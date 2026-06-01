export * from './types.js';
export * from './layout.js';
export * from './compile.js';
import type { Scenario } from './types.js';
import { scenario0 } from './scenario-0.js';

/** The campaign's scenarios, keyed by id. Scenario 0 (Training Course) is the
 *  starting scenario for every new campaign. */
const all: Record<string, Scenario> = {
  [scenario0.id]: scenario0,
};

/** The scenario a brand-new campaign begins on. */
export const FIRST_SCENARIO_ID = scenario0.id;

export function getScenario(id: string): Scenario | null {
  return all[id] ?? null;
}

/** All registered scenarios, for the host's scenario picker. */
export function listScenarios(): { id: string; name: string }[] {
  return Object.values(all).map((s) => ({ id: s.id, name: s.name }));
}
