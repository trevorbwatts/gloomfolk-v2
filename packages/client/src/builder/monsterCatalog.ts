/**
 * Lightweight monster catalogue for the scenario editor's picker.
 *
 * Add an entry here when a new monster stat card is registered in
 * packages/shared/src/monsters. The id must match `MonsterStatCard.id`.
 */

export interface MonsterCatalogEntry {
  id: string;
  name: string;
  /** Two-letter short label shown on the canvas. */
  short: string;
}

export const MONSTER_CATALOG: MonsterCatalogEntry[] = [
  { id: 'bandit-archer', name: 'Bandit Archer', short: 'BA' },
  { id: 'bandit-scout',  name: 'Bandit Scout',  short: 'BS' },
  { id: 'city-guard',    name: 'City Guard',    short: 'CG' },
];

export function monsterEntry(id: string): MonsterCatalogEntry | undefined {
  return MONSTER_CATALOG.find((m) => m.id === id);
}
