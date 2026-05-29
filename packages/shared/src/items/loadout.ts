/**
 * Item loadout validation. Per items.md:44-48, a character can bring at most:
 *   - 1 Head, 1 Body, 1 Feet
 *   - 2 One-Hand items OR 1 Two-Hand item (not both)
 *   - Small items up to half their level, rounded up
 */

import { getItem } from './items.js';
import type { ItemSlot } from './types.js';

export type ItemLoadoutValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function maxSmallItemsForLevel(characterLevel: number): number {
  return Math.ceil(characterLevel / 2);
}

export function validateItemLoadout(
  characterLevel: number,
  ownedItemIds: readonly string[],
  broughtItemIds: readonly string[],
): ItemLoadoutValidation {
  const owned = new Set(ownedItemIds);
  for (const id of broughtItemIds) {
    if (!owned.has(id)) {
      return { ok: false, reason: `item ${id} is not owned` };
    }
  }

  const counts: Record<ItemSlot, number> = {
    head: 0,
    body: 0,
    feet: 0,
    'one-hand': 0,
    'two-hands': 0,
    small: 0,
  };
  for (const id of broughtItemIds) {
    const item = getItem(id);
    if (!item) return { ok: false, reason: `unknown item ${id}` };
    counts[item.slot]++;
  }

  if (counts.head > 1) return { ok: false, reason: 'too many head items' };
  if (counts.body > 1) return { ok: false, reason: 'too many body items' };
  if (counts.feet > 1) return { ok: false, reason: 'too many feet items' };
  if (counts['two-hands'] > 1) return { ok: false, reason: 'too many two-hand items' };
  if (counts['two-hands'] === 1 && counts['one-hand'] > 0) {
    return { ok: false, reason: 'cannot bring one-hand items with a two-hand item' };
  }
  if (counts['one-hand'] > 2) return { ok: false, reason: 'too many one-hand items' };
  const smallMax = maxSmallItemsForLevel(characterLevel);
  if (counts.small > smallMax) {
    return { ok: false, reason: `too many small items (max ${smallMax})` };
  }

  return { ok: true };
}
