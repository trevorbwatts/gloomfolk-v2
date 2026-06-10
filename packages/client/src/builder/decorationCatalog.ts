/**
 * Catalogue of decorative map props (logs, scenery, …). These are purely
 * visual: they render as transparent PNGs glued to a hex footprint and rotate
 * with the map, but carry no game meaning (difficult terrain, obstacles, etc.
 * remain separate `Overlay` markers).
 *
 * Each entry pairs a piece of artwork (a PNG under `client/public/overlays/`)
 * with the hex pattern it covers at rotation 0, relative to its origin hex
 * (0,0). Footprints follow the pointy-top axial directions in `sceneGeometry`.
 */

import type { Hex } from '@gloomfolk/shared';

export type DecorationFootprint = 'single' | 'line-2' | 'triangle-3';

export interface DecorationDef {
  id: string;
  name: string;
  /** Served from `client/public`, e.g. "/overlays/fallen-log.png". */
  image: string;
  /** Human-readable footprint size, shown in the editor. */
  footprint: DecorationFootprint;
  /** Hex pattern at rotation 0, relative to the origin hex (0,0). */
  hexes: readonly Hex[];
  /** Render scale relative to the footprint's bounding box. 1 = fill the box;
   *  < 1 shrinks the artwork (keeping it centred). Defaults to 1. */
  scale?: number;
}

export const DECORATION_CATALOG: readonly DecorationDef[] = [
  {
    id: 'fallen-log',
    name: 'Fallen log',
    image: '/overlays/fallen-log.png',
    footprint: 'line-2',
    // Two hexes running left→right (origin + its east neighbour). The art is
    // drawn horizontally, so rotation 0 lies along this axis.
    hexes: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ],
    scale: 0.9,
  },
  {
    id: 'crate',
    name: 'Crate',
    image: '/overlays/crate.png',
    footprint: 'single',
    hexes: [{ q: 0, r: 0 }],
    // The single-hex bounding box is wider than the hex itself, so pull the
    // crate in a little to keep it sitting inside the hex.
    scale: 0.65,
  },
];

export function decorationDef(id: string): DecorationDef | undefined {
  return DECORATION_CATALOG.find((d) => d.id === id);
}
