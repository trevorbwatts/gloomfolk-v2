/**
 * Card data model — Gloomhaven 2E shape.
 *
 * Glossary
 * - Card: name, level, initiative, top half, bottom half.
 * - Half (CardHalf): top or bottom — the unit a player commits at action-choice
 *   time. The rulebook calls each half an "Action".
 * - Ability: a sub-region of a half, separated from sibling abilities by
 *   horizontal "ability lines" on the printed card. A half with no line has
 *   one implicit ability. Abilities are skippable as whole units (unless
 *   marked mandatory); order is preserved.
 * - AbilityStep: one effect inside an ability (Attack, Move, Gain EXP, ...).
 *   Not a rulebook term — internal granularity for the engine.
 * - Disposition: half-level pile destination — discard / lost / persistent.
 *   Triggers if any non-basic ability of the half is performed.
 * - Mandatory (`!`): per-step flag. Binds to a specific effect; if that effect
 *   is engaged, it cannot be opted out of.
 * - Node: upgrade slot on a step (diamond / square). Mechanics deferred.
 */

export type CardLevel = 1 | 'X' | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * A reference to a value that depends on turn-state, used for "X where X is …"
 * cards. Resolved by the engine at the moment the ability resolves.
 */
export type AmountRef =
  | { readonly kind: 'hexes-moved-this-turn' }
  | { readonly kind: 'damage-dealt-this-turn' };

/** Either a fixed number or a reference to a turn-state value. */
export type Amount = number | AmountRef;

export type Disposition =
  | 'discard'
  | 'lost'
  | 'persistent-round'
  | 'persistent-tracked'
  /** Persistent until end of scenario or voluntary removal — no use track.
      Default `finalPile`: 'lost'. Used for "passive" round-conditional bonuses
      that have no charge slots. */
  | 'persistent-scenario';

export type NodeShape = 'square' | 'circle' | 'diamond' | 'hex';

export type MoveTrait = 'jump';

/** Axial hex offset, pointy-top. Coordinates are relative to the actor (0,0). */
export interface HexOffset {
  readonly q: number;
  readonly r: number;
}

export type AttackTarget =
  | { readonly kind: 'melee' }
  | {
      readonly kind: 'ranged';
      readonly range: number;
      /** Number of distinct enemies/figures the ability may target.
          Default 1 if omitted. */
      readonly targets?: number;
      readonly targetsNode?: NodeShape;
    }
  | { readonly kind: 'enemies-moved-through' }
  | {
      readonly kind: 'all-within-range';
      readonly range: number;
      /** Whose figures the effect applies to. Default: 'enemies' (attacks and
          condition applies hit enemies only). Set 'figures' for effects that
          hit allies too (e.g. push-all). */
      readonly scope?: 'enemies' | 'figures';
    }
  | {
      readonly kind: 'aoe';
      /** Target hexes relative to the actor, not including the actor's own hex.
          Player chooses rotation AND mirroring at cast time (12 orientations). */
      readonly pattern: readonly HexOffset[];
      /** Upgrade slots on the AOE shape itself (e.g. expand the pattern).
          Order matches the printed slots; each may take an attached upgrade. */
      readonly nodes?: readonly NodeShape[];
    };

export interface PierceModifier {
  readonly amount: number;
  readonly node?: NodeShape;
  readonly mandatory?: boolean;
}

/** A conditional bonus on an attack: if the named element is consumed, all
    bundled bonuses apply (cannot opt into a subset). */
export interface AttackElementRider {
  readonly consume: Element;
  readonly attackBonus?: number;
  readonly pierce?: PierceModifier;
  readonly gainExp?: number;
}

/** A conditional bonus on an attack gated by a non-element cause (e.g. "you
    moved this turn"). Same shape as AttackElementRider; player applies all
    bundled bonuses if the cause is satisfied. */
export interface AttackConditionRider {
  readonly when: ConditionalCause;
  readonly attackBonus?: number;
  readonly pierce?: PierceModifier;
  readonly gainExp?: number;
}

