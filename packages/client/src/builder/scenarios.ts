/**
 * Local-storage backed authored data for the 100 scenarios in the rule book.
 *
 * Each scenario number (1..100) maps to a JSON entry under
 * `gf.scenario.<n>`. If no entry exists, the scenario is considered
 * "unbuilt" and shows an empty state in the editor. Anything authored here
 * applies globally — every campaign uses the same scenario templates.
 *
 * The data model is intentionally minimal for now; we add fields (placed
 * tiles, overlays, special rules) as the scenario editor grows.
 */

/** Includes session zero (campaign setup) plus scenarios 1–100. */
export const SCENARIO_COUNT = 101;
export const SCENARIO_NUMBERS: number[] = Array.from(
  { length: SCENARIO_COUNT },
  (_, i) => i,
);

import type { Hex } from '@gloomfolk/shared';

export interface PlacedTile {
  id: string;            // unique within the scenario
  tileSideId: string;    // e.g. "04-C"
  origin: { q: number; r: number };
  rotation: number;      // 0..5, each step = 60° CCW
}

export type OverlayKind =
  | 'difficult-terrain'
  | 'hazardous-terrain'
  | 'trap'
  | 'obstacle'
  | 'objective'
  | 'treasure'
  | 'coin'
  | 'door'
  | 'starting-position';

export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** Hexes this overlay covers. A 3-hex tree obstacle is one overlay with 3 hexes. */
  hexes: Hex[];
  /** door: open vs closed. Closed by default. */
  doorOpen?: boolean;
}

export type MonsterRankAtCount = 'none' | 'normal' | 'elite';

export interface MonsterSpawn {
  id: string;
  hex: Hex;
  /** Monster type id (e.g. "bandit-archer"); refs the shared monster catalogue. */
  monsterType: string;
  /** Rank per player count. Standard Gloomhaven: a slot may differ at 2/3/4 players. */
  ranks: { 2: MonsterRankAtCount; 3: MonsterRankAtCount; 4: MonsterRankAtCount };
  /** Optional named-monster variant. When set, the monster acts before elites. */
  named?: { name: string };
}

export interface ScenarioData {
  number: number;
  name?: string;
  /** Free-text special rules pasted from the scenario book — read by the host. */
  specialRules?: string;
  placedTiles?: PlacedTile[];
  overlays?: Overlay[];
  monsterSpawns?: MonsterSpawn[];
  // Future: structured monster flags, triggers, etc.
}

export function newPlacedTileId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newOverlayId(): string {
  return `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newMonsterSpawnId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function key(n: number): string {
  return `gf.scenario.${n}`;
}

export function getScenario(n: number): ScenarioData | null {
  try {
    const raw = localStorage.getItem(key(n));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScenarioData;
    if (typeof parsed.number !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScenario(data: ScenarioData): void {
  try {
    localStorage.setItem(key(data.number), JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save scenario:', err);
  }
}

export function clearScenario(n: number): void {
  try {
    localStorage.removeItem(key(n));
  } catch {
    // ignore
  }
}

export function isBuilt(n: number): boolean {
  return getScenario(n) !== null;
}
