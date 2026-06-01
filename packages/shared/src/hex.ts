export interface Hex {
  q: number;
  r: number;
}

export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

const NEIGHBOR_OFFSETS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

export function hexNeighbors(h: Hex): Hex[] {
  return NEIGHBOR_OFFSETS.map((o) => ({ q: h.q + o.q, r: h.r + o.r }));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * Reachable destinations from `start` within `budget` movement points.
 *   - `walkable(h)` decides if a hex can be *moved through* — walls block, and
 *     so do enemy figures, but a figure may pass through its allies.
 *   - `canEnd(h)` decides if a hex is a legal stopping point — additionally
 *     false for any occupied hex, since a figure can't end on top of another.
 *   - `enterCost(h)` is the cost to step *into* a hex (difficult terrain = 2,
 *     everything else 1).
 * Returns a map of hexKey → cheapest movement cost for hexes you may stop on.
 */
export function bfsReachable(
  start: Hex,
  budget: number,
  walkable: (h: Hex) => boolean,
  canEnd: (h: Hex) => boolean,
  enterCost: (h: Hex) => number = () => 1,
): Map<string, number> {
  // Uniform-cost (Dijkstra) search by accumulated movement cost over walkable
  // hexes, then keep only those a figure may legally stop on. With a uniform
  // cost of 1 and canEnd === walkable this matches a plain layered BFS.
  const cost = new Map<string, number>([[hexKey(start), 0]]);
  const visited = new Set<string>();
  if (budget > 0) {
    for (;;) {
      // Pick the cheapest unvisited hex.
      let curK: string | null = null;
      let curCost = Infinity;
      for (const [k, c] of cost) {
        if (visited.has(k)) continue;
        if (c < curCost) {
          curCost = c;
          curK = k;
        }
      }
      if (curK === null) break;
      visited.add(curK);
      const [qs, rs] = curK.split(',');
      const cur = { q: Number(qs), r: Number(rs) };
      for (const n of hexNeighbors(cur)) {
        if (!walkable(n)) continue;
        const c = curCost + enterCost(n);
        if (c > budget) continue;
        const nk = hexKey(n);
        const ex = cost.get(nk);
        if (ex === undefined || c < ex) cost.set(nk, c);
      }
    }
  }
  // `start` is always included (the "don't move" option); other hexes only if
  // they're a legal stopping point.
  const out = new Map<string, number>();
  out.set(hexKey(start), 0);
  for (const [k, c] of cost) {
    const [qs, rs] = k.split(',');
    if (canEnd({ q: Number(qs), r: Number(rs) })) out.set(k, c);
  }
  return out;
}

/**
 * Cheapest path from `start` to `goal`, including both endpoints. Mid-path
 * hexes need only be `walkable` (a figure may pass through allies); the goal
 * must also satisfy `canEnd` (no stopping on an occupied hex). `enterCost`
 * charges 2 to step into difficult terrain. Returns null if `goal` is
 * unreachable within `budget` movement points.
 */
export function bfsPath(
  start: Hex,
  goal: Hex,
  budget: number,
  walkable: (h: Hex) => boolean,
  canEnd: (h: Hex) => boolean,
  enterCost: (h: Hex) => number = () => 1,
): Hex[] | null {
  if (hexEqual(start, goal)) return [start];
  if (budget <= 0) return null;
  if (!canEnd(goal)) return null;
  const cost = new Map<string, number>([[hexKey(start), 0]]);
  const parents = new Map<string, Hex>();
  const visited = new Set<string>();
  const goalK = hexKey(goal);
  for (;;) {
    let curK: string | null = null;
    let curCost = Infinity;
    for (const [k, c] of cost) {
      if (visited.has(k)) continue;
      if (c < curCost) {
        curCost = c;
        curK = k;
      }
    }
    if (curK === null) break;
    visited.add(curK);
    if (curK === goalK) break;
    const [qs, rs] = curK.split(',');
    const cur = { q: Number(qs), r: Number(rs) };
    for (const n of hexNeighbors(cur)) {
      if (!walkable(n)) continue;
      const c = curCost + enterCost(n);
      if (c > budget) continue;
      const nk = hexKey(n);
      const ex = cost.get(nk);
      if (ex === undefined || c < ex) {
        cost.set(nk, c);
        parents.set(nk, cur);
      }
    }
  }
  if (!visited.has(goalK)) return null;
  const out: Hex[] = [];
  let cur: Hex | undefined = goal;
  while (cur && !hexEqual(cur, start)) {
    out.push(cur);
    cur = parents.get(hexKey(cur));
  }
  out.push(start);
  return out.reverse();
}

/**
 * Total movement cost of walking `path` — the list of hexes entered, excluding
 * the starting hex. Sums each hex's `enterCost` (difficult terrain costs 2), so
 * it can differ from `path.length` (the physical number of hexes moved).
 */
export function pathCost(path: readonly Hex[], enterCost: (h: Hex) => number): number {
  let total = 0;
  for (const h of path) total += enterCost(h);
  return total;
}

/**
 * BFS reachable destinations for a Jump move. Jumping ignores enemies in
 * pass-through hexes but the last hex of the move is treated normally.
 *
 *   - `walkable(h)` decides if a hex can be traversed (walls block; enemies
 *     do not).
 *   - `canEnd(h)` decides if a hex is a legal destination (must also be
 *     unoccupied by another figure).
 *
 * `start` is included with distance 0 to match `bfsReachable`.
 */
export function bfsReachableJump(
  start: Hex,
  budget: number,
  walkable: (h: Hex) => boolean,
  canEnd: (h: Hex) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  out.set(hexKey(start), 0);
  if (budget <= 0) return out;
  const seen = new Set<string>([hexKey(start)]);
  let frontier: Hex[] = [start];
  for (let step = 1; step <= budget; step++) {
    const next: Hex[] = [];
    for (const h of frontier) {
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (seen.has(k)) continue;
        if (!walkable(n)) continue;
        seen.add(k);
        if (canEnd(n)) out.set(k, step);
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out;
}

/**
 * Shortest jump path from `start` to `goal`, including both endpoints.
 * Mid-path hexes need only be `walkable`; the goal must also satisfy
 * `canEnd`. Returns null if no path exists within `budget`.
 */
export function bfsPathJump(
  start: Hex,
  goal: Hex,
  budget: number,
  walkable: (h: Hex) => boolean,
  canEnd: (h: Hex) => boolean,
): Hex[] | null {
  if (hexEqual(start, goal)) return [start];
  if (budget <= 0) return null;
  if (!canEnd(goal)) return null;
  const parents = new Map<string, Hex>();
  const seen = new Set<string>([hexKey(start)]);
  let frontier: Hex[] = [start];
  for (let step = 1; step <= budget; step++) {
    const next: Hex[] = [];
    for (const h of frontier) {
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (seen.has(k)) continue;
        if (!walkable(n)) continue;
        seen.add(k);
        parents.set(k, h);
        if (hexEqual(n, goal)) {
          const out: Hex[] = [n];
          let cur = h;
          while (!hexEqual(cur, start)) {
            out.push(cur);
            cur = parents.get(hexKey(cur))!;
          }
          out.push(start);
          return out.reverse();
        }
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

/**
 * Rotate an axial hex 60° counter-clockwise around the origin.
 * Six rotations cycle back to identity.
 */
export function rotateHex60CCW(h: Hex): Hex {
  return { q: -h.r, r: h.q + h.r };
}

/** Rotate `h` by `n * 60°` CCW around the origin (n is taken mod 6). */
export function rotateHexN(h: Hex, n: number): Hex {
  let cur = h;
  const m = ((n % 6) + 6) % 6;
  for (let i = 0; i < m; i++) cur = rotateHex60CCW(cur);
  return cur;
}

/** Apply a rotation to every hex offset in the pattern. */
export function rotatePattern(pattern: readonly Hex[], n: number): Hex[] {
  return pattern.map((h) => rotateHexN(h, n));
}

function cubeRound(x: number, y: number, z: number): { x: number; z: number } {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, z: rz };
}

/**
 * Hex line from `a` to `b` inclusive (linear interpolation in cube coords,
 * rounded back to axial). Length = hexDistance(a,b) + 1.
 */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const N = hexDistance(a, b);
  if (N === 0) return [{ q: a.q, r: a.r }];
  const ax = a.q, az = a.r, ay = -a.q - a.r;
  const bx = b.q, bz = b.r, by = -b.q - b.r;
  const out: Hex[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = ax + (bx - ax) * t;
    const cy = ay + (by - ay) * t;
    const cz = az + (bz - az) * t;
    const { x, z } = cubeRound(cx, cy, cz);
    out.push({ q: x, r: z });
  }
  return out;
}

/**
 * Centerline-based line-of-sight: trace a hex line from `a` to `b` and check
 * that no intermediate hex blocks. Endpoints are not checked.
 * NB: this is more conservative than the rulebook (which allows
 * corner-to-corner peeks past wall corners). Adequate for v1.
 */
export function hasLineOfSight(
  a: Hex,
  b: Hex,
  blocks: (h: Hex) => boolean,
): boolean {
  const line = hexLine(a, b);
  for (let i = 1; i < line.length - 1; i++) {
    if (blocks(line[i]!)) return false;
  }
  return true;
}

/**
 * Forced-movement reachable hexes for Push/Pull.
 * Each step from current hex to neighbor must satisfy the directional rule
 * relative to `anchor` (the actor):
 *   - 'push' → distance(anchor, next) > distance(anchor, current)
 *   - 'pull' → distance(anchor, next) < distance(anchor, current)
 * Returns a map of hexKey → distance from `start`. Includes `start` at 0.
 */
export function bfsForcedMove(
  start: Hex,
  budget: number,
  anchor: Hex,
  direction: 'push' | 'pull',
  passable: (h: Hex) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  out.set(hexKey(start), 0);
  if (budget <= 0) return out;
  let frontier: Hex[] = [start];
  for (let step = 1; step <= budget; step++) {
    const next: Hex[] = [];
    for (const h of frontier) {
      const curDist = hexDistance(anchor, h);
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (out.has(k)) continue;
        if (!passable(n)) continue;
        const newDist = hexDistance(anchor, n);
        if (direction === 'push' && newDist <= curDist) continue;
        if (direction === 'pull' && newDist >= curDist) continue;
        out.set(k, step);
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out;
}

/**
 * Like `bfsForcedMove` but returns the path from `start` to `dest` (excluding
 * `start`). Each step satisfies the push/pull directional rule. Returns null
 * if `dest` is not reachable within the budget.
 */
export function bfsForcedMovePath(
  start: Hex,
  dest: Hex,
  budget: number,
  anchor: Hex,
  direction: 'push' | 'pull',
  passable: (h: Hex) => boolean,
): Hex[] | null {
  if (budget <= 0) return null;
  const startKey = hexKey(start);
  const parent = new Map<string, Hex | null>();
  parent.set(startKey, null);
  let frontier: Hex[] = [start];
  for (let step = 1; step <= budget; step++) {
    const next: Hex[] = [];
    for (const h of frontier) {
      const curDist = hexDistance(anchor, h);
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (parent.has(k)) continue;
        if (!passable(n)) continue;
        const newDist = hexDistance(anchor, n);
        if (direction === 'push' && newDist <= curDist) continue;
        if (direction === 'pull' && newDist >= curDist) continue;
        parent.set(k, h);
        if (n.q === dest.q && n.r === dest.r) {
          const out: Hex[] = [];
          let cur: Hex | null = n;
          while (cur && hexKey(cur) !== startKey) {
            out.unshift(cur);
            cur = parent.get(hexKey(cur)) ?? null;
          }
          return out;
        }
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}
