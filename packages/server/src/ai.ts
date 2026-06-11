import type {
  Hex,
  MonsterAbilityCard,
  MonsterAttackEffect,
  MonsterStatBlock,
  Tile,
  Unit,
} from '@gloomfolk/shared';
import {
  hexDistance,
  hexKey,
  hexNeighbors,
} from '@gloomfolk/shared';

interface BoardView {
  tiles: Tile[];
  units: Unit[];
}

/**
 * Movement predicates shared by the AI's searches. Walls and enemy figures
 * block traversal; allies can be passed through but not stopped on (`occupied`
 * marks illegal destinations). Difficult terrain costs 2 to enter, and live
 * traps and hazardous terrain are "negative" hexes — the rulebook treats both
 * the same for path priority. (Sprung traps reach the AI as plain floor.)
 */
function boardCosts(
  monster: Unit,
  board: BoardView,
): {
  occupied: Set<string>;
  passable: (h: Hex) => boolean;
  enterCost: (h: Hex) => number;
  isNegative: (h: Hex) => boolean;
} {
  const tileAt = new Map<string, Tile>();
  for (const t of board.tiles) tileAt.set(hexKey({ q: t.q, r: t.r }), t);
  const occupied = new Set<string>();
  const enemyOccupied = new Set<string>();
  for (const u of board.units) {
    if (u.id === monster.id) continue;
    occupied.add(hexKey(u.hex));
    if (u.kind !== monster.kind) enemyOccupied.add(hexKey(u.hex));
  }
  const passable = (h: Hex) => {
    const tile = tileAt.get(hexKey(h));
    if (!tile) return false;
    if (tile.kind === 'wall') return false;
    return !enemyOccupied.has(hexKey(h));
  };
  const enterCost = (h: Hex) => (tileAt.get(hexKey(h))?.kind === 'difficult' ? 2 : 1);
  const isNegative = (h: Hex) => {
    const kind = tileAt.get(hexKey(h))?.kind;
    return kind === 'hazard' || kind === 'trap';
  };
  return { occupied, passable, enterCost, isNegative };
}

interface AttackInfo {
  /** 1 for melee, > 1 for ranged. */
  range: number;
  /** Damage value (post stat-card + card modifier). */
  damage: number;
  /** Max distinct targets this attack may hit (card `Target N`; default 1). */
  targets: number;
  /** Condition riders applied to every target hit (from the ability card's
   *  attack step plus the stat block's printed attackEffects). */
  effects: readonly MonsterAttackEffect[];
}

interface MoveInfo {
  /** Total movement points (statBlock + card modifier, floor 0). */
  budget: number;
}

/** Extract base move/attack from a monster ability card + stat block. */
export function readAbility(
  card: MonsterAbilityCard,
  stat: MonsterStatBlock,
): { move: MoveInfo | null; attack: AttackInfo | null } {
  let move: MoveInfo | null = null;
  let attack: AttackInfo | null = null;
  for (const a of card.abilities) {
    if (a.kind === 'move' && !move) {
      move = { budget: Math.max(0, stat.movement + a.modifier) };
    } else if (a.kind === 'attack' && !attack) {
      attack = {
        range: a.range ?? 1,
        damage: Math.max(0, stat.attack + a.modifier),
        targets: a.targets ?? 1,
        effects: [...(a.effects ?? []), ...(stat.attackEffects ?? [])],
      };
    }
  }
  return { move, attack };
}

interface FocusResult {
  enemy: Unit;
  path: Hex[]; // includes start hex; ends at chosen attack hex (which may be start hex)
  attackHex: Hex;
  pathCost: number;
  /** Negative (trap/hazard) hexes the chosen path enters. */
  pathNegatives: number;
}

/**
 * Determine focus for `monster` given its attack range and the current board.
 * Candidates are compared by the rulebook's priority list (appendix B):
 *   1. a movement path that triggers fewer negative (trap/hazard) hexes,
 *   2. a movement path that needs fewer movement points (difficult terrain
 *      costs 2 to enter),
 *   3. the enemy closer by range (hex distance, ignoring terrain),
 *   4. the enemy earlier in initiative (`enemyInitiative` maps unit id →
 *      tiebreak value; lower acts first).
 * Paths assume infinite movement — the budget only matters later, in
 * determineMovement. Returns null if no enemy is reachable.
 */
