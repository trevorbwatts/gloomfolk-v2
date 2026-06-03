/**
 * Bridges builder-authored scenarios (stored in the browser) into something the
 * game server can play.
 *
 * The editor is the single source of truth for a scenario's *map*. To play one
 * we compile its layout into a runtime `Scenario` here in the host's browser,
 * layer on any hand-written rules registered for that scenario number (door
 * wiring, scripted behavior, narrative — things the editor can't express),
 * gather the tile artwork from IndexedDB, and ship it all to the server with
 * `host_start_scenario`.
 */

import {
  compileScenario,
  getScenarioRules,
  listScenarios,
  type PlacedTileArt,
  type Scenario,
} from '@gloomfolk/shared';
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

/** Display name for a built scenario: the canonical rules name when this number
 *  has hand-written rules, otherwise the editor's name (or a fallback). */
function builtScenarioName(n: number, editorName?: string): string {
  const rulesName = getScenarioRules(n)?.name;
  if (rulesName) return rulesName;
  const trimmed = editorName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Custom Scenario ${n}`;
}

function isBuilt(n: number): boolean {
  const data = getScenario(n);
  return !!data && !!data.placedTiles && data.placedTiles.length > 0;
}

/**
 * The scenarios the host can start. Built editor scenarios are the source of
 * truth and come first; a registry scenario is included only when no built
 * scenario supersedes it (i.e. shares the rules id it would compile to), so the
 * editor's Training Course replaces — rather than duplicates — the hardcoded one.
 */
export function listPlayableScenarios(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const supersededRegistryIds = new Set<string>();
  for (const n of SCENARIO_NUMBERS) {
    if (!isBuilt(n)) continue;
    const editorName = getScenario(n)?.name;
    out.push({ id: builderScenarioId(n), name: builtScenarioName(n, editorName) });
    const rules = getScenarioRules(n);
    if (rules) supersededRegistryIds.add(rules.id);
  }
  for (const s of listScenarios()) {
    if (!supersededRegistryIds.has(s.id)) out.push(s);
  }
  return out;
}

/** Compile a builder scenario (layout + any registered rules) and collect its
 *  tile artwork, ready to send to the server. Returns null if the id isn't a
 *  (built) builder scenario. */
export async function buildCustomScenario(
  pickerId: string,
): Promise<{ scenario: Scenario; tileArt: PlacedTileArt[] } | null> {
  const n = builderNumberFromId(pickerId);
  if (n === null) return null;
  const data = getScenario(n);
  if (!data || !data.placedTiles || data.placedTiles.length === 0) return null;

  // Hand-written rules for this number (doors, scripted behavior, narrative)
  // when present; otherwise a minimal kill-all scenario.
  const rules = getScenarioRules(n) ?? {
    id: builderScenarioId(n),
    name: builtScenarioName(n, data.name),
    objective: 'Defeat all enemies.',
  };
  const scenario = compileScenario(data, rules);

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
  console.info(
    `[customScenario] starting "${scenario.name}" (builder ${n}): ` +
      `${data.placedTiles.length} tile(s), ${tileArt.length} with artwork.` +
      (tileArt.length === 0
        ? ' No tile images found in this browser — the map will have no background art.'
        : ''),
  );
  return { scenario, tileArt };
}
