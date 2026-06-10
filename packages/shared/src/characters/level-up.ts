/**
 * Level-up rules (docs/rules/level-up.md).
 *
 * Leveling up happens only at Downtime (the lobby, between scenarios). When a
 * character levels up they must: add one ability card to their pool, increase
 * max HP (read from the class's level track), and gain + spend one perk mark.
 *
 * Perk-mark accounting: `CharacterInstance.perksUnlocked` is the spend ledger —
 * each entry is one mark committed to that perk index. Marks earned come from
 * level-ups (one per level past 1) and battle-goal checkmarks (one per
 * completed set of three, capped at +6). Mastery and character-creation marks
 * aren't tracked yet; add them here when those systems exist.
 */

import { catchUpLevelCap } from '../campaign/sheet.js';
import type { Card } from '../cards/types.js';
import type { ModifierCard } from '../modifiers/types.js';
import { STARTING_MODIFIER_DECK_TEMPLATE } from '../modifiers/deck.js';
import { experienceRequirementByLevel } from './experience.js';
import type { CharacterClass, CharacterLevel } from './types.js';
import type { CharacterPool } from './loadout.js';
import type { Perk } from './perks.js';

export const MAX_CHARACTER_LEVEL = 9;

/** XP needed to reach `level + 1`, or null at the level cap. */
export function nextLevelRequirement(level: number): number | null {
  if (level >= MAX_CHARACTER_LEVEL) return null;
  return experienceRequirementByLevel[(level + 1) as CharacterLevel];
}

/** Mandatory level-up check: XP has met the next level's requirement. */
export function canLevelUp(level: number, xp: number): boolean {
  const need = nextLevelRequirement(level);
  return need !== null && xp >= need;
}

/**
 * Optional prosperity catch-up (docs/rules/level-up.md): allowed while the
 * character's level is below half the current prosperity level (rounded up),
 * without meeting the XP requirement. Each catch-up level-up sets the
 * character's XP to the new level's requirement.
 */
export function canCatchUpLevelUp(
  level: number,
  prosperityLevel: number,
): boolean {
  return level < MAX_CHARACTER_LEVEL && level < catchUpLevelCap(prosperityLevel);
}

/** How a level-up was earned: mandatory XP threshold or optional catch-up. */
export type LevelUpMode = 'xp' | 'catch-up';

/**
 * Cards the character may add on reaching `newLevel`: any class card of a
 * level equal to or lower than `newLevel` that isn't already in their pool.
 * (Level-X cards count as level 1; they're in the pool from creation, as are
 * all level-1 cards, so in practice this yields the level-2+ cards.)
 */
export function eligibleLevelUpCards(
  characterClass: CharacterClass,
  pool: CharacterPool,
  newLevel: number,
): readonly Card[] {
  const owned = new Set(pool);
  return characterClass.cards.filter((c) => {
    if (owned.has(c.id)) return false;
    const cardLevel = c.level === 'X' ? 1 : c.level;
    return cardLevel <= newLevel;
  });
}

/** Marks committed to the perk at `perkIndex` (one per ledger entry). */
export function perkMarksCommitted(
  perksUnlocked: readonly number[],
  perkIndex: number,
): number {
  return perksUnlocked.filter((i) => i === perkIndex).length;
}

/**
 * How many times the perk's effects are actually in force:
 * - unlinked: once per committed mark (up to `count`)
 * - linked: once, but only after all `count` marks are committed
 */
export function perkResolvedTakes(perk: Perk, marksCommitted: number): number {
  if (perk.slots.kind === 'linked') {
    return marksCommitted >= perk.slots.count ? 1 : 0;
  }
  return Math.min(marksCommitted, perk.slots.count);
}

/** Cap on checkmark-earned perk marks: 18 checkmarks / 6 marks. */
const MAX_CHECKMARK_PERK_MARKS = 6;

/** Total perk marks earned: one per level past 1, one per three checkmarks. */
export function perkMarksEarned(
  level: number,
  battleGoalCheckmarks: number,
): number {
  const fromLevels = Math.max(0, level - 1);
  const fromCheckmarks = Math.min(
    Math.floor(Math.max(0, battleGoalCheckmarks) / 3),
    MAX_CHECKMARK_PERK_MARKS,
  );
  return fromLevels + fromCheckmarks;
}

