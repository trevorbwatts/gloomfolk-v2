import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Card,
  CardHalf,
  HalfSlot,
  Hex,
  ModifierDrawResult,
  MonsterTurnAnim,
  PendingAction,
  PrivatePlayerState,
  PublicGameState,
  Unit,
} from '@gloomfolk/shared';
import {
  bfsForcedMove,
  bfsForcedMovePath,
  bfsPath,
  bfsPathJump,
  bfsReachable,
  bfsReachableJump,
  hasLineOfSight,
  hexDistance,
  hexEqual,
  hexKey,
  modifierLabel,
  rotateHexN,
} from '@gloomfolk/shared';
import { HexBoard } from '../board/HexBoard.js';
import { useMoveAnim } from '../board/useMoveAnim.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { BOTTOM_BAR_HEIGHT } from './BottomBar.js';

const unitAvatarUrl = (u: Unit) =>
  u.kind === 'monster' ? monsterAvatarUrl(u.defId) : classAvatarUrl(u.defId);
import { useSocket } from '../net/useSocket.js';
import { GameIcon, type IconKey } from '../icons.js';

const cap = (s: string): string => s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
import { btn, theme } from '../theme.js';
import { CardView, HalfView, type CardElementContext } from './CardView.js';
import { CardsOverview } from './Hand.js';

export function TurnPlay({
  gameState,
  myPlayerId,
  you,
}: {
  gameState: PublicGameState;
  myPlayerId: string;
  you: PrivatePlayerState | null;
}) {
  const cur = gameState.turnOrder[gameState.activeTurnIndex];
  const isMyTurn = cur?.kind === 'player' && cur.playerId === myPlayerId;
  const ct = gameState.currentTurn;
  const myUnit = useMemo(
    () => gameState.units.find((u) => u.ownerPlayerId === myPlayerId) ?? null,
    [gameState.units, myPlayerId],
  );
  const { moveAnim, onMoveAnimDone } = useMoveAnim(gameState.lastMove);

  if (!isMyTurn || !ct) {
    const sel = you?.selection;
    const selectedCards = sel?.kind === 'cards' && you
      ? [sel.leadingId, sel.secondId]
          .map((id) => you.hand.find((c) => c.id === id))
          .filter((c): c is Card => !!c)
      : [];

    return (
      <div>
        {gameState.monsterTurnAnim ? (
          <MonsterTurnBanner anim={gameState.monsterTurnAnim} units={gameState.units} />
        ) : (
          <p style={{ color: theme.muted }}>
            {cur?.kind === 'player'
              ? `Waiting on ${gameState.players.find((p) => p.playerId === cur.playerId)?.name ?? 'player'}…`
              : cur?.kind === 'monster-group'
                ? `${cur.abilityCardName} — monster turn`
                : 'No active turn.'}
          </p>
        )}
        <HexBoard
          tiles={gameState.tiles}
          units={gameState.units}
          moneyTokens={gameState.moneyTokens}
          size={20}
          maxWidthPx={400}
          activeUnitIds={cur?.kind === 'player' ? [cur.unitId] : []}
          unitAvatarUrl={unitAvatarUrl}
          moveAnim={moveAnim}
          onMoveAnimDone={onMoveAnimDone}
          monsterTurnAnim={gameState.monsterTurnAnim}
        />
        {selectedCards.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 12, color: theme.muted, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: theme.headingFont }}>Your cards this round</h3>
            {selectedCards.map((c) => (
              <CardView key={c.id} card={c} />
            ))}
          </div>
        )}
        {you && <CardsOverview you={you} />}
      </div>
    );
  }

  const activeSlot: HalfSlot | null =
    ct.activeSlot === 'top' ? ct.topSlot : ct.activeSlot === 'bottom' ? ct.bottomSlot : null;
  const activeSlotKind: 'top' | 'bottom' | null = activeSlot ? ct.activeSlot : null;

  return (
    <ActionDriver
      gameState={gameState}
      myPlayerId={myPlayerId}
      ct={ct}
      activeSlot={activeSlot}
      activeSlotKind={activeSlotKind}
      myUnit={myUnit}
      you={you}
      moveAnim={moveAnim}
      onMoveAnimDone={onMoveAnimDone}
    />
  );
}

function isTargetedActionType(t: PendingAction['type']): boolean {
  return (
    t === 'move' ||
    t === 'attack' ||
    t === 'attack-aoe' ||
    t === 'push' ||
    t === 'pull' ||
    t === 'apply-condition'
  );
}

/** A target the player has tapped but not yet confirmed. Different action
 *  types stage different shapes; the bottom bar reads from this to render
 *  Confirm/Cancel and the description. */
type PendingTarget =
  | { kind: 'attack'; unit: Unit }
  | { kind: 'condition'; unit: Unit }
  | { kind: 'aoe'; hex: Hex }
  | { kind: 'forced-move'; destination: Hex; path: Hex[] };

