import {
  type Hex,
  rotatePattern,
  tileShapeById,
} from '@gloomfolk/shared';
import type { PlacedTile } from './scenarios.js';

/** Six neighbor directions in pointy-top axial coordinates. */
export const HEX_DIRECTIONS: { label: string; delta: Hex }[] = [
  { label: 'W',  delta: { q: -1, r:  0 } },
  { label: 'E',  delta: { q:  1, r:  0 } },
  { label: 'NW', delta: { q:  0, r: -1 } },
  { label: 'NE', delta: { q:  1, r: -1 } },
  { label: 'SW', delta: { q: -1, r:  1 } },
  { label: 'SE', delta: { q:  0, r:  1 } },
];

/** Absolute hex coords occupied by a placed tile. */
export function placedTileHexes(placed: PlacedTile): Hex[] {
  const shape = tileShapeById(
    // Look up shape via side. Caller passes a placed tile that references a
    // side id; resolve to shapeId in the caller for simplicity.
    placed.tileSideId,
  );
  // Fallback path — see resolved variant below.
  if (!shape) return [];
  return rotatePattern(shape.footprint, placed.rotation).map((h) => ({
    q: h.q + placed.origin.q,
    r: h.r + placed.origin.r,
  }));
}

/**
 * Resolve the absolute hexes a footprint covers given a placement (origin +
 * rotation). Works for any placed thing — tiles and decorations alike — since
 * it only needs the origin and rotation, not the tile-specific fields.
 */
export function applyPlacement(
  footprint: readonly Hex[],
  placed: { origin: { q: number; r: number }; rotation: number },
): Hex[] {
  return rotatePattern(footprint, placed.rotation).map((h) => ({
    q: h.q + placed.origin.q,
    r: h.r + placed.origin.r,
  }));
}
