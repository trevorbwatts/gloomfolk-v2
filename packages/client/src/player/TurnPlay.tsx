import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { ChevronLeft } from 'lucide-react';
import type {
  AttackConsumeOffer,
  Card,
  CardHalf,
  CharacterInstance,
  ElementSelector,
  HalfSlot,
  Hex,
  ModifierCard,
  ModifierDrawResult,
  MonsterTurnAnim,
  PendingAction,
  PrivatePlayerState,
  PublicGameState,
  Unit,
} from '@gloomfolk/shared';
import {
  ALL_ITEMS,
  bfsForcedMove,
  bfsForcedMovePath,
  bfsPath,
  bfsPathJump,
  bfsReachable,
  bfsReachableJump,
  pathCost,
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
import { CardView, HalfView, ElementChip, type CardElementContext } from './CardView.js';
import {
  ItemModal,
  UseItemButton,
  actionHasRelevantItem,
  attackChargeTags,
  type ItemActionContext,
} from './ItemModal.js';

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
    // Long-rest turn: my init-99 slot is up but there's no currentTurn —
    // the server has set longRestPending and is waiting for me to walk
    // through the rest. Render the dedicated panel instead of the wait view.
    if (isMyTurn && you?.longRestPending) {
      const myChar = gameState.characters.find((c) => c.claimedByPlayerId === myPlayerId) ?? null;
      return <LongRestPanel you={you} character={myChar} />;
    }
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
        ) : cur?.kind === 'player' ? (
          // The "<character> is playing…" wait message lives in the page header
          // (see PlayerScreen), so nothing is rendered here for a player's turn.
          null
        ) : (
          <p style={{ color: theme.muted }}>
            {cur?.kind === 'monster-group'
              ? `${cur.abilityCardName} — monster turn`
              : 'No active turn.'}
          </p>
        )}
        {/* The board is intentionally hidden while it isn't this player's turn
            (monster attacks, waiting on others) — the map only appears once the
            player is actively taking an action. The MonsterTurnBanner above
            carries the enemy-turn play-by-play on its own. */}
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
      myPlayerId={myPlayerId}
      ct={ct}
      activeSlot={activeSlot}
      activeSlotKind={activeSlotKind}
      myUnit={myUnit}
      you={you}
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
    t === 'apply-condition' ||
    t === 'destroy-trap'
  );
}

/** Enemy ids the given attack can legally hit from the actor's hex (in range +
 *  line of sight), minus any already struck by this same multi-target ability.
 *  Shared by the board's target highlights and the targeting prompt. */
