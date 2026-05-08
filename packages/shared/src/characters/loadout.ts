/**
 * Pre-scenario loadout: which ability cards a player takes into a scenario.
 *
 * At the start of each scenario the player picks `class.handSize` cards from
 * the cards available to them. At character level 1 the available pool is
 * level-1 cards plus all level-X cards. (Higher character levels add the
 * specific cards the player chose at each level-up — modeled in a later
 * iteration; for now this module assumes a level-1 character.)
 */

import type { Card } from '../cards/types.js';
import type { CharacterClass } from './types.js';

/**
 * Cards a level-1 character may pick from: every level-1 card plus every
 * level-X card the class has. (Higher character levels also include the
 * specific cards chosen at each level-up; that selection model is not yet
 * implemented — extend this function when it is.)
 */
export function availableCardsAtLevelOne(
  characterClass: CharacterClass,
): readonly Card[] {
  return characterClass.cards.filter(
    (c) => c.level === 1 || c.level === 'X',
  );
}

/**
 * Default scenario loadout: every level-1 card pre-selected. At level 1 this
 * matches `handSize` for both currently-modeled classes (Bruiser 10/10,
 * Silent Knife 9/9). If a class ever has more level-1 cards than its hand
 * size, the first `handSize` level-1 cards in printed order are returned.
 */
export function defaultLoadout(
  characterClass: CharacterClass,
): readonly string[] {
  const levelOne = characterClass.cards.filter((c) => c.level === 1);
  return levelOne.slice(0, characterClass.handSize).map((c) => c.id);
}

/** A scenario loadout: the cards a specific character is taking in. */
export interface ScenarioLoadout {
  readonly characterClassId: string;
  readonly chosenCardIds: readonly string[];
}

export type LoadoutValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: LoadoutInvalidReason };

export type LoadoutInvalidReason =
  | { readonly kind: 'wrong-count'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'duplicate-card'; readonly cardId: string }
  | { readonly kind: 'unknown-card'; readonly cardId: string }
  | { readonly kind: 'card-not-available'; readonly cardId: string };

/** Validate a level-1 loadout: count, duplicates, and pool membership. */
export function validateLevelOneLoadout(
  characterClass: CharacterClass,
  loadout: ScenarioLoadout,
): LoadoutValidation {
  const { chosenCardIds } = loadout;

  if (chosenCardIds.length !== characterClass.handSize) {
    return {
      ok: false,
      reason: {
        kind: 'wrong-count',
        expected: characterClass.handSize,
        actual: chosenCardIds.length,
      },
    };
  }

  const seen = new Set<string>();
  for (const id of chosenCardIds) {
    if (seen.has(id)) {
      return { ok: false, reason: { kind: 'duplicate-card', cardId: id } };
    }
    seen.add(id);
  }

  const allowedById = new Map(
    availableCardsAtLevelOne(characterClass).map((c) => [c.id, c]),
  );
  const knownById = new Map(characterClass.cards.map((c) => [c.id, c]));
  for (const id of chosenCardIds) {
    if (!knownById.has(id)) {
      return { ok: false, reason: { kind: 'unknown-card', cardId: id } };
    }
    if (!allowedById.has(id)) {
      return { ok: false, reason: { kind: 'card-not-available', cardId: id } };
    }
  }

  return { ok: true };
}
