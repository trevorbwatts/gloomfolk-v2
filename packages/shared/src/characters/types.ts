/**
 * Character class data model.
 *
 * - CharacterLevel: 1..9 — the player's character level.
 * - HpByLevel: max HP at each character level, indexed 1..9.
 */

import type { Mastery } from './masteries.js';
import type { Perk } from './perks.js';

export type CharacterLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A value per character level (1..9). */
export type ByCharacterLevel<T> = { readonly [L in CharacterLevel]: T };

export type HpByLevel = ByCharacterLevel<number>;

export interface CharacterClass {
  readonly id: string;
  readonly name: string;
  readonly hp: HpByLevel;
  /** Perk list as printed on the character sheet, in order. Position is
      load-bearing: perks are referenced by index when marking checkboxes. */
  readonly perks: readonly Perk[];
  /** Masteries printed on the character sheet, in order. Each is single-take
      and grants a perk mark when achieved. */
  readonly masteries: readonly Mastery[];
}
