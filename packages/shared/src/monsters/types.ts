/**
 * Monster data model — Gloomhaven 2E shape.
 *
 * Glossary
 * - MonsterType: a kind of monster (e.g. "Bandit Archer"). Owns one stat card
 *   and one ability deck shared by every standee of the type in a scenario.
 * - MonsterRank: 'normal' | 'elite' | 'named' | 'boss'. Targeting filters use
 *   strict equality on rank — a `named` monster is NOT a normal/elite.
 * - MonsterLevel: scenario level, 0..7. Stat card values are indexed by
 *   `(level, rank)`; bosses have one stat block per level (no rank dimension).
 * - StatBlock: HP / Move / Attack at a given level + rank, plus any
 *   persistent bonuses, attack effects, and immunities printed on that block.
 *
 * See [docs/rules/monster-turns.md](../../../../docs/rules/monster-turns.md)
 * for the rules these shapes encode.
 */

import type {
  Condition,
  ElementSelector,
  MoveTrait,
  NegativeCondition,
} from '../cards/types.js';

export type MonsterRank = 'normal' | 'elite' | 'named' | 'boss';

export type MonsterLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Active bonuses printed on a monster stat block — apply for the entire
 * scenario, even when the monster is stunned (per the active-bonus rule).
 */
export type MonsterPersistentBonus =
  | { readonly kind: 'shield'; readonly amount: number }
  | { readonly kind: 'retaliate'; readonly amount: number; readonly range?: number };

/**
 * Effects added to every attack performed by a monster of this type, on
 * top of whatever the drawn ability card carries. Encoded with the same
 * `MonsterAttackEffect` shape used on ability cards (see below) for now —
 * lift to a wider union if stat-card-only effects appear that the cards
 * can't express.
 */
export interface MonsterStatBlock {
  readonly hp: number;
  readonly movement: number;
  readonly attack: number;
  readonly persistentBonuses?: readonly MonsterPersistentBonus[];
  readonly attackEffects?: readonly MonsterAttackEffect[];
}

/** Stats for a non-boss monster type at a single level (both ranks). */
export interface RankedStatBlock {
  readonly normal: MonsterStatBlock;
  readonly elite: MonsterStatBlock;
}

export interface MonsterStatCard {
  readonly id: string;
  readonly name: string;
  /** Number of physical standees in the box. Selects the stat-sleeve side
      (six-section vs. ten-section). Pure component metadata. */
  readonly standeeCount: 6 | 10;
  /** Conditions this monster type is immune to. Per the rulebook the
      immunity icons sit at the card edges spanning both ranks, so they are
      lifted to the type level. */
  readonly immunities?: readonly Condition[];
  /** Stat blocks indexed by scenario level. Not every type covers every
      level — some only appear in late-campaign scenarios. */
  readonly levels: Partial<Record<MonsterLevel, RankedStatBlock>>;
  /** The monster set whose ability deck this type draws from. Multiple
      types may share a set (e.g. several Archer types share the Archer
      deck). */
  readonly setId: string;
}

// ─── Monster ability cards ───────────────────────────────────────────────
//
// Per the rules, a monster ability card is an *ordered list of abilities*,
// not a top/bottom split like character cards. Horizontal dividers on the
// printed card are visual separators between sequential abilities.
//
// Values on the card are *modifiers* relative to the base stats from the
// stat card (Move +1, Attack -1, Target +1). Range, when present, is an
// absolute value supplied by the card itself — stat cards do not carry a
// default range.

/** A condition rider applied by an attack on the card to every hit target. */
export interface MonsterAttackEffect {
  readonly kind: 'apply-condition';
  readonly condition: NegativeCondition;
}

export type MonsterAbilityStep =
  | {
      readonly kind: 'move';
      readonly modifier: number;
      readonly traits?: readonly MoveTrait[];
    }
  | {
      readonly kind: 'attack';
      readonly modifier: number;
      /** Absolute attack range from the card. Omit for melee. */
      readonly range?: number;
      /** Absolute target count printed on the card (e.g. `Target 2`).
          Overrides the default of 1; not added to base. Omit for
          single-target. */
      readonly targets?: number;
      /** Riders applied to every target hit by this attack. */
      readonly effects?: readonly MonsterAttackEffect[];
    }
  | {
      /** Loot all money tokens within `range` of the monster's hex.
          Range 0 = own hex only; range 1 = own hex + all adjacent. */
      readonly kind: 'loot';
      readonly range: number;
    }
  | {
      /** Place a trap on the map, dealing `damage` to figures that enter it.
          `placement` describes how the destination hex is chosen.
          Engine policy: when a placement rule produces multiple equally-
          valid hexes, pick one uniformly at random. (Per design decision —
          avoids prompting the players for a low-impact UI choice.) */
      readonly kind: 'create-trap';
      readonly damage: number;
      readonly placement: 'adjacent-empty-closest-to-enemy';
    }
  | {
      /** Mark an element for end-of-block infusion. Fires once per set
          turn block at the end (after the last member's turn), provided
          at least one member of the set acted. */
      readonly kind: 'infuse';
      readonly element: ElementSelector;
    }
  | {
      /** Consume an element at the start of the set's turn block (before
          the first member acts), provided at least one member will act.
          Every member acting in the block benefits from `effect`; members
          that arrive after the block start (spawned/revealed later) do
          NOT benefit retroactively. */
      readonly kind: 'consume';
      readonly element: ElementSelector;
      readonly effect: MonsterConsumeEffect;
    };

/** A bonus a monster set picks up by consuming an element at block start. */
export type MonsterConsumeEffect =
  | { readonly kind: 'attack-bonus'; readonly amount: number }
  | { readonly kind: 'range-bonus'; readonly amount: number }
  | { readonly kind: 'shield-bonus'; readonly amount: number };

export interface MonsterAbilityCard {
  /** Stable id, e.g. `archer.greed`. */
  readonly id: string;
  /** Set the card belongs to (matches `MonsterStatCard.setId`). */
  readonly setId: string;
  readonly name: string;
  readonly initiative: number;
  /** Ordered list of abilities. Resolved top-to-bottom on each acting
      monster's turn; steps whose preconditions aren't met are skipped. */
  readonly abilities: readonly MonsterAbilityStep[];
  /** End-of-round shuffle marker. When true on the card drawn this round,
      the discard pile is shuffled back at round end. */
  readonly shuffle?: boolean;
}

export interface MonsterAbilityDeck {
  readonly setId: string;
  /** Display name of the set (e.g. "Archer"). */
  readonly setName: string;
  /** Exactly 8 cards, per the rulebook. */
  readonly cards: readonly MonsterAbilityCard[];
}
