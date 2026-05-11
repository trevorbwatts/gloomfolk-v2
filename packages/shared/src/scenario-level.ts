/**
 * Scenario-level derived values. Index 0..7 corresponds to scenarioLevel 0..7.
 * Source: Gloomhaven 2E rulebook scenario level chart — see
 * `docs/rules/scenario-level.md`.
 */

export const MIN_SCENARIO_LEVEL = 0;
export const MAX_SCENARIO_LEVEL = 7;

/** Maximum number of money tokens that can be placed on the map in a single
 *  scenario, per rulebook (monster-damage-and-death). */
export const MONEY_TOKEN_CAP = 25;

const GOLD_CONVERSION = [2, 2, 3, 3, 4, 4, 5, 6] as const;
const TRAP_DAMAGE = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const HAZARDOUS_TERRAIN_DAMAGE = [1, 2, 2, 2, 3, 3, 3, 4] as const;
const BONUS_EXPERIENCE = [4, 6, 8, 10, 12, 14, 16, 18] as const;

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(MIN_SCENARIO_LEVEL, Math.min(MAX_SCENARIO_LEVEL, Math.floor(level)));
}

/** Gold awarded per money token at end-of-scenario, by scenario level. */
export function goldConversionFor(level: number): number {
  return GOLD_CONVERSION[clampLevel(level)]!;
}

/** Damage dealt by a generic "damage" trap, by scenario level. (= 2 + level) */
export function trapDamageFor(level: number): number {
  return TRAP_DAMAGE[clampLevel(level)]!;
}

/** Damage dealt by hazardous terrain on entry, by scenario level. (= 1 + ⌈l/3⌉) */
export function hazardousTerrainDamageFor(level: number): number {
  return HAZARDOUS_TERRAIN_DAMAGE[clampLevel(level)]!;
}

/** Bonus XP awarded for completing a scenario, by scenario level. (= 4 + 2*l) */
export function bonusExperienceFor(level: number): number {
  return BONUS_EXPERIENCE[clampLevel(level)]!;
}

/** Recommended scenario level: average character level / 2, rounded up. */
export function recommendedScenarioLevel(characterLevels: readonly number[]): number {
  if (characterLevels.length === 0) return 0;
  const avg = characterLevels.reduce((a, b) => a + b, 0) / characterLevels.length;
  return clampLevel(Math.ceil(avg / 2));
}
