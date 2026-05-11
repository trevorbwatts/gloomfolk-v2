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

export const SCENARIO_COUNT = 100;
export const SCENARIO_NUMBERS: number[] = Array.from(
  { length: SCENARIO_COUNT },
  (_, i) => i + 1,
);

export interface ScenarioData {
  number: number;
  name?: string;
  // Future: placedTiles, overlays, monsters, specialRules, etc.
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
