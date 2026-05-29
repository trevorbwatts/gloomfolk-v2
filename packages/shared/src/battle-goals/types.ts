/**
 * Battle goal data model — Gloomhaven 2E shape.
 *
 * At the start of every scenario, each character is dealt 3 battle goals in
 * secret and keeps 1, discarding the other 2 face down. If the scenario is
 * won AND the criteria are met, the character gains the listed checkmarks.
 * Every 3 checkmarks = 1 extra perk mark (lifetime cap of 6 extra perk marks
 * / 18 checkmarks per character). Losing the scenario grants nothing.
 *
 * Achievement is auto-tracked by the engine. Each card carries a `tracker`
 * that initializes per-scenario state, folds in events as they happen, and
 * answers `isAchieved` at scenario end.
 *
 * See docs/rules/battle-goals.md for the underlying rulebook text.
 */

import type { Condition, NegativeCondition } from '../cards/types.js';
import type { MonsterRank } from '../monsters/types.js';

/** Events the engine emits to battle-goal trackers during a scenario.
 *  Every tracker sees every event (a single global stream); a tracker tells
 *  self-actions from ally/enemy actions by comparing the event's actor to its
 *  owner (see {@link BattleGoalReduceContext}). This union grows as new cards
 *  demand new signals. */
export type BattleGoalEvent =
  /** Fired at the start of each round, before any figure acts. Carries no
   *  actor; trackers use it to reset per-round accumulators. */
  | {
      readonly kind: 'round_start';
      readonly round: number;
    }
  /** Fired at the start of each figure's turn. `characterId` is the acting
   *  character, or null for a non-character turn (e.g. a monster). Trackers
   *  use it to reset per-turn accumulators; since only one figure is active
   *  at a time, resetting on every turn_start bounds a counter to one turn. */
  | {
      readonly kind: 'turn_start';
      readonly characterId: string | null;
    }
  /** Fired when a character collects loot. `tokenIds` identifies each token
   *  collected (usually one; a loot-all ability can be several), letting
   *  goals link a looted token back to the enemy that dropped it. `source`
   *  distinguishes the mandatory end-of-turn auto-loot of one's own hex from
   *  loot gathered by a Loot ability. */
  | {
      readonly kind: 'loot_collected';
      readonly characterId: string;
      readonly tokenIds: readonly string[];
      readonly source: 'end-of-turn' | 'ability';
      /** Whether the collecting character was adjacent to one or more enemies
       *  at the moment of collection. */
      readonly adjacentToEnemy: boolean;
    }
  /** Fired when a character performs a card ability (top or bottom). `lost`
   *  is true when the performed action bears the lost (or permanent-lost)
   *  icon, sending the card to the lost pile. `targetedAlly` is true when the
   *  ability targeted at least one ally (a friendly character other than the
   *  performer; self does not count). Card loss to negate damage and resting
   *  are NOT ability performances and never emit this. */
  | {
      readonly kind: 'ability_performed';
      readonly characterId: string;
      readonly lost: boolean;
      readonly targetedAlly: boolean;
      /** True when the card was used for a basic Attack 2 / Move 2 action
       *  rather than its printed ability. */
      readonly basic: boolean;
    }
  /** Fired whenever a character's current hit points change. `maxHp` travels
   *  with it since maximum HP varies by character and level. */
  | {
      readonly kind: 'hp_changed';
      readonly characterId: string;
      readonly currentHp: number;
      readonly maxHp: number;
    }
  /** Fired when a character becomes exhausted (removed from play), either by
   *  dropping to 0 HP or by running out of cards. */
  | {
      readonly kind: 'character_exhausted';
      readonly characterId: string;
      readonly cause: 'hp' | 'cards';
    }
  /** Fired once per character at scenario end, reporting their final ability-
   *  card pile sizes. (Active and lost piles are separate and not included.) */
  | {
      readonly kind: 'scenario_end_piles';
      readonly characterId: string;
      readonly handCount: number;
      readonly discardCount: number;
    }
  /** Fired when a character's figure enters (moves into or passes through) a
   *  hex occupied by another figure or blocker. `occupant` classifies what
   *  was there. Normal movement can pass through allies; Jump can pass over
   *  enemies and obstacles — both produce this event. Forced movement stops
   *  at occupied hexes, so it doesn't. */
  | {
      readonly kind: 'entered_occupied_hex';
      readonly characterId: string;
      readonly occupant: 'ally' | 'enemy' | 'objective' | 'obstacle';
    }
  /** Fired when a character applies a condition to a figure. `byCharacterId`
   *  is the applier. `targetIsEnemy` is true when the recipient is an enemy.
   *  `targetPriorNegativeConditions` lists the negative conditions the target
   *  already had immediately before this application. */
  | {
      readonly kind: 'condition_applied';
      readonly byCharacterId: string | null;
      readonly targetIsEnemy: boolean;
      readonly condition: Condition;
      readonly targetPriorNegativeConditions: readonly NegativeCondition[];
    }
  /** Fired when a character gains experience. `bonus` is true for the
   *  end-of-scenario completion bonus (and other post-scenario awards),
   *  false for experience earned from abilities during play. */
  | {
      readonly kind: 'experience_gained';
      readonly characterId: string;
      readonly amount: number;
      readonly bonus: boolean;
    }
  /** Fired when a negative condition leaves a figure. `byCharacterId` is the
   *  character whose action caused the removal (e.g. a heal clearing wound/
   *  poison, or a remove-condition ability), or null for automatic expiry
   *  (immobilize/disarm/stun/muddle ending at end of next turn — nobody
   *  removed those). `targetFriendly` is true when the condition was on a
   *  player-side figure. One event per condition removed. */
  | {
      readonly kind: 'condition_removed';
      readonly byCharacterId: string | null;
      readonly targetFriendly: boolean;
      readonly condition: NegativeCondition;
    }
  /** Fired the moment a character takes a rest (short or long). */
  | {
      readonly kind: 'rest';
      readonly characterId: string;
      readonly restKind: 'short' | 'long';
      /** Cards in hand at the moment the rest was triggered. */
      readonly handSizeAtRest: number;
    }
  /** Fired when a character negates incoming damage. `amount` is the damage
   *  that was about to be dealt (after ward, before negation). */
  | {
      readonly kind: 'damage_negated';
      readonly characterId: string;
      readonly amount: number;
      readonly method:
        | { readonly via: 'ability' }
        | { readonly via: 'card-from-hand' }
        | { readonly via: 'cards-from-discard' };
      /** Whether the negated damage came from an attack (vs. trap, hazard,
       *  etc.). */
      readonly fromAttack: boolean;
    }
  /** Fired when a character actually suffers damage (HP is reduced) — i.e.
   *  not negated. `amount` is the HP lost (> 0). `fromAttack` distinguishes
   *  attack damage from other sources (traps, hazards, wound, etc.). */
  | {
      readonly kind: 'damage_suffered';
      readonly characterId: string;
      readonly amount: number;
      readonly fromAttack: boolean;
    }
  /** Fired when a character (or a figure they control) attacks an enemy.
   *  `attackerCharacterId` is the controlling character. */
  | {
      readonly kind: 'attack';
      readonly attackerCharacterId: string;
      readonly targetUnitId: string;
      /** Whether the targeted enemy had already taken its turn this round. */
      readonly targetHasActedThisRound: boolean;
    }
  /** Fired when a character locks in their initiative for the round by playing
   *  two cards. `usedLowestOfPlayed` is true when the chosen initiative was the
   *  lower (slower) of the two cards. Not emitted on long-rest rounds (no
   *  cards are played for initiative). */
  | {
      readonly kind: 'initiative_chosen';
      readonly characterId: string;
      readonly usedLowestOfPlayed: boolean;
    }
  /** Fired when one or more cards enter a character's lost pile, from any
   *  cause (lost-icon action, losing cards to negate damage, a persistent
   *  lost card expiring, resting, etc.). `count` is how many cards were lost.
   *  The engine emits a character's rest event before the rest's own card
   *  loss, so goals can distinguish "before resting". */
  | {
      readonly kind: 'card_lost';
      readonly characterId: string;
      readonly count: number;
    }
  /** Fired when a character's figure exits a hex that was adjacent to an
   *  enemy. `forced` is true when the exit was caused by forced movement
   *  (push/pull) rather than the character's own movement. */
  | {
      readonly kind: 'exited_enemy_adjacent_hex';
      readonly characterId: string;
      readonly forced: boolean;
    }
  /** Fired when a character's figure leaves a room that still contains one or
   *  more uncollected loot tokens. `forced` distinguishes push/pull. */
  | {
      readonly kind: 'exited_room_with_loot';
      readonly characterId: string;
      readonly forced: boolean;
    }
  /** Fired when a character opens a door (by entering its closed-door hex).
   *  `characterId` is the opener. */
  | {
      readonly kind: 'door_opened';
      readonly characterId: string;
    }
  /** Fired when a character's figure moves under a move ability. `hexes` is
   *  the number of hexes moved. `forced` is true for push/pull (not the
   *  character's own movement). */
  | {
      readonly kind: 'character_moved';
      readonly characterId: string;
      readonly hexes: number;
      readonly forced: boolean;
    }
  /** Fired when an enemy attack targets a character — regardless of whether
   *  it hits or deals damage. `enemyUnitId` identifies the attacking enemy so
   *  goals can count distinct attackers. */
  | {
      readonly kind: 'targeted_by_enemy_attack';
      readonly targetCharacterId: string;
      readonly enemyUnitId: string;
    }
  /** Fired when a character uses an item. `isPotion` mirrors the item's
   *  `isPotion` tag (see items/types.ts). */
  | {
      readonly kind: 'item_used';
      readonly characterId: string;
      readonly itemId: string;
      readonly isPotion: boolean;
    }
  /** Fired when an enemy is reduced to 0 HP. `killerCharacterId` is the
   *  character credited with the kill, or null if no character caused it
   *  (e.g. a trap or an effect with no owner). */
  | {
      readonly kind: 'enemy_killed';
      readonly killerCharacterId: string | null;
      readonly targetUnitId: string;
      /** Negative conditions standing on the target at the moment it died.
       *  (Curse never appears here — it lives in the modifier deck, not on
       *  the figure.) */
      readonly targetNegativeConditions: readonly NegativeCondition[];
      /** True when the kill was caused by an attack (vs. a trap, hazard, or
       *  condition tick like wound). */
      readonly byAttack: boolean;
      /** Excess damage the killing blow would have dealt beyond what was
       *  needed to drop the target — i.e. (final damage) − (target HP just
       *  before the hit), floored at 0. 0 for non-attack kills. */
      readonly overkill: number;
      /** True when the target was at full HP immediately before the killing
       *  blow — i.e. it went from undamaged to dead in this one hit. */
      readonly targetWasUndamaged: boolean;
      /** Advantage state of the killing attack; null for non-attack kills. */
      readonly attackAdvantage:
        | 'advantage'
        | 'disadvantage'
        | 'normal'
        | null;
      /** Rank of the slain enemy. */
      readonly targetRank: MonsterRank;
      /** Monster-type id (defId) of the slain enemy. */
      readonly targetDefId: string;
      /** ID of the loot token this enemy dropped on death, or null if it
       *  dropped nothing. Matches an id in a later `loot_collected`. */
      readonly droppedLootTokenId: string | null;
      /** Number of elements in the strong or waning state at the moment of the
       *  kill (0–6). */
      readonly elementsStrongOrWaning: number;
      /** Whether the slain enemy was adjacent to the killer. False for
       *  non-character kills. */
      readonly targetAdjacentToKiller: boolean;
      /** Whether the killer was adjacent to a different enemy (not the
       *  target) at the moment of the kill. False for non-character kills. */
      readonly killerAdjacentToOtherEnemy: boolean;
      /** Whether the slain enemy had already taken at least one turn this
       *  scenario before dying. */
      readonly targetHadTakenTurn: boolean;
    }
  /** Fired once per character at the end of each round, capturing engine-
   *  computed facts about where that character's figure is standing. Only
   *  emitted for characters present on the board (an exhausted character
   *  produces no snapshot). Spatial fields are added as new cards need them. */
  | {
      readonly kind: 'round_end_position';
      readonly characterId: string;
      /** The character's hex carries a door overlay. */
      readonly onDoorHex: boolean;
      /** Number of enemy figures at hex distance 1 from the character. */
      readonly adjacentEnemyCount: number;
    }
  /** Fired at the end of each of a character's own turns, capturing where
   *  that character's figure ended the turn. Evaluated per-turn (not at round
   *  end) because other figures may move afterward. Only emitted for
   *  characters present on the board. */
  | {
      readonly kind: 'turn_end_position';
      readonly characterId: string;
      /** Number of OTHER player characters at hex distance 1. */
      readonly adjacentCharacterCount: number;
      /** Whether the character ended the turn adjacent to a wall, obstacle,
       *  or objective. */
      readonly adjacentToWallObstacleOrObjective: boolean;
    };

