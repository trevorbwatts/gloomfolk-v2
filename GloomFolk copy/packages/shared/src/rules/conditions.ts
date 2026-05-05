import type { ConditionId, GameState, Unit } from '../types.js';
import { END_OF_TURN_CONDITIONS, NEGATIVE_CONDITIONS } from '../types.js';

export function hasCondition(unit: Unit, condition: ConditionId): boolean {
  return unit.conditions.includes(condition);
}

// Attempt to add a condition, respecting safeguard. Returns true if condition was gained.
export function gainCondition(unit: Unit, condition: ConditionId): boolean {
  // Safeguard blocks one negative condition per activation.
  if (NEGATIVE_CONDITIONS.includes(condition) && hasCondition(unit, 'safeguard')) {
    removeCondition(unit, 'safeguard');
    return false;
  }
  // Gaining a condition you already have resets duration (no-op for Set-style storage).
  if (!unit.conditions.includes(condition)) {
    unit.conditions.push(condition);
  }
  return true;
}

export function removeCondition(unit: Unit, condition: ConditionId): void {
  unit.conditions = unit.conditions.filter((c) => c !== condition);
}

// Start-of-turn hook: applies wound damage using suffer-damage rules (only ward reduces).
export function applyStartOfTurnConditions(state: GameState, unitId: string): void {
  const unit = state.units[unitId];
  if (!unit || unit.exhausted) return;

  if (hasCondition(unit, 'wound')) {
    let damage = 1;
    if (hasCondition(unit, 'ward')) {
      removeCondition(unit, 'ward');
      damage = Math.floor(damage / 2); // 0 — ward absorbs 1 suffer damage completely
      state.log.push(`${unit.archetype}'s ward absorbs wound damage`);
    }
    if (damage > 0) {
      unit.hp = Math.max(0, unit.hp - damage);
      if (unit.hp === 0) unit.exhausted = true;
      state.log.push(`${unit.archetype} suffers 1 wound damage`);
    }
  }
}

// End-of-turn hook: removes all turn-duration conditions.
export function applyEndOfTurnConditions(state: GameState, unitId: string): void {
  const unit = state.units[unitId];
  if (!unit) return;
  for (const cond of END_OF_TURN_CONDITIONS) {
    removeCondition(unit, cond);
  }
}

// Called during heal: removes wound and poison, returns whether HP increase should be blocked.
// A single heal removes both, but if poison was present the HP increase is prevented.
export function applyHealConditions(unit: Unit): { blockHpIncrease: boolean } {
  const hadPoison = hasCondition(unit, 'poison');
  removeCondition(unit, 'wound');
  removeCondition(unit, 'poison');
  return { blockHpIncrease: hadPoison };
}