function attackableEnemyIds(
  gameState: PublicGameState,
  myUnit: Unit,
  action: { range: number; hitTargetIds: readonly string[] },
): string[] {
  const walls = new Set<string>();
  for (const t of gameState.tiles) if (t.kind === 'wall') walls.add(hexKey(t));
  const losBlocks = (h: Hex) => walls.has(hexKey(h));
  return gameState.units
    .filter(
      (u) =>
        u.kind === 'monster' &&
        !action.hitTargetIds.includes(u.id) &&
        hexDistance(u.hex, myUnit.hex) <= action.range &&
        (action.range <= 1 || hasLineOfSight(myUnit.hex, u.hex, losBlocks)),
    )
    .map((u) => u.id);
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
}: {
  gameState: PublicGameState;
  myPlayerId: string;
  ct: NonNullable<PublicGameState['currentTurn']>;
  activeSlot: HalfSlot | null;
  activeSlotKind: 'top' | 'bottom' | null;
  myUnit: Unit | null;
  you: PrivatePlayerState | null;
}) {
  const sock = useSocket();
  // Driven here (not in TurnPlay) so the hook's lifecycle matches the board's:
  // it mounts only during this player's turn. Moves that happen while the board
  // is hidden (enemy turns, other players) are skipped on mount by useMoveAnim's
  // initial-snapshot guard, instead of being queued and replayed when the board
  // reappears.
  const { moveAnim, onMoveAnimDone } = useMoveAnim(gameState.lastMove);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  /** For push/pull: the target unit chosen first; destination tap follows. */
  const [forcedMoveTargetId, setForcedMoveTargetId] = useState<string | null>(null);
  /** Staged target awaiting Confirm. Set when the player taps an enemy/hex
   *  in the relevant target mode; cleared on Cancel, Confirm, or when the
   *  active action changes. */
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null);
  /** Target N (multi-target) attack staging. The player taps every enemy they
   *  want to hit up front (ordered), optionally attaches items to specific
   *  ones, then confirms once — instead of confirming each shot in turn.
   *  Only meaningful while a `targets > 1` attack is selected. */
  const [stagedTargets, setStagedTargets] = useState<Unit[]>([]);
  /** Items attached to staged enemies for the multi-target attack, in the order
   *  attached. Deferred: nothing is sent to the server until Confirm, so a
   *  Cancel needs no rollback. Multiple items may target one or several enemies. */
  const [itemBindings, setItemBindings] = useState<{ itemId: string; targetUnitId: string }[]>([]);
  /** While set, the next tap on a (staged) enemy attaches this item to it,
   *  rather than toggling its staging. Set from the item modal. */
  const [bindingItemId, setBindingItemId] = useState<string | null>(null);
  /** Open the item modal anchored to a specific action row (its relevant items
   *  surface at the top). Null when closed. */
  const [itemContext, setItemContext] = useState<ItemActionContext | null>(null);
  /** Preview path for a Move action — ordered hexes excluding start. Lifted
   *  here (out of BoardForTurn) so the move's Skip/Confirm renders in the
   *  shared sticky bottom area next to the action list. BoardForTurn owns the
   *  board interaction that mutates it. */
  const [movePath, setMovePath] = useState<Hex[]>([]);
  const character = gameState.characters.find((c) => c.claimedByPlayerId === myPlayerId) ?? null;
  // The unified bottom panel (action list + Confirm/Skip) is fixed to the
  // bottom so it stays pinned regardless of how tall the map is. We measure its
  // height to reserve matching scroll space, so nothing hides behind it.
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);

  // Reset selection when the active slot changes (e.g., after finishing a half).
  const slotSig = `${activeSlotKind}|${activeSlot?.cardId ?? ''}`;
  useEffect(() => {
    setSelectedActionId(null);
    setForcedMoveTargetId(null);
    setPendingTarget(null);
    setStagedTargets([]);
    setItemBindings([]);
    setBindingItemId(null);
  }, [slotSig]);

  // Engaging a top/bottom half (and entering your turn at all) swaps in a fresh
  // screen — scroll back to the top so the player always starts at the header,
  // not wherever the previous screen had them scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slotSig]);

  const firstPending = activeSlot?.actions.find((a) => !a.done) ?? null;
  const firstPendingId = firstPending?.id ?? null;

  // Auto-select the next pending action so it's highlighted and its
  // Confirm/Skip controls appear in the bottom bar — the player never has to
  // tap a "Perform" button. Targeted actions additionally enter board target
  // mode; non-targeted ones (Shield, Retaliate, …) just wait for Confirm.
  // Unsupported actions are selected too so their bar's Skip lets the player
  // move past something the engine can't resolve yet.
  useEffect(() => {
    setSelectedActionId(firstPendingId);
    setForcedMoveTargetId(null);
    setPendingTarget(null);
    setStagedTargets([]);
    setItemBindings([]);
    setBindingItemId(null);
  }, [firstPendingId]);

  const selectedAction =
    activeSlot?.actions.find((a) => a.id === selectedActionId && !a.done) ?? null;

  // Clear the move preview whenever the move action (or its budget, e.g. after
  // a move-bonus item) changes — previously owned by BoardForTurn.
  const moveActionSig =
    selectedAction?.type === 'move' ? `${selectedAction.id}|${selectedAction.amount}` : null;
  useEffect(() => {
    setMovePath([]);
  }, [moveActionSig]);

  const isMoveSelected = selectedAction?.type === 'move';
  // Target N attack: the batch-staging flow (tap all targets, attach items,
  // confirm once) instead of confirming each shot. Single-target attacks keep
  // the immediate stage→confirm `pendingTarget` path.
  const isMultiAttack = selectedAction?.type === 'attack' && selectedAction.targets > 1;
  const boundItemIds = useMemo(() => itemBindings.map((b) => b.itemId), [itemBindings]);
  const itemBoundUnitIds = useMemo(
    () => [...new Set(itemBindings.map((b) => b.targetUnitId))],
    [itemBindings],
  );
  const isImmobilized = !!myUnit?.conditions.some((c) => c.kind === 'immobilize');
  const moveStepsUsed = movePath.length;
  const clearActionSelection = () => {
    setMovePath([]);
    setSelectedActionId(null);
    setForcedMoveTargetId(null);
    setPendingTarget(null);
    setStagedTargets([]);
    setItemBindings([]);
    setBindingItemId(null);
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
    // Only drop the preview path — keep the move action selected. If the move
    // still has budget left, the server leaves it pending and the player can
    // move again from the new hex (or Skip the remainder). If it's fully spent,
    // the action becomes `done`, firstPendingId changes, and the auto-select
    // effect advances to the next action.
    setMovePath([]);
  };
  const skipMove = () => {
    if (selectedAction?.type === 'move' && activeSlotKind) {
      sock.send({
        type: 'player_skip_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
      });
    }
    clearActionSelection();
  };

  // How many distinct enemies the player could still legally hit — caps the
  // staged list and tells the bottom bar when every reachable target is chosen.
  const attackableCount = useMemo(() => {
    if (!myUnit || selectedAction?.type !== 'attack') return 0;
    return attackableEnemyIds(gameState, myUnit, selectedAction).length;
  }, [myUnit, selectedAction, gameState]);

  // Tap an enemy during a Target N attack: in binding mode it attaches the
  // armed item to that enemy (staging it if needed); otherwise it toggles the
  // enemy in/out of the staged set, capped at the attack's target count.
  const onTapAttackTarget = (u: Unit) => {
    if (!selectedAction || selectedAction.type !== 'attack') return;
    const cap = selectedAction.targets;
    if (bindingItemId) {
      const alreadyStaged = stagedTargets.some((t) => t.id === u.id);
      if (!alreadyStaged && stagedTargets.length >= cap) return; // no room to add
      if (!alreadyStaged) setStagedTargets((cur) => [...cur, u]);
      setItemBindings((cur) => [...cur, { itemId: bindingItemId, targetUnitId: u.id }]);
      setBindingItemId(null);
      return;
    }
    if (stagedTargets.some((t) => t.id === u.id)) {
      setStagedTargets((cur) => cur.filter((t) => t.id !== u.id));
      setItemBindings((cur) => cur.filter((b) => b.targetUnitId !== u.id));
    } else if (stagedTargets.length < cap) {
      setStagedTargets((cur) => [...cur, u]);
    }
  };

  // Resolve a Target N attack: replay one shot per staged enemy. Any items
  // attached to an enemy are armed (player_use_item) immediately before that
  // enemy's shot, so the turn-charge the server consumes lands on the intended
  // target even with several riders across different enemies. If the player
  // staged fewer than the card allows, a trailing skip closes the action.
  const confirmMultiAttack = () => {
    if (!selectedAction || selectedAction.type !== 'attack' || !activeSlotKind) return;
    if (stagedTargets.length === 0) return;
    for (const t of stagedTargets) {
      for (const b of itemBindings.filter((b) => b.targetUnitId === t.id)) {
        sock.send({ type: 'player_use_item', itemId: b.itemId });
      }
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { unitId: t.id },
      });
    }
    if (stagedTargets.length < selectedAction.targets) {
      sock.send({ type: 'player_skip_action', slot: activeSlotKind, actionId: selectedAction.id });
    }
    setStagedTargets([]);
    setItemBindings([]);
    setBindingItemId(null);
    setSelectedActionId(null);
  };

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
  // Confirm gesture (→ routes to active) or Skip (→ card discards), shown in
  // the shared sticky bottom controls.
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
        return selectedAction.type === 'attack' ? (
          <AttackTargetSummary action={selectedAction} target={pendingTarget.unit} />
        ) : (
          <>
            <strong><GameIcon kind="attack" /> Attack</strong>
            {' on '}
            <strong>{pendingTarget.unit.name}</strong>
          </>
        );
      case 'condition': {
        const stateChips = targetStateChips(pendingTarget.unit);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              {selectedAction.type === 'apply-condition' ? (
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
              )}
            </div>
            {stateChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{stateChips}</div>
            )}
          </div>
        );
      }
      case 'aoe':
        return <strong>Attack the highlighted hex</strong>;
      case 'forced-move':
        return selectedAction.type === 'push' || selectedAction.type === 'pull'
          ? <strong><GameIcon kind={selectedAction.type} /> {selectedAction.type === 'push' ? 'Push' : 'Pull'} target</strong>
          : <strong>Confirm move</strong>;
    }
  }, [pendingTarget, selectedAction]);

  // A non-targeted action (Shield, Retaliate, Heal, Loot, …) that's selected
  // and waiting to be confirmed. These have no board target, so Confirm is
  // always enabled.
  const nonTargetedReady =
    !!selectedAction &&
    !isTargetedActionType(selectedAction.type) &&
    selectedAction.type !== 'unsupported' &&
    !pendingTarget;

  // Move renders its own Skip/Confirm in the sticky bottom area (it needs the
  // live path state), so the shared action controls cover everything else.
  // Targeted actions other than move: attack, AOE, apply-condition, push/pull.
  const targetedSelected =
    !!selectedAction &&
    isTargetedActionType(selectedAction.type) &&
    !isMoveSelected;
  // The bar stays visible the whole time an action is selected so the player
  // always has a Skip to move past it — even when there's no legal target to
  // confirm, or the action isn't supported yet. Confirm is disabled until a
  // target is staged (and always for unsupported actions).
  const showActionBar = !!selectedAction && !isMoveSelected;
  const isUnsupported = selectedAction?.type === 'unsupported';
  // Target N: Confirm needs at least one staged enemy (and the player isn't
  // mid-bind). Otherwise the usual rule: a single-target action needs a staged
  // pendingTarget, and unsupported actions can never confirm.
  const confirmDisabled = isMultiAttack
    ? stagedTargets.length === 0 || !!bindingItemId
    : (targetedSelected && !pendingTarget) || isUnsupported;

  // Only summarize a staged target (e.g. "Attack 3 on Goblin") — that names
  // the specific target, which isn't shown above. The plain "Perform <action>"
  // line is dropped: it just echoed the action row already on screen. Target N
  // attacks show their own multi-target summary instead.
  const bottomSummary: ReactNode = isMultiAttack
    ? selectedAction?.type === 'attack'
      ? (
          <MultiAttackSummary
            action={selectedAction}
            stagedTargets={stagedTargets}
            itemBindings={itemBindings}
            bindingItemId={bindingItemId}
            attackableCount={attackableCount}
            onRemoveTarget={(id) => {
              setStagedTargets((cur) => cur.filter((t) => t.id !== id));
              setItemBindings((cur) => cur.filter((b) => b.targetUnitId !== id));
            }}
            onCancelBinding={() => setBindingItemId(null)}
          />
        )
      : ''
    : pendingTarget
      ? targetSummary
      : '';

  // The player can back out of the chosen half (to pick the other card/half)
  // only while nothing has been performed yet. The button sits above the
  // "Your turn" header so it reads as "go back a screen".
  const canGoBack =
    !!activeSlot &&
    !!activeSlotKind &&
    activeSlot.performedCount === 0 &&
    !activeSlot.actions.some((a) => a.done);

  // Which control row the sticky bottom area shows. At most one applies.
  const showEndTurnControls = showEndTurn && !pendingTarget && !isPersistentEmpty;
  const showPersistentControls =
    isPersistentEmpty && !!activeSlotKind && !!activeCard && !pendingTarget;
  const hasControls =
    isMoveSelected || showActionBar || showEndTurnControls || showPersistentControls;
  // The bottom area carries the action list (when a half is active) plus the
  // controls, so render it whenever either is present.
  const showStickyArea = (!!activeSlot && !!activeSlotKind) || hasControls;

  // Keep the reserved scroll-space spacer in sync with the fixed bottom panel's
  // actual height (it grows/shrinks with the action list and controls).
  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) {
      setBottomPanelHeight(0);
      return;
    }
    const update = () => setBottomPanelHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStickyArea]);

  const onConfirmAction = () => {
    if (isMultiAttack) {
      confirmMultiAttack();
    } else if (pendingTarget) {
      confirmPendingTarget();
    } else if (nonTargetedReady && selectedAction && activeSlotKind) {
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
      });
    }
  };
  const onSkipAction = () => {
    // Target N: Skip is a layered back-out. Cancel a pending item-bind first,
    // then clear staged targets, and only skip the whole attack once there's
    // nothing staged — nothing was sent to the server, so this is purely local.
    if (isMultiAttack) {
      if (bindingItemId) {
        setBindingItemId(null);
        return;
      }
      if (stagedTargets.length > 0 || itemBindings.length > 0) {
        setStagedTargets([]);
        setItemBindings([]);
        return;
      }
    }
    // Skip the underlying action: send the skip message and clear any local
    // target/forced-move state so the action row updates and the bar dismisses.
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
    setStagedTargets([]);
    setItemBindings([]);
    setBindingItemId(null);
  };

  return (
    <div>
      {canGoBack && activeSlotKind && (
        <button
          onClick={() => sock.send({ type: 'player_unengage_half', slot: activeSlotKind })}
          style={{
            ...btn.ghost(),
            padding: '4px 10px',
            fontSize: 11,
            marginBottom: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <ChevronLeft size={13} /> Back
        </button>
      )}
      <h2 style={{ marginBottom: 10, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>Your turn</h2>

      <ElementChoicePrompt
        choice={gameState.pendingElementChoice}
        myPlayerId={myPlayerId}
      />

      <TrapChoicePrompt choice={gameState.pendingTrapChoice} />

      {/* The active area (persistent cards + effects) lives in its own
          "Active" app tab now — see ActiveArea in this file. */}

      {activeSlot && activeSlotKind ? (
        <>
          {/* Board-interaction hints sit just above the map. */}
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
          {selectedAction?.type === 'destroy-trap' && (
            <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
              {selectedAction.eligibleHexes.length > 0
                ? <>Tap a highlighted <GameIcon kind="loot" /> trap to destroy it{selectedAction.gainExp > 0 ? <> (+{selectedAction.gainExp} XP)</> : null}, or Skip.</>
                : 'No trap to destroy here — Skip this action.'}
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
          {isMultiAttack && (
            <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0' }}>
              {bindingItemId
                ? <>Tap a target to attach the item, then tap <strong>Confirm</strong>.</>
                : <>Tap each enemy you want to hit ({stagedTargets.length}/{selectedAction.targets}), then tap <strong>Items</strong> or <strong>Confirm</strong>.</>}
            </p>
          )}

          <BoardForTurn
            gameState={gameState}
            myUnit={myUnit}
            activeSlotKind={activeSlotKind}
            selectedAction={selectedAction}
            forcedMoveTargetId={forcedMoveTargetId}
            onPickForcedMoveTarget={(id) => setForcedMoveTargetId(id)}
            pendingTarget={pendingTarget}
            onStageTarget={setPendingTarget}
            isMultiAttack={isMultiAttack}
            stagedTargetIds={stagedTargets.map((t) => t.id)}
            itemBoundUnitIds={itemBoundUnitIds}
            onTapAttackTarget={onTapAttackTarget}
            movePath={movePath}
            setMovePath={setMovePath}
            isImmobilized={isImmobilized}
            moveAnim={moveAnim}
            onMoveAnimDone={onMoveAnimDone}
          />
        </>
      ) : (
        <SlotPicker ct={ct} you={you} />
      )}

      {itemContext && (
        <ItemModal
          gameState={gameState}
          myPlayerId={myPlayerId}
          you={you}
          context={itemContext}
          isMyTurn
          onClose={() => setItemContext(null)}
          onArmForBinding={(itemId) => setBindingItemId(itemId)}
          boundItemIds={boundItemIds}
        />
      )}

      {/* The action list and its Confirm/Skip controls live in one panel fixed
          just above the app's tab bar — they read as a single bottom area while
          the map scrolls above. A spacer below reserves matching scroll space. */}
      {showStickyArea && <div style={{ height: bottomPanelHeight }} aria-hidden />}
      {showStickyArea && (
        <div
          ref={bottomPanelRef}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: BOTTOM_BAR_HEIGHT,
            zIndex: 55,
            background: theme.bgSolid,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
          {activeSlot && activeSlotKind && (
            <div style={{ padding: '10px 16px 0', maxHeight: '42vh', overflowY: 'auto' }}>
              <ActiveHalfPanel
                slot={activeSlot}
                slotKind={activeSlotKind}
                you={you}
                selectedActionId={selectedActionId}
                character={character}
                chargeTags={attackChargeTags(ct)}
                onUseItem={(action) => setItemContext({ slot: activeSlotKind, action })}
              />
            </div>
          )}

          {showActionBar && bottomSummary && (
            <div
              style={{
                padding: '6px 16px',
                color: theme.text,
                fontSize: 14,
                borderTop: `1px solid ${theme.border}`,
              }}
            >
              {bottomSummary}
            </div>
          )}

          {hasControls && (
            <div
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderTop: `1px solid ${theme.border}`,
              }}
            >
              {isMoveSelected ? (
                <>
                  <button onClick={skipMove} style={bottomBarBtn(false)}>
                    Skip
                  </button>
                  <button
                    onClick={confirmMove}
                    disabled={isImmobilized || moveStepsUsed === 0}
                    style={{
                      ...bottomBarBtn(true),
                      ...(isImmobilized || moveStepsUsed === 0
                        ? { opacity: 0.4, cursor: 'not-allowed' }
                        : {}),
                    }}
                  >
                    {isImmobilized ? 'Immobilized' : 'Confirm'}
                  </button>
                </>
              ) : showActionBar ? (
                <>
                  <button onClick={onSkipAction} style={bottomBarBtn(false)}>
                    {isMultiAttack &&
                    (stagedTargets.length > 0 || itemBindings.length > 0 || bindingItemId)
                      ? 'Cancel'
                      : 'Skip'}
                  </button>
                  {isMultiAttack && activeSlotKind && selectedAction && (
                    <button
                      onClick={() => setItemContext({ slot: activeSlotKind, action: selectedAction })}
                      style={bottomBarBtn(false)}
                    >
                      Items
                    </button>
                  )}
                  <button
                    onClick={onConfirmAction}
                    disabled={confirmDisabled}
                    style={{
                      ...bottomBarBtn(true),
                      ...(confirmDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : showEndTurnControls ? (
                <button onClick={() => sock.send({ type: 'end_turn' })} style={bottomBarBtn(true)}>
                  End Turn
                </button>
              ) : showPersistentControls && activeSlotKind ? (
                <>
                  <button
                    onClick={() => sock.send({ type: 'player_finish_half', slot: activeSlotKind })}
                    style={bottomBarBtn(false)}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() =>
                      sock.send({ type: 'player_confirm_persistent_half', slot: activeSlotKind })
                    }
                    style={bottomBarBtn(true)}
                  >
                    Confirm
                  </button>
                </>
              ) : null}
            </div>
          )}
          </div>
        </div>
      )}

      <ModifierFlipOverlay draws={ct.lastModifierDraws} />
    </div>
  );
}

/** Shared style for the buttons in the fixed bottom bars (Confirm/Skip/End
 *  Turn). A fixed height keeps Confirm (primary, no border) and Skip (ghost,
 *  1px border) the exact same size, and keeps every bottom bar consistent. */
function bottomBarBtn(primary: boolean): CSSProperties {
  return {
    ...(primary ? btn.primary(false) : btn.ghost()),
    flex: 1,
    height: 40,
    padding: '0 16px',
    fontSize: 14,
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/** Tracks which modifier draws have already been shown; pops a centered
 *  overlay with the flip animation + result when new draws arrive (e.g.
 *  after the player confirms an attack). */
function ModifierFlipOverlay({ draws }: { draws: ModifierDrawResult[] }) {
  const shownRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<ModifierDrawResult[] | null>(null);

  useEffect(() => {
    // A multi-target attack draws one card per target, sent as several rapid
    // perform messages → several state broadcasts (first [d1], then [d1, d2]).
    // Showing only the newly-arrived draws would replace the overlay on each
    // broadcast and reveal just the last card. Instead, whenever any new draw
    // arrives, show the whole current burst: the server clears
    // lastModifierDraws at the start of each fresh attack, so this array only
    // ever holds the current attack's cards.
    const hasNew = draws.some((d) => !shownRef.current.has(d.id));
    if (!hasNew) return;
    for (const d of draws) shownRef.current.add(d.id);
    setActive(draws);
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

/** A single attack-modifier card that flips face-up after `delay` ms. When
 *  `faded` it renders dimmed (the discarded card of an Advantage/Disadvantage
 *  pair); `chosen` gives the used card an accent ring + checkmark. */
function ModCardFace({
  card,
  width = 80,
  height = 110,
  delay = 80,
  faded = false,
  chosen = false,
}: {
  card: ModifierCard;
  width?: number;
  height?: number;
  delay?: number;
  faded?: boolean;
  chosen?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const label = modifierLabel(card);
  const isCrit = card.kind === 'crit';
  const isNull = card.kind === 'null';
  const accent = chosen ? theme.good : isCrit ? theme.accent : isNull ? theme.bad : theme.border;
  return (
    <div style={{ position: 'relative', width, height, perspective: 800, opacity: faded ? 0.4 : 1 }}>
      {chosen && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            zIndex: 2,
            width: 18,
            height: 18,
            borderRadius: 9,
            background: theme.good,
            color: '#0e1612',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✓
        </span>
      )}
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
            filter: faded ? 'grayscale(1)' : 'none',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function FlipCard({ draw }: { draw: ModifierDrawResult }) {
  const adv = draw.advantageDraw;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
      {adv ? (
        <>
          <span
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontFamily: theme.headingFont,
              color: adv.mode === 'advantage' ? theme.good : theme.bad,
            }}
          >
            {adv.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {adv.cards.map((c, i) => (
              <ModCardFace
                key={i}
                card={c}
                width={70}
                height={96}
                delay={80 + i * 220}
                chosen={i === adv.usedIndex}
                faded={i !== adv.usedIndex}
              />
            ))}
          </div>
        </>
      ) : (
        <ModCardFace card={draw.card} />
      )}
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

/** The Active tab — shows the player's persistent state: active cards (with
 *  use-slot circles for persistent-tracked) and active effects. Persistent
 *  card halves land here when played and stay until they expire or are used
 *  up. Rendered as its own app tab in PlayerScreen.tsx. */
export function ActiveArea({ you }: { you: PrivatePlayerState }) {
  if (you.active.length === 0 && you.activeEffects.length === 0) {
    return (
      <p style={{ color: theme.muted, fontSize: 13, textAlign: 'center', margin: '32px 0' }}>
        Nothing active right now. Persistent cards you play will show up here.
      </p>
    );
  }
  return (
    <div style={{ fontSize: 12 }}>
      {you.active.map((c) => {
        const tracked = you.activeTracked.find((t) => t.cardId === c.id);
        // Show only the half that's actually persisting — for Warding Strength
        // that's the bottom (Shield/Retaliate), not the top attack. Tracked
        // cards name their half; others are found by persistent disposition.
        const isPersistent = (d: typeof c.top.disposition) =>
          d === 'persistent-round' || d === 'persistent-tracked' || d === 'persistent-scenario';
        const persistentHalf: 'top' | 'bottom' | undefined =
          tracked?.halfKind ??
          (isPersistent(c.top.disposition)
            ? 'top'
            : isPersistent(c.bottom.disposition)
              ? 'bottom'
              : undefined);
        return (
          <CardView
            key={c.id}
            card={c}
            {...(persistentHalf ? { halfOnly: persistentHalf } : {})}
            {...(tracked
              ? { activeTracked: { halfKind: tracked.halfKind, currentSlot: tracked.currentSlot } }
              : {})}
          />
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
      // A ref-valued bonus (e.g. Trickster's Reversal: X from target Shield)
      // resolves at attack time, so show "+X" rather than its flat part.
      const value = e.amountRef ? '+X' : `+${e.amount}`;
      return `${value} atk${k} (${exp})${p}`;
    }
    case 'retaliate':
      return `Retaliate ${e.amount}${e.range > 1 ? ` r${e.range}` : ''}`;
    case 'negate-next-damage':
      return `Negate next damage (${e.expires === 'end-scenario' ? 'scenario' : 'this round'})`;
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

function TrapChoicePrompt({
  choice,
}: {
  choice: PublicGameState['pendingTrapChoice'];
}) {
  const sock = useSocket();
  if (!choice) return null;
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
        <button
          onClick={() => sock.send({ type: 'player_resolve_trap_choice', choiceId: choice.id, spring: true })}
          style={{ ...btn.ghost(), padding: '6px 10px', fontSize: 12 }}
        >
          Spring it
        </button>
        <button
          onClick={() => sock.send({ type: 'player_resolve_trap_choice', choiceId: choice.id, spring: false })}
          style={{ ...btn.ghost(), padding: '6px 10px', fontSize: 12 }}
        >
          Bypass
        </button>
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
  character,
  chargeTags,
  onUseItem,
}: {
  slot: HalfSlot;
  slotKind: 'top' | 'bottom';
  you: PrivatePlayerState | null;
  selectedActionId: string | null;
  character: CharacterInstance | null;
  /** Armed attack-rider tags (e.g. "Poison") shown on the active attack row. */
  chargeTags: string[];
  onUseItem: (action: PendingAction) => void;
}) {
  const card = slot.cardId && you ? you.hand.find((c) => c.id === slot.cardId) ?? null : null;
  const firstPendingId = slot.actions.find((a) => !a.done)?.id ?? null;
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
      {isPersistentEmpty && halfData ? (
        <PersistentConfirmPanel half={halfData} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {slot.actions.map((a) => {
            const isNext = a.id === firstPendingId;
            const showUseItem =
              isNext && !!character && actionHasRelevantItem(character, a);
            return (
              <ActionRow
                key={a.id}
                action={a}
                slotKind={slotKind}
                isNext={isNext}
                selected={selectedActionId === a.id}
                chargeTags={chargeTags}
                onUseItem={showUseItem ? () => onUseItem(a) : null}
              />
            );
          })}
          <InfuseRows half={halfData} />
        </div>
      )}
    </div>
  );
}

/** Element selectors this half infuses at end of turn (its `create-element`
 *  steps). Pulled straight off the committed card half — the engine resolves
 *  these automatically at finishHalf, so they never enter the action queue. */
function infusedElements(half: CardHalf | null): ElementSelector[] {
  if (!half) return [];
  const out: ElementSelector[] = [];
  for (const ability of half.abilities) {
    for (const step of ability.steps) {
      if (step.type === 'create-element') out.push(step.element);
    }
  }
  return out;
}

/** Informational row(s) shown beneath the action queue for any element the
 *  half infuses. Infusion is automatic and mandatory at end of turn, so this
 *  is display-only — there's no Perform/Skip gesture. */
function InfuseRows({ half }: { half: CardHalf | null }) {
  const elements = infusedElements(half);
  if (elements.length === 0) return null;
  return (
    <>
      {elements.map((element, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '6px 8px',
            background: theme.panel,
            borderRadius: 4,
            border: `1px dashed ${theme.border}`,
            color: theme.muted,
          }}
        >
          <span
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Infuse
          </span>
          <ElementChip element={element} context={null} consumeIntent={false} />
          <span style={{ flex: 1, fontSize: 11, textAlign: 'right' }}>
            automatic at end of turn
          </span>
        </div>
      ))}
    </>
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
        // Highlighted like a selected ActionRow so a tracked/persistent half
        // reads as "active" the same way Attack does.
        background: 'rgba(217, 164, 65, 0.14)',
        border: `1px solid ${theme.accent}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <HalfView half={half} />
    </div>
  );
}

function ActionRow({
  action,
  slotKind,
  isNext,
  selected,
  chargeTags,
  onUseItem,
}: {
  action: PendingAction;
  slotKind: 'top' | 'bottom';
  isNext: boolean;
  selected: boolean;
  /** Armed attack-rider tags (e.g. "Poison"), shown on the active attack row. */
  chargeTags: string[];
  /** Opens the item modal anchored to this action. Null hides the button. */
  onUseItem: (() => void) | null;
}) {
  const sock = useSocket();
  const label = actionLabel(action);
  const isAttack = action.type === 'attack' || action.type === 'attack-aoe';
  // Armed riders (Poison Dagger, Scouting Lens, Simple Bow) attach to the next
  // attack you perform — surface them on the active attack row as "+ Poison".
  const rowTags = isNext && isAttack ? chargeTags : [];
  // The Perform/Skip controls live in the fixed bottom bar (ActionBottomBar)
  // for every action type; the row itself only shows the label, its done
  // checkmark, and any element-consume offers.
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
          {label}
          {rowTags.map((t) => (
            <span key={t} style={{ color: theme.accent, fontWeight: 600 }}>
              {' '}
              + {t}
            </span>
          ))}
          {action.done ? ' ✓' : ''}
        </span>
        {onUseItem && <UseItemButton onClick={onUseItem} />}
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

/** Conditions that ride on an attack and auto-apply to whatever it hits — shown
 *  inline on the attack's label so the player knows the attack carries them. */
function riderConditionSuffix(conditions?: readonly string[]): ReactNode {
  if (!conditions || conditions.length === 0) return null;
  return (
    <>
      {conditions.map((c) => (
        <span key={c}> · <GameIcon kind={c as IconKey} /> {cap(c)}</span>
      ))}
    </>
  );
}

type ChipTone = 'applied' | 'muted' | 'warn' | 'good';

/** Small pill used in the target breakdown. `applied` = something this action
 *  will do to the enemy (accent); `muted` = the enemy's current defensive
 *  state; `warn` = something that will hit the player back (retaliate). */
function StatusChip({
  icon,
  label,
  tone,
}: {
  icon?: IconKey;
  label: ReactNode;
  tone: ChipTone;
}) {
  const palette =
    tone === 'applied'
      ? { bg: 'rgba(217, 164, 65, 0.14)', border: theme.accent, fg: theme.text }
      : tone === 'warn'
        ? { bg: 'rgba(200, 80, 80, 0.14)', border: theme.bad, fg: theme.text }
        : tone === 'good'
          ? { bg: 'rgba(90, 180, 110, 0.16)', border: theme.good, fg: theme.text }
          : { bg: 'transparent', border: theme.border, fg: theme.muted };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
      }}
    >
      {icon && <GameIcon kind={icon} />} {label}
    </span>
  );
}

/** The enemy's current defensive state, shown so the player sees what they're
 *  hitting (existing conditions, shield, retaliate). */
function targetStateChips(unit: Unit): ReactNode[] {
  const chips: ReactNode[] = [];
  if (unit.shield > 0) {
    chips.push(<StatusChip key="shield" icon="shield" label={`Shield ${unit.shield}`} tone="muted" />);
  }
  const retaliateTotal = unit.retaliate.reduce((s, b) => s + b.amount, 0);
  if (retaliateTotal > 0) {
    chips.push(<StatusChip key="retaliate" icon="retaliate" label={`Retaliate ${retaliateTotal}`} tone="warn" />);
  }
  for (const c of unit.conditions) {
    // Poison is surfaced on the attack summary itself (it adds damage), so skip
    // it here to avoid showing it twice.
    if (c.kind === 'poison') continue;
    chips.push(<StatusChip key={`cond-${c.kind}`} icon={c.kind as IconKey} label={cap(c.kind)} tone="muted" />);
  }
  return chips;
}

/** Full breakdown of a staged single-target attack: damage (with deterministic
 *  bonuses folded in), pierce, conditions it will apply, the poison interaction,
 *  and the enemy's current defensive state. Shown in the bar above Confirm so
 *  the player sees the whole hit before committing. */
function AttackTargetSummary({
  action,
  target,
}: {
  action: Extract<PendingAction, { type: 'attack' }>;
  target: Unit;
}) {
  const targetPoisoned = target.conditions.some((c) => c.kind === 'poison');
  // Net advantage/disadvantage is precomputed by the server (single source of
  // truth) and keyed by target id; a missing entry means a normal draw.
  const drawMode = action.drawModeByTargetId?.[target.id] ?? null;
  const acceptedOffers = action.acceptedConsumeIndices
    .map((i) => action.consumeOffers.find((o) => o.riderIndex === i))
    .filter((o): o is AttackConsumeOffer => !!o);
  const bonusAttack = action.consumesLocked
    ? action.lockedRiderAttack
    : acceptedOffers.reduce((s, o) => s + (o.attackBonus ?? 0), 0);
  const bonusPierce = action.consumesLocked
    ? action.lockedRiderPierce
    : acceptedOffers.reduce((s, o) => s + (o.pierceBonus ?? 0), 0);
  // Damage and Pierce come precomputed per target from the server (single
  // source of truth) — they fold in persistent/conditional bonuses (e.g. Single
  // Out's +3 vs isolated) the client can't see. Fall back to the printed value
  // if a preview is somehow missing for this target.
  const preview = action.previewByTargetId?.[target.id];
  const dmg = preview ? preview.damage : action.amount + bonusAttack + (targetPoisoned ? 1 : 0);
  const pierceTotal = preview ? preview.pierce : action.pierce + bonusPierce;
  const riders = action.riderConditions ?? [];
  const stateChips = targetStateChips(target);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <GameIcon kind="attack" />{' '}
        <strong>Attack {action.amountRef ? 'X' : dmg}</strong>
        {' on '}
        <strong>{target.name}</strong>
        {amountSuffix(action)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {drawMode === 'advantage' && <StatusChip label="Advantage" tone="good" />}
        {drawMode === 'disadvantage' && <StatusChip label="Disadvantage" tone="warn" />}
        {/* Why the damage is what it is: a pill per attack-value bonus
            (e.g. "+3 Single Out", "+2 isolated"). */}
        {preview?.bonuses.map((b, i) => (
          <StatusChip key={`bonus-${i}`} label={`+${b.amount} ${b.label}`} tone="applied" />
        ))}
        {pierceTotal > 0 && <StatusChip icon="pierce" label={`Pierce ${pierceTotal}`} tone="applied" />}
        {riders.map((c) => (
          <StatusChip key={`rider-${c}`} icon={c as IconKey} label={cap(c)} tone="applied" />
        ))}
        {targetPoisoned && <StatusChip icon="poison" label="+1 dmg (poisoned)" tone="applied" />}
        {stateChips}
      </div>
      <div style={{ fontSize: 11, color: theme.muted }}>Before the attack-modifier draw.</div>
    </div>
  );
}

/** Target N staging summary: the chosen enemies in order (each removable), the
 *  items attached to each, and a hint while an item is waiting to be attached. */
function MultiAttackSummary({
  action,
  stagedTargets,
  itemBindings,
  bindingItemId,
  attackableCount,
  onRemoveTarget,
  onCancelBinding,
}: {
  action: Extract<PendingAction, { type: 'attack' }>;
  stagedTargets: Unit[];
  itemBindings: { itemId: string; targetUnitId: string }[];
  bindingItemId: string | null;
  attackableCount: number;
  onRemoveTarget: (unitId: string) => void;
  onCancelBinding: () => void;
}) {
  const bindingName = bindingItemId ? ALL_ITEMS[bindingItemId]?.name ?? 'item' : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <GameIcon kind="attack" /> <strong>Attack {action.amount}</strong>
        {' · '}
        {stagedTargets.length}/{action.targets} target{action.targets === 1 ? '' : 's'}
        {stagedTargets.length >= attackableCount && attackableCount < action.targets && (
          <span style={{ color: theme.muted }}> (all reachable enemies chosen)</span>
        )}
      </div>
      {stagedTargets.length === 0 ? (
        <div style={{ fontSize: 12, color: theme.muted }}>Tap enemies on the map to choose targets.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stagedTargets.map((t, i) => {
            const items = itemBindings
              .filter((b) => b.targetUnitId === t.id)
              .map((b) => ALL_ITEMS[b.itemId]?.name ?? b.itemId);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: theme.accent,
                    color: '#0e1612',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </span>
                <strong>{t.name}</strong>
                {items.map((name) => (
                  <StatusChip key={name} label={name} tone="applied" />
                ))}
                <button
                  onClick={() => onRemoveTarget(t.id)}
                  style={{ ...btn.ghost(), padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
      {bindingName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.accent }}>
          <span>Tap a target to attach <strong>{bindingName}</strong>.</span>
          <button
            onClick={onCancelBinding}
            style={{ ...btn.ghost(), padding: '2px 8px', fontSize: 11 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
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
          {riderConditionSuffix(a.riderConditions)}
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
          {riderConditionSuffix(a.riderConditions)}
        </>
      );
    }
    case 'heal':
      return withActionIcon('heal', `Heal ${a.amount}${a.selfOnly ? ' (self)' : ''}`);
    case 'shield':
      return withActionIcon('shield', `Shield ${a.amount}`);
    case 'loot':
      return withActionIcon('loot', a.range <= 0 ? 'Loot your hex' : `Loot within ${a.range}`);
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
    case 'negate-damage':
      return `Negate the next damage you would suffer ${a.expires === 'end-scenario' ? 'this scenario' : 'this round'}`;
    case 'destroy-trap':
      return `Destroy a trap${a.gainExp > 0 ? ` (+${a.gainExp} XP)` : ''}`;
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
  isMultiAttack,
  stagedTargetIds,
  itemBoundUnitIds,
  onTapAttackTarget,
  movePath,
  setMovePath,
  isImmobilized,
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
  /** Target N attack: when true, enemy taps go through `onTapAttackTarget`
   *  (stage/unstage or attach an item) rather than staging a single target. */
  isMultiAttack: boolean;
  stagedTargetIds: string[];
  itemBoundUnitIds: string[];
  onTapAttackTarget: (u: Unit) => void;
  /** Move preview path (owned by ActionDriver so the move's Confirm/Skip can
   *  live in the shared sticky bottom area). This component mutates it as the
   *  player traces a route on the board. */
  movePath: Hex[];
  setMovePath: Dispatch<SetStateAction<Hex[]>>;
  isImmobilized: boolean;
  moveAnim: { unitId: string; steps: Hex[] } | null;
  onMoveAnimDone: () => void;
}) {
  const sock = useSocket();

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
    const difficult = new Set<string>();
    for (const t of gameState.tiles) {
      if (t.kind !== 'wall') tilePassable.add(hexKey(t));
      if (t.kind === 'difficult') difficult.add(hexKey(t));
    }
    const occupied = new Set<string>();
    const enemyOccupied = new Set<string>();
    for (const u of gameState.units) {
      if (u.id === myUnit.id) continue;
      occupied.add(hexKey(u.hex));
      // A figure can move through its allies (same kind) but not its enemies.
      if (u.kind !== myUnit.kind) enemyOccupied.add(hexKey(u.hex));
    }
    // Jump traversal: only walls block. Ground traversal: walls + enemy figures
    // block, but allies can be passed through. Neither can end on an occupied hex.
    const walkable = (h: Hex) => tilePassable.has(hexKey(h));
    const walkableGround = (h: Hex) => tilePassable.has(hexKey(h)) && !enemyOccupied.has(hexKey(h));
    const canEnd = (h: Hex) => tilePassable.has(hexKey(h)) && !occupied.has(hexKey(h));
    // Difficult terrain costs 2 movement to enter; everything else costs 1.
    const enterCost = (h: Hex) => (difficult.has(hexKey(h)) ? 2 : 1);
    return { walkable, walkableGround, canEnd, enterCost };
  }, [gameState.tiles, gameState.units, myUnit]);


  const reachableKeys = useMemo(() => {
    if (!myUnit || !selectedAction) return new Set<string>();
    if (selectedAction.type === 'move') {
      if (!movePredicates) return new Set<string>();
      // Immobilized: no hexes are reachable, so don't highlight any.
      if (myUnit.conditions.some((c) => c.kind === 'immobilize')) return new Set<string>();
      const reach = selectedAction.jump
        ? bfsReachableJump(myUnit.hex, selectedAction.amount, movePredicates.walkable, movePredicates.canEnd)
        : bfsReachable(
            myUnit.hex,
            selectedAction.amount,
            movePredicates.walkableGround,
            movePredicates.canEnd,
            movePredicates.enterCost,
          );
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
    if (selectedAction.type === 'destroy-trap') {
      // Highlight the trap hexes entered (and bypassed) this move.
      return new Set(selectedAction.eligibleHexes.map((h) => hexKey(h)));
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
      // A multi-target attack can't hit the same enemy twice — already-hit
      // enemies are excluded by attackableEnemyIds.
      return attackableEnemyIds(gameState, myUnit, selectedAction);
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
    const { walkable, walkableGround, canEnd, enterCost } = movePredicates;
    // Traversal predicate for this move: a jump only cares about walls; a walk
    // can pass through allies but not enemies.
    const traverse = isJump ? walkable : walkableGround;
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
      // Extend by one step if hex is adjacent to current end and traversable.
      // The destination is validated at confirm-time. A jump ignores difficult
      // terrain, so its cost is the hex count; a walk pays 2 to enter difficult.
      const tail = last ?? myUnit.hex;
      const candidate = [...current, h];
      const candidateCost = isJump ? candidate.length : pathCost(candidate, enterCost);
      if (hexDistance(tail, h) === 1 && traverse(h) && candidateCost <= budget) {
        return candidate;
      }
      // Otherwise (initial tap / fast drag): snap to shortest path.
      const path = isJump
        ? bfsPathJump(myUnit.hex, h, budget, walkable, canEnd)
        : bfsPath(myUnit.hex, h, budget, walkableGround, canEnd, enterCost);
      if (!path) return current;
      return path.slice(1);
    });
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
    if (selectedAction.type === 'destroy-trap') {
      // Tap one of the eligible trap hexes to destroy it.
      if (!reachableKeys.has(hexKey(h))) return;
      sock.send({
        type: 'player_perform_action',
        slot: activeSlotKind,
        actionId: selectedAction.id,
        target: { hex: h },
      });
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
      // Target N: stage/unstage or attach an item. Single-target: stage one.
      if (isMultiAttack) onTapAttackTarget(u);
      else onStageTarget({ kind: 'attack', unit: u });
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
  // An immobilized figure can't move, so don't let the player trace a path the
  // server will only reject (`isImmobilized` arrives as a prop). The move's
  // Confirm is disabled and relabeled "Immobilized"; the player skips instead.
  const canTapHex =
    (isForcedMove && !!forcedMoveTargetId) ||
    isAoeMode ||
    selectedAction?.type === 'destroy-trap' ||
    (!pendingTarget && selectedAction?.type === 'move' && !isImmobilized);
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
  // The ratio is shown in movement points (same units as the budget), not raw
  // hex count — so difficult terrain reads correctly: stepping into a difficult
  // hex bumps the count by 2 and "5/5" shows you're maxed even at 4 hexes. A
  // jump ignores difficult terrain, so its cost is just the hex count. (The
  // board's step numbers still show the true hex count for "X = hexes moved".)
  const isJumpMove =
    selectedAction != null && selectedAction.type === 'move' && selectedAction.jump === true;
  const movePointsUsed =
    movePredicates && !isJumpMove ? pathCost(movePath, movePredicates.enterCost) : moveStepsUsed;

  const handleHexEnter = (h: Hex) => {
    if (isMoveMode && !isImmobilized) {
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
            {movePointsUsed}/{moveBudget}
          </span>
          <span style={{ color: theme.muted, fontSize: 12, flex: 1 }}>
            {isImmobilized
              ? "You're immobilized and can't move this turn — skip the move."
              : moveStepsUsed === 0
                ? 'Tap or drag across hexes to trace your path.'
                : 'Drag to adjust. Tap your hex to clear.'}
          </span>
        </div>
      )}
      <HexBoard
        tiles={gameState.tiles}
        units={gameState.units}
        moneyTokens={gameState.moneyTokens}
        doors={gameState.doors}
        {...(gameState.tileArt ? { tileArt: gameState.tileArt } : {})}
        {...(gameState.decorations ? { decorations: gameState.decorations } : {})}
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
        stagedUnitIds={isMultiAttack ? stagedTargetIds : []}
        itemBoundUnitIds={isMultiAttack ? itemBoundUnitIds : []}
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
        {/* The monster's attack-modifier pull is shown big on the Host screen
            (see MonsterModifierModal in HostScreen) rather than here. */}
      </div>
    </div>
  );
}

/** Long-rest turn UI. Two steps:
 *  1. Pick one card from the effective discard (server-supplied candidates)
 *     to lose. Remaining discard returns to hand; active cards stay put.
 *  2. Optional Heal 2 self, then Finish to close out the turn.
 *  Spent items are refreshed automatically when the rest resolves (step 2). */
function LongRestPanel({
  you,
  character,
}: {
  you: PrivatePlayerState;
  character: CharacterInstance | null;
}) {
  const sock = useSocket();
  const pending = you.longRestPending!;
  const [stagedId, setStagedId] = useState<string | null>(null);
  // Clear staging when the step advances (server confirmed our pick).
  useEffect(() => {
    if (pending.step !== 'choose_lost') setStagedId(null);
  }, [pending.step]);
  const candidates = pending.candidateCardIds
    .map((id) => {
      const fromDiscard = you.discard.find((c) => c.id === id);
      if (fromDiscard) return { card: fromDiscard, source: 'discard' as const };
      const fromActive = you.active.find((c) => c.id === id);
      if (fromActive) return { card: fromActive, source: 'active' as const };
      return null;
    })
    .filter((x): x is { card: Card; source: 'discard' | 'active' } => !!x)
    .sort((a, b) => a.card.initiative - b.card.initiative);
  const stagedCard = stagedId ? candidates.find((c) => c.card.id === stagedId) ?? null : null;

  return (
    <div>
      <h2 style={{ marginBottom: 10, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>
        Long Rest
      </h2>
      {pending.step === 'choose_lost' ? (
        <div style={{ paddingBottom: stagedId ? 96 : 0 }}>
          <p style={{ color: theme.text, marginTop: 0 }}>
            <strong>Choose one card to lose.</strong> The rest of your discard returns to your hand.
          </p>
          {candidates.length === 0 && (
            <p style={{ color: theme.muted }}>No eligible cards. This shouldn't happen — please report.</p>
          )}
          {candidates.map(({ card, source }) => {
            const isStaged = stagedId === card.id;
            return (
              <div
                key={card.id}
                style={{ position: 'relative' }}
              >
                {source === 'active' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: 10,
                      background: theme.panelRaised,
                      border: `1px solid ${theme.border}`,
                      color: theme.muted,
                      padding: '2px 6px',
                      borderRadius: 3,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      zIndex: 2,
                    }}
                  >
                    Active
                  </div>
                )}
                <CardView
                  card={card}
                  selected={isStaged}
                  onClick={() => setStagedId(isStaged ? null : card.id)}
                />
              </div>
            );
          })}
          {stagedCard && (
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
                Lose <strong>{stagedCard.card.name}</strong>?
              </div>
              <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setStagedId(null)}
                  style={{ ...btn.ghost(), flex: 1, padding: '6px 14px', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    sock.send({ type: 'player_long_rest_choose_lost', cardId: stagedCard.card.id })
                  }
                  style={{ ...btn.primary(false), flex: 1, padding: '6px 18px', fontSize: 14 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: theme.text, marginTop: 0 }}>
            Card lost. Your discard returned to your hand.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 12,
              padding: 12,
              background: theme.panel,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
            }}
          >
            <button
              onClick={() => sock.send({ type: 'player_long_rest_heal' })}
              disabled={pending.healUsed}
              style={{
                ...btn.outline(),
                opacity: pending.healUsed ? 0.5 : 1,
                cursor: pending.healUsed ? 'not-allowed' : 'pointer',
                padding: '10px 14px',
              }}
            >
              {pending.healUsed ? 'Healed 2 ✓' : 'Heal 2 (self)'}
            </button>
            <button
              onClick={() => sock.send({ type: 'player_long_rest_finish' })}
              style={{ ...btn.primary(false), padding: '10px 14px' }}
            >
              Finish Rest
            </button>
            {character && character.broughtItemIds.length > 0 && (
              <p style={{ fontSize: 12, color: theme.muted, margin: '4px 0 0' }}>
                Spent items refreshed — all your items are ready to use again.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