/** Snapshot of cross-character data made available to `isAchieved` at
 *  scenario end. Comparative goals ("more than any other player",
 *  "fewest deaths", …) read from this; per-character goals ignore it.
 *  Fields are added as new cards demand them. */
export interface BattleGoalEvaluationContext {
  /** The character whose goal is being evaluated. */
  readonly characterId: string;
  /** All characters that participated in the scenario (including this one). */
  readonly allCharacterIds: readonly string[];
  /** Final per-character loot-token count at scenario end. */
  readonly lootByCharacter: Readonly<Record<string, number>>;
  /** Monster-type ids (defIds) of every monster type that appeared in the
   *  scenario. */
  readonly monsterTypesInScenario: readonly string[];
}

/** Context passed alongside every event so a tracker can distinguish its
 *  owner's actions from those of allies and enemies. */
export interface BattleGoalReduceContext {
  /** The character this tracker instance belongs to. Compare event actor
   *  IDs against this: equal = self, any other character = ally. */
  readonly ownerCharacterId: string;
}

/** Per-card achievement tracker. State shape is the card's own concern;
 *  the engine only stores and forwards it opaquely. */
export interface BattleGoalTracker<TState> {
  /** State at scenario start, before any events. */
  readonly init: () => TState;
  /** Fold one event into the running state. Return `state` unchanged for
   *  events the card doesn't care about. Sees the global event stream, so
   *  use `ctx.ownerCharacterId` to filter to the relevant actor. */
  readonly reduce: (
    state: TState,
    event: BattleGoalEvent,
    ctx: BattleGoalReduceContext,
  ) => TState;
  /** Final check at scenario end. Only relevant if the scenario was won —
   *  losing the scenario zeroes the reward regardless. The `context`
   *  exposes cross-character data for comparative goals. */
  readonly isAchieved: (
    state: TState,
    context: BattleGoalEvaluationContext,
  ) => boolean;
}

export interface BattleGoal {
  /** Stable identifier — kebab-case of the title. */
  readonly id: string;
  /** Thematic name shown on the card. */
  readonly title: string;
  /** How the goal is achieved. */
  readonly description: string;
  /** Reward when achieved AND the scenario is won. Typically 1–2. A function
   *  is used for goals whose reward depends on the party (e.g. "+1 checkmark
   *  for four characters"); resolve it with {@link resolveCheckmarks}. */
  readonly checkmarks:
    | number
    | ((ctx: BattleGoalEvaluationContext) => number);
  /** Auto-tracker — state shape is internal to each card. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly tracker: BattleGoalTracker<any>;
}
