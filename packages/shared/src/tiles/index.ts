import type { Hex } from '../hex.js';

/**
 * Catalogue of physical map tiles from the Gloomhaven 2E box.
 *
 * Each physical tile has a SHAPE (footprint of hexes + connector edges) and
 * multiple SIDES (printed art variants). Two tiles can share the same shape
 * but have different art on each side.
 *
 * Footprints below are best-guess approximations from photos and will be
 * refined as Trevor reviews each tile in the builder screen.
 */

export interface TileShape {
  id: string;
  name: string;
  description: string;
  footprint: Hex[];
}

export interface TileSide {
  id: string;        // e.g. "04-C"
  shapeId: string;   // e.g. "04"
  artNotes: string;  // short description of what's on the side
  hasWalls: boolean; // stone-wall border around the playable area
}

// ---------- Footprint generators ----------

/** Regular hexagonal footprint of axial radius N (1+6+12+...). */
export function hexagonFootprint(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) out.push({ q, r });
    }
  }
  return out;
}

/** Pointy-top rectangle, offset so rows stay visually centered. */
export function rectangleFootprint(width: number, height: number): Hex[] {
  const out: Hex[] = [];
  for (let r = 0; r < height; r++) {
    const offset = Math.floor(r / 2);
    for (let q = -offset; q < width - offset; q++) {
      out.push({ q, r });
    }
  }
  return out;
}

/** Horizontal slice: rows of varying widths, centered. */
function rowsFootprint(rowWidths: number[]): Hex[] {
  const out: Hex[] = [];
  for (let r = 0; r < rowWidths.length; r++) {
    const w = rowWidths[r]!;
    const offset = Math.floor(r / 2);
    const start = -Math.floor(w / 2) - offset + Math.floor(r / 2);
    for (let i = 0; i < w; i++) {
      out.push({ q: start + i, r });
    }
  }
  return out;
}

// ---------- Irregular shapes ----------

/** L-shape: vertical arm on the left, horizontal arm extending right at the bottom. */
function lShapeFootprint(): Hex[] {
  const out: Hex[] = [];
  // Vertical arm: 3 columns wide × 5 rows tall
  for (let r = 0; r < 5; r++) {
    const offset = Math.floor(r / 2);
    for (let q = -offset; q < 3 - offset; q++) out.push({ q, r });
  }
  // Horizontal extension: 4 extra columns to the right, only bottom 3 rows
  for (let r = 2; r < 5; r++) {
    const offset = Math.floor(r / 2);
    for (let q = 3 - offset; q < 7 - offset; q++) out.push({ q, r });
  }
  return out;
}

/** T-shape: wide bar across the top, stem extending down from the middle. */
function tShapeFootprint(): Hex[] {
  const out: Hex[] = [];
  // Top bar: 7 columns × 3 rows
  for (let r = 0; r < 3; r++) {
    const offset = Math.floor(r / 2);
    for (let q = -offset; q < 7 - offset; q++) out.push({ q, r });
  }
  // Stem: 3 cols × 5 more rows, centered
  for (let r = 3; r < 8; r++) {
    const offset = Math.floor(r / 2);
    for (let q = 2 - offset; q < 5 - offset; q++) out.push({ q, r });
  }
  return out;
}

/** Arch (Π) shape: wide top, two legs extending down with a notch in the middle. */
function archShapeFootprint(): Hex[] {
  const out: Hex[] = [];
  // Top bar: 7 columns × 3 rows
  for (let r = 0; r < 3; r++) {
    const offset = Math.floor(r / 2);
    for (let q = -offset; q < 7 - offset; q++) out.push({ q, r });
  }
  // Left leg: 2 cols × 4 more rows
  for (let r = 3; r < 7; r++) {
    const offset = Math.floor(r / 2);
    for (let q = -offset; q < 2 - offset; q++) out.push({ q, r });
  }
  // Right leg: 2 cols × 4 more rows
  for (let r = 3; r < 7; r++) {
    const offset = Math.floor(r / 2);
    for (let q = 5 - offset; q < 7 - offset; q++) out.push({ q, r });
  }
  return out;
}

// ---------- Shapes ----------

