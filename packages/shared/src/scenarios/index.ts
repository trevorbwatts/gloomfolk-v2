export * from './types.js';
export { level1 } from './level1.js';
import type { Scenario } from './types.js';
import { level1 } from './level1.js';

const all: Record<string, Scenario> = {
  [level1.id]: level1,
};

export function getScenario(id: string): Scenario | null {
  return all[id] ?? null;
}
