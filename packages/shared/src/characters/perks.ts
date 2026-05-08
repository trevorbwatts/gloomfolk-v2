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

import type { PositiveCondition, NegativeCondition } from '../cards/types.js';
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

/** Remove `count` copies of `card` from the modifier deck. */
export interface RemoveModifierEffect {
  readonly kind: 'remove-modifier';
  readonly card: ModifierCard;
  /** Defaults to 1. */
  readonly count?: number;
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
  | { readonly kind: 'refresh-item' }
  /** Apply a condition to a target. */
  | {
      readonly kind: 'apply-condition';
      readonly condition: PositiveCondition | NegativeCondition;
      readonly target: 'self' | 'tagged-enemy';
    }
  /** Place one of the player's money tokens in a target hex. */
  | {
      readonly kind: 'place-money-token';
      readonly target: { readonly kind: 'enemy-hex'; readonly range: number };
    }
  /** Perform an attack as part of the granted ability. */
  | {
      readonly kind: 'attack';
      readonly amount: number;
      readonly range: number;
      /** 'tagged-enemy': the enemy whose hex received a placed money token. */
      readonly target: 'tagged-enemy';
    };

/** When during the scenario a perk-granted ability may be triggered. */
export type PerkAbilityTiming =
  /** Performed on the player's own turn as an action. */
  | 'own-turn'
  /** Performed at the end of each of the player's rests (short or long). */
  | 'end-of-rest';

export interface PerkActiveAbility {
  readonly id: string;
  readonly timing: PerkAbilityTiming;
  /** Hard cap on uses per scenario. Omit when the timing itself bounds uses
      (e.g. `end-of-rest` is naturally limited by rest count). */
  readonly usesPerScenario?: number;
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
    }
  /** Out-of-scenario trigger: the player completes a city event. */
  | { readonly kind: 'city-event-completed' };

/** The effect a passive rule applies when its trigger fires. */
export type PassiveRuleEffect =
  | {
      readonly kind: 'next-round-first-move-bonus';
      readonly amount: number;
    }
  /** Draw two modifier cards and apply the better one. */
  | { readonly kind: 'advantage' }
  /** Draw an attack modifier as if performing a virtual Attack of
      `attackBase`, then award gold equal to the damage that virtual attack
      would have dealt. */
  | {
      readonly kind: 'gold-equal-to-virtual-attack-damage';
      readonly attackBase: number;
    };

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
  | RemoveModifierEffect
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
