import { useState, type ReactNode } from 'react';
import type {
  CharacterInstance,
  Item,
  PendingAction,
  PrivatePlayerState,
  PublicGameState,
} from '@gloomfolk/shared';
import { ALL_ITEMS, cardMatchesLevel, hexDistance } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { CardView } from './CardView.js';
import { btn, theme } from '../theme.js';

/** Which action a row-triggered item modal was opened from. Used to surface
 *  contextually-relevant items at the top and to attach action-scoped effects
 *  (move-bonus → that move; pierce/poison/advantage → arm for that attack). */
export type ItemActionContext = {
  slot: 'top' | 'bottom';
  action: PendingAction;
};

/** True when `item` is contextually relevant to `action` — i.e. using it would
 *  meaningfully affect this specific action. Drives both the per-row "Use Item"
 *  button visibility and the surfaced-at-top ordering inside the modal. */
export function itemRelevantToAction(item: Item, action: PendingAction): boolean {
  switch (item.effect.kind) {
    case 'move-bonus':
    case 'jump-this-turn':
      return action.type === 'move';
    case 'pierce-one-attack':
      return action.type === 'attack' || action.type === 'attack-aoe';
    case 'poison-one-attack':
      // Melee: an adjacent-range attack, or any AOE (treated as melee).
      return action.type === 'attack-aoe' || (action.type === 'attack' && action.range <= 1);
    case 'advantage-one-attack':
      return action.type === 'attack' && action.range > 1;
    default:
      return false;
  }
}

/** Does the character have at least one un-spent brought item that's relevant
 *  to this action? Gates whether the action row shows a "Use Item" button. */
export function actionHasRelevantItem(character: CharacterInstance, action: PendingAction): boolean {
  return character.broughtItemIds.some((id) => {
    const item = ALL_ITEMS[id];
    if (!item) return false;
    if (character.spentItemIds.includes(id)) return false;
    return itemRelevantToAction(item, action);
  });
}

/** Armed attack-rider tags to show on an attack action row (e.g. "+ Poison").
 *  Reads the live charges off the current turn. */
export function attackChargeTags(ct: NonNullable<PublicGameState['currentTurn']>): string[] {
  const tags: string[] = [];
  if (ct.pierceCharge) tags.push(`Pierce ${ct.pierceCharge.amount}`);
  if (ct.poisonCharge) tags.push('Poison');
  if (ct.advantageCharge) tags.push('Advantage');
  return tags;
}