export function determineFocus(
  monster: Unit,
  attackRange: number,
  board: BoardView,
  enemyInitiative: Map<string, number>,
): FocusResult | null {
  const { occupied, passable, enterCost, isNegative } = boardCosts(monster, board);
  const search = terrainSearch(monster.hex, passable, enterCost, isNegative);
  // The monster's own hex is "reachable" at cost 0 for ranged attacks.
  // For melee it doesn't help (must be adjacent to focus).

  const enemies = board.units.filter((u) => u.kind === 'player');
  if (enemies.length === 0) return null;

  let best: FocusResult | null = null;
  for (const e of enemies) {
    // Best attack hex for this enemy: fewest negative hexes, then cheapest.
    let bestForE: { hex: Hex; cost: number; neg: number } | null = null;
    if (attackRange <= 1) {
      // Melee — adjacent hexes to the enemy. Skip hexes occupied by another
      // figure (passable to move through, but not to stand on).
      for (const adj of hexNeighbors(e.hex)) {
        const k = hexKey(adj);
        if (occupied.has(k)) continue;
        const v = search.get(k);
        if (!v) continue;
        if (
          !bestForE ||
          v.neg < bestForE.neg ||
          (v.neg === bestForE.neg && v.cost < bestForE.cost)
        ) {
          bestForE = { hex: adj, cost: v.cost, neg: v.neg };
        }
      }
    } else {
      // Ranged — any reachable, unoccupied hex within range of enemy (no LOS).
      for (const [k, v] of search) {
        if (occupied.has(k)) continue;
        const [qs, rs] = k.split(',');
        const h = { q: Number(qs), r: Number(rs) };
        if (hexDistance(h, e.hex) > attackRange) continue;
        if (
          !bestForE ||
          v.neg < bestForE.neg ||
          (v.neg === bestForE.neg && v.cost < bestForE.cost)
        ) {
          bestForE = { hex: h, cost: v.cost, neg: v.neg };
        }
      }
    }
    if (!bestForE) continue;
    const cur: FocusResult = {
      enemy: e,
      path: reconstructTerrainPath(bestForE.hex, search),
      attackHex: bestForE.hex,
      pathCost: bestForE.cost,
      pathNegatives: bestForE.neg,
    };
    if (!best) {
      best = cur;
      continue;
    }
    // Priority: fewest negative hexes, then fewest movement points, then
    // closest by hex-distance to monster, then earliest initiative.
    if (cur.pathNegatives !== best.pathNegatives) {
      if (cur.pathNegatives < best.pathNegatives) best = cur;
    } else if (cur.pathCost !== best.pathCost) {
      if (cur.pathCost < best.pathCost) best = cur;
    } else {
      const curRange = hexDistance(monster.hex, cur.enemy.hex);
      const bestRange = hexDistance(monster.hex, best.enemy.hex);
      if (curRange < bestRange) best = cur;
      else if (curRange === bestRange) {
        const curInit = enemyInitiative.get(cur.enemy.id) ?? 999;
        const bestInit = enemyInitiative.get(best.enemy.id) ?? 999;
        if (curInit < bestInit) best = cur;
      }
    }
  }
  return best;
}

/**
 * Walk along `path` consuming up to `budget` steps, stopping early when within
 * `attackRange` of `focusHex`. Returns the destination hex.
 */
export function walkPath(
  start: Hex,
  path: Hex[],
  budget: number,
  attackRange: number,
  focusHex: Hex,
): Hex {
  let cur = start;
  let used = 0;
  // path[0] is the start hex. Step from index 1 onward.
  for (let i = 1; i < path.length && used < budget; i++) {
    cur = path[i]!;
    used++;
    if (hexDistance(cur, focusHex) <= attackRange) break;
  }
  return cur;
}

export interface MovementPlan {
  /** Where the monster ends up. May equal its start hex (no move). */
  destination: Hex;
  /** Animation/replay path: [start, …steps]; just [start] when no move. */
  path: Hex[];
  /** Movement points consumed (0 when no move). */
  pointsSpent: number;
}

/** What an attack would achieve from a given standing hex. */
export interface DestinationEval {
  /** Whether the monster could still land its attack on its FOCUS from here. */
  canHitFocus: boolean;
  /** Total attacks landed from here (focus + additional targets, capped at the
   *  card's Target count). */
  attacks: number;
  /** How many of those attacks are made with Disadvantage (ranged attack on an
   *  adjacent target). */
  disadvantaged: number;
}

/**
 * Terrain-aware shortest-path search from `start`. Difficult terrain costs 2
 * movement to enter; negative (trap/hazard) hexes are counted and outrank
 * cost — a safer path always beats a cheaper one (the rulebook's path
 * priority: a monster walks 10 clean hexes rather than 2 through a trap).
 * Returns, per reachable hex, the best (negative-hex count, then cost) and
 * its predecessor for reconstruction.
 */
function terrainSearch(
  start: Hex,
  passable: (h: Hex) => boolean,
  enterCost: (h: Hex) => number,
  isNegative: (h: Hex) => boolean,
): Map<string, { cost: number; neg: number; prev: string | null }> {
  const best = new Map<string, { cost: number; neg: number; prev: string | null }>();
  const visited = new Set<string>();
  best.set(hexKey(start), { cost: 0, neg: 0, prev: null });
  for (;;) {
    // Extract the unvisited node with the lexicographically smallest (neg, cost).
    let curK: string | null = null;
    let curV: { cost: number; neg: number } | null = null;
    for (const [k, v] of best) {
      if (visited.has(k)) continue;
      if (!curV || v.neg < curV.neg || (v.neg === curV.neg && v.cost < curV.cost)) {
        curV = v;
        curK = k;
      }
    }
    if (curK === null || curV === null) break;
    visited.add(curK);
    const [qs, rs] = curK.split(',');
    const cur = { q: Number(qs), r: Number(rs) };
    const here = best.get(curK)!;
    for (const n of hexNeighbors(cur)) {
      const nk = hexKey(n);
      if (visited.has(nk)) continue;
      if (!passable(n)) continue;
      const cost = here.cost + enterCost(n);
      const neg = here.neg + (isNegative(n) ? 1 : 0);
      const ex = best.get(nk);
      if (!ex || neg < ex.neg || (neg === ex.neg && cost < ex.cost)) {
        best.set(nk, { cost, neg, prev: curK });
      }
    }
  }
  return best;
}

