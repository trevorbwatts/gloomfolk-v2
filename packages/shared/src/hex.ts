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
 * Breadth-first reachable hexes from `start`, up to `budget` steps.
 * `passable(hex)` decides if a hex can be entered (false for walls / occupied).
 * Returns a map of hexKey → distance from start.
 */
export function bfsReachable(
  start: Hex,
  budget: number,
  passable: (h: Hex) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  out.set(hexKey(start), 0);
  if (budget <= 0) return out;
  let frontier: Hex[] = [start];
  for (let step = 1; step <= budget; step++) {
    const next: Hex[] = [];
    for (const h of frontier) {
      for (const n of hexNeighbors(h)) {
        const k = hexKey(n);
        if (out.has(k)) continue;
        if (!passable(n)) continue;
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
