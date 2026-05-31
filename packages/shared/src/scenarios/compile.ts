/**
 * Compiles an authored `ScenarioData` layout (from the editor) plus a
 * hand-written `ScenarioRules` module into a runtime `Scenario` the engine can
 * play. This is the single bridge between the two scenario worlds.
 */

import type { Hex } from '../hex.js';
import { hexKey, rotatePattern } from '../hex.js';
import type { MonsterRank } from '../monsters/types.js';
import { tileShapeById, tileSideById } from '../tiles/index.js';
import type { MonsterRankAtCount, PlacedTile, ScenarioData } from './layout.js';
import type {
  Door,
  LossCondition,
  MonsterBehavior,
  Narrative,
  Scenario,
  SpawnSlot,
  Tile,
  TileKind,
  VictoryCondition,
} from './types.js';

/** Rules a scenario author (us) supplies on top of the editor layout. */
export interface ScenarioRules {
  id: string;
  name: string;
  objective: string;
  /** Reveal order, by room id (= the placed tile's side id, e.g. "09-D"). The
   *  first entry is the room visible at start. If omitted, rooms are derived
   *  from placed-tile order. */
  rooms?: string[];
  /** Doors wiring story + reveal logic onto door overlays in the layout. */
  doors?: Door[];
  /** Behavior applied to every monster in a given room (room id → behavior).
   *  A per-spawn `behavior` tag in the layout overrides this. */
  behaviorByRoom?: Record<string, MonsterBehavior>;
  narrative?: Narrative;
  victory?: VictoryCondition;
  loss?: LossCondition;
}

/** Absolute hex coords occupied by a placed tile (pure; server-safe). */
export function resolveTileHexes(placed: PlacedTile): Hex[] {
  const side = tileSideById(placed.tileSideId);
  const shape = side ? tileShapeById(side.shapeId) : undefined;
  if (!shape) return [];
  return rotatePattern(shape.footprint, placed.rotation).map((h) => ({
    q: h.q + placed.origin.q,
    r: h.r + placed.origin.r,
  }));
}

/** Map an editor overlay kind onto a runtime tile kind, or null if the overlay
 *  doesn't change the floor (tokens, objectives, coins, etc.). */
function overlayTileKind(kind: string): TileKind | null {
  switch (kind) {
    case 'obstacle':
      return 'wall';
    case 'difficult-terrain':
      return 'difficult';
    case 'hazardous-terrain':
      return 'hazard';
    case 'door':
      return 'door';
    default:
      return null;
  }
}

/** Map the editor's per-count rank onto the engine rank, or null for 'none'. */
function engineRank(v: MonsterRankAtCount): MonsterRank | null {
  if (v === 'none') return null;
  return v === 'elite' ? 'elite' : 'normal';
}

export function compileScenario(data: ScenarioData, rules: ScenarioRules): Scenario {
  const placed = data.placedTiles ?? [];

  // 1. Room id per hex = the placed tile's side id. (Assumes one placed tile
  //    per side within a scenario, which holds for the campaign's maps.)
  const roomOf = new Map<string, string>(); // hexKey -> room id
  const tileByHex = new Map<string, Tile>();
  for (const p of placed) {
    for (const h of resolveTileHexes(p)) {
      const k = hexKey(h);
      roomOf.set(k, p.tileSideId);
      // Later tiles win on overlap (matches editor draw order).
      tileByHex.set(k, { q: h.q, r: h.r, kind: 'floor', room: p.tileSideId });
    }
  }

  // 2. Apply overlays that change the floor kind; collect player start hexes.
  const playerStarts: Hex[] = [];
  for (const ov of data.overlays ?? []) {
    if (ov.kind === 'starting-position') {
      for (const h of ov.hexes) playerStarts.push(h);
      continue;
    }
    const kind = overlayTileKind(ov.kind);
    if (!kind) continue;
    for (const h of ov.hexes) {
      const existing = tileByHex.get(hexKey(h));
      if (existing) existing.kind = kind;
      else {
        const room = roomOf.get(hexKey(h));
        tileByHex.set(hexKey(h), { q: h.q, r: h.r, kind, ...(room ? { room } : {}) });
      }
    }
  }

  const tiles = [...tileByHex.values()];

  // 3. Spawns: players from starting positions, enemies from monster spawns.
  const spawns: SpawnSlot[] = [];
  for (const h of playerStarts) {
    spawns.push({ hex: h, side: 'player', room: roomOf.get(hexKey(h)) });
  }
  for (const m of data.monsterSpawns ?? []) {
    const room = roomOf.get(hexKey(m.hex));
    const ranks: Partial<Record<number, MonsterRank>> = {};
    for (const count of [2, 3, 4] as const) {
      const rank = m.named ? 'named' : engineRank(m.ranks[count]);
      if (rank) ranks[count] = rank;
    }
    const behavior = resolveBehavior(m.behavior, room, rules.behaviorByRoom);
    spawns.push({
      hex: m.hex,
      side: 'enemy',
      monsterId: m.monsterType,
      ranks,
      room,
      ...(behavior !== 'normal' ? { behavior } : {}),
    });
  }

  // 4. Room reveal order: explicit, else placed-tile order (deduped).
  const rooms =
    rules.rooms ??
    [...new Set(placed.map((p) => p.tileSideId))];

  return {
    id: rules.id,
    name: rules.name,
    objective: rules.objective,
    tiles,
    spawns,
    ...(rooms.length > 1 ? { rooms } : {}),
    ...(rules.doors ? { doors: rules.doors } : {}),
    ...(rules.narrative ? { narrative: rules.narrative } : {}),
    ...(rules.victory ? { victory: rules.victory } : {}),
    ...(rules.loss ? { loss: rules.loss } : {}),
  };
}

function resolveBehavior(
  tag: string | undefined,
  room: string | undefined,
  byRoom: Record<string, MonsterBehavior> | undefined,
): MonsterBehavior {
  // A scripted tag needs its parameters, which only the rules module carries —
  // so a per-room behavior of the same shape takes precedence for 'scripted'.
  if (room && byRoom && byRoom[room]) {
    const roomBehavior = byRoom[room];
    if (tag === undefined || behaviorTag(roomBehavior) === tag) return roomBehavior;
  }
  if (tag === 'dummy') return 'dummy';
  return 'normal';
}

function behaviorTag(b: MonsterBehavior): string {
  if (b === 'normal' || b === 'dummy') return b;
  return 'scripted';
}