function ActionDriver({
  gameState,
  myPlayerId,
  ct,
  activeSlot,
  activeSlotKind,
  myUnit,
  you,
  moveAnim,
  onMoveAnimDone,
}: {
  gameState: PublicGameState;
  myPlayerId: string;
  ct: NonNullable<PublicGameState['currentTurn']>;
  activeSlot: HalfSlot | null;
  activeSlotKind: 'top' | 'bottom' | null;
  myUnit: Unit | null;
  you: PrivatePlayerState | null;
  moveAnim: { unitId: string; steps: Hex[] } | null;
  onMoveAnimDone: () => void;
}) {
  const sock = useSocket();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  /** For push/pull: the target unit chosen first; destination tap follows. */
  const [forcedMoveTargetId, setForcedMoveTargetId] = useState<string | null>(null);
  /** Staged target awaiting Confirm. Set when the player taps an enemy/hex
   *  in the relevant target mode; cleared on Cancel, Confirm, or when the
   *  active action changes. */
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null);

  // Reset selection when the active slot changes (e.g., after finishing a half).
  const slotSig = `${activeSlotKind}|${activeSlot?.cardId ?? ''}`;
  useEffect(() => {
    setSelectedActionId(null);
    setForcedMoveTargetId(null);
    setPendingTarget(null);
  }, [slotSig]);

  const firstPending = activeSlot?.actions.find((a) => !a.done) ?? null;
  const firstPendingId = firstPending?.id ?? null;
  const firstPendingIsTargeted = !!firstPending && isTargetedActionType(firstPending.type);

  // Auto-enter target mode for the next targeted action so the player
  // doesn't have to tap "Perform" — moving straight from card-half choice
  // into picking a destination/target.
  useEffect(() => {
    if (firstPendingId && firstPendingIsTargeted) {
      setSelectedActionId(firstPendingId);
    } else {
      setSelectedActionId(null);
    }
    setForcedMoveTargetId(null);
    setPendingTarget(null);
  }, [firstPendingId, firstPendingIsTargeted]);

  const selectedAction =
    activeSlot?.actions.find((a) => a.id === selectedActionId && !a.done) ?? null;

  // End-turn bar appears when both halves are effectively done: either the
  // active half has all actions ticked off and the other half is `done`, or
  // both halves are already `done` (no active slot).
  const otherSlotDone =
    activeSlotKind === 'top'
      ? ct.bottomSlot.status === 'done'
      : activeSlotKind === 'bottom'
        ? ct.topSlot.status === 'done'
        : false;
  const activeAllDone =
    !!activeSlot && activeSlot.actions.length > 0 && activeSlot.actions.every((a) => a.done);
  const showEndTurn =
    (activeAllDone && otherSlotDone) ||
    (!activeSlot && ct.topSlot.status === 'done' && ct.bottomSlot.status === 'done');

  // Persistent-tracked (or other persistent) half with an empty engage queue
  // — all its steps are deferred to fire on a trigger. Needs an explicit
  // Confirm gesture (→ routes to active) or Skip (→ card discards). The bar
  // is rendered near the end of the page so it doesn't fight ActionBottomBar
  // or EndTurnBar.
  const activeCard =
    activeSlot && !activeSlot.useBasic && activeSlot.cardId && you
      ? you.hand.find((c) => c.id === activeSlot.cardId) ?? null
      : null;
  const activeHalf =
    activeCard && activeSlotKind ? (activeSlotKind === 'top' ? activeCard.top : activeCard.bottom) : null;
  const isPersistentEmpty =
    !!activeSlot &&
    activeSlot.actions.length === 0 &&
    !!activeHalf &&
    (activeHalf.disposition === 'persistent-tracked' ||
      activeHalf.disposition === 'persistent-round' ||
      activeHalf.disposition === 'persistent-scenario');

  const confirmPendingTarget = () => {
    if (!pendingTarget || !selectedAction || !activeSlotKind) return;
    if (pendingTarget.kind === 'attack') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: pendingTarget.unit.id },
      });
    } else if (pendingTarget.kind === 'condition') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: pendingTarget.unit.id },
      });
    } else if (pendingTarget.kind === 'aoe') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { hex: pendingTarget.hex },
      });
    } else if (pendingTarget.kind === 'forced-move' && forcedMoveTargetId) {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: {
          unitId: forcedMoveTargetId,
          hex: pendingTarget.destination,
          path: pendingTarget.path,
        },
      });
    }
    setPendingTarget(null);
    // For multi-target attacks the action stays not-done and we keep targeting.
    // Other actions complete and selectedActionId gets reset by the effect above.
    if (selectedAction.type !== 'attack' || selectedAction.targetsRemaining <= 1) {
      setSelectedActionId(null);
      setForcedMoveTargetId(null);
    }
  };

  const targetSummary = useMemo<ReactNode>(() => {
    if (!pendingTarget || !selectedAction) return '';
    switch (pendingTarget.kind) {
      case 'attack':
        return (
          <>
            <strong><GameIcon kind="attack" /> Attack {selectedAction.type === 'attack' ? selectedAction.amount : ''}</strong>
            {' on '}
            <strong>{pendingTarget.unit.name}</strong>
          </>
        );
      case 'condition':
        return selectedAction.type === 'apply-condition' ? (
          <>
            <strong>Apply <GameIcon kind={selectedAction.condition} /> {cap(selectedAction.condition)}</strong>
            {' to '}
            <strong>{pendingTarget.unit.name}</strong>
          </>
        ) : (
          <>
            {'Apply to '}
            <strong>{pendingTarget.unit.name}</strong>
          </>
        );
      case 'aoe':
        return <strong>Attack the highlighted hex</strong>;
      case 'forced-move':
        return selectedAction.type === 'push' || selectedAction.type === 'pull'
          ? <strong><GameIcon kind={selectedAction.type} /> {selectedAction.type === 'push' ? 'Push' : 'Pull'} target</strong>
          : <strong>Confirm move</strong>;
    }
  }, [pendingTarget, selectedAction]);

  return (
    <div>
      <h2 style={{ marginBottom: 10, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>Your turn</h2>

      {activeSlot && activeSlotKind ? (
        <ActiveHalfPanel
          slot={activeSlot}
          slotKind={activeSlotKind}
          you={you}
          selectedActionId={selectedActionId}
          onSelect={(actionId) => {
            const action = activeSlot.actions.find((a) => a.id === actionId);
            if (!action || action.done) return;
            // Targeted actions are auto-selected by ActionDriver; this handler
            // is only invoked for non-targeted "Apply" actions, which fire now.
            sock.send({ type: 'player_perform_action', slot: activeSlotKind, actionId });
          }}
          onSkip={(actionId) => {
            sock.send({ type: 'player_skip_action', slot: activeSlotKind, actionId });
            if (selectedActionId === actionId) {
              setSelectedActionId(null);
              setForcedMoveTargetId(null);
              setPendingTarget(null);
            }
          }}
        />
      ) : (
        <SlotPicker ct={ct} you={you} />
      )}

      <ElementChoicePrompt
        choice={gameState.pendingElementChoice}
        myPlayerId={myPlayerId}
      />

      {/* ActiveArea has moved up under the sticky PlayerHeader (see
          PlayerScreen.tsx) so the persistent state is always visible. */}

      {selectedAction && (selectedAction.type === 'push' || selectedAction.type === 'pull') && !pendingTarget && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          {forcedMoveTargetId
            ? <>Tap a destination hex to <GameIcon kind={selectedAction.type} /> {cap(selectedAction.type)} the target.</>
            : <>Tap an enemy in <GameIcon kind="range" /> Range {selectedAction.range} to <GameIcon kind={selectedAction.type} /> {cap(selectedAction.type)}.</>}
        </p>
      )}
      {selectedAction?.type === 'apply-condition' && !pendingTarget && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Tap an enemy to apply <strong><GameIcon kind={selectedAction.condition} /> {cap(selectedAction.condition)}</strong>.
        </p>
      )}
      {selectedAction?.type === 'attack-aoe' && !pendingTarget && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Tap or drag across the highlighted hexes to aim the AOE pattern.
        </p>
      )}
      {selectedAction?.type === 'attack-aoe' && pendingTarget?.kind === 'aoe' && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Drag to rotate the pattern, then tap Confirm.
        </p>
      )}
      {selectedAction?.type === 'attack' && selectedAction.targets > 1 && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Multi-target: <strong>{selectedAction.targetsRemaining}</strong> of {selectedAction.targets} shots remaining.
        </p>
      )}

      {activeSlot && (
        <BoardForTurn
          gameState={gameState}
          myUnit={myUnit}
          activeSlotKind={activeSlotKind}
          selectedAction={selectedAction}
          forcedMoveTargetId={forcedMoveTargetId}
          onPickForcedMoveTarget={(id) => setForcedMoveTargetId(id)}
          pendingTarget={pendingTarget}
          onStageTarget={setPendingTarget}
          onConsumeSelection={() => {
            setSelectedActionId(null);
            setForcedMoveTargetId(null);
            setPendingTarget(null);
          }}
          moveAnim={moveAnim}
          onMoveAnimDone={onMoveAnimDone}
        />
      )}

      {/* Spacer so content doesn't sit under the fixed action bar. */}
      {(pendingTarget || showEndTurn || isPersistentEmpty) && <div style={{ height: 80 }} />}

      <ActionBottomBar
        targetSummary={targetSummary}
        hasPendingTarget={!!pendingTarget}
        hideSkip={pendingTarget?.kind === 'forced-move'}
        onConfirm={confirmPendingTarget}
        onSkip={() => {
          // Skip the underlying action: send the skip message and clear any
          // local target/forced-move state so the action row updates and the
          // bar dismisses.
          if (selectedActionId && activeSlotKind) {
            sock.send({
              type: 'player_skip_action',
              slot: activeSlotKind,
              actionId: selectedActionId,
            });
          }
          setSelectedActionId(null);
          setForcedMoveTargetId(null);
          setPendingTarget(null);
        }}
      />

      {showEndTurn && !pendingTarget && !isPersistentEmpty && (
        <EndTurnBar onEndTurn={() => sock.send({ type: 'end_turn' })} />
      )}

      {isPersistentEmpty && activeSlotKind && activeCard && !pendingTarget && (
        <PersistentConfirmBar
          cardName={activeCard.name}
          onConfirm={() =>
            sock.send({ type: 'player_confirm_persistent_half', slot: activeSlotKind })
          }
          onSkip={() => sock.send({ type: 'player_finish_half', slot: activeSlotKind })}
        />
      )}

      <ModifierFlipOverlay draws={ct.lastModifierDraws} />
    </div>
  );
}

