import { BATTLE_GOAL_BY_ID, BATTLE_GOALS, resolveCheckmarks } from './goals.js';
import type { BattleGoal, BattleGoalEvent, BattleGoalEvaluationContext } from './types.js';

/** Result of evaluating one character's chosen battle goal at scenario end. */
export interface BattleGoalResult {
  readonly goalId: string;
  readonly achieved: boolean;
  /** Checkmarks earned — `achieved ? resolved-checkmarks : 0`. Note this is
   *  still gated on the scenario being WON by the caller; a lost scenario
   *  grants nothing regardless of `achieved`. */
  readonly checkmarks: number;
}

/**
 * Fold a scenario's event log through one goal's tracker and decide the
 * outcome. Pure: the same log + context always yields the same result, so the
 * server only needs to persist the log (and assignments), not live tracker
 * state.
 */
export function evaluateBattleGoal(
  goalId: string,
  events: readonly BattleGoalEvent[],
  ctx: BattleGoalEvaluationContext,
): BattleGoalResult {
  const goal = BATTLE_GOAL_BY_ID[goalId];
  if (!goal) throw new Error(`Unknown battle goal id: ${goalId}`);
  let state = goal.tracker.init();
  for (const event of events) {
    state = goal.tracker.reduce(state, event, {
      ownerCharacterId: ctx.characterId,
    });
  }
  const achieved = goal.tracker.isAchieved(state, ctx);
  return {
    goalId,
    achieved,
    checkmarks: achieved ? resolveCheckmarks(goal, ctx) : 0,
  };
}

/**
 * Deal `count` distinct random battle goals (default 3, per the rules). Pass an
 * `rng` returning [0,1) for deterministic dealing in tests; defaults to
 * `Math.random`. Returns the dealt goal ids; the player then keeps one.
 */
export function dealBattleGoalIds(
  count = 3,
  rng: () => number = Math.random,
): string[] {
  const pool = BATTLE_GOALS.map((g) => g.id);
  // Fisher–Yates partial shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Convenience: look up a goal definition (title/description/checkmarks). */
export function getBattleGoal(goalId: string): BattleGoal | undefined {
  return BATTLE_GOAL_BY_ID[goalId];
}
