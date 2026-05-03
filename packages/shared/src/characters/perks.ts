/**
 * Perk data model.
 *
 * A perk is a single entry in the perk list on a character sheet. Each entry
 * has one or more boxes; checking a box requires spending a perk mark.
 *
 * Slot styles
 * - `unlinked` (N boxes): the perk can be taken up to N times; each take
 *   costs one perk mark and resolves `effects` again.
 * - `linked` (N boxes): the perk is taken once, but only after N marks have
 *   been committed to it across multiple level-ups.
 *
 * Effect resolution: when a perk is taken, every entry in `effects` is
 * applied. Some effects (deck mutations) are one-shot at take-time; others
 * are persistent rules that remain in force for the rest of the campaign
 * and may need a reminder card in the character's active area.
 */

import type { ModifierCard } from '../modifiers/types.js';

export type PerkSlots =
  | {
      readonly kind: 'unlinked';
      /** Maximum number of times the perk may be taken. */
      readonly count: number;
    }
  | {
      readonly kind: 'linked';
      /** Number of marks that must accumulate before the single take resolves. */
      readonly count: number;
    };

/** Replace one copy of `remove` in the modifier deck with one copy of `add`. */
export interface ReplaceModifierEffect {
  readonly kind: 'replace-modifier';
  readonly remove: ModifierCard;
  readonly add: ModifierCard;
}

/** Add one copy of `card` to the modifier deck. */
export interface AddModifierEffect {
  readonly kind: 'add-modifier';
  readonly card: ModifierCard;
}

/**
 * Persistent rule: −1 modifier cards that items would add to the deck
 * (the ones marked in the lower-left corner of some item cards) are
 * ignored. Native deck −1 cards are unaffected. Resolves to a reminder
 * card in the active area.
 */
export interface IgnoreItemMinusOnesEffect {
  readonly kind: 'ignore-item-minus-ones';
}

/**
 * Steps inside a perk-granted active ability. Mirrors `AbilityStep` from
 * cards but scoped to the small set of effects perks can grant.
 */
export type PerkAbilityStep =
  | { readonly kind: 'loot'; readonly range: number }
  | {
      readonly kind: 'when';
      readonly cause: { readonly kind: 'money-token-looted-this-action' };
      readonly effects: readonly PerkAbilityStep[];
    }
  | { readonly kind: 'refresh-item' };

export interface PerkActiveAbility {
  readonly id: string;
  /** When during the scenario the ability may be performed. */
  readonly timing: 'own-turn';
  /** Hard cap on uses per scenario. */
  readonly usesPerScenario: number;
  readonly steps: readonly PerkAbilityStep[];
}

/** Grant the character a new active ability (not a deck mutation). */
export interface GrantActiveAbilityEffect {
  readonly kind: 'grant-active-ability';
  readonly ability: PerkActiveAbility;
}

/** A trigger that fires a passive perk rule. */
export type PassiveTrigger =
  | { readonly kind: 'long-rest' }
  | {
      /**
       * Fires once per scenario, on each affected character's first
       * attack during the first round.
       */
      readonly kind: 'first-attack-of-scenario';
      /** Whose first attack the trigger applies to. */
      readonly scope: 'self' | 'each-character';
    };

/** The effect a passive rule applies when its trigger fires. */
export type PassiveRuleEffect =
  | {
      readonly kind: 'next-round-first-move-bonus';
      readonly amount: number;
    }
  /** Draw two modifier cards and apply the better one. */
  | { readonly kind: 'advantage' };

/**
 * Persistent passive rule: every time `trigger` fires, `effect` applies.
 * Resolves to a reminder card in the active area.
 */
export interface PassiveRuleEffectEntry {
  readonly kind: 'passive-rule';
  readonly trigger: PassiveTrigger;
  readonly effect: PassiveRuleEffect;
}

export type PerkEffect =
  | ReplaceModifierEffect
  | AddModifierEffect
  | IgnoreItemMinusOnesEffect
  | GrantActiveAbilityEffect
  | PassiveRuleEffectEntry;

export interface Perk {
  readonly id: string;
  readonly slots: PerkSlots;
  /** Printed perk text, verbatim. */
  readonly text: string;
  /** Effects applied each time the perk is taken. */
  readonly effects: readonly PerkEffect[];
}
