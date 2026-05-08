/**
 * Pool & scenario-loadout model.
 *
 * - `CharacterPool`: the set of card IDs a specific character has access to.
 *   At level 1 it equals all of the class's level-1 cards plus all of its
 *   level-X cards. Each level-up appends one chosen card. Pool is per-character
 *   state (separate from the class's master card list).
 * - `ScenarioLoadout`: which `class.handSize` cards from the pool the
 *   character is taking into the next scenario.
 */

import type { Card } from '../cards/types.js';
import type { CharacterClass } from './types.js';

/** A character's card pool: the IDs of every card they have unlocked. */
export type CharacterPool = readonly string[];

/** Default pool for a freshly-created level-1 character: all L1 + LX cards. */
export function defaultPoolForClass(
  characterClass: CharacterClass,
): CharacterPool {
  return characterClass.cards
    .filter((c) => c.level === 1 || c.level === 'X')
    .map((c) => c.id);
}

/** Resolve a pool's card IDs to full Card objects, in printed order. */
export function cardsInPool(
  characterClass: CharacterClass,
  pool: CharacterPool,
): readonly Card[] {
  const ids = new Set(pool);
  return characterClass.cards.filter((c) => ids.has(c.id));
}

/**
 * Default scenario loadout for a class+pool: every level-1 card from the
 * pool, in printed order, capped at `class.handSize`.
 */
export function defaultLoadout(
  characterClass: CharacterClass,
  pool: CharacterPool,
): readonly string[] {
  const ids = new Set(pool);
  return characterClass.cards
    .filter((c) => ids.has(c.id) && c.level === 1)
    .slice(0, characterClass.handSize)
    .map((c) => c.id);
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
  | { readonly kind: 'card-not-in-pool'; readonly cardId: string };

/** Validate a loadout: count matches hand size, no duplicates, every chosen
    card belongs to the player's pool. */
export function validateLoadout(
  characterClass: CharacterClass,
  pool: CharacterPool,
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

  const poolSet = new Set(pool);
  for (const id of chosenCardIds) {
    if (!poolSet.has(id)) {
      return { ok: false, reason: { kind: 'card-not-in-pool', cardId: id } };
    }
  }

  return { ok: true };
}
