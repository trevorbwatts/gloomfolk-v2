/**
 * Local-storage backed authored data for the 100 scenarios in the rule book.
 *
 * Each scenario number (0..100) maps to a JSON entry under `gf.scenario.<n>`.
 * If no entry exists, the scenario is considered "unbuilt" and shows an empty
 * state in the editor. Anything authored here applies globally — every campaign
 * uses the same scenario templates.
 *
 * The authoring schema (PlacedTile, Overlay, MonsterSpawn, ScenarioData, …)
 * lives in `@gloomfolk/shared` so the server-side scenario compiler can consume
 * the same shapes. This module re-exports them and adds the browser-only bits
 * (id generators, localStorage persistence).
 */

export type {
  PlacedTile,
  Overlay,
  OverlayKind,
  MonsterSpawn,
  MonsterRankAtCount,
  SpawnBehavior,
  ScenarioData,
  TokenLetter,
  TokenNumber,
} from '@gloomfolk/shared';
export { TOKEN_LETTERS, TOKEN_NUMBERS } from '@gloomfolk/shared';

import type { ScenarioData } from '@gloomfolk/shared';

/** Includes session zero (campaign setup) plus scenarios 1–100. */
export const SCENARIO_COUNT = 101;
export const SCENARIO_NUMBERS: number[] = Array.from(
  { length: SCENARIO_COUNT },
  (_, i) => i,
);

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
