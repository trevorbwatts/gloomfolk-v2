/**
 * Universal basic actions, available to every class.
 *
 * Basics are *substitutions* for a half — not halves themselves. When a
 * player substitutes a basic, that card's printed half is not "performed",
 * so its disposition does not trigger. The card still goes to its owner's
 * discard pile (unless the *other* half of the same card was performed and
 * carries a different disposition).
 */

import type { Ability } from './types.js';

export const BASIC_ATTACK_2: Ability = {
  steps: [{ type: 'attack', amount: 2, target: { kind: 'melee' } }],
};

export const BASIC_MOVE_2: Ability = {
  steps: [{ type: 'move', amount: 2 }],
};
