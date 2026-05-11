import { useMemo, useState } from 'react';
import type {
  Card,
  HalfSlot,
  Hex,
  PendingAction,
  PrivatePlayerState,
  PublicGameState,
  Unit,
} from '@gloomfolk/shared';
import {
  bfsForcedMove,
  bfsReachable,
  hasLineOfSight,
  hexDistance,
  hexKey,
  rotateHexN,
} from '@gloomfolk/shared';
import { HexBoard } from '../board/HexBoard.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';

const unitAvatarUrl = (u: Unit) =>
  u.kind === 'monster' ? monsterAvatarUrl(u.defId) : classAvatarUrl(u.defId);
import { useSocket } from '../net/useSocket.js';
import { btn, theme } from '../theme.js';
import { CardView, HalfView } from './CardView.js';
import { ModifierDeckView } from './ModifierDeckView.js';

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

  if (!isMyTurn || !ct) {
    const sel = you?.selection;
    const selectedCards = sel?.kind === 'cards' && you
      ? [sel.leadingId, sel.secondId]
          .map((id) => you.hand.find((c) => c.id === id))
          .filter((c): c is Card => !!c)
      : [];

    return (
      <div>
        <p style={{ color: theme.muted }}>
          {cur?.kind === 'player'
            ? `Waiting on ${gameState.players.find((p) => p.playerId === cur.playerId)?.name ?? 'player'}…`
            : cur?.kind === 'monster-group'
              ? `${cur.abilityCardName} — monster turn`
              : 'No active turn.'}
        </p>
        <HexBoard
          tiles={gameState.tiles}
          units={gameState.units}
          moneyTokens={gameState.moneyTokens}
          size={20}
          maxWidthPx={400}
          activeUnitIds={cur?.kind === 'player' ? [cur.unitId] : []}
          unitAvatarUrl={unitAvatarUrl}
        />
        {selectedCards.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 12, color: theme.muted, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: theme.headingFont }}>Your cards this round</h3>
            {selectedCards.map((c) => (
              <CardView key={c.id} card={c} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const activeSlot: HalfSlot | null =
    ct.activeSlot === 'top' ? ct.topSlot : ct.activeSlot === 'bottom' ? ct.bottomSlot : null;
  const activeSlotKind: 'top' | 'bottom' | null = activeSlot ? ct.activeSlot : null;

  return (
    <ActionDriver
      gameState={gameState}
      ct={ct}
      activeSlot={activeSlot}
      activeSlotKind={activeSlotKind}
      myUnit={myUnit}
      you={you}
    />
  );
}

function ActionDriver({
  gameState,
  ct,
  activeSlot,
  activeSlotKind,
  myUnit,
  you,
}: {
  gameState: PublicGameState;
  ct: NonNullable<PublicGameState['currentTurn']>;
  activeSlot: HalfSlot | null;
  activeSlotKind: 'top' | 'bottom' | null;
  myUnit: Unit | null;
  you: PrivatePlayerState | null;
}) {
  const sock = useSocket();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  /** For push/pull: the target unit chosen first; destination tap follows. */
  const [forcedMoveTargetId, setForcedMoveTargetId] = useState<string | null>(null);

  // Reset selection when the active slot changes (e.g., after finishing a half).
  const slotSig = `${activeSlotKind}|${activeSlot?.cardId ?? ''}`;
  useMemo(() => {
    setSelectedActionId(null);
    setForcedMoveTargetId(null);
  }, [slotSig]);

  const selectedAction =
    activeSlot?.actions.find((a) => a.id === selectedActionId && !a.done) ?? null;

  return (
    <div>
      <h2 style={{ marginBottom: 4, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>Your turn</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, fontSize: 12, color: theme.text }}>
        <SlotChip label="Top" slot={ct.topSlot} you={you} />
        <SlotChip label="Bottom" slot={ct.bottomSlot} you={you} />
      </div>

      {activeSlot && activeSlotKind ? (
        <ActiveHalfPanel
          slot={activeSlot}
          slotKind={activeSlotKind}
          you={you}
          selectedActionId={selectedActionId}
          onSelect={(actionId) => {
            const action = activeSlot.actions.find((a) => a.id === actionId);
            if (!action || action.done) return;
            if (
              action.type === 'move' ||
              action.type === 'attack' ||
              action.type === 'attack-aoe' ||
              action.type === 'push' ||
              action.type === 'pull' ||
              action.type === 'apply-condition'
            ) {
              setSelectedActionId(actionId);
              setForcedMoveTargetId(null);
              return;
            }
            // No target needed — apply immediately (heal-self, shield, modify-future, retaliate).
            sock.send({ type: 'player_perform_action', slot: activeSlotKind, actionId });
            setSelectedActionId(null);
          }}
          onSkip={(actionId) => {
            sock.send({ type: 'player_skip_action', slot: activeSlotKind, actionId });
            if (selectedActionId === actionId) {
              setSelectedActionId(null);
              setForcedMoveTargetId(null);
            }
          }}
        />
      ) : (
        <SlotPicker ct={ct} you={you} />
      )}

      {you && (
        <ModifierDeckView you={you} lastDraws={ct.lastModifierDraws} />
      )}

      {you && <ActiveArea you={you} />}

      {selectedAction && (selectedAction.type === 'push' || selectedAction.type === 'pull') && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          {forcedMoveTargetId
            ? `Tap a destination hex to ${selectedAction.type} the target.`
            : `Tap an enemy in range ${selectedAction.range} to ${selectedAction.type}.`}
        </p>
      )}
      {selectedAction?.type === 'apply-condition' && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Tap an enemy to apply <strong>{selectedAction.condition}</strong>.
        </p>
      )}
      {selectedAction?.type === 'attack-aoe' && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Tap one of the highlighted hexes to anchor the AOE pattern.
        </p>
      )}
      {selectedAction?.type === 'attack' && selectedAction.targets > 1 && (
        <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
          Multi-target: <strong>{selectedAction.targetsRemaining}</strong> of {selectedAction.targets} shots remaining.
        </p>
      )}

      <BoardForTurn
        gameState={gameState}
        myUnit={myUnit}
        activeSlotKind={activeSlotKind}
        selectedAction={selectedAction}
        forcedMoveTargetId={forcedMoveTargetId}
        onPickForcedMoveTarget={(id) => setForcedMoveTargetId(id)}
        onConsumeSelection={() => {
          setSelectedActionId(null);
          setForcedMoveTargetId(null);
        }}
      />
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

function ActiveArea({ you }: { you: PrivatePlayerState }) {
  if (you.active.length === 0 && you.activeEffects.length === 0) return null;
  return (
    <div
      style={{
        marginBottom: 10,
        padding: 8,
        border: `1px solid ${theme.border}`,
        background: theme.panel,
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div style={{ color: theme.muted, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: theme.headingFont }}>
        Active area
      </div>
      {you.active.map((c) => (
        <div key={c.id} style={{ marginBottom: 2, color: theme.text }}>
          <strong>{c.name}</strong>
        </div>
      ))}
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

  // If both slots are done, show End Turn.
  if (ct.topSlot.status === 'done' && ct.bottomSlot.status === 'done') {
    return (
      <button
        onClick={() => sock.send({ type: 'end_turn' })}
        style={{ ...btn.primary(false), padding: '12px 16px', fontSize: 16, marginBottom: 12 }}
      >
        End my turn
      </button>
    );
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
}: {
  card: Card;
  allowedSlots: ('top' | 'bottom')[];
  onEngage: (slot: 'top' | 'bottom', useBasic: boolean) => void;
  onSkip: (slot: 'top' | 'bottom') => void;
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
        <div>
          <HalfView half={card.top} />
          {allowedSlots.includes('top') && (
            <HalfActions
              label="Top"
              basicLabel="Basic Attack 2"
              onEngage={(useBasic) => onEngage('top', useBasic)}
              onSkip={() => onSkip('top')}
            />
          )}
        </div>
        <div
          style={{
            borderTop: `2px solid ${theme.border}`,
            margin: '16px -18px 4px',
          }}
        />
        <div>
          <HalfView half={card.bottom} />
          {allowedSlots.includes('bottom') && (
            <HalfActions
              label="Bottom"
              basicLabel="Basic Move 2"
              onEngage={(useBasic) => onEngage('bottom', useBasic)}
              onSkip={() => onSkip('bottom')}
            />
          )}
        </div>
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
  const sock = useSocket();
  const card = slot.cardId && you ? you.hand.find((c) => c.id === slot.cardId) ?? null : null;
  const allDone = slot.actions.every((a) => a.done);
  const firstPendingId = slot.actions.find((a) => !a.done)?.id ?? null;
  const cardLabel = slot.useBasic
    ? `Basic ${slotKind === 'top' ? 'Attack 2' : 'Move 2'}`
    : card?.name ?? '?';

  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: theme.text }}>
        Performing <strong>{slotKind}</strong>: {cardLabel}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {slot.actions.map((a) => (
          <ActionRow
            key={a.id}
            action={a}
            isNext={a.id === firstPendingId}
            selected={selectedActionId === a.id}
            onSelect={() => onSelect(a.id)}
            onSkip={() => onSkip(a.id)}
          />
        ))}
      </div>
      {allDone ? (
        <button
          onClick={() => sock.send({ type: 'player_finish_half', slot: slotKind })}
          style={btn.primary(false)}
        >
          Done with this {slotKind}
        </button>
      ) : (
        <button
          onClick={() => sock.send({ type: 'player_finish_half', slot: slotKind })}
          style={{ ...btn.ghost(), fontSize: 12 }}
          title="Skip remaining actions"
        >
          Stop here (skip remaining)
        </button>
      )}
    </div>
  );
}

function ActionRow({
  action,
  isNext,
  selected,
  onSelect,
  onSkip,
}: {
  action: PendingAction;
  isNext: boolean;
  selected: boolean;
  onSelect: () => void;
  onSkip: () => void;
}) {
  const label = actionLabel(action);
  const needsTarget = action.type === 'move' || action.type === 'attack';
  const supported = action.type !== 'unsupported';
  const showButtons = isNext && !action.done;
  const bgDone = action.done
    ? 'rgba(123, 185, 107, 0.10)'
    : selected
      ? 'rgba(217, 164, 65, 0.14)'
      : theme.panel;
  const borderCol = selected ? theme.accent : action.done ? theme.good : theme.border;
  return (
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
      {showButtons && supported && (
        <button onClick={onSelect} style={{ ...btn.primary(false), padding: '4px 12px', fontSize: 11 }}>
          {needsTarget ? (selected ? 'Cancel' : 'Perform') : 'Apply'}
        </button>
      )}
      {showButtons && (
        <button onClick={onSkip} style={{ ...btn.ghost(), padding: '4px 10px', fontSize: 11 }}>
          Skip
        </button>
      )}
    </div>
  );
}

function actionLabel(a: PendingAction): string {
  switch (a.type) {
    case 'move':
      return `Move ${a.amount}`;
    case 'attack': {
      const t = a.targets > 1 ? ` · ${a.targetsRemaining}/${a.targets} targets` : '';
      return `Attack ${a.amount}${a.range > 1 ? ` · range ${a.range}` : ''}${a.pierce > 0 ? ` · pierce ${a.pierce}` : ''}${t}`;
    }
    case 'attack-aoe':
      return `AOE Attack ${a.amount}${a.pierce > 0 ? ` · pierce ${a.pierce}` : ''}`;
    case 'heal':
      return `Heal ${a.amount}${a.selfOnly ? ' (self)' : ''}`;
    case 'shield':
      return `Shield ${a.amount}`;
    case 'push':
      return `Push ${a.amount}${a.range > 1 ? ` · range ${a.range}` : ''}`;
    case 'pull':
      return `Pull ${a.amount}${a.range > 1 ? ` · range ${a.range}` : ''}`;
    case 'apply-condition':
      return `Apply ${a.condition}${a.range > 1 ? ` · range ${a.range}` : ''}`;
    case 'modify-future-move':
      return `+${a.amount} move (persistent${a.expires === 'end-scenario' ? ' scenario' : ''})`;
    case 'modify-future-attack': {
      const exp =
        a.expires === 'next-attack'
          ? 'next attack'
          : a.expires === 'end-scenario'
            ? 'scenario'
            : 'this round';
      const kind = a.attackKind ? ` · ${a.attackKind}` : '';
      const pierce = a.pierceBonus > 0 ? ` · +${a.pierceBonus} pierce` : '';
      return `+${a.amount} attack (${exp})${kind}${pierce}`;
    }
    case 'grant-retaliate':
      return `Retaliate ${a.amount}${a.range > 1 ? ` · range ${a.range}` : ''}`;
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
  onConsumeSelection,
}: {
  gameState: PublicGameState;
  myUnit: Unit | null;
  activeSlotKind: 'top' | 'bottom' | null;
  selectedAction: PendingAction | null;
  forcedMoveTargetId: string | null;
  onPickForcedMoveTarget: (unitId: string) => void;
  onConsumeSelection: () => void;
}) {
  const sock = useSocket();

  const forcedMoveTarget = useMemo(
    () => (forcedMoveTargetId ? gameState.units.find((u) => u.id === forcedMoveTargetId) ?? null : null),
    [forcedMoveTargetId, gameState.units],
  );

  const reachableKeys = useMemo(() => {
    if (!myUnit || !selectedAction) return new Set<string>();
    if (selectedAction.type === 'move') {
      const tilePassable = new Set<string>();
      for (const t of gameState.tiles) if (t.kind !== 'wall') tilePassable.add(hexKey(t));
      const occupied = new Set<string>();
      for (const u of gameState.units) {
        if (u.id === myUnit.id) continue;
        occupied.add(hexKey(u.hex));
      }
      const reach = bfsReachable(myUnit.hex, selectedAction.amount, (h) => {
        const k = hexKey(h);
        return tilePassable.has(k) && !occupied.has(k);
      });
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

  const handleTapHex = (h: Hex) => {
    if (!activeSlotKind || !selectedAction) return;
    if (selectedAction.type === 'move') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { hex: h },
      });
      onConsumeSelection();
      return;
    }
    if (selectedAction.type === 'attack-aoe') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { hex: h },
      });
      onConsumeSelection();
      return;
    }
    if ((selectedAction.type === 'push' || selectedAction.type === 'pull') && forcedMoveTargetId) {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: forcedMoveTargetId, hex: h },
      });
      onConsumeSelection();
    }
  };
  const handleTapUnit = (u: Unit) => {
    if (!activeSlotKind || !selectedAction) return;
    if (u.kind !== 'monster') return;
    if (selectedAction.type === 'attack') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: u.id },
      });
      // Multi-target: stay in target mode if more shots remain.
      if (selectedAction.targetsRemaining <= 1) onConsumeSelection();
      return;
    }
    if (selectedAction.type === 'apply-condition') {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: u.id },
      });
      onConsumeSelection();
      return;
    }
    if ((selectedAction.type === 'push' || selectedAction.type === 'pull') && !forcedMoveTargetId) {
      onPickForcedMoveTarget(u.id);
    }
  };

  const canTapHex =
    selectedAction?.type === 'move' ||
    selectedAction?.type === 'attack-aoe' ||
    ((selectedAction?.type === 'push' || selectedAction?.type === 'pull') && !!forcedMoveTargetId);
  const canTapUnit =
    selectedAction?.type === 'attack' ||
    selectedAction?.type === 'apply-condition' ||
    ((selectedAction?.type === 'push' || selectedAction?.type === 'pull') && !forcedMoveTargetId);

  return (
    <HexBoard
      tiles={gameState.tiles}
      units={gameState.units}
      moneyTokens={gameState.moneyTokens}
      size={22}
      maxWidthPx={500}
      activeUnitIds={myUnit ? [myUnit.id] : []}
      reachableKeys={reachableKeys}
      targetableUnitIds={targetableUnitIds}
      onTapHex={canTapHex ? handleTapHex : undefined}
      onTapUnit={canTapUnit ? handleTapUnit : undefined}
      unitAvatarUrl={unitAvatarUrl}
    />
  );
}

