/**
 * Bridges builder-authored scenarios (stored in the browser) into something the
 * game server can play.
 *
 * The server only knows the hand-written campaign scenarios. To play a scenario
 * built in the editor we compile its layout into a runtime `Scenario` here in
 * the host's browser, gather the tile artwork from IndexedDB, and ship both to
 * the server with `host_start_scenario`.
 */

import { compileScenario, type PlacedTileArt, type Scenario } from '@gloomfolk/shared';
import { getScenario, SCENARIO_NUMBERS } from '../builder/scenarios.js';
import { getTileImageRecord } from '../builder/tileImages.js';

/** Id prefix marking a scenario-picker entry as a builder scenario (vs. a
 *  registry one). The suffix is the builder scenario number. */
const BUILDER_ID_PREFIX = 'builder:';

export function isBuilderScenarioId(id: string): boolean {
  return id.startsWith(BUILDER_ID_PREFIX);
}

export function builderScenarioId(n: number): string {
  return `${BUILDER_ID_PREFIX}${n}`;
}

function builderNumberFromId(id: string): number | null {
  if (!isBuilderScenarioId(id)) return null;
  const n = Number(id.slice(BUILDER_ID_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

function displayName(n: number, name?: string): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Custom Scenario ${n}`;
}

/** Built scenarios in the editor (those with at least one placed tile), for the
 *  host's scenario picker. */
export function listBuiltScenarios(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const n of SCENARIO_NUMBERS) {
    const data = getScenario(n);
    if (!data || !data.placedTiles || data.placedTiles.length === 0) continue;
    out.push({ id: builderScenarioId(n), name: displayName(n, data.name) });
  }
  return out;
}

/** Compile a builder scenario and collect its tile artwork, ready to send to the
 *  server. Returns null if the id isn't a (built) builder scenario. */
export async function buildCustomScenario(
  pickerId: string,
): Promise<{ scenario: Scenario; tileArt: PlacedTileArt[] } | null> {
  const n = builderNumberFromId(pickerId);
  if (n === null) return null;
  const data = getScenario(n);
  if (!data || !data.placedTiles || data.placedTiles.length === 0) return null;

  const scenario = compileScenario(data, {
    id: builderScenarioId(n),
    name: displayName(n, data.name),
    objective: 'Defeat all enemies.',
  });

  // One art entry per placed tile that has an uploaded image.
  const tileArt: PlacedTileArt[] = [];
  for (const p of data.placedTiles) {
    const record = await getTileImageRecord(p.tileSideId);
    if (!record) continue;
    tileArt.push({
      tileSideId: p.tileSideId,
      origin: p.origin,
      rotation: p.rotation,
      dataUrl: record.dataUrl,
      transform: record.transform,
    });
  }
  return { scenario, tileArt };
}
