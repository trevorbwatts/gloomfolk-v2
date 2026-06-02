/**
 * Authoring schema for scenario layouts.
 *
 * This is what the Scenario Editor produces and what gets committed into the
 * repo (one `ScenarioData` per scenario). It is intentionally close to the
 * physical components: placed map tiles, overlay tokens, and monster spawns.
 * `compileScenario` (compile.ts) turns it, plus a hand-written rules module,
 * into a runtime `Scenario`.
 */

import type { Hex } from '../hex.js';

export interface PlacedTile {
  id: string;            // unique within the scenario
  tileSideId: string;    // e.g. "04-C"
  origin: { q: number; r: number };
  rotation: number;      // 0..5, each step = 60° CCW
}

/** Lettered map tokens (A–J) and numbered map tokens (1–9), placed on hexes
    to key them to the scenario book (spawn points, plates, markers, etc.). */
export const TOKEN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const TOKEN_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type TokenLetter = (typeof TOKEN_LETTERS)[number];
export type TokenNumber = (typeof TOKEN_NUMBERS)[number];

export type OverlayKind =
  | 'difficult-terrain'
  | 'hazardous-terrain'
  | 'trap'
  | 'obstacle'
  | 'objective'
  | 'treasure'
  | 'coin'
  | 'door'
  | 'corridor'
  | 'pressure-plate'
  | 'starting-position'
  | `token-${TokenLetter}`
  | `token-${TokenNumber}`;

export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** Hexes this overlay covers. A 3-hex tree obstacle is one overlay with 3 hexes. */
  hexes: Hex[];
  /** door: open vs closed. Closed by default. */
  doorOpen?: boolean;
}

export type MonsterRankAtCount = 'none' | 'normal' | 'elite';

/** Behavior tag authored per monster spawn. Maps to the runtime
 *  `MonsterBehavior`; 'scripted' is fleshed out in the rules module. */
export type SpawnBehavior = 'normal' | 'dummy' | 'scripted';

export interface MonsterSpawn {
  id: string;
  hex: Hex;
  /** Monster type id (e.g. "bandit-archer"); refs the shared monster catalogue. */
  monsterType: string;
  /** Rank per player count. Standard Gloomhaven: a slot may differ at 2/3/4 players. */
  ranks: { 2: MonsterRankAtCount; 3: MonsterRankAtCount; 4: MonsterRankAtCount };
  /** Optional named-monster variant. When set, the monster acts before elites. */
  named?: { name: string };
  /** Behavior tag (defaults to 'normal'). Authored in the editor or the rules module. */
  behavior?: SpawnBehavior;
}

export interface ScenarioData {
  number: number;
  name?: string;
  /** Free-text special rules pasted from the scenario book — read by the host. */
  specialRules?: string;
  placedTiles?: PlacedTile[];
  overlays?: Overlay[];
  monsterSpawns?: MonsterSpawn[];
}
