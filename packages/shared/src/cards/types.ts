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
 * Whether a card with printed `level` counts as a "level-N card" for effects
 * that retrieve/reference by level (e.g. Stamina Potion's "Level 1 card").
 * `X` cards are part of a character's pool from level 1, so they count as
 * level-1 cards.
 */
export function cardMatchesLevel(level: CardLevel, target: number): boolean {
  if (level === target) return true;
  return target === 1 && level === 'X';
}

/**
 * A reference to a value that depends on turn-state, used for "X where X is …"
 * cards. Resolved by the engine at the moment the ability resolves.
 */
export type AmountRef =
  | { readonly kind: 'hexes-moved-this-turn' }
  | { readonly kind: 'damage-dealt-this-turn' }
  /** The Shield value of the current attack's target. Resolves to 0 if the
      target has no Shield. `offset` is added to the resolved value
      (e.g. "X+2" → offset: 2). */
  | { readonly kind: 'target-shield-value'; readonly offset?: number };

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
      readonly rangeNode?: NodeShape;
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

/** A conditional bonus on an attack: if the named element(s) are consumed,
    all bundled bonuses apply (cannot opt into a subset). `consume` is either
    a single element or an `all` bundle meaning every listed element must be
    consumed together to fire this rider. */
export interface AttackElementRider {
  readonly consume: ElementSelector | { readonly all: readonly Element[] };
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
export type TargetCondition =
  | { readonly kind: 'target-undamaged' }
  /** Target is adjacent to at least one of the acting player's allies. */
  | { readonly kind: 'target-adjacent-to-your-ally' }
  /** Target has no adjacent allies of its own (i.e. no other enemy figures
      sharing its side adjacent to it). */
  | { readonly kind: 'target-isolated-from-allies' }
  /** Conjunction: all listed conditions must be satisfied for the same target. */
  | { readonly kind: 'all-of'; readonly conditions: readonly TargetCondition[] };

/** A bonus applied to the attack against any individual target that satisfies
    the condition. Evaluated per target; targets that do not match get no
    bonus. */
export interface TargetConditionalBonus {
  readonly condition: TargetCondition;
  readonly attackBonus?: number;
  readonly pierce?: PierceModifier;
  /** Roll the attack against this target with advantage (draw two attack
      modifier cards, take the better). */
  readonly advantage?: boolean;
  readonly gainExp?: number;
}

export interface AttackModifiers {
  readonly pierce?: PierceModifier;
  readonly elementRiders?: readonly AttackElementRider[];
  readonly conditionRiders?: readonly AttackConditionRider[];
  readonly targetConditionalBonuses?: readonly TargetConditionalBonus[];
}

export type Element = 'fire' | 'ice' | 'air' | 'earth' | 'light' | 'dark';

export const ALL_ELEMENTS: readonly Element[] = [
  'fire',
  'ice',
  'air',
  'earth',
  'light',
  'dark',
] as const;

/** Where each element token sits on the element board. */
export type ElementColumn = 'strong' | 'waning' | 'inert';

/** The full state of the six-element board. */
export type ElementBoardState = Readonly<Record<Element, ElementColumn>>;

/** A reference to an element on a card. Concrete element, or a wild slot
    (player/party picks any of the six), or a mixed slot (player/party picks
    one of two named options). Resolved at the moment the engine needs a
    concrete element (infuse-end-of-turn, consume-at-attack-resolve). */
export type ElementSelector =
  | Element
  | { readonly kind: 'wild' }
  | { readonly kind: 'mixed'; readonly options: readonly [Element, Element] };

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
  | { readonly kind: 'move-ability-performed' }
  /** The acting player performs an attack whose target has no adjacent
      allies of its own. */
  | { readonly kind: 'attack-against-isolated-enemy' }
  /** The acting player performs a melee attack against a target that has
      Shield. */
  | { readonly kind: 'melee-attack-against-shielded-enemy' }
  /** The acting player performs an attack while they have the Invisible
      condition. */
  | { readonly kind: 'attack-while-invisible' };

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
      /** If true, the actor picks up loot from each hex entered during this
          move ability. Loot is grabbed per hex as it is entered, so a hex
          whose loot would be triggered/removed by passing through is still
          collected by the moving figure. */
      readonly lootEnteredHexes?: boolean;
      /** If true, the actor may choose, per hex entered, not to spring traps
          in hexes entered during this move ability. Untriggered traps remain
          in place. */
      readonly mayBypassTraps?: boolean;
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
      /** Mark an element for end-of-turn infusion. Concrete element infuses
          directly; wild/mixed selectors prompt the actor (player) or the
          party (monster set) to pick at infusion time. */
      readonly type: 'create-element';
      readonly element: ElementSelector;
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
          at range 1", "Apply Invisible to self"). Omit when this step rides
          on the prior attack. */
      readonly target?: AttackTarget | { readonly kind: 'self' };
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
          range. `range` is the targeting range; absent = adjacent. Use
          `target` for multi-target pulls (e.g. "pull 2 figures at
          range 3"). */
      readonly type: 'pull';
      readonly amount: number;
      readonly range?: number;
      readonly rangeNode?: NodeShape;
      readonly target?: AttackTarget;
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
      /** Add a bonus to one or more future attack abilities. At least one of
          `bonusAmount` or `pierceBonus` must be set.
          `appliesTo`:
            - 'next-attack-ability': bonus applies to every sub-attack of the
              actor's next attack ability and is consumed by that ability
              (or expires at the round bound, whichever comes first).
            - 'all-attacks-this-round': bonus applies to every attack the
              actor performs for the remainder of the round.
            - 'while-persistent-active': the enclosing half is
              persistent-tracked; the bonus is the active bonus and applies
              to every qualifying attack while use slots remain. The
              persistent-tracked half's `persistentTrigger` governs slot
              advancement.
          `attackKind`: optional filter — if set, the bonus only applies to
          attacks of that kind (e.g. only ranged attacks).
          `targetCondition`: optional per-target filter — if set, the bonus
          only applies to attacks whose target satisfies the condition. */
      readonly type: 'modify-future-attack';
      readonly bonusAmount?: Amount;
      readonly pierceBonus?: number;
      /** If true, the attack value is doubled when this modifier resolves.
          Resolved before flat `bonusAmount` is added. */
      readonly doubleAttack?: boolean;
      readonly appliesTo:
        | 'next-attack-ability'
        | 'all-attacks-this-round'
        | 'while-persistent-active';
      readonly attackKind?: 'ranged' | 'melee';
      readonly targetCondition?: TargetCondition;
      readonly mandatory?: boolean;
    }
  | {
      /** Take temporary control of a target enemy and force it to perform a
          basic move. The enemy moves under the actor's direction up to
          `moveAmount` hexes using its own movement rules.
          `endConstraint`:
            - 'adjacent-to-actor': the controlled figure's path must end in
              a hex adjacent to the actor. */
      readonly type: 'control-enemy-move';
      readonly target: AttackTarget;
      readonly moveAmount: number;
      readonly endConstraint?: 'adjacent-to-actor';
      readonly node?: NodeShape;
      readonly mandatory?: boolean;
    }
  | {
      /** Destroy one trap in a qualifying hex. Optional — if no qualifying
          trap is available (or the player chooses not to), the step is
          skipped and `gainExp` is not awarded.
          `target.kind`:
            - 'hex-entered-this-move-ability': any hex the actor entered
              during their most recent move ability this turn. */
      readonly type: 'destroy-trap';
      readonly target: { readonly kind: 'hex-entered-this-move-ability' };
      readonly gainExp?: number;
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
  /** Action-level required elemental cost (upper-left corner on the printed
      card). All listed elements must be strong/waning at turn-start AND
      still uncon­sumed when the player engages this half; engaging consumes
      them. Half cannot be engaged otherwise. */
  readonly requiredElementCost?: readonly Element[];
  /** Only set for `persistent-tracked`: number of charge slots on the printed card. */
  readonly trackedUses?: number;
  /**
   * For persistent-tracked halves: EXP awarded as the use-slot token
   * advances. Length is either `trackedUses - 1` (transitions between slots
   * only) or `trackedUses` (transitions plus a final entry for when the
   * last token is consumed and the bonus expires).
   *
   * Index `i` (0-based, 1-indexed slots): EXP gained when the token leaves
   * slot `i+1`. So index 0 is awarded when slot 1 is consumed (token moves
   * to slot 2 if any, otherwise the half expires). `null` = no EXP for
   * that advancement.
   *
   * (2E rule: "When the token passes an experience icon, the character
   * gains that much experience." Most printed cards place icons only on
   * the arrows between slots, but some also award EXP when the final
   * token is consumed.)
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
