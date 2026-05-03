/**
 * Mastery data model.
 *
 * A mastery is a single optional challenge printed on the character sheet.
 * Achieving one grants a perk mark (per the leveling rules). Each mastery
 * is single-take — once X'd, it's done.
 *
 * Criteria are layered:
 *  - `MasteryCriterion`: scenario-scoping (one scenario / N distinct scenarios).
 *  - `PerScenarioCriterion`: what success looks like inside one scenario
 *    (a tracked event, or a sliding consecutive-round window with per-round
 *    and across-window sub-criteria).
 *  - `MasteryEvent`, `PerRoundCriterion`, `AcrossWindowCriterion`: the
 *    leaf-level checks the engine evaluates against play history.
 *
 * New criterion / event shapes are added as new classes' masteries
 * introduce them.
 */

/** A discrete in-game event the engine can detect against play history. */
export type MasteryEvent =
  /**
   * Killed an enemy that the character applied any of
   * `forcedMovementKinds` to during the same round of this scenario.
   */
  | {
      readonly kind: 'kill-after-forced-movement-same-round';
      readonly forcedMovementKinds: readonly ('push' | 'pull')[];
    };

/** A condition evaluated against a single round's play. */
export type PerRoundCriterion =
  /** Total damage caused to enemies this round meets a threshold. */
  | {
      readonly kind: 'damage-to-enemies-at-least';
      readonly amount: number;
    };

/** A condition evaluated across the full window of rounds. */
export type AcrossWindowCriterion =
  /** Distinct ability cards played across the window meets a threshold. */
  | {
      readonly kind: 'distinct-ability-cards-played-at-least';
      readonly count: number;
    };

/** What success looks like inside one scenario. */
export type PerScenarioCriterion =
  /** At least one occurrence anywhere in the scenario of `event`. */
  | {
      readonly kind: 'event-occurs';
      readonly event: MasteryEvent;
    }
  /**
   * A sliding window of `roundCount` consecutive rounds where every
   * `perRound` criterion is satisfied each round AND every
   * `acrossWindow` criterion is satisfied across the window total.
   */
  | {
      readonly kind: 'consecutive-round-window';
      readonly roundCount: number;
      readonly perRound: readonly PerRoundCriterion[];
      readonly acrossWindow?: readonly AcrossWindowCriterion[];
    };

/** Top-level criterion: scenario scoping. */
export type MasteryCriterion =
  /** Achieve `inner` in `scenarioCount` distinct scenarios. */
  | {
      readonly kind: 'in-distinct-scenarios';
      readonly scenarioCount: number;
      readonly inner: PerScenarioCriterion;
    }
  /** Achieve `inner` once within a single scenario. */
  | {
      readonly kind: 'in-single-scenario';
      readonly inner: PerScenarioCriterion;
    };

export interface Mastery {
  readonly id: string;
  /** Printed mastery text, verbatim. */
  readonly text: string;
  readonly criterion: MasteryCriterion;
}