/** A condition evaluated per-target during a multi-target attack. */
export type TargetCondition = { readonly kind: 'target-undamaged' };

/** A bonus applied to the attack against any individual target that satisfies
    the condition. Evaluated per target; targets that do not match get no
    bonus. */
export interface TargetConditionalBonus {
  readonly condition: TargetCondition;
  readonly attackBonus?: number;
  readonly pierce?: PierceModifier;
}

export interface AttackModifiers {
  readonly pierce?: PierceModifier;
  readonly elementRiders?: readonly AttackElementRider[];
  readonly conditionRiders?: readonly AttackConditionRider[];
  readonly targetConditionalBonuses?: readonly TargetConditionalBonus[];
}

export type Element = 'fire' | 'ice' | 'air' | 'earth' | 'light' | 'dark';

export type PositiveCondition =
  | 'safeguard'
  | 'ward'
  | 'invisible'
  | 'strengthen'
  | 'bless';

export type NegativeCondition =
  | 'wound'
  | 'poison'
  | 'immobilize'
  | 'disarm'
  | 'stun'
  | 'muddle'
  | 'curse';

export type Condition = PositiveCondition | NegativeCondition;

/** Cause leg ("effect A") of a conditional "apply A to apply B" trigger. */
export type ConditionalCause =
  | { readonly kind: 'moved-in-straight-line' }
  | { readonly kind: 'moved-this-turn' }
  /** Round-scoped trigger: the first time this round you gain Shield or
      Retaliate from one of your ability or attack-modifier cards. */
  | { readonly kind: 'first-shield-or-retaliate-this-round' };

/** Event that advances the use-slot token on a persistent-tracked half. */
export type PersistentTrigger =
  | { readonly kind: 'attack-targets-self' }
  | { readonly kind: 'damage-suffered' }
  | { readonly kind: 'move-ability-performed' };

export type HealTarget = { readonly kind: 'self' };

/**
 * What triggers an EXP gain.
 *  - `immediate`: resolves now, exactly `amount` EXP. (Default if omitted.)
 *  - `per-enemy-targeted`: resolves now, `amount` × number of enemies targeted
 *    by the enclosing attack/section.
 *  - `on-next-retaliate-this-round`: deferred — fires the next time the player
 *    retaliates during this round, then expires.
 */
export type ExpTrigger =
  | { readonly kind: 'immediate' }
  | { readonly kind: 'per-enemy-targeted' }
  | { readonly kind: 'on-next-retaliate-this-round' };