export const TILE_SHAPES: TileShape[] = [
  {
    id: '01',
    name: 'Small corridor',
    description: 'Top row of 4 hexes over a bottom row of 5 hexes (9 total).',
    footprint: [
      // top row: 4 hexes
      { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 },
      // bottom row: 5 hexes
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 4, r: 1 },
    ],
  },
  {
    id: '02',
    name: 'Square room',
    description: 'Rows of 4-3-4-3 hexes (14 total).',
    footprint: [
      // r=0: 4 hexes
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 },
      // r=1: 3 hexes (nested between row 0)
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
      // r=2: 4 hexes (aligned with row 0)
      { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 },
      // r=3: 3 hexes (nested between row 2)
      { q: -1, r: 3 }, { q: 0, r: 3 }, { q: 1, r: 3 },
    ],
  },
  {
    id: '03',
    name: 'Small hexagonal',
    description: 'Rows of 2-3-4-3 hexes (12 total), centered.',
    footprint: [
      // r=0: 2 hexes
      { q: -1, r: 0 }, { q: 0, r: 0 },
      // r=1: 3 hexes
      { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 },
      // r=2: 4 hexes
      { q: -3, r: 2 }, { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
      // r=3: 3 hexes
      { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 },
    ],
  },
  {
    id: '04',
    name: 'Large hexagonal',
    description: 'Regular hexagon of radius 2, rows of 3-4-5-4-3 (19 hexes).',
    footprint: hexagonFootprint(2),
  },
  {
    id: '05',
    name: 'Large square hall',
    description: 'Rows of 4-5-4-5-4 hexes (22 total), centered.',
    footprint: [
      // r=0: 4 hexes
      { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 },
      // r=1: 5 hexes
      { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      // r=2: 4 hexes
      { q: -3, r: 2 }, { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
      // r=3: 5 hexes
      { q: -4, r: 3 }, { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 }, { q: 0, r: 3 },
      // r=4: 4 hexes
      { q: -4, r: 4 }, { q: -3, r: 4 }, { q: -2, r: 4 }, { q: -1, r: 4 },
    ],
  },
  {
    id: '06',
    name: 'Narrow passage',
    description: 'Rows of 3-2-3-2-3-2-3-2-3 hexes (25 total), centered.',
    footprint: [
      // r=0: 3 hexes
      { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 },
      // r=1: 2 hexes
      { q: -1, r: 1 }, { q: 0, r: 1 },
      // r=2: 3 hexes
      { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
      // r=3: 2 hexes
      { q: -2, r: 3 }, { q: -1, r: 3 },
      // r=4: 3 hexes
      { q: -3, r: 4 }, { q: -2, r: 4 }, { q: -1, r: 4 },
      // r=5: 2 hexes
      { q: -3, r: 5 }, { q: -2, r: 5 },
      // r=6: 3 hexes
      { q: -4, r: 6 }, { q: -3, r: 6 }, { q: -2, r: 6 },
      // r=7: 2 hexes
      { q: -4, r: 7 }, { q: -3, r: 7 },
      // r=8: 3 hexes
      { q: -5, r: 8 }, { q: -4, r: 8 }, { q: -3, r: 8 },
    ],
  },
  {
    id: '07',
    name: 'Long hall',
    description: 'Rows of 8-7-8 hexes (23 total), centered.',
    footprint: [
      // r=0: 8 hexes
      { q: -4, r: 0 }, { q: -3, r: 0 }, { q: -2, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 },
      // r=1: 7 hexes
      { q: -4, r: 1 }, { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 },
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
      // r=2: 8 hexes
      { q: -5, r: 2 }, { q: -4, r: 2 }, { q: -3, r: 2 }, { q: -2, r: 2 },
      { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 },
    ],
  },
  {
    id: '09',
    name: 'T-junction',
    description: 'Rows of 6-7-2-3-2-3-2 hexes (25 total), centered.',
    footprint: [
      // r=0: 6 hexes (top bar)
      { q: -3, r: 0 }, { q: -2, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
      // r=1: 7 hexes (top bar)
      { q: -4, r: 1 }, { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 },
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
      // r=2: 2 hexes (stem)
      { q: -2, r: 2 }, { q: -1, r: 2 },
      // r=3: 3 hexes (stem)
      { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 },
      // r=4: 2 hexes (stem)
      { q: -3, r: 4 }, { q: -2, r: 4 },
      // r=5: 3 hexes (stem)
      { q: -4, r: 5 }, { q: -3, r: 5 }, { q: -2, r: 5 },
      // r=6: 2 hexes (stem)
      { q: -4, r: 6 }, { q: -3, r: 6 },
    ],
  },
  {
    id: '10',
    name: 'Large hall',
    description: 'Rows of 6-5-6-5-6 hexes (28 total), centered.',
    footprint: [
      // r=0: 6 hexes
      { q: -3, r: 0 }, { q: -2, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
      // r=1: 5 hexes
      { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 },
      { q: 0, r: 1 }, { q: 1, r: 1 },
      // r=2: 6 hexes
      { q: -4, r: 2 }, { q: -3, r: 2 }, { q: -2, r: 2 },
      { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 },
      // r=3: 5 hexes
      { q: -4, r: 3 }, { q: -3, r: 3 }, { q: -2, r: 3 },
      { q: -1, r: 3 }, { q: 0, r: 3 },
      // r=4: 6 hexes
      { q: -5, r: 4 }, { q: -4, r: 4 }, { q: -3, r: 4 },
      { q: -2, r: 4 }, { q: -1, r: 4 }, { q: 0, r: 4 },
    ],
  },
  {
    id: '11',
    name: 'L-corner',
    description: 'Rows of 1-3-3-3-7-6-5 hexes (28 total), traced from diagram.',
    footprint: [
      // r=0: 1 hex  (..1)
      { q: 2, r: 0 },
      // r=1: 3 hexes (111)
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
      // r=2: 3 hexes (shifted left 1)
      { q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 },
      // r=3: 3 hexes (shifted left 2)
      { q: 0, r: 3 }, { q: 1, r: 3 }, { q: 2, r: 3 },
      // r=4: 7 hexes (shifted left 3)
      { q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 },
      { q: 3, r: 4 }, { q: 4, r: 4 }, { q: 5, r: 4 }, { q: 6, r: 4 },
      // r=5: 6 hexes (shifted left 4)
      { q: 0, r: 5 }, { q: 1, r: 5 }, { q: 2, r: 5 },
      { q: 3, r: 5 }, { q: 4, r: 5 }, { q: 5, r: 5 },
      // r=6: 5 hexes (shifted left 5)
      { q: 1, r: 6 }, { q: 2, r: 6 }, { q: 3, r: 6 },
      { q: 4, r: 6 }, { q: 5, r: 6 },
    ],
  },
  {
    id: '12',
    name: 'Arch chamber',
    description: 'Rows of 4-5-6-3+3-3+3-2+2 (31 hexes), centered, with a growing notch in the lower middle.',
    footprint: [
      // r=0: 4 hexes (1111)
      { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 },
      // r=1: 5 hexes (11111)
      { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      // r=2: 6 hexes (111111)
      { q: -4, r: 2 }, { q: -3, r: 2 }, { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 },
      // r=3: 3 + gap(1) + 3 hexes (1110111)
      { q: -5, r: 3 }, { q: -4, r: 3 }, { q: -3, r: 3 },
      { q: -1, r: 3 }, { q: 0, r: 3 }, { q: 1, r: 3 },
      // r=4: 3 + gap(2) + 3 hexes (11100111)
      { q: -6, r: 4 }, { q: -5, r: 4 }, { q: -4, r: 4 },
      { q: -1, r: 4 }, { q: 0, r: 4 }, { q: 1, r: 4 },
      // r=5: 2 + gap(3) + 2 hexes (1100011)
      { q: -6, r: 5 }, { q: -5, r: 5 },
      { q: -1, r: 5 }, { q: 0, r: 5 },
    ],
  },
  {
    id: '13',
    name: 'Tall hall',
    description: 'Rows of 5-4-5-4-5-4-5 hexes (32 total), centered.',
    footprint: [
      // r=0: 5 hexes
      { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
      // r=1: 4 hexes
      { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      // r=2: 5 hexes
      { q: -3, r: 2 }, { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 },
      // r=3: 4 hexes
      { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 }, { q: 0, r: 3 },
      // r=4: 5 hexes
      { q: -4, r: 4 }, { q: -3, r: 4 }, { q: -2, r: 4 }, { q: -1, r: 4 }, { q: 0, r: 4 },
      // r=5: 4 hexes
      { q: -4, r: 5 }, { q: -3, r: 5 }, { q: -2, r: 5 }, { q: -1, r: 5 },
      // r=6: 5 hexes
      { q: -5, r: 6 }, { q: -4, r: 6 }, { q: -3, r: 6 }, { q: -2, r: 6 }, { q: -1, r: 6 },
    ],
  },
  {
    id: '15',
    name: 'Large chamber',
    description: 'Rows of 4-5-6-5-6-5-4 hexes (35 total), centered.',
    footprint: [
      // r=0: 4 hexes
      { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 },
      // r=1: 5 hexes
      { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      // r=2: 6 hexes
      { q: -4, r: 2 }, { q: -3, r: 2 }, { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 },
      // r=3: 5 hexes
      { q: -4, r: 3 }, { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 }, { q: 0, r: 3 },
      // r=4: 6 hexes
      { q: -5, r: 4 }, { q: -4, r: 4 }, { q: -3, r: 4 }, { q: -2, r: 4 }, { q: -1, r: 4 }, { q: 0, r: 4 },
      // r=5: 5 hexes
      { q: -5, r: 5 }, { q: -4, r: 5 }, { q: -3, r: 5 }, { q: -2, r: 5 }, { q: -1, r: 5 },
      // r=6: 4 hexes
      { q: -5, r: 6 }, { q: -4, r: 6 }, { q: -3, r: 6 }, { q: -2, r: 6 },
    ],
  },
  {
    id: '16',
    name: 'Large chamber (alt)',
    description: 'Rows of 8-7-8-7-8-7-8 hexes (53 total), centered.',
    footprint: [
      // r=0: 8 hexes
      { q: -4, r: 0 }, { q: -3, r: 0 }, { q: -2, r: 0 }, { q: -1, r: 0 },
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 },
      // r=1: 7 hexes
      { q: -4, r: 1 }, { q: -3, r: 1 }, { q: -2, r: 1 }, { q: -1, r: 1 },
      { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 },
      // r=2: 8 hexes
      { q: -5, r: 2 }, { q: -4, r: 2 }, { q: -3, r: 2 }, { q: -2, r: 2 },
      { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 },
      // r=3: 7 hexes
      { q: -5, r: 3 }, { q: -4, r: 3 }, { q: -3, r: 3 }, { q: -2, r: 3 },
      { q: -1, r: 3 }, { q: 0, r: 3 }, { q: 1, r: 3 },
      // r=4: 8 hexes
      { q: -6, r: 4 }, { q: -5, r: 4 }, { q: -4, r: 4 }, { q: -3, r: 4 },
      { q: -2, r: 4 }, { q: -1, r: 4 }, { q: 0, r: 4 }, { q: 1, r: 4 },
      // r=5: 7 hexes
      { q: -6, r: 5 }, { q: -5, r: 5 }, { q: -4, r: 5 }, { q: -3, r: 5 },
      { q: -2, r: 5 }, { q: -1, r: 5 }, { q: 0, r: 5 },
      // r=6: 8 hexes
      { q: -7, r: 6 }, { q: -6, r: 6 }, { q: -5, r: 6 }, { q: -4, r: 6 },
      { q: -3, r: 6 }, { q: -2, r: 6 }, { q: -1, r: 6 }, { q: 0, r: 6 },
    ],
  },
];

// ---------- Sides ----------
// Each entry: id, shape, short art notes, and whether walls are part of the side.

export const TILE_SIDES: TileSide[] = [
  // 01 — small corridor (6 sides)
  { id: '01-A', shapeId: '01', artNotes: 'Cave passage with two top-corner torches.', hasWalls: true },
  { id: '01-B', shapeId: '01', artNotes: 'Barren rocky outdoor terrain with sparse grass.', hasWalls: false },
  { id: '01-C', shapeId: '01', artNotes: 'Stone dungeon corridor with torch and central bloodstain.', hasWalls: true },
  { id: '01-D', shapeId: '01', artNotes: 'Open grass / moss meadow.', hasWalls: false },
  { id: '01-E', shapeId: '01', artNotes: 'Rocky outdoor passage with mossy patches.', hasWalls: false },
  { id: '01-F', shapeId: '01', artNotes: 'Stone dungeon corridor with upper-right wall torch and floor stain.', hasWalls: true },

  // 02 — square room (7 sides)
  { id: '02-A', shapeId: '02', artNotes: 'Wooden shack interior with hanging oil lantern.', hasWalls: true },
  { id: '02-B', shapeId: '02', artNotes: 'Overgrown stone ruin with mossy boulders and wildflowers.', hasWalls: false },
  { id: '02-C', shapeId: '02', artNotes: 'Ship hold or cellar — wood plank floor, moonlight, barrels.', hasWalls: false },
  { id: '02-D', shapeId: '02', artNotes: 'Rough crypt floor with side torches, skull, half-buried sword.', hasWalls: true },
  { id: '02-G', shapeId: '02', artNotes: 'Wood plank floor with torch and small weapon/debris.', hasWalls: false },
  { id: '02-H', shapeId: '02', artNotes: 'Rocky cave floor with faint reddish streak.', hasWalls: false },
  { id: '02-E', shapeId: '02', artNotes: 'Blood-stained wood plank floor with cobwebs and debris.', hasWalls: false },
  { id: '02-F', shapeId: '02', artNotes: 'Bloody stone floor with four torch alcoves, heavy central gore.', hasWalls: true },

  // 03 — small hexagonal (4 sides)
  { id: '03-A', shapeId: '03', artNotes: 'Wet stone floor with hint of sword, no torches.', hasWalls: true },
  { id: '03-B', shapeId: '03', artNotes: 'Hexagonal wood-floor room with three torches and rope coil.', hasWalls: true },
  { id: '03-C', shapeId: '03', artNotes: 'Forest clearing with dirt path and small rocks.', hasWalls: false },
  { id: '03-D', shapeId: '03', artNotes: 'Stone-cobbled floor with bloodstain/skull and corner torch.', hasWalls: true },

  // 04 — large hexagonal (4 sides)
  { id: '04-A', shapeId: '04', artNotes: 'Large dungeon chamber with forge glow and bloody pickaxe.', hasWalls: true },
  { id: '04-B', shapeId: '04', artNotes: 'Lush meadow with wildflowers and tree root.', hasWalls: false },
  { id: '04-C', shapeId: '04', artNotes: 'Dungeon stone with two side torches and a printed sword.', hasWalls: true },
  { id: '04-D', shapeId: '04', artNotes: 'Sunken rocky pit with mossy floor.', hasWalls: false },

  // 05 — large square hall (2 sides)
  { id: '05-A', shapeId: '05', artNotes: 'Blood-stained dungeon with gold ring, torch, and corpse.', hasWalls: true },
  { id: '05-B', shapeId: '05', artNotes: 'Dark cavern with forge fire, skull, and embedded sword.', hasWalls: false },

  // 06 — narrow passage (2 sides)
  { id: '06-A', shapeId: '06', artNotes: 'Walled stone corridor with corner torches and floor bloodstains.', hasWalls: true },
  { id: '06-B', shapeId: '06', artNotes: 'Cracked stone path running through grass.', hasWalls: false },

  // 07 — long hall (4 sides)
  { id: '07-A', shapeId: '07', artNotes: 'Overgrown stone courtyard with weathered flagstones.', hasWalls: false },
  { id: '07-B', shapeId: '07', artNotes: 'Tiled dungeon floor with central brazier and bloodstain.', hasWalls: true },
  { id: '07-C', shapeId: '07', artNotes: 'Outdoor rocky rubble with stone marker stub.', hasWalls: false },
  { id: '07-D', shapeId: '07', artNotes: 'Tavern/library interior with bookshelf, barrels, papers.', hasWalls: true },

  // 09 — T-junction (4 sides)
  { id: '09-A', shapeId: '09', artNotes: 'Outdoor rocky terrain with sword in stone and mossy patches.', hasWalls: false },
  { id: '09-B', shapeId: '09', artNotes: 'Stone dungeon T-junction with end torches.', hasWalls: true },
  { id: '09-C', shapeId: '09', artNotes: 'Volcanic rock floor with lava veins throughout.', hasWalls: false },
  { id: '09-D', shapeId: '09', artNotes: 'Forest trail with rocks and boulders.', hasWalls: false },

  // 10 — large hall (4 sides)
  { id: '10-A', shapeId: '10', artNotes: 'Lodge interior with rug, axe, torches, hay pile, windows.', hasWalls: true },
  { id: '10-B', shapeId: '10', artNotes: 'Dungeon hall with debris, broken sword, dropped shield, torch.', hasWalls: true },
  { id: '10-C', shapeId: '10', artNotes: 'Cave floor embedded with giant fossilized ammonite shells.', hasWalls: false },
  { id: '10-D', shapeId: '10', artNotes: 'Tavern/lodge with four wall torches, barrels, broken bottle.', hasWalls: true },

  // 11 — L-corner (4 sides)
  { id: '11-A', shapeId: '11', artNotes: 'Cave/mine with abandoned lantern and torches.', hasWalls: false },
  { id: '11-B', shapeId: '11', artNotes: 'Rocky red-orange outdoor terrain.', hasWalls: false },
  { id: '11-C', shapeId: '11', artNotes: 'Collapsed mine with fallen timbers and ember glow.', hasWalls: false },
  { id: '11-D', shapeId: '11', artNotes: 'Cracked dried-earth ground with mossy pool and bloodstain.', hasWalls: false },

  // 12 — arch chamber (4 sides)
  { id: '12-A', shapeId: '12', artNotes: 'Stone dungeon with three torches lighting cracked walls.', hasWalls: true },
  { id: '12-B', shapeId: '12', artNotes: 'Heavily cracked rocky ground with reddish stain.', hasWalls: false },
  { id: '12-C', shapeId: '12', artNotes: 'Rocky cavern with lava burst and small fallen log.', hasWalls: false },
  { id: '12-D', shapeId: '12', artNotes: 'Cracked dungeon floor with bloody axe stuck in stone, torches.', hasWalls: true },

  // 13 — tall hall (6 sides)
  { id: '13-A', shapeId: '13', artNotes: 'Cave interior, dark stone fading to lava glow in corner.', hasWalls: false },
  { id: '13-B', shapeId: '13', artNotes: 'Overgrown temple floor with fallen stone pillar and sunbeams.', hasWalls: false },
  { id: '13-C', shapeId: '13', artNotes: 'Mine interior with wagon wheel, pickaxe, scaffolding, torches.', hasWalls: false },
  { id: '13-D', shapeId: '13', artNotes: 'Stone rubble dungeon with spider/skull and dropped torch.', hasWalls: true },
  { id: '13-E', shapeId: '13', artNotes: 'Forest floor with dappled sunlight, ferns, fallen leaves.', hasWalls: false },
  { id: '13-F', shapeId: '13', artNotes: 'Cave/mine with a crack in floor, picks, wooden supports, torches.', hasWalls: false },

  // 15 — large chamber (2 sides)
  { id: '15-A', shapeId: '15', artNotes: 'Dark cavern with torches, coals, faint moonlight above.', hasWalls: true },
  { id: '15-B', shapeId: '15', artNotes: 'Overgrown stone ruin wall with vines and central skull relief.', hasWalls: false },

  // 16 — large chamber (alt) (2 sides)
  { id: '16-A', shapeId: '16', artNotes: 'Dry desert scrubland with cracked earth, dead tree, sparse bushes.', hasWalls: false },
  { id: '16-B', shapeId: '16', artNotes: 'Large stone chamber with lava bursts at edges, sword in floor.', hasWalls: true },
];

export function tileShapeById(id: string): TileShape | undefined {
  return TILE_SHAPES.find((s) => s.id === id);
}

export function tileSideById(id: string): TileSide | undefined {
  return TILE_SIDES.find((s) => s.id === id);
}