/** Unspent perk marks. */
export function perkMarksAvailable(
  level: number,
  battleGoalCheckmarks: number,
  perksUnlocked: readonly number[],
): number {
  return perkMarksEarned(level, battleGoalCheckmarks) - perksUnlocked.length;
}

export type LevelUpInvalidReason =
  | 'max_level'
  | 'not_enough_xp'
  | 'card_not_eligible'
  | 'bad_perk_index'
  | 'perk_full';

export type LevelUpValidation =
  | { readonly ok: true; readonly mode: LevelUpMode }
  | { readonly ok: false; readonly reason: LevelUpInvalidReason };

/**
 * Validate a level-up choice: the level-up is earned (XP threshold met, or
 * prosperity catch-up applies), the chosen card is eligible for the new
 * level, and the chosen perk still has an open box. The XP path wins when
 * both apply (it's the mandatory one; catch-up never changes XP downward
 * in that case).
 */
export function validateLevelUp(
  characterClass: CharacterClass,
  state: {
    readonly level: number;
    readonly xp: number;
    readonly pool: CharacterPool;
    readonly perksUnlocked: readonly number[];
  },
  chosenCardId: string,
  perkIndex: number,
  prosperityLevel = 1,
): LevelUpValidation {
  if (state.level >= MAX_CHARACTER_LEVEL) return { ok: false, reason: 'max_level' };
  const mode: LevelUpMode | null = canLevelUp(state.level, state.xp)
    ? 'xp'
    : canCatchUpLevelUp(state.level, prosperityLevel)
      ? 'catch-up'
      : null;
  if (mode === null) {
    return { ok: false, reason: 'not_enough_xp' };
  }
  const newLevel = state.level + 1;
  const eligible = eligibleLevelUpCards(characterClass, state.pool, newLevel);
  if (!eligible.some((c) => c.id === chosenCardId)) {
    return { ok: false, reason: 'card_not_eligible' };
  }
  const perk = characterClass.perks[perkIndex];
  if (!Number.isInteger(perkIndex) || !perk) {
    return { ok: false, reason: 'bad_perk_index' };
  }
  if (perkMarksCommitted(state.perksUnlocked, perkIndex) >= perk.slots.count) {
    return { ok: false, reason: 'perk_full' };
  }
  return { ok: true, mode };
}

/** Structural equality for modifier cards (plain data, no functions). */
function modifierCardsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => modifierCardsEqual(v, b[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    modifierCardsEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

/** Remove one card matching `target` from `deck` (in place). */
function removeOneMatching(deck: ModifierCard[], target: ModifierCard): void {
  const i = deck.findIndex((c) => modifierCardsEqual(c, target));
  if (i !== -1) deck.splice(i, 1);
}

/**
 * The character's personal attack-modifier deck template: the standard
 * 20-card deck with every resolved perk's deck mutations applied. Non-deck
 * perk effects (granted abilities, passive rules) are not handled here.
 */
export function modifierDeckTemplateForCharacter(
  characterClass: CharacterClass,
  perksUnlocked: readonly number[],
): ModifierCard[] {
  const deck: ModifierCard[] = [...STARTING_MODIFIER_DECK_TEMPLATE];
  characterClass.perks.forEach((perk, idx) => {
    const takes = perkResolvedTakes(perk, perkMarksCommitted(perksUnlocked, idx));
    for (let t = 0; t < takes; t++) {
      for (const effect of perk.effects) {
        if (effect.kind === 'replace-modifier') {
          removeOneMatching(deck, effect.remove);
          deck.push(effect.add);
        } else if (effect.kind === 'add-modifier') {
          deck.push(effect.card);
        } else if (effect.kind === 'remove-modifier') {
          const n = effect.count ?? 1;
          for (let k = 0; k < n; k++) removeOneMatching(deck, effect.card);
        }
      }
    }
  });
  return deck;
}

/** Whether a resolved perk grants the "ignore item −1 cards" rule. */
export function characterIgnoresItemMinusOnes(
  characterClass: CharacterClass,
  perksUnlocked: readonly number[],
): boolean {
  return characterClass.perks.some((perk, idx) => {
    if (perkResolvedTakes(perk, perkMarksCommitted(perksUnlocked, idx)) === 0) {
      return false;
    }
    return perk.effects.some((e) => e.kind === 'ignore-item-minus-ones');
  });
}