export type AbilityStep =
  | {
      readonly type: 'attack';
      readonly amount: Amount;
      readonly target?: AttackTarget;
      readonly modifiers?: AttackModifiers;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'move';
      readonly amount: Amount;
      readonly traits?: readonly MoveTrait[];
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'shield';
      readonly amount: number;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'retaliate';
      readonly amount: number;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'heal';
      readonly amount: number;
      readonly target: HealTarget;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'create-element';
      readonly element: Element;
      readonly mandatory?: boolean;
    }
  | {
      /** Pick up loot from your own hex and all hexes within `range` of you.
          Range 0 = own hex only (the standard end-of-turn loot). Range 1+
          extends to adjacent hexes and can be performed mid-turn. */
      readonly type: 'loot';
      readonly range: number;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'gain-exp';
      readonly amount: number;
      readonly trigger?: ExpTrigger;
      readonly mandatory?: boolean;
    }
  | {
      readonly type: 'apply-condition';
      readonly condition: Condition;
      /** Targeting for a stand-alone condition apply (e.g. "Stun all enemies
          at range 1"). Omit when this step rides on the prior attack. */
      readonly target?: AttackTarget;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      /** Forced-movement: push the target up to `amount` hexes away from the
          acting figure. Each hex entered must place the target farther by
          range. `range` is the targeting range; absent = adjacent. Use
          `target` for multi-target pushes (e.g. "push all figures at
          range 1"). */
      readonly type: 'push';
      readonly amount: number;
      readonly range?: number;
      readonly rangeNode?: NodeShape;
      readonly target?: AttackTarget;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      /** Forced-movement: pull the target up to `amount` hexes toward the
          acting figure. Each hex entered must place the target closer by
          range. `range` is the targeting range; absent = adjacent. */
      readonly type: 'pull';
      readonly amount: number;
      readonly range?: number;
      readonly rangeNode?: NodeShape;
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      /** Fully cancel one source of damage the actor would suffer. Distinct
          from shield (which reduces). Typically gated by a persistent-tracked
          half whose token advances on `damage-suffered`. */
      readonly type: 'negate-damage';
      readonly mandatory?: boolean;
    }
  | {
      /** Conditional effect: "Apply effect A to apply effect B" (rulebook
          phrasing). If `cause` is satisfied this turn, the player MAY perform
          the wrapped `effects` (still optional per the conditional-triggers
          rule). */
      readonly type: 'when';
      readonly cause: ConditionalCause;
      readonly effects: readonly AbilityStep[];
      readonly mandatory?: boolean;
    }
  | {
      /** Add a flat movement bonus to the actor's future move abilities while
          the persistent bonus is active. Use-slot advancement on
          `move-ability-performed` consumes the bonus. */
      readonly type: 'modify-future-move';
      readonly bonusAmount: number;
      readonly mandatory?: boolean;
    }
  | {
      /** Add a flat attack bonus to a future attack ability. `appliesTo`
          specifies the scope: 'next-attack-ability' adds the bonus to every
          sub-attack of the actor's next attack ability and is consumed by
          that ability (or expires at the round bound, whichever comes
          first). */
      readonly type: 'modify-future-attack';
      readonly bonusAmount: number;
      readonly appliesTo: 'next-attack-ability';
      readonly mandatory?: boolean;
    }
  | {
      /**
       * Active-bonus ability: when `when` fires, the acting figure may
       * redirect the triggering enemy attack so it targets them instead.
       * Player chooses per-attack whether to redirect. `bypasses` lists the
       * normal targeting rules the redirect ignores when applied.
       */
      readonly type: 'redirect-attack';
      readonly when: { readonly kind: 'enemy-targets-adjacent-ally' };
      readonly bypasses?: readonly ('range' | 'line-of-sight')[];
      readonly mandatory?: boolean;
    };

export interface Ability {
  readonly steps: readonly AbilityStep[];
  /** When true on a persistent half, this ability is performed only when the
      card is played and is NOT part of the active bonus. (Per 2E: an
      active-bonus action may carry one-shot abilities alongside the bonus.) */
  readonly oneShot?: boolean;
}

export interface CardHalf {
  readonly disposition: Disposition;
  /** Only set for `persistent-tracked`: number of charge slots on the printed card. */
  readonly trackedUses?: number;
  /**
   * For persistent-tracked halves: EXP awarded at each *transition* between
   * use slots. Length = `trackedUses - 1`. Index `i` is the EXP gained when
   * the token moves from slot `i+1` to slot `i+2`. `null` = no EXP awarded
   * for that transition.
   *
   * (2E rule: "When the token passes an experience icon, the character gains
   * that much experience." 2E places EXP icons on the arrows between slots,
   * not on the slots themselves.)
   */
  readonly useSlotExp?: readonly (number | null)[];
  /** For persistent-tracked halves: what advances the use-slot token. */
  readonly persistentTrigger?: PersistentTrigger;
  /** Flat EXP awarded when this half is performed (any non-basic ability).
      Typically printed alongside the disposition icon, e.g. "+2 EXP" with Lost. */
  readonly expOnPerform?: number;
  /** Override the implicit destination pile for an expired persistent bonus.
      Defaults: `persistent-tracked` → 'lost', `persistent-round` → 'discard'.
      Set explicitly when the printed card breaks the default (e.g. a
      persistent-tracked bonus that goes to discard, not lost). */
  readonly finalPile?: 'discard' | 'lost';
  readonly abilities: readonly Ability[];
}

export interface Card {
  readonly id: string;
  readonly name: string;
  readonly level: CardLevel;
  readonly initiative: number;
  readonly top: CardHalf;
  readonly bottom: CardHalf;
}
