/**
 * Attack-modifier-deck data model.
 *
 * Each character has a personal attack-modifier deck. Perks mutate this deck
 * (add/remove/replace cards). Items can also add cards (typically `-1`
 * "item-added" cards, distinguished from native deck cards).
 *
 * Only the kinds needed by encoded perks/cards live here. Add more kinds
 * (rolling effects, riders, etc.) as later perks require them.
 */

import type { Condition } from '../cards/types.js';

/**
 * Effects that ride along with the current outgoing attack when the
 * carrying modifier card is drawn. Valid on both flat and rolling cards.
 */
export type AttackRiderEffect =
  | { readonly kind: 'shield'; readonly amount: number }
  | { readonly kind: 'heal-self'; readonly amount: number }
  | { readonly kind: 'push'; readonly amount: number }
  | { readonly kind: 'apply-condition'; readonly condition: Condition }
  | {
      readonly kind: 'gain-money-token';
      readonly amount: number;
      /** Conditional gate; if absent, gain unconditionally. */
      readonly when?: { readonly kind: 'attack-targeted-adjacent-enemy' };
    };

/** What causes a parked reactive card to fire. */
export type ReactiveTrigger =
  | { readonly kind: 'adjacent-enemy-attacks-self' };

/**
 * Effects resolved when a parked reactive card's trigger fires. Distinct
 * from AttackRiderEffect: ReactiveEffects act on the *incoming* situation
 * (e.g. an enemy attack against you), not your own outgoing attack.
 */
export type ReactiveEffect =
  | { readonly kind: 'shield'; readonly amount: number };

/**
 * Effects valid only on Rolling modifier cards. (Parking implies the card
 * stays in play, which would be ill-defined on a non-rolling card that
 * already terminates the draw.)
 */
export type RollingOnlyEffect = {
  /**
   * Park this rolling card in the player's active area instead of
   * discarding it at end-of-attack. When `trigger` fires, resolve
   * `onTrigger` and discard the card. The rolling draw still continues
   * normally on the attack that revealed this card.
   */
  readonly kind: 'park-as-reactive';
  readonly trigger: ReactiveTrigger;
  readonly onTrigger: readonly ReactiveEffect[];
};

/** Any effect that can appear on a Rolling card. */
export type ModifierEffect = AttackRiderEffect | RollingOnlyEffect;

/** A flat-bonus modifier card (e.g. +0, +1, -1), optionally with riders. */
export interface FlatModifier {
  readonly kind: 'flat';
  /** Signed bonus: +1, +0, -1, -2. */
  readonly amount: number;
  /** Optional rider effects (e.g. "+0 Stun"). */
  readonly effects?: readonly AttackRiderEffect[];
}

/** Null (×0) modifier. */
export interface NullModifier {
  readonly kind: 'null';
}

/** ×2 / Critical modifier. */
export interface CritModifier {
  readonly kind: 'crit';
}

/** A Bless card shuffled in by the Bless condition. Resolves as a ×2 and is
 *  returned to the shared supply (not discarded) once drawn. */
export interface BlessModifier {
  readonly kind: 'bless';
}

/** A Curse card shuffled in by the Curse condition. Resolves as a Null (×0)
 *  and is returned to the shared supply (not discarded) once drawn. */
export interface CurseModifier {
  readonly kind: 'curse';
}

/**
 * Rolling modifier. When drawn, its bonus and effects are added to the
 * attack and another modifier card is drawn. Rolling cards do not end the
 * draw — they accumulate.
 */
export interface RollingModifier {
  readonly kind: 'rolling';
  /** Flat bonus printed on the rolling card. Defaults to 0 if omitted. */
  readonly amount?: number;
  readonly effects: readonly ModifierEffect[];
}

export type ModifierCard =
  | FlatModifier
  | NullModifier
  | CritModifier
  | BlessModifier
  | CurseModifier
  | RollingModifier;
