import type {
  Hex,
  MonsterAbilityCard,
  MonsterStatBlock,
  Tile,
  Unit,
} from '@gloomfolk/shared';
import {
  hexDistance,
  hexEqual,
  hexKey,
  hexNeighbors,
} from '@gloomfolk/shared';

interface BoardView {
  tiles: Tile[];
  units: Unit[];
}

/**
 * BFS from `start`, no budget cap, returning per-hex distance + predecessor.
 * `passable(hex)` decides if a hex can be entered; `start` is always allowed.
 */
function bfsAll(
  start: Hex,
  passable: (h: Hex) => boolean,
): { dist: Map<string, number>; prev: Map<string, string> } {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const startK = hexKey(start);
  dist.set(startK, 0);
  let frontier: Hex[] = [start];
  while (frontier.length > 0) {
    const next: Hex[] = [];
    for (const h of frontier) {
      const hk = hexKey(h);
      const d = dist.get(hk)!;
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (dist.has(k)) continue;
        if (!passable(n)) continue;
        dist.set(k, d + 1);
        prev.set(k, hk);
        next.push(n);
      }
    }
    frontier = next;
  }
  return { dist, prev };
}

function reconstructPath(target: Hex, prev: Map<string, string>): Hex[] {
  const path: Hex[] = [];
  let cur: string | undefined = hexKey(target);
  path.unshift(target);
  while (cur) {
    const p = prev.get(cur);
    if (!p) break;
    const [qs, rs] = p.split(',');
    const h = { q: Number(qs), r: Number(rs) };
    path.unshift(h);
    cur = p;
  }
  return path;
}

interface AttackInfo {
  /** 1 for melee, > 1 for ranged. */
  range: number;
  /** Damage value (post stat-card + card modifier). */
  damage: number;
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
}

/**
 * Determine focus for `monster` given its attack range and the current board.
 * `enemyInitiative` maps unit id → tiebreak initiative (lower acts first).
 * Returns null if no enemy is reachable.
 */
export function determineFocus(
  monster: Unit,
  attackRange: number,
  board: BoardView,
  enemyInitiative: Map<string, number>,
): FocusResult | null {
  const passable = (h: Hex) => {
    // Walls block
    const tile = board.tiles.find((t) => t.q === h.q && t.r === h.r);
    if (!tile) return false;
    if (tile.kind === 'wall') return false;
    // Other units block (we won't end on them; we also don't pass through them
    // for v1 — Gloomhaven allows passing through allies, but monster has no allies on the player board).
    for (const u of board.units) {
      if (u.id === monster.id) continue;
      if (hexEqual(u.hex, h)) return false;
    }
    return true;
  };

  const { dist, prev } = bfsAll(monster.hex, passable);
  // The monster's own hex is "reachable" at cost 0 for ranged attacks.
  // For melee it doesn't help (must be adjacent to focus).

  const enemies = board.units.filter((u) => u.kind === 'player');
  if (enemies.length === 0) return null;

  let best: FocusResult | null = null;
  for (const e of enemies) {
    // Candidate attack hexes for this enemy.
    let bestForE: { hex: Hex; cost: number } | null = null;
    if (attackRange <= 1) {
      // Melee — adjacent hexes to the enemy.
      for (const adj of hexNeighbors(e.hex)) {
        const k = hexKey(adj);
        const d = dist.get(k);
        if (d === undefined) continue;
        if (!bestForE || d < bestForE.cost) bestForE = { hex: adj, cost: d };
      }
    } else {
      // Ranged — any reachable hex within range of enemy (no LOS).
      for (const [k, d] of dist) {
        const [qs, rs] = k.split(',');
        const h = { q: Number(qs), r: Number(rs) };
        if (hexDistance(h, e.hex) > attackRange) continue;
        if (!bestForE || d < bestForE.cost) bestForE = { hex: h, cost: d };
      }
    }
    if (!bestForE) continue;
    const cur: FocusResult = {
      enemy: e,
      path: reconstructPath(bestForE.hex, prev),
      attackHex: bestForE.hex,
      pathCost: bestForE.cost,
    };
    if (!best) {
      best = cur;
      continue;
    }
    // Tiebreaks: lowest pathCost, then closest by hex-distance to monster, then earliest initiative.
    if (cur.pathCost < best.pathCost) best = cur;
    else if (cur.pathCost === best.pathCost) {
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
