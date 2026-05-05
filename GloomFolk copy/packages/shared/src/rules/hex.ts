import type { Hex } from '../types.js';

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexEq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => hexAdd(h, d));
}

export type HexBounds = { width: number; height: number };

// Offset rectangle: q in [0, width), r in [0, height) with skew
export function inBounds(h: Hex, b: HexBounds): boolean {
  const col = h.q + Math.floor(h.r / 2);
  return col >= 0 && col < b.width && h.r >= 0 && h.r < b.height;
}

export function bfsReachable(
  start: Hex,
  maxSteps: number,
  blocked: (h: Hex) => boolean,
  bounds: HexBounds,
): Map<string, { hex: Hex; dist: number; from: string | null }> {
  const result = new Map<string, { hex: Hex; dist: number; from: string | null }>();
  result.set(hexKey(start), { hex: start, dist: 0, from: null });
  let frontier: Hex[] = [start];
  for (let step = 1; step <= maxSteps; step++) {
    const next: Hex[] = [];
    for (const cur of frontier) {
      for (const n of neighbors(cur)) {
        const k = hexKey(n);
        if (result.has(k)) continue;
        if (!inBounds(n, bounds)) continue;
        if (blocked(n)) continue;
        result.set(k, { hex: n, dist: step, from: hexKey(cur) });
        next.push(n);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return result;
}

export function pathTo(
  reach: Map<string, { hex: Hex; dist: number; from: string | null }>,
  goalKey: string,
): Hex[] {
  const path: Hex[] = [];
  let cur: string | null = goalKey;
  while (cur) {
    const node = reach.get(cur);
    if (!node) break;
    path.unshift(node.hex);
    cur = node.from;
  }
  return path;
}

// Returns the straight-line path from `from` to `to` (inclusive of both endpoints)
// if such a path exists in one of the 6 axial directions and every intermediate
// hex is in-bounds and not blocked. The destination hex itself is allowed to be
// blocked-or-not — caller decides — only the intermediates are checked here.
// Returns null if no straight path exists.
export function straightLinePath(
  from: Hex,
  to: Hex,
  blocked: (h: Hex) => boolean,
  bounds: HexBounds,
): Hex[] | null {
  if (hexEq(from, to)) return [from];
  const dist = hexDistance(from, to);
  for (const dir of DIRECTIONS) {
    let cur = from;
    const path: Hex[] = [from];
    let ok = true;
    for (let i = 0; i < dist; i++) {
      cur = hexAdd(cur, dir);
      if (!inBounds(cur, bounds)) { ok = false; break; }
      const isLast = i === dist - 1;
      if (!isLast && blocked(cur)) { ok = false; break; }
      path.push(cur);
    }
    if (ok && hexEq(cur, to)) return path;
  }
  return null;
}

// Pointy-top hex layout for rendering
export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = size * (3 / 2) * h.r;
  return { x, y };
}
