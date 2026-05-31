export * from './types.js';
export * from './layout.js';
export * from './compile.js';
import type { Scenario } from './types.js';
import { level1 } from './level1.js';

const all: Record<string, Scenario> = {
  [level1.id]: level1,
};

export function getScenario(id: string): Scenario | null {
  return all[id] ?? null;
}

/** All registered scenarios, for the host's scenario picker. */
export function listScenarios(): { id: string; name: string }[] {
  return Object.values(all).map((s) => ({ id: s.id, name: s.name }));
}
