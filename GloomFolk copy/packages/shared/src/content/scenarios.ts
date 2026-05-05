import type { ScenarioDef } from '../types.js';

// Scenario 01 — small chamber. Players spawn south, enemies north.
// Coordinates: q in [0, width), r in [0, height); width 10, height 8.
export const SCENARIO_01: ScenarioDef = {
  id: 'scenario_01',
  name: 'The Forgotten Chamber',
  width: 10,
  height: 8,
  obstacles: [
    { q: 4, r: 3 },
    { q: 5, r: 3 },
    { q: 4, r: 4 },
    { q: 2, r: 5 },
    { q: 7, r: 5 },
  ],
  playerSpawns: [
    { q: 3, r: 7 },
    { q: 5, r: 7 },
  ],
  enemies: [
    { defId: 'grunt', pos: { q: 2, r: 1 } },
    { defId: 'grunt', pos: { q: 4, r: 0 } },
    { defId: 'grunt', pos: { q: 6, r: 1 } },
    { defId: 'grunt', pos: { q: 8, r: 0 } },
    { defId: 'shooter', pos: { q: 3, r: 2 } },
    { defId: 'shooter', pos: { q: 7, r: 2 } },
  ],
};

export const SCENARIOS: Record<string, ScenarioDef> = {
  scenario_01: SCENARIO_01,
};
