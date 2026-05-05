import type { ActivePersistent, GameState, PersistentEffect, PlayerState } from '../types.js';

let nextPersistentSeq = 0;
function newInstanceId(): string {
  nextPersistentSeq += 1;
  return `pers_${nextPersistentSeq}`;
}

function findPlayerByUnitId(state: GameState, unitId: string): PlayerState | undefined {
  return Object.values(state.players).find((p) => p.unitId === unitId);
}

// Activate a persistent effect on a player. Caller is responsible for removing the
// source card from hand/selectedCard before calling this.
export function addPersistent(
  player: PlayerState,
  cardId: string,
  effect: PersistentEffect,
): ActivePersistent {
  // react-shield-retaliate is a permanent persistent (no charges counted; uses
  // `triggeredRound` for per-round gating). Other variants count down charges.
  const remainingCharges = 'charges' in effect ? effect.charges : Number.POSITIVE_INFINITY;
  const inst: ActivePersistent = {
    instanceId: newInstanceId(),
    cardId,
    effect,
    remainingCharges,
  };
  player.activePersistents.push(inst);
  return inst;
}

// Route a depleted persistent's source card to lost or discard, then remove it.
function retireDepleted(player: PlayerState, instanceId: string): void {
  const idx = player.activePersistents.findIndex((p) => p.instanceId === instanceId);
  if (idx < 0) return;
  const inst = player.activePersistents[idx]!;
  if (inst.effect.lostWhenEmpty) {
    player.lost.push(inst.cardId);
  } else {
    player.discard.push(inst.cardId);
  }
  player.activePersistents.splice(idx, 1);
}

// If the unit has any active negate-damage persistent, consume one charge and return true.
// Charges are consumed FIFO (oldest first). Returns true if damage should be skipped.
export function consumeNegate(state: GameState, unitId: string): boolean {
  const player = findPlayerByUnitId(state, unitId);
  if (!player) return false;
  const inst = player.activePersistents.find(
    (p) => p.effect.kind === 'negate-damage' && p.remainingCharges > 0,
  );
  if (!inst) return false;
  inst.remainingCharges -= 1;
  if (inst.remainingCharges <= 0) {
    retireDepleted(player, inst.instanceId);
  }
  return true;
}

// Reactive shield/retaliate trigger: first time per round the player gains shield or
// retaliate from an ability, the persistent (if active) grants +1 of each. Returns
// the bonus to add. Mutates triggeredRound to prevent re-firing this round.
export function triggerReactiveShieldRetaliate(state: GameState, unitId: string): { shield: number; retaliate: number } {
  const player = findPlayerByUnitId(state, unitId);
  if (!player) return { shield: 0, retaliate: 0 };
  const inst = player.activePersistents.find((p) => p.effect.kind === 'react-shield-retaliate');
  if (!inst) return { shield: 0, retaliate: 0 };
  if (inst.triggeredRound === state.round) return { shield: 0, retaliate: 0 };
  inst.triggeredRound = state.round;
  return { shield: 1, retaliate: 1 };
}

// Returns the bonus to add to the next move ability and decrements one charge.
// Multiple bonus-move persistents stack additively. Charges are consumed once per call.
export function consumeMoveBonus(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;
  let bonus = 0;
  const toRetire: string[] = [];
  for (const inst of player.activePersistents) {
    if (inst.effect.kind !== 'bonus-move' || inst.remainingCharges <= 0) continue;
    bonus += inst.effect.bonus;
    inst.remainingCharges -= 1;
    if (inst.remainingCharges <= 0) toRetire.push(inst.instanceId);
  }
  for (const id of toRetire) retireDepleted(player, id);
  return bonus;
}