export function ItemModal({
  gameState,
  myPlayerId,
  you,
  context,
  isMyTurn,
  onClose,
  onArmForBinding,
  boundItemIds = [],
}: {
  gameState: PublicGameState;
  myPlayerId: string;
  you: PrivatePlayerState | null;
  /** Action the modal was opened from (row trigger), or null for the global
   *  header "Items" button. */
  context: ItemActionContext | null;
  isMyTurn: boolean;
  onClose: () => void;
  /** Target N attack flow: when supplied and the modal is anchored to a
   *  multi-target attack, using an attack-rider item (pierce/poison/advantage)
   *  doesn't arm a turn charge — instead it hands the item id back so the
   *  player can attach it to a specific staged enemy on the board. */
  onArmForBinding?: (itemId: string) => void;
  /** Rider items already attached to a staged target this attack — shown as
   *  "Attached" and not re-usable. */
  boundItemIds?: string[];
}) {
  const sock = useSocket();
  const [aimingItemId, setAimingItemId] = useState<string | null>(null);
  // For retrieve-discarded-card: the discarded card the player has tentatively
  // selected (shown as full cards), pending a Confirm.
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const character: CharacterInstance | undefined = gameState.characters.find(
    (c) => c.claimedByPlayerId === myPlayerId,
  );
  const ct = gameState.currentTurn;
  const myUnit = gameState.units.find((u) => u.ownerPlayerId === myPlayerId) ?? null;

  // The active half + its next pending action, used when no explicit row
  // context was supplied (the global header modal).
  const activeSlotKind: 'top' | 'bottom' | null =
    ct?.activeSlot === 'top' ? 'top' : ct?.activeSlot === 'bottom' ? 'bottom' : null;
  const activeSlot = ct
    ? activeSlotKind === 'top'
      ? ct.topSlot
      : activeSlotKind === 'bottom'
        ? ct.bottomSlot
        : null
    : null;
  const fallbackPending = activeSlot?.actions.find((a) => !a.done) ?? null;

  // The action an action-scoped item acts on: the row that opened the modal, or
  // the active half's next pending action for the global modal.
  const refAction: PendingAction | null = context?.action ?? fallbackPending;
  const refSlot: 'top' | 'bottom' | null = context?.slot ?? activeSlotKind;

  // Target N binding mode: a multi-target attack is staging, so attack-rider
  // items get attached to a chosen enemy (on the board) rather than armed as a
  // turn-wide charge that the next attack consumes.
  const bindingMode =
    !!onArmForBinding &&
    refAction != null &&
    refAction.type === 'attack' &&
    refAction.targets > 1;

  if (!character) return null;

  // ——— Context flags mirroring the engine's usability rules ———
  const hasPendingAttack =
    refAction != null &&
    !refAction.done &&
    (refAction.type === 'attack' || refAction.type === 'attack-aoe');
  const hasPendingMeleeAttack =
    refAction != null &&
    !refAction.done &&
    (refAction.type === 'attack-aoe' || (refAction.type === 'attack' && refAction.range <= 1));
  const hasPendingRangedAttack =
    refAction != null &&
    !refAction.done &&
    refAction.type === 'attack' &&
    refAction.range > 1;
  const hasPendingMove =
    refAction != null && !refAction.done && refSlot != null && refAction.type === 'move';
  const atFullHp = myUnit != null && myUnit.hp >= myUnit.hpMax;
  const performedLostAction = ct?.performedLostAction ?? false;
  const livingMonsters = gameState.units.filter((u) => u.kind === 'monster' && u.hp > 0);
  const healableInRange = (range: number) =>
    myUnit == null
      ? []
      : gameState.units.filter(
          (u) =>
            u.kind === 'player' &&
            hexDistance(u.hex, myUnit.hex) <= range &&
            (u.hp < u.hpMax ||
              u.conditions.some((c) => c.kind === 'poison' || c.kind === 'wound')),
        );
  const discardedAtLevel = (level: number) =>
    (you?.discard ?? []).filter((c) => cardMatchesLevel(c.level, level));

  // Sort brought items so contextually-relevant ones surface at the top, while
  // still showing every item.
  const itemIds = [...character.broughtItemIds];
  if (refAction) {
    itemIds.sort((a, b) => {
      const ia = ALL_ITEMS[a];
      const ib = ALL_ITEMS[b];
      const ra = ia && !character.spentItemIds.includes(a) && itemRelevantToAction(ia, refAction);
      const rb = ib && !character.spentItemIds.includes(b) && itemRelevantToAction(ib, refAction);
      return Number(rb) - Number(ra);
    });
  }

  return (
    <div
      role="dialog"
      aria-label="Items"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.bgSolid,
          borderTop: `1px solid ${theme.border}`,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: '16px 16px 24px',
          width: '100%',
          maxWidth: 540,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              color: theme.accent,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              fontFamily: theme.headingFont,
              fontWeight: 500,
            }}
          >
            Items
          </h3>
          <button onClick={onClose} style={{ ...btn.ghost(), padding: '4px 12px', fontSize: 12 }}>
            Close
          </button>
        </div>

        {!isMyTurn && (
          <p style={{ fontSize: 12, color: theme.muted, margin: '0 0 12px' }}>
            You can only use items on your turn.
          </p>
        )}

        {itemIds.length === 0 ? (
          <p style={{ fontSize: 13, color: theme.muted, margin: 0 }}>
            You didn't bring any items into this scenario.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {itemIds.map((id) => {
              const item = ALL_ITEMS[id];
              if (!item) return null;
              const spent = character.spentItemIds.includes(id);
              const active = character.activeItems.find((ai) => ai.itemId === id);
              const relevant = !!refAction && !spent && itemRelevantToAction(item, refAction);

              // Usability mirrors the engine. All gated additionally on its
              // being your turn.
              const usable =
                isMyTurn &&
                !spent &&
                (item.effect.kind === 'move-bonus'
                  ? hasPendingMove
                  : item.effect.kind === 'jump-this-turn'
                    ? true
                    : item.effect.kind === 'shield-on-attack'
                      ? !active
                      : item.effect.kind === 'pierce-one-attack'
                        ? hasPendingAttack && (bindingMode ? !boundItemIds.includes(id) : !ct?.pierceCharge)
                        : item.effect.kind === 'poison-one-attack'
                          ? hasPendingMeleeAttack && (bindingMode ? !boundItemIds.includes(id) : !ct?.poisonCharge)
                          : item.effect.kind === 'advantage-one-attack'
                            ? hasPendingRangedAttack && (bindingMode ? !boundItemIds.includes(id) : !ct?.advantageCharge)
                            : item.effect.kind === 'heal-self'
                              ? !atFullHp
                              : item.effect.kind === 'heal-after-lost'
                                ? performedLostAction && healableInRange(item.effect.range).length > 0
                                : item.effect.kind === 'retrieve-discarded-card'
                                  ? discardedAtLevel(item.effect.cardLevel).length > 0
                                  : item.effect.kind === 'infuse-element'
                                    ? true
                                    : false);

              const buttonLabel = spent
                ? 'Spent'
                : active
                  ? `Active · ${active.usesRemaining}`
                  : item.effect.kind === 'shield-on-attack'
                    ? 'Activate'
                    : item.effect.kind === 'disadvantage-when-attacked' ||
                        item.effect.kind === 'shield-when-attacked'
                      ? 'Reactive'
                      : item.effect.kind === 'pierce-one-attack'
                        ? bindingMode
                          ? boundItemIds.includes(id) ? 'Attached' : 'Use'
                          : ct?.pierceCharge ? 'Armed' : 'Use'
                        : item.effect.kind === 'poison-one-attack'
                          ? bindingMode
                            ? boundItemIds.includes(id) ? 'Attached' : 'Use'
                            : ct?.poisonCharge ? 'Armed' : 'Use'
                          : item.effect.kind === 'advantage-one-attack'
                            ? bindingMode
                              ? boundItemIds.includes(id) ? 'Attached' : 'Use'
                              : ct?.advantageCharge ? 'Armed' : 'Use'
                            : item.effect.kind === 'heal-self'
                              ? atFullHp
                                ? 'Full HP'
                                : `Heal ${item.effect.amount}`
                              : item.effect.kind === 'heal-after-lost'
                                ? performedLostAction
                                  ? 'Aim'
                                  : 'Needs Lost'
                                : item.effect.kind === 'retrieve-discarded-card'
                                  ? discardedAtLevel(item.effect.cardLevel).length > 0
                                    ? 'Retrieve'
                                    : 'Empty'
                                  : item.effect.kind === 'infuse-element'
                                    ? 'Infuse'
                                    : 'Use';

              const aiming = aimingItemId === id;
              const pickTargets =
                item.effect.kind === 'heal-after-lost'
                  ? healableInRange(item.effect.range)
                  : livingMonsters;

              return (
                <div
                  key={id}
                  style={{
                    opacity: spent ? 0.5 : 1,
                    padding: '10px 12px',
                    background: relevant ? 'rgba(217, 164, 65, 0.10)' : theme.panel,
                    border: `1px solid ${relevant ? theme.accent : theme.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 14 }}>{item.name}</strong>
                        {relevant && (
                          <span
                            style={{
                              fontSize: 9,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              color: theme.accent,
                              border: `1px solid ${theme.accent}`,
                              borderRadius: 999,
                              padding: '1px 6px',
                            }}
                          >
                            Relevant
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: theme.muted }}>
                        {item.description}
                      </div>
                    </div>
                    <button
                      disabled={!usable}
                      onClick={() => {
                        if (!usable) return;
                        if (item.effect.kind === 'move-bonus') {
                          if (!refAction || !refSlot) return;
                          sock.send({
                            type: 'player_use_item',
                            itemId: id,
                            slot: refSlot,
                            actionId: refAction.id,
                          });
                          onClose();
                        } else if (
                          item.effect.kind === 'pierce-one-attack' ||
                          item.effect.kind === 'poison-one-attack' ||
                          item.effect.kind === 'advantage-one-attack'
                        ) {
                          if (bindingMode && onArmForBinding) {
                            // Target N: don't arm a turn-wide charge — hand the
                            // item back so the player taps the specific staged
                            // enemy it should hit. The actual use_item fires at
                            // attack-confirm time, ordered before that enemy's
                            // shot so the rider lands on it.
                            onArmForBinding(id);
                            onClose();
                          } else {
                            // Arm the rider — it attaches to the attack you then
                            // perform; no separate target pick. Close the modal so
                            // the player returns to targeting their attack.
                            sock.send({ type: 'player_use_item', itemId: id });
                            onClose();
                          }
                        } else if (
                          item.effect.kind === 'heal-after-lost' ||
                          item.effect.kind === 'retrieve-discarded-card'
                        ) {
                          setAimingItemId(aiming ? null : id);
                          setSelectedCardId(null);
                        } else {
                          sock.send({ type: 'player_use_item', itemId: id });
                          onClose();
                        }
                      }}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        background: aiming ? theme.border : usable ? theme.accent : 'transparent',
                        color: usable ? '#0e1612' : theme.muted,
                        border: usable ? 'none' : `1px solid ${theme.border}`,
                        borderRadius: 3,
                        fontFamily: theme.headingFont,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        cursor: usable ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {aiming ? 'Cancel' : buttonLabel}
                    </button>
                  </div>

                  {aiming && item.effect.kind === 'retrieve-discarded-card' && (
                    <div style={{ marginTop: 8 }}>
                      {discardedAtLevel(item.effect.cardLevel).length === 0 ? (
                        <span style={{ fontSize: 11, color: theme.muted }}>No cards to retrieve.</span>
                      ) : (
                        <>
                          {discardedAtLevel(item.effect.cardLevel).map((c) => (
                            <CardView
                              key={c.id}
                              card={c}
                              selected={selectedCardId === c.id}
                              onClick={() => setSelectedCardId(c.id)}
                            />
                          ))}
                          <button
                            disabled={selectedCardId == null}
                            onClick={() => {
                              if (selectedCardId == null) return;
                              sock.send({
                                type: 'player_use_item',
                                itemId: id,
                                targetCardId: selectedCardId,
                              });
                              setAimingItemId(null);
                              setSelectedCardId(null);
                              onClose();
                            }}
                            style={{ ...btn.primary(selectedCardId == null), marginTop: 8 }}
                          >
                            Confirm
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {aiming && item.effect.kind === 'heal-after-lost' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {pickTargets.length === 0 ? (
                        <span style={{ fontSize: 11, color: theme.muted }}>No targets.</span>
                      ) : (
                        pickTargets.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              sock.send({
                                type: 'player_use_item',
                                itemId: id,
                                targetUnitId: m.id,
                              });
                              setAimingItemId(null);
                              onClose();
                            }}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              background: 'transparent',
                              color: theme.text,
                              border: `1px solid ${theme.border}`,
                              borderRadius: 3,
                              cursor: 'pointer',
                            }}
                          >
                            {m.name} ({m.hp})
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small inline "Use Item" button rendered at the right edge of an action row.
 *  Only shown by the caller when the action has a relevant un-spent item. */
export function UseItemButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '4px 10px',
        background: 'transparent',
        color: theme.accent,
        border: `1px solid ${theme.accent}`,
        borderRadius: 3,
        fontFamily: theme.headingFont,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      Use Item
    </button>
  );
}
