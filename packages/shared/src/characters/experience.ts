import type { ByCharacterLevel } from './types.js';

/**
 * Experience point total required to be at each character level.
 * A character whose XP is ≥ the requirement of `level + 1` must level up
 * during the next Downtime step. XP does not reset on level-up.
 *
 * Class-independent: every class shares this table.
 */
export const experienceRequirementByLevel: ByCharacterLevel<number> = {
  1: 0,
  2: 45,
  3: 95,
  4: 150,
  5: 210,
  6: 275,
  7: 345,
  8: 420,
  9: 500,
};
