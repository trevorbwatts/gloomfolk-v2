import type { Scenario, Tile } from './types.js';

// Simple rectangular-ish room: 7 wide (q: 0..6) × 6 tall (r: 0..5)
// Pointy-top axial. A couple of walls in the middle for visual interest.

function buildTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let r = 0; r < 6; r++) {
    for (let q = 0; q < 7; q++) {
      tiles.push({ q, r, kind: 'floor' });
    }
  }
  // Two interior walls to break sight lines
  for (const t of tiles) {
    if ((t.q === 3 && t.r === 1) || (t.q === 3 && t.r === 4)) {
      t.kind = 'wall';
    }
  }
  return tiles;
}

export const level1: Scenario = {
  id: 'level1',
  name: 'The Bandit Camp',
  objective: 'Defeat all enemies.',
  tiles: buildTiles(),
  spawns: [
    { hex: { q: 0, r: 2 }, side: 'player' },
    { hex: { q: 0, r: 3 }, side: 'player' },
    { hex: { q: 6, r: 1 }, side: 'enemy', monsterId: 'bandit-archer' },
    { hex: { q: 6, r: 4 }, side: 'enemy', monsterId: 'bandit-scout' },
  ],
};
