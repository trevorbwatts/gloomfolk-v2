export * from './types.js';
export * from './layout.js';
export * from './compile.js';
import type { Scenario } from './types.js';
import type { ScenarioRules } from './compile.js';
import { scenario0, scenario0Rules, SCENARIO_0_NUMBER } from './scenario-0.js';

/** The campaign's scenarios, keyed by id. Scenario 0 (Training Course) is the
 *  starting scenario for every new campaign. */
const all: Record<string, Scenario> = {
  [scenario0.id]: scenario0,
};

/** Hand-written rules (door wiring, scripted behavior, narrative) keyed by the
 *  scenario-book *number*. The host layers these onto the matching builder
 *  layout so the editor stays the single source of truth for the map while this
 *  code supplies behavior the editor can't express. */
const rulesByNumber: Record<number, ScenarioRules> = {
  [SCENARIO_0_NUMBER]: scenario0Rules,
};

/** Rules for a scenario-book number, if any are hand-written for it. */
export function getScenarioRules(n: number): ScenarioRules | null {
  return rulesByNumber[n] ?? null;
}

/** The scenario a brand-new campaign begins on. */
export const FIRST_SCENARIO_ID = scenario0.id;

export function getScenario(id: string): Scenario | null {
  return all[id] ?? null;
}

/** All registered scenarios, for the host's scenario picker. */
export function listScenarios(): { id: string; name: string }[] {
  return Object.values(all).map((s) => ({ id: s.id, name: s.name }));
}
