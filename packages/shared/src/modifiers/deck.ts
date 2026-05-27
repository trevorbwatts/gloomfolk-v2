import type { ModifierCard } from './types.js';

/**
 * A modifier card in a player's deck. The `id` is stable across draws and
 * reshuffles — used by the client to key reveal animations.
 */
export interface ModifierCardInstance {
  readonly id: string;
  readonly card: ModifierCard;
}

/**
 * Every character starts with the same 20-card attack-modifier deck:
 * 6× +0, 5× +1, 5× -1, 1× +2, 1× -2, 1× Null, 1× ×2 (Crit).
 */
export const STARTING_MODIFIER_DECK_TEMPLATE: readonly ModifierCard[] = [
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: 2 },
  { kind: 'flat', amount: -2 },
  { kind: 'null' },
  { kind: 'crit' },
];

/**
 * The shared monster attack-modifier deck. All monsters in a scenario draw
 * from this single deck (one deck per scenario, not per monster type).
 * Same composition as the player template for now; broken out so the two
 * can diverge cleanly later (e.g. blessings/curses sliding cards in).
 */
export const MONSTER_MODIFIER_DECK_TEMPLATE: readonly ModifierCard[] = [
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 0 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: 1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: -1 },
  { kind: 'flat', amount: 2 },
  { kind: 'flat', amount: -2 },
  { kind: 'null' },
  { kind: 'crit' },
];

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Build a fresh, shuffled starting modifier deck with stable ids. */
export function createStartingModifierDeck(): ModifierCardInstance[] {
  const instances: ModifierCardInstance[] = STARTING_MODIFIER_DECK_TEMPLATE.map(
    (card, i) => ({ id: `m${i + 1}`, card }),
  );
  return shuffleInPlace(instances);
}

/** Build a fresh, shuffled monster attack-modifier deck with stable ids. */
export function createMonsterModifierDeck(): ModifierCardInstance[] {
  const instances: ModifierCardInstance[] = MONSTER_MODIFIER_DECK_TEMPLATE.map(
    (card, i) => ({ id: `mm${i + 1}`, card }),
  );
  return shuffleInPlace(instances);
}


/** Combine deck + discard, shuffle, return as the new deck. */
export function reshuffleModifierDeck(
  deck: ModifierCardInstance[],
  discard: ModifierCardInstance[],
): ModifierCardInstance[] {
  return shuffleInPlace([...deck, ...discard]);
}

/**
 * Resolve a drawn modifier against a base attack amount.
 * - flat: base + amount (clamped to 0 below)
 * - null: 0
 * - crit (×2): base * 2
 * - rolling: not used in starting deck; treated as flat 0 for safety.
 */
export function applyModifierToAttack(
  base: number,
  card: ModifierCard,
): number {
  if (card.kind === 'flat') return Math.max(0, base + card.amount);
  if (card.kind === 'null') return 0;
  if (card.kind === 'crit') return base * 2;
  return base;
}

/** Whether a drawn card forces an end-of-turn reshuffle (Null or ×2). */
export function triggersReshuffle(card: ModifierCard): boolean {
  return card.kind === 'null' || card.kind === 'crit';
}

/** Short label for UI ("+1", "−2", "Null", "×2"). */
export function modifierLabel(card: ModifierCard): string {
  if (card.kind === 'flat') {
    if (card.amount === 0) return '+0';
    if (card.amount > 0) return `+${card.amount}`;
    return `−${Math.abs(card.amount)}`;
  }
  if (card.kind === 'null') return 'Null';
  if (card.kind === 'crit') return '×2';
  return '?';
}