function EndTurnBar({ onEndTurn }: { onEndTurn: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: BOTTOM_BAR_HEIGHT,
        background: theme.bgSolid,
        borderTop: `1px solid ${theme.border}`,
        zIndex: 55,
      }}
    >
      <div style={{ padding: '10px 14px', display: 'flex' }}>
        <button
          onClick={onEndTurn}
          style={{ ...btn.primary(false), flex: 1, padding: '10px 16px', fontSize: 14 }}
        >
          End Turn
        </button>
      </div>
    </div>
  );
}

function ActionBottomBar({
  targetSummary,
  hasPendingTarget,
  hideSkip = false,
  onConfirm,
  onSkip,
}: {
  targetSummary: ReactNode;
  hasPendingTarget: boolean;
  /** True for forced-move (push/pull) resolution — there's no "skip" option
   *  once the player has committed to the move and the only way out is to
   *  confirm a destination. */
  hideSkip?: boolean;
  onConfirm: () => void;
  /** Skip the underlying action entirely — sends player_skip_action and
   *  clears any staged target. Replaces the previous "Cancel" (which only
   *  un-staged the target). */
  onSkip: () => void;
}) {
  if (!hasPendingTarget) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: BOTTOM_BAR_HEIGHT,
        background: theme.bgSolid,
        borderTop: `1px solid ${theme.border}`,
        zIndex: 55,
      }}
    >
      <div
        style={{
          padding: '6px 14px',
          color: theme.text,
          fontSize: 14,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        {targetSummary}
      </div>
      <div
        style={{
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {!hideSkip && (
          <button onClick={onSkip} style={{ ...btn.ghost(), flex: 1, padding: '6px 14px', fontSize: 13 }}>
            Skip
          </button>
        )}
        <button onClick={onConfirm} style={{ ...btn.primary(false), flex: 1, padding: '6px 18px', fontSize: 14 }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

/** Tracks which modifier draws have already been shown; pops a centered
 *  overlay with the flip animation + result when new draws arrive (e.g.
 *  after the player confirms an attack). */
function ModifierFlipOverlay({ draws }: { draws: ModifierDrawResult[] }) {
  const shownRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ModifierDrawResult[] | null>(null);

  useEffect(() => {
    const fresh = draws.filter((d) => !shownRef.current.has(d.id));
    if (fresh.length === 0) return;
    for (const d of fresh) shownRef.current.add(d.id);
    setActive(fresh);
  }, [draws]);

  if (!active) return null;
  return (
    <div
      role="dialog"
      aria-label="Attack result"
      onClick={() => setActive(null)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 20,
          maxWidth: 360,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            fontFamily: theme.headingFont,
          }}
        >
          Attack modifier
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {active.map((d) => (
            <FlipCard key={d.id} draw={d} />
          ))}
        </div>
        <button
          onClick={() => setActive(null)}
          style={{ ...btn.primary(false), padding: '8px 22px', fontSize: 14, marginTop: 4 }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

function FlipCard({ draw }: { draw: ModifierDrawResult }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 80);
    return () => clearTimeout(t);
  }, []);
  const label = modifierLabel(draw.card);
  const isCrit = draw.card.kind === 'crit';
  const isNull = draw.card.kind === 'null';
  const accent = isCrit ? theme.accent : isNull ? theme.bad : theme.border;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
      <div style={{ width: 80, height: 110, perspective: 800 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transition: 'transform 450ms ease-out',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: theme.panelRaised,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: theme.panelRaised,
              border: `2px solid ${accent}`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: label.length > 2 ? 20 : 32,
              fontFamily: theme.headingFont,
              color: isCrit ? theme.accent : isNull ? theme.bad : theme.text,
            }}
          >
            {label}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 11, color: theme.muted, textAlign: 'center' }}>{draw.targetName}</span>
      <span style={{ fontSize: 12, color: theme.muted }}>
        {draw.baseAmount} → <strong style={{ color: theme.text }}>{draw.finalAmount}</strong>
        {draw.damageDealt !== draw.finalAmount && (
          <span style={{ color: theme.muted }}> ({draw.damageDealt} dealt)</span>
        )}
      </span>
    </div>
  );
}

function SlotChip({
  label,
  slot,
  you,
}: {
  label: string;
  slot: HalfSlot;
  you: PrivatePlayerState | null;
}) {
  const card = slot.cardId && you ? you.hand.find((c) => c.id === slot.cardId) : null;
  let txt = `${label}: —`;
  let bg = theme.panel;
  let borderColor = theme.border;
  if (slot.status === 'engaged') {
    txt = `${label}: ${slot.useBasic ? 'Basic' : (card?.name ?? '?')}`;
    bg = 'rgba(217, 164, 65, 0.12)';
    borderColor = theme.accent;
  } else if (slot.status === 'done') {
    txt = `${label}: ${slot.useBasic ? 'Basic' : (card?.name ?? '?')} ✓`;
    bg = 'rgba(123, 185, 107, 0.12)';
    borderColor = theme.good;
  }
  return (
    <span style={{ padding: '4px 8px', borderRadius: 4, background: bg, border: `1px solid ${borderColor}`, color: theme.text }}>
      {txt}
    </span>
  );
}

/** Sticky bar showing the player's persistent state — active cards (with
 *  use-slot circles for persistent-tracked) and active effects. Rendered in
 *  PlayerScreen.tsx, pinned directly under the sticky PlayerHeader. */
export function ActiveArea({ you }: { you: PrivatePlayerState }) {
  if (you.active.length === 0 && you.activeEffects.length === 0) return null;
  return (
    <div
      style={{
        padding: '6px 12px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.panel,
        fontSize: 12,
      }}
    >
      <div style={{ color: theme.muted, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: theme.headingFont }}>
        Active area
      </div>
      {you.active.map((c) => {
        const tracked = you.activeTracked.find((t) => t.cardId === c.id);
        return (
          <div key={c.id} style={{ marginBottom: 2, color: theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{c.name}</strong>
            {tracked && (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {Array.from({ length: tracked.trackedUses }).map((_, i) => {
                  const slotIdx = i + 1;
                  const used = slotIdx < tracked.currentSlot;
                  return (
                    <span
                      key={i}
                      title={`slot ${slotIdx}${slotIdx === tracked.currentSlot ? ' (current)' : used ? ' (used)' : ''}`}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: used ? theme.muted : slotIdx === tracked.currentSlot ? theme.accent : 'transparent',
                        border: `1px solid ${theme.border}`,
                        opacity: used ? 0.4 : 1,
                      }}
                    />
                  );
                })}
                <span style={{ marginLeft: 4, color: theme.muted, fontSize: 11 }}>
                  on {tracked.persistentTrigger.kind.replace(/-/g, ' ')}
                </span>
              </span>
            )}
          </div>
        );
      })}
      {you.activeEffects.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {you.activeEffects.map((e) => (
            <span
              key={e.id}
              style={{
                display: 'inline-block',
                marginRight: 6,
                padding: '2px 6px',
                background: theme.panelRaised,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: 3,
              }}
            >
              {effectLabel(e)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function effectLabel(e: PrivatePlayerState['activeEffects'][number]): string {
  switch (e.kind) {
    case 'move-bonus':
      return `+${e.amount} move`;
    case 'attack-bonus': {
      const exp =
        e.expires === 'next-attack'
          ? 'next atk'
          : e.expires === 'end-scenario'
            ? 'scenario'
            : 'this round';
      const k = e.attackKind ? ` ${e.attackKind}` : '';
      const p = e.pierceBonus > 0 ? ` +${e.pierceBonus} pierce` : '';
      return `+${e.amount} atk${k} (${exp})${p}`;
    }
    case 'retaliate':
      return `Retaliate ${e.amount}${e.range > 1 ? ` r${e.range}` : ''}`;
  }
}

function elementContextFor(
  ct: NonNullable<PublicGameState['currentTurn']>,
): CardElementContext {
  return {
    board: ct.turnStartElementBoard, // not actually used downstream right now
    turnStartBoard: ct.turnStartElementBoard,
    consumedThisTurn: new Set(ct.consumedThisTurn),
  };
}

function ElementChoicePrompt({
  choice,
  myPlayerId,
}: {
  choice: PublicGameState['pendingElementChoice'];
  myPlayerId: string;
}) {
  const sock = useSocket();
  if (!choice) return null;
  const ctx = choice.context;
  // For player-scoped choices, only the named player sees the prompt.
  if (ctx.kind === 'create-element' || ctx.kind === 'consume-rider') {
    if (ctx.playerId !== myPlayerId) return null;
  }
  // (Monster contexts are routed to the host today; players ignore them.)
  if (ctx.kind === 'monster-infuse' || ctx.kind === 'monster-consume') return null;
  return (
    <div
      style={{
        margin: '8px 0',
        padding: '10px 12px',
        background: 'rgba(217, 164, 65, 0.10)',
        border: `1px solid ${theme.accent}`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: theme.accent,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {choice.prompt}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {choice.options.map((e) => (
          <button
            key={e}
            onClick={() =>
              sock.send({ type: 'player_resolve_element_choice', choiceId: choice.id, element: e })
            }
            style={{
              ...btn.ghost(),
              padding: '6px 10px',
              fontSize: 12,
              textTransform: 'capitalize',
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function SlotPicker({
  ct,
  you,
}: {
  ct: NonNullable<PublicGameState['currentTurn']>;
  you: PrivatePlayerState | null;
}) {
  const sock = useSocket();
  const sel = you?.selection;
  if (!sel || sel.kind !== 'cards' || !you) return null;

  // When both slots are done the fixed End Turn bar above the app bar handles
  // ending the turn — render nothing here.
  if (ct.topSlot.status === 'done' && ct.bottomSlot.status === 'done') {
    return null;
  }

  const cardIds = [sel.leadingId, sel.secondId];
  const committedIds = new Set(
    [ct.topSlot.cardId, ct.bottomSlot.cardId].filter((x): x is string => Boolean(x)),
  );
  const availableCardIds = cardIds.filter((id) => !committedIds.has(id));

  const allowedSlots: ('top' | 'bottom')[] = [];
  if (ct.topSlot.status === 'unlocked') allowedSlots.push('top');
  if (ct.bottomSlot.status === 'unlocked') allowedSlots.push('bottom');

  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 6px', fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500, fontSize: 16 }}>
        {allowedSlots.length === 2 ? 'Choose any half to perform' : `Choose your ${allowedSlots[0]} action`}
      </h3>
      {availableCardIds.map((cid) => {
        const card = you.hand.find((c) => c.id === cid);
        if (!card) return null;
        return (
          <CardHalfChoices
            key={cid}
            card={card}
            allowedSlots={allowedSlots}
            elementContext={elementContextFor(ct)}
            onEngage={(slot, useBasic) =>
              sock.send({ type: 'player_engage_half', slot, cardId: cid, useBasic })
            }
            onSkip={(slot) => sock.send({ type: 'player_skip_half', slot, cardId: cid })}
          />
        );
      })}
    </div>
  );
}

function HalfActions({
  label,
  basicLabel,
  onEngage,
  onSkip,
}: {
  label: string;
  basicLabel: string;
  onEngage: (useBasic: boolean) => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, paddingTop: 8 }}>
      <button
        style={{ ...btn.primary(false), flex: 1, padding: '8px 10px', fontSize: 13 }}
        onClick={() => onEngage(false)}
      >
        Use {label.toLowerCase()}
      </button>
      <button
        style={{ ...btn.ghost(), padding: '8px 10px', fontSize: 11 }}
        onClick={() => onEngage(true)}
      >
        {basicLabel}
      </button>
      <button
        style={{ ...btn.ghost(), padding: '8px 10px', fontSize: 11 }}
        onClick={onSkip}
      >
        Skip
      </button>
    </div>
  );
}

function CardHalfChoices({
  card,
  allowedSlots,
  onEngage,
  onSkip,
  elementContext,
}: {
  card: Card;
  allowedSlots: ('top' | 'bottom')[];
  onEngage: (slot: 'top' | 'bottom', useBasic: boolean) => void;
  onSkip: (slot: 'top' | 'bottom') => void;
  elementContext: CardElementContext | null;
}) {
  return (
    <div
      style={{
        textAlign: 'left',
        background: theme.panel,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
        padding: '16px 18px',
        margin: '8px 0',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: theme.font,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
          {card.level} · {card.name}
        </span>
        <span style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
          {String(card.initiative).padStart(2, '0')}
        </span>
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.35 }}>
        {allowedSlots.includes('top') && (
          <div>
            <HalfView half={card.top} elementContext={elementContext} />
            <HalfActions
              label="Top"
              basicLabel="Basic Attack 2"
              onEngage={(useBasic) => onEngage('top', useBasic)}
              onSkip={() => onSkip('top')}
            />
          </div>
        )}
        {allowedSlots.includes('top') && allowedSlots.includes('bottom') && (
          <div
            style={{
              borderTop: `2px solid ${theme.border}`,
              margin: '16px -18px 4px',
            }}
          />
        )}
        {allowedSlots.includes('bottom') && (
          <div>
            <HalfView half={card.bottom} elementContext={elementContext} />
            <HalfActions
              label="Bottom"
              basicLabel="Basic Move 2"
              onEngage={(useBasic) => onEngage('bottom', useBasic)}
              onSkip={() => onSkip('bottom')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveHalfPanel({
  slot,
  slotKind,
  you,
  selectedActionId,
  onSelect,
  onSkip,
}: {
  slot: HalfSlot;
  slotKind: 'top' | 'bottom';
  you: PrivatePlayerState | null;
  selectedActionId: string | null;
  onSelect: (actionId: string) => void;
  onSkip: (actionId: string) => void;
}) {
  const card = slot.cardId && you ? you.hand.find((c) => c.id === slot.cardId) ?? null : null;
  const firstPendingId = slot.actions.find((a) => !a.done)?.id ?? null;
  const cardLabel = slot.useBasic
    ? `Basic ${slotKind === 'top' ? 'Attack 2' : 'Move 2'}`
    : card?.name ?? '?';
  // Persistent halves with deferred-only steps (e.g. Warding Strength bottom:
  // Shield + Retaliate that fire on attack-targets-self) produce an empty
  // engage queue. Show an explicit Confirm/Skip panel instead of the empty
  // ActionRow list, since there's nothing to tap otherwise.
  const halfData =
    card && !slot.useBasic ? (slotKind === 'top' ? card.top : card.bottom) : null;
  const isPersistentEmpty =
    !!halfData &&
    slot.actions.length === 0 &&
    (halfData.disposition === 'persistent-tracked' ||
      halfData.disposition === 'persistent-round' ||
      halfData.disposition === 'persistent-scenario');

  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: theme.text }}>
        Performing <strong>{slotKind}</strong>: {cardLabel}
      </p>
      {isPersistentEmpty && halfData ? (
        <PersistentConfirmPanel half={halfData} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {slot.actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              slotKind={slotKind}
              isNext={a.id === firstPendingId}
              selected={selectedActionId === a.id}
              onSelect={() => onSelect(a.id)}
              onSkip={() => onSkip(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Triggered persistent halves (e.g. Warding Strength bottom) have no engage
 *  queue — all their steps are deferred to fire on a trigger. The player still
 *  needs an explicit gesture to commit (Confirm → routes to active) or skip
 *  (→ card discards). The Confirm/Skip buttons live in PersistentConfirmBar
 *  (fixed to the bottom, matching the targeted-action ActionBottomBar
 *  pattern); this panel just renders the half exactly as it appears on the
 *  card during selection — trigger sentence with icons, the row of use-slot
 *  circles with arrows, and the disposition label. */
function PersistentConfirmPanel({ half }: { half: CardHalf }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <HalfView half={half} />
    </div>
  );
}

/** Bottom-pinned Confirm/Skip bar for a persistent-tracked half whose engage
 *  queue is empty. Mirrors ActionBottomBar so the gesture matches attack/move
 *  confirmation. Skip sends player_finish_half (no credit → card discards). */
function PersistentConfirmBar({
  cardName,
  onConfirm,
  onSkip,
}: {
  cardName: string;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: BOTTOM_BAR_HEIGHT,
        background: theme.bgSolid,
        borderTop: `1px solid ${theme.border}`,
        zIndex: 55,
      }}
    >
      <div
        style={{
          padding: '6px 14px',
          color: theme.text,
          fontSize: 14,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        Activate <strong>{cardName}</strong>?
      </div>
      <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onSkip}
          style={{ ...btn.ghost(), flex: 1, padding: '6px 14px', fontSize: 13 }}
        >
          Skip
        </button>
        <button
          onClick={onConfirm}
          style={{ ...btn.primary(false), flex: 1, padding: '6px 18px', fontSize: 14 }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  action,
  slotKind,
  isNext,
  selected,
  onSelect,
  onSkip,
}: {
  action: PendingAction;
  slotKind: 'top' | 'bottom';
  isNext: boolean;
  selected: boolean;
  onSelect: () => void;
  onSkip: () => void;
}) {
  const sock = useSocket();
  const label = actionLabel(action);
  const needsTarget = isTargetedActionType(action.type);
  const supported = action.type !== 'unsupported';
  const showButtons = isNext && !action.done;
  const bgDone = action.done
    ? 'rgba(123, 185, 107, 0.10)'
    : selected
      ? 'rgba(217, 164, 65, 0.14)'
      : theme.panel;
  const borderCol = selected ? theme.accent : action.done ? theme.good : theme.border;
  const consumeOffers =
    (action.type === 'attack' || action.type === 'attack-aoe') ? action.consumeOffers : [];
  const acceptedSet = new Set(
    (action.type === 'attack' || action.type === 'attack-aoe') ? action.acceptedConsumeIndices : [],
  );
  const consumesLocked =
    (action.type === 'attack' || action.type === 'attack-aoe') && action.consumesLocked;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '6px 8px',
          background: bgDone,
          borderRadius: 4,
          border: `1px solid ${borderCol}`,
          color: theme.text,
          opacity: action.done ? 0.65 : isNext ? 1 : 0.5,
        }}
      >
        <span style={{ flex: 1, fontSize: 13 }}>
          {label} {action.done ? '✓' : ''}
        </span>
        {showButtons && supported && !needsTarget && (
          <button onClick={onSelect} style={{ ...btn.primary(false), padding: '4px 12px', fontSize: 11 }}>
            Apply
          </button>
        )}
        {showButtons && (
          <button onClick={onSkip} style={{ ...btn.ghost(), padding: '4px 10px', fontSize: 11 }}>
            Skip
          </button>
        )}
      </div>
      {showButtons && consumeOffers.length > 0 && !consumesLocked && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '6px 8px',
            marginTop: 4,
            background: 'rgba(217, 164, 65, 0.06)',
            border: `1px dashed ${theme.border}`,
            borderRadius: 4,
            fontSize: 11,
            color: theme.muted,
          }}
        >
          <span style={{ alignSelf: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Consume?
          </span>
          {consumeOffers.map((offer) => {
            const accepted = acceptedSet.has(offer.riderIndex);
            const bonusBits: string[] = [];
            if (offer.attackBonus) bonusBits.push(`+${offer.attackBonus} atk`);
            if (offer.pierceBonus) bonusBits.push(`+${offer.pierceBonus} pierce`);
            if (offer.gainExp) bonusBits.push(`+${offer.gainExp} XP`);
            return (
              <button
                key={offer.riderIndex}
                onClick={() =>
                  sock.send({
                    type: 'player_toggle_consume_rider',
                    slot: slotKind,
                    actionId: action.id,
                    riderIndex: offer.riderIndex,
                  })
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                  background: accepted ? theme.accent : 'transparent',
                  color: accepted ? '#0e1612' : theme.text,
                  border: `1px solid ${accepted ? theme.accent : theme.border}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: theme.font,
                }}
              >
                {offer.consumes.join(' + ')} → {bonusBits.join(', ') || 'effect'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function amountSuffix(a: { amountRef?: { kind: string } }): string {
  if (!a.amountRef) return '';
  if (a.amountRef.kind === 'hexes-moved-this-turn') return ' (X = hexes moved this turn)';
  if (a.amountRef.kind === 'damage-dealt-this-turn') return ' (X = damage dealt this turn)';
  if (a.amountRef.kind === 'target-shield-value') return ' (X = target shield)';
  return ' (X)';
}

function withActionIcon(kind: IconKey, label: ReactNode): ReactNode {
  return (
    <>
      <GameIcon kind={kind} /> {label}
    </>
  );
}

function actionLabel(a: PendingAction): ReactNode {
  switch (a.type) {
    case 'move':
      return withActionIcon(
        a.jump ? 'jump' : 'move',
        `${a.jump ? 'Jump' : 'Move'} ${a.amount}${amountSuffix(a)}`,
      );
    case 'attack': {
      const t = a.targets > 1 ? ` · ${a.targetsRemaining}/${a.targets} targets` : '';
      const range: ReactNode = a.range > 1
        ? <> · <GameIcon kind="range" /> Range {a.range}</>
        : null;
      const pierce: ReactNode = a.pierce > 0
        ? <> · <GameIcon kind="pierce" /> Pierce {a.pierce}</>
        : null;
      return (
        <>
          <GameIcon kind="attack" /> Attack {a.amount}{range}{pierce}{t}{amountSuffix(a)}
        </>
      );
    }
    case 'attack-aoe': {
      const pierce: ReactNode = a.pierce > 0
        ? <> · <GameIcon kind="pierce" /> Pierce {a.pierce}</>
        : null;
      return (
        <>
          <GameIcon kind="attack" /> AOE Attack {a.amount}{pierce}{amountSuffix(a)}
        </>
      );
    }
    case 'heal':
      return withActionIcon('heal', `Heal ${a.amount}${a.selfOnly ? ' (self)' : ''}`);
    case 'shield':
      return withActionIcon('shield', `Shield ${a.amount}`);
    case 'push':
      return (
        <>
          <GameIcon kind="push" /> Push {a.amount}
          {a.range > 1 && <> · <GameIcon kind="range" /> Range {a.range}</>}
        </>
      );
    case 'pull':
      return (
        <>
          <GameIcon kind="pull" /> Pull {a.amount}
          {a.range > 1 && <> · <GameIcon kind="range" /> Range {a.range}</>}
        </>
      );
    case 'apply-condition':
      return (
        <>
          <GameIcon kind={a.condition} /> Apply {cap(a.condition)}
          {a.range > 1 && <> · <GameIcon kind="range" /> Range {a.range}</>}
        </>
      );
    case 'modify-future-move':
      return (
        <>
          +{a.amount} <GameIcon kind="move" /> Move (persistent
          {a.expires === 'end-scenario' ? ' scenario' : ''})
        </>
      );
    case 'modify-future-attack': {
      const exp =
        a.expires === 'next-attack'
          ? 'next attack'
          : a.expires === 'end-scenario'
            ? 'scenario'
            : 'this round';
      const kind = a.attackKind ? ` · ${a.attackKind}` : '';
      const pierce: ReactNode = a.pierceBonus > 0
        ? <> · +{a.pierceBonus} <GameIcon kind="pierce" /> Pierce</>
        : null;
      return (
        <>
          +{a.amount} <GameIcon kind="attack" /> Attack ({exp}){kind}{pierce}
        </>
      );
    }
    case 'grant-retaliate':
      return (
        <>
          <GameIcon kind="retaliate" /> Retaliate {a.amount}
          {a.range > 1 && <> · <GameIcon kind="range" /> Range {a.range}</>}
        </>
      );
    case 'become-invisible':
      return withActionIcon('invisible', 'Become Invisible');
    case 'unsupported':
      return `${a.description} (not supported yet)`;
  }
}

function BoardForTurn({
  gameState,
  myUnit,
  activeSlotKind,
  selectedAction,
  forcedMoveTargetId,
  onPickForcedMoveTarget,
  pendingTarget,
  onStageTarget,
  onConsumeSelection,
  moveAnim,
  onMoveAnimDone,
}: {
  gameState: PublicGameState;
  myUnit: Unit | null;
  activeSlotKind: 'top' | 'bottom' | null;
  selectedAction: PendingAction | null;
  forcedMoveTargetId: string | null;
  onPickForcedMoveTarget: (unitId: string) => void;
  pendingTarget: PendingTarget | null;
  onStageTarget: (target: PendingTarget | null) => void;
  onConsumeSelection: () => void;
  moveAnim: { unitId: string; steps: Hex[] } | null;
  onMoveAnimDone: () => void;
}) {
  const sock = useSocket();

  /** Preview path for a Move action — ordered hexes excluding start. Empty
      while the player hasn't picked a destination yet; cleared on cancel,
      confirm, or when the selected action changes. */
  const [movePath, setMovePath] = useState<Hex[]>([]);
  // Reset preview when the action being driven changes.
  const moveActionSig =
    selectedAction?.type === 'move' ? `${selectedAction.id}|${selectedAction.amount}` : null;
  useEffect(() => {
    setMovePath([]);
  }, [moveActionSig]);

  const forcedMoveTarget = useMemo(
    () => (forcedMoveTargetId ? gameState.units.find((u) => u.id === forcedMoveTargetId) ?? null : null),
    [forcedMoveTargetId, gameState.units],
  );

  // `walkable` allows mid-path traversal (walls block; enemies do not).
  // `canEnd` additionally forbids ending on an occupied hex. For a normal
  // move the two are the same; Jump uses `walkable` mid-path and `canEnd`
  // only at the destination.
  const movePredicates = useMemo(() => {
    if (!myUnit) return null;
    const tilePassable = new Set<string>();
    for (const t of gameState.tiles) if (t.kind !== 'wall') tilePassable.add(hexKey(t));
    const occupied = new Set<string>();
    for (const u of gameState.units) {
      if (u.id === myUnit.id) continue;
      occupied.add(hexKey(u.hex));
    }
    const walkable = (h: Hex) => tilePassable.has(hexKey(h));
    const canEnd = (h: Hex) => tilePassable.has(hexKey(h)) && !occupied.has(hexKey(h));
    return { walkable, canEnd };
  }, [gameState.tiles, gameState.units, myUnit]);


  const reachableKeys = useMemo(() => {
    if (!myUnit || !selectedAction) return new Set<string>();
    if (selectedAction.type === 'move') {
      if (!movePredicates) return new Set<string>();
      const reach = selectedAction.jump
        ? bfsReachableJump(myUnit.hex, selectedAction.amount, movePredicates.walkable, movePredicates.canEnd)
        : bfsReachable(myUnit.hex, selectedAction.amount, movePredicates.canEnd);
      reach.delete(hexKey(myUnit.hex));
      return new Set(reach.keys());
    }
    if ((selectedAction.type === 'push' || selectedAction.type === 'pull') && forcedMoveTarget) {
      const tilePassable = new Set<string>();
      for (const t of gameState.tiles) if (t.kind !== 'wall') tilePassable.add(hexKey(t));
      const occupied = new Set<string>();
      for (const u of gameState.units) {
        if (u.id === forcedMoveTarget.id) continue;
        occupied.add(hexKey(u.hex));
      }
      const reach = bfsForcedMove(
        forcedMoveTarget.hex,
        selectedAction.amount,
        myUnit.hex,
        selectedAction.type,
        (h) => {
          const k = hexKey(h);
          return tilePassable.has(k) && !occupied.has(k);
        },
      );
      reach.delete(hexKey(forcedMoveTarget.hex));
      return new Set(reach.keys());
    }
    if (selectedAction.type === 'attack-aoe') {
      // Highlight the 6 candidate anchor hexes (rotations of pattern[0]).
      const p0 = selectedAction.pattern[0];
      if (!p0) return new Set<string>();
      const out = new Set<string>();
      for (let r = 0; r < 6; r++) {
        const off = rotateHexN(p0, r);
        out.add(hexKey({ q: myUnit.hex.q + off.q, r: myUnit.hex.r + off.r }));
      }
      return out;
    }
    return new Set<string>();
  }, [myUnit, selectedAction, forcedMoveTarget, gameState.tiles, gameState.units]);

  // Hexes the staged AOE pattern will hit (anchor + rest of rotated pattern,
  // translated to absolute board coords). Empty until the player stages an
  // anchor by tapping or dragging.
  const aoeHexKeys = useMemo(() => {
    if (!myUnit || selectedAction?.type !== 'attack-aoe') return undefined;
    if (pendingTarget?.kind !== 'aoe') return undefined;
    const p0 = selectedAction.pattern[0];
    if (!p0) return undefined;
    const off = { q: pendingTarget.hex.q - myUnit.hex.q, r: pendingTarget.hex.r - myUnit.hex.r };
    let chosenRot = -1;
    for (let r = 0; r < 6; r++) {
      const rot = rotateHexN(p0, r);
      if (rot.q === off.q && rot.r === off.r) {
        chosenRot = r;
        break;
      }
    }
    if (chosenRot < 0) return undefined;
    const out = new Set<string>();
    for (const o of selectedAction.pattern) {
      const rot = rotateHexN(o, chosenRot);
      out.add(hexKey({ q: myUnit.hex.q + rot.q, r: myUnit.hex.r + rot.r }));
    }
    return out;
  }, [myUnit, selectedAction, pendingTarget]);

  const wallKeys = useMemo(() => {
    const s = new Set<string>();
    for (const t of gameState.tiles) if (t.kind === 'wall') s.add(hexKey(t));
    return s;
  }, [gameState.tiles]);

  const losBlocks = (h: Hex) => wallKeys.has(hexKey(h));

  const inRangeWithLOS = (action: { range: number }, u: Unit) => {
    if (!myUnit) return false;
    if (u.kind !== 'monster') return false;
    if (hexDistance(u.hex, myUnit.hex) > action.range) return false;
    if (action.range > 1 && !hasLineOfSight(myUnit.hex, u.hex, losBlocks)) return false;
    return true;
  };

  const targetableUnitIds = useMemo(() => {
    if (!myUnit || !selectedAction) return [];
    if (selectedAction.type === 'attack') {
      return gameState.units.filter((u) => inRangeWithLOS(selectedAction, u)).map((u) => u.id);
    }
    if ((selectedAction.type === 'push' || selectedAction.type === 'pull') && !forcedMoveTargetId) {
      return gameState.units.filter((u) => inRangeWithLOS(selectedAction, u)).map((u) => u.id);
    }
    if (selectedAction.type === 'apply-condition') {
      return gameState.units.filter((u) => inRangeWithLOS(selectedAction, u)).map((u) => u.id);
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUnit, selectedAction, forcedMoveTargetId, gameState.units, wallKeys]);

  const updateMovePath = (h: Hex) => {
    if (!myUnit || !movePredicates || selectedAction?.type !== 'move') return;
    const budget = selectedAction.amount;
    const isJump = selectedAction.jump === true;
    const { walkable, canEnd } = movePredicates;
    // Tap on own hex → clear preview.
    if (hexEqual(h, myUnit.hex)) {
      setMovePath([]);
      return;
    }
    setMovePath((current) => {
      const last = current[current.length - 1];
      if (last && hexEqual(last, h)) return current;
      // Backtrack: hex already in path → truncate to it.
      const idx = current.findIndex((p) => hexEqual(p, h));
      if (idx >= 0) return current.slice(0, idx + 1);
      // Extend by one step if hex is adjacent to current end and walkable.
      // Path display permits passing through enemies on a jump; the dest
      // is validated at confirm-time.
      const tail = last ?? myUnit.hex;
      if (hexDistance(tail, h) === 1 && walkable(h) && current.length + 1 <= budget) {
        return [...current, h];
      }
      // Otherwise (initial tap / fast drag): snap to shortest path.
      const path = isJump
        ? bfsPathJump(myUnit.hex, h, budget, walkable, canEnd)
        : bfsPath(myUnit.hex, h, budget, canEnd);
      if (!path) return current;
      return path.slice(1);
    });
  };

  const confirmMove = () => {
    if (!activeSlotKind || selectedAction?.type !== 'move') return;
    const dest = movePath[movePath.length - 1];
    if (!dest) return;
    sock.send({
      type: 'player_perform_action',
      slot: activeSlotKind,
      actionId: selectedAction.id,
      target: { hex: dest, path: movePath },
    });
    setMovePath([]);
    onConsumeSelection();
  };

  const skipMove = () => {
    // Skip the underlying Move action entirely (replaces the old "Clear",
    // which only un-staged the path while keeping you in the action).
    if (selectedAction?.type === 'move' && activeSlotKind) {
      sock.send({
        type: 'player_skip_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
      });
    }
    setMovePath([]);
    onConsumeSelection();
  };

  const handleTapHex = (h: Hex) => {
    if (!activeSlotKind || !selectedAction) return;
    if (selectedAction.type === 'move') {
      updateMovePath(h);
      return;
    }
    if (selectedAction.type === 'attack-aoe') {
      // Only accept one of the 6 valid anchor hexes; ignore taps elsewhere
      // so the player can't stage an invalid AOE.
      if (!reachableKeys.has(hexKey(h))) return;
      onStageTarget({ kind: 'aoe', hex: h });
      return;
    }
    if (
      (selectedAction.type === 'push' || selectedAction.type === 'pull') &&
      forcedMoveTarget &&
      myUnit
    ) {
      const tilePassable = new Set<string>();
      for (const t of gameState.tiles) if (t.kind !== 'wall') tilePassable.add(hexKey(t));
      const occupied = new Set<string>();
      for (const u of gameState.units) {
        if (u.id === forcedMoveTarget.id) continue;
        occupied.add(hexKey(u.hex));
      }
      const path = bfsForcedMovePath(
        forcedMoveTarget.hex,
        h,
        selectedAction.amount,
        myUnit.hex,
        selectedAction.type,
        (hx) => {
          const k = hexKey(hx);
          return tilePassable.has(k) && !occupied.has(k);
        },
      );
      if (!path) return;
      onStageTarget({ kind: 'forced-move', destination: h, path });
      sock.send({
        type: 'player_preview_forced_move',
        preview: { targetUnitId: forcedMoveTarget.id, destination: h },
      });
    }
  };
  const handleTapUnit = (u: Unit) => {
    if (!activeSlotKind || !selectedAction) return;
    if (u.kind !== 'monster') return;
    if (selectedAction.type === 'attack') {
      onStageTarget({ kind: 'attack', unit: u });
      return;
    }
    if (selectedAction.type === 'apply-condition') {
      onStageTarget({ kind: 'condition', unit: u });
      return;
    }
    if ((selectedAction.type === 'push' || selectedAction.type === 'pull') && !forcedMoveTargetId) {
      onPickForcedMoveTarget(u.id);
    }
  };

  // Once a target is staged we lock the board taps so the player commits via
  // the bottom-bar Confirm or cancels first. Exception: push/pull and AOE
  // let the player re-tap/re-drag to re-stage a different anchor without
  // canceling first.
  const isForcedMove =
    selectedAction?.type === 'push' || selectedAction?.type === 'pull';
  const isAoeMode = selectedAction?.type === 'attack-aoe';
  const canTapHex =
    (isForcedMove && !!forcedMoveTargetId) ||
    isAoeMode ||
    (!pendingTarget && selectedAction?.type === 'move');
  const canTapUnit =
    !pendingTarget &&
    (selectedAction?.type === 'attack' ||
      selectedAction?.type === 'apply-condition' ||
      (isForcedMove && !forcedMoveTargetId));

  const selectedUnitId =
    pendingTarget && (pendingTarget.kind === 'attack' || pendingTarget.kind === 'condition')
      ? pendingTarget.unit.id
      : forcedMoveTargetId && selectedAction && (selectedAction.type === 'push' || selectedAction.type === 'pull')
        ? forcedMoveTargetId
        : null;
  const selectedHexKey =
    pendingTarget && pendingTarget.kind === 'aoe'
      ? hexKey(pendingTarget.hex)
      : pendingTarget && pendingTarget.kind === 'forced-move'
        ? hexKey(pendingTarget.destination)
        : null;

  const isMoveMode = selectedAction?.type === 'move';
  const moveBudget = isMoveMode ? selectedAction.amount : 0;
  const moveStepsUsed = movePath.length;

  const handleHexEnter = (h: Hex) => {
    if (isMoveMode) {
      updateMovePath(h);
    } else if (isAoeMode) {
      // Drag restages the anchor whenever the pointer crosses one of the 6
      // valid anchor hexes — gives a live preview of where the pattern lands.
      if (!reachableKeys.has(hexKey(h))) return;
      onStageTarget({ kind: 'aoe', hex: h });
    }
  };

  return (
    <>
      {isMoveMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '4px 0 6px',
            padding: '6px 10px',
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            fontSize: 13,
            color: theme.text,
          }}
        >
          <span style={{ fontFamily: theme.headingFont, color: theme.accent }}>
            {moveStepsUsed}/{moveBudget}
          </span>
          <span style={{ color: theme.muted, fontSize: 12, flex: 1 }}>
            {moveStepsUsed === 0
              ? 'Tap or drag across hexes to trace your path.'
              : 'Drag to adjust. Tap your hex to clear.'}
          </span>
        </div>
      )}
      <HexBoard
        tiles={gameState.tiles}
        units={gameState.units}
        moneyTokens={gameState.moneyTokens}
        size={22}
        maxWidthPx={500}
        activeUnitIds={myUnit ? [myUnit.id] : []}
        reachableKeys={reachableKeys}
        pathHexes={
          isMoveMode
            ? movePath
            : pendingTarget?.kind === 'forced-move'
              ? pendingTarget.path
              : undefined
        }
        targetableUnitIds={targetableUnitIds}
        selectedUnitId={selectedUnitId}
        selectedHexKey={selectedHexKey}
        aoeHexKeys={aoeHexKeys}
        onTapHex={canTapHex ? handleTapHex : undefined}
        onTapUnit={canTapUnit ? handleTapUnit : undefined}
        onHexEnter={isMoveMode || isAoeMode ? handleHexEnter : undefined}
        unitAvatarUrl={unitAvatarUrl}
        moveAnim={moveAnim}
        onMoveAnimDone={onMoveAnimDone}
        monsterTurnAnim={gameState.monsterTurnAnim}
      />
      {isMoveMode && moveStepsUsed > 0 && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: BOTTOM_BAR_HEIGHT,
            background: theme.bgSolid,
            borderTop: `1px solid ${theme.border}`,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 55,
          }}
        >
          <button
            onClick={cancelMove}
            style={{ ...btn.ghost(), flex: 1, padding: '6px 14px', fontSize: 13 }}
          >
            Clear
          </button>
          <button
            onClick={confirmMove}
            style={{ ...btn.primary(false), flex: 1, padding: '6px 18px', fontSize: 14 }}
          >
            Confirm
          </button>
        </div>
      )}
    </>
  );
}

function MonsterTurnBanner({ anim, units }: { anim: MonsterTurnAnim; units: Unit[] }) {
  const active = units.find((u) => u.id === anim.activeMonsterId) ?? null;
  const target = anim.targetUnitId
    ? units.find((u) => u.id === anim.targetUnitId) ?? null
    : null;
  const phaseLabel = (() => {
    switch (anim.phase) {
      case 'focus':
        return target ? `Choosing target: ${target.name}` : 'Choosing target…';
      case 'move':
        return target ? `Moving toward ${target.name}` : 'Moving…';
      case 'modifier-draw':
        return 'Drawing attack modifier…';
      case 'damage':
        return target ? `Attacking ${target.name}` : 'Resolving attack';
      case 'idle':
        return '…';
    }
  })();
  const draw = anim.modifierDraw;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: theme.panel,
        border: `1px solid ${theme.accent}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.accent,
          }}
        >
          {anim.abilityCardName}
        </div>
        <div style={{ fontSize: 13, marginTop: 1 }}>
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>{active?.name ?? '—'}</span>
          <span style={{ color: theme.muted, margin: '0 5px' }}>→</span>
          <span style={{ color: target ? '#ffd84d' : theme.muted }}>
            {target ? target.name : 'no target'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{phaseLabel}</div>
      </div>
      {draw && (
        <div
          style={{
            width: 44,
            height: 58,
            borderRadius: 5,
            border: `1px solid ${theme.border}`,
            background: theme.panelRaised,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.headingFont,
            color:
              draw.card.kind === 'crit'
                ? theme.accent
                : draw.card.kind === 'null'
                  ? theme.bad
                  : theme.text,
          }}
        >
          <div
            style={{
              fontSize: modifierLabel(draw.card).length > 2 ? 11 : 18,
              fontWeight: 700,
            }}
          >
            {modifierLabel(draw.card)}
          </div>
          <div style={{ fontSize: 9, color: theme.muted }}>
            {draw.baseAmount}→{draw.finalAmount}
          </div>
          {draw.damageDealt !== null && (
            <div style={{ fontSize: 9, color: theme.bad }}>−{draw.damageDealt}</div>
          )}
        </div>
      )}
    </div>
  );
}