/**
 * Decide where a monster moves before attacking, scoring every hex reachable
 * within `budget` against a lexicographic preference (appendix B, rules B–E):
 *   1. cross the fewest negative (trap/hazard) hexes — path priority outranks
 *      everything, including target maximization,
 *   2. maximize total attacks landed (focus + additional targets),
 *   3. minimize disadvantaged attacks (ranged attack on an adjacent target),
 *   4. spend the fewest movement points.
 *
 * `evaluateFrom(hex)` reports what an attack achieves from `hex` (target count
 * and disadvantage — owned by the caller so this stays board-agnostic). When
 * no reachable hex can attack the focus, it falls back to approaching the focus
 * along the shortest path (the shorten-the-path rule) — but never enters a
 * negative hex just to get closer (appendix B caption B: the Hound stays put
 * rather than spring a trap).
 *
 * Difficult terrain costs 2 to enter.
 */
export function determineMovement(
  monster: Unit,
  focus: FocusResult,
  attackRange: number,
  budget: number,
  board: BoardView,
  evaluateFrom: (from: Hex) => DestinationEval,
): MovementPlan {
  // A figure can move *through* its allies (same kind) but not its enemies, and
  // can't *stop* on any occupied hex. `passable` governs traversal; `occupied`
  // marks hexes that are illegal destinations.
  const { occupied, passable, enterCost, isNegative } = boardCosts(monster, board);

  const search = terrainSearch(monster.hex, passable, enterCost, isNegative);

  // Enumerate reachable destinations within budget (start hex is cost 0).
  type Cand = { hex: Hex; cost: number; neg: number; attacks: number; disadv: number };
  const attackers: Cand[] = [];
  for (const [k, v] of search) {
    if (v.cost > budget) continue;
    if (occupied.has(k)) continue; // can pass through allies but not stop on them
    const [qs, rs] = k.split(',');
    const hex = { q: Number(qs), r: Number(rs) };
    const ev = evaluateFrom(hex);
    if (!ev.canHitFocus) continue;
    attackers.push({ hex, cost: v.cost, neg: v.neg, attacks: ev.attacks, disadv: ev.disadvantaged });
  }

  if (attackers.length > 0) {
    attackers.sort(
      (a, b) =>
        a.neg - b.neg || // fewest negative hexes — outranks target maximization
        b.attacks - a.attacks || // then maximize attacks landed
        a.disadv - b.disadv || // then avoid disadvantage
        a.cost - b.cost || // then spend the fewest movement points
        hexDistance(a.hex, focus.enemy.hex) - hexDistance(b.hex, focus.enemy.hex),
    );
    const best = attackers[0]!;
    return {
      destination: best.hex,
      path: reconstructTerrainPath(best.hex, search),
      pointsSpent: best.cost,
    };
  }

  // No reachable hex can attack — approach the focus (terrain-aware): cross
  // the fewest negative hexes (staying put, at zero, beats any path through a
  // trap — caption B), then get as close as possible to the focus, then spend
  // the fewest movement points.
  void attackRange;
  let best = { hex: monster.hex, cost: 0, neg: 0, d: hexDistance(monster.hex, focus.enemy.hex) };
  for (const [k, v] of search) {
    if (v.cost > budget) continue;
    if (occupied.has(k)) continue; // can pass through allies but not stop on them
    const [qs, rs] = k.split(',');
    const hex = { q: Number(qs), r: Number(rs) };
    const d = hexDistance(hex, focus.enemy.hex);
    if (
      v.neg < best.neg ||
      (v.neg === best.neg &&
        (d < best.d || (d === best.d && v.cost < best.cost)))
    ) {
      best = { hex, cost: v.cost, neg: v.neg, d };
    }
  }
  return {
    destination: best.hex,
    path: reconstructTerrainPath(best.hex, search),
    pointsSpent: best.cost,
  };
}

/** Reconstruct [start, …, target] from a terrainSearch predecessor map. */
function reconstructTerrainPath(
  target: Hex,
  search: Map<string, { prev: string | null }>,
): Hex[] {
  const path: Hex[] = [target];
  let cur: string | null = search.get(hexKey(target))?.prev ?? null;
  while (cur) {
    const [qs, rs] = cur.split(',');
    path.unshift({ q: Number(qs), r: Number(rs) });
    cur = search.get(cur)?.prev ?? null;
  }
  return path;
}
