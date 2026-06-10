import type { Hex } from '../hex.js';
import type { MonsterRank } from '../monsters/types.js';

export type TileKind =
  | 'floor'
  | 'wall'
  | 'difficult'
  | 'hazard'
  | 'trap'
  | 'door'
  // Corridors and pressure plates are both "empty hexes" for movement (passable,
  // 1 movement point, no trap spring). A corridor connects map tiles into one
  // room; a pressure plate's trigger lives in the scenario's special rules.
  | 'corridor'
  | 'pressure-plate';

export interface Tile {
  q: number;
  r: number;
  kind: TileKind;
  /** Room this hex belongs to (the source map-tile id, e.g. "07-D"). Hexes
   *  without a room are always visible. Rooms are revealed progressively as
   *  doors open. */
  room?: string;
}

/** How a monster figure behaves on its turns.
 *  - 'normal'  : draws and acts on its ability card deck as usual.
 *  - 'dummy'   : never acts (training dummies, inert statues, etc.).
 *  - scripted  : ignores the deck and performs a fixed action every round at a
 *                fixed initiative (e.g. Scenario 0's sparring partners). */
export type MonsterBehavior =
  | 'normal'
  | 'dummy'
  | { scripted: ScriptedAction };

export interface ScriptedAction {
  /** Initiative this scripted figure acts on each round. */
  initiative: number;
  /** Fixed move distance, if any. */
  move?: number;
  /** Fixed attack value, if any. */
  attack?: number;
}

export interface SpawnSlot {
  hex: Hex;
  side: 'player' | 'enemy';
  /** For enemy slots: monster id to place there. Players fill player slots in join order. */
  monsterId?: string;
  /** For enemy slots: this figure's rank by player count (Gloomhaven scales
   *  elites with party size). Keyed by the number of players in the scenario;
   *  the value for the actual count is used, defaulting to 'normal' when the
   *  count isn't listed or `ranks` is absent. */
  ranks?: Partial<Record<number, MonsterRank>>;
  /** Room this figure belongs to. Enemies in unrevealed rooms are not placed
   *  until their room is revealed. */
  room?: string;
  /** Behavior override for this figure (defaults to 'normal'). */
  behavior?: MonsterBehavior;
}

/** A door between two rooms. Closed and (optionally) locked at start; opening
 *  it reveals `revealsRoom` and may fire a narrative section. */
export interface Door {
  id: string;
  hex: Hex;
  /** Room id this door reveals when opened. */
  revealsRoom: string;
  /** When the door becomes openable. `allMonstersDeadIn` waits until every
   *  monster in the named room is dead; 'manual' is openable from the start. */
  unlock: { allMonstersDeadIn: string } | 'manual';
  /** Narrative key to fire when this door is opened (e.g. 'door:1'). */
  narrativeKey?: string;
}

/** A block of story text shown to players when its trigger fires. */
export interface NarrativeEntry {
  title: string;
  body: string;
}

/** Story text keyed by trigger: 'start', 'victory', 'defeat', or a door key
 *  like 'door:1'. */
export type Narrative = Record<string, NarrativeEntry>;

/** Win condition. Only 'killAll' is implemented today; the rest are reserved so
 *  future scenarios fail loudly rather than resolving incorrectly. */
export type VictoryCondition =
  | { kind: 'killAll' }
  | { kind: 'killTarget'; monsterId: string }
  | { kind: 'reachHex'; hex: Hex }
  | { kind: 'surviveRounds'; rounds: number }
  | { kind: 'loot'; count: number };

/** Loss condition (beyond the engine's default party-exhaustion check). */
export type LossCondition = { kind: 'allCharactersExhausted' };

/** A purely-decorative image prop on the runtime map (e.g. a fallen log).
 *  Compiled from the authored `Decoration`; carries no game meaning. The
 *  artwork and hex footprint are resolved client-side from the decoration
 *  catalogue via `decorationId`. `room` (when set) gates fog-of-war reveal the
 *  same way tiles do. */
export interface SceneDecoration {
  id: string;
  decorationId: string;
  origin: Hex;
  rotation: number;
  /** Room this prop sits in, for reveal gating. Omitted on room-less maps. */
  room?: string;
}

export interface Scenario {
  id: string;
  name: string;
  /** One-line victory condition shown to players in the Scenario tab. */
  objective: string;
  tiles: Tile[];
  /** Purely-visual props (logs, scenery). Carry no game meaning. */
  decorations?: SceneDecoration[];
  spawns: SpawnSlot[];
  /** Reveal order of rooms. The first room is visible at start; the rest are
   *  hidden until a door reveals them. Scenarios with no rooms (single-room
   *  maps like level1) omit this and everything is visible. */
  rooms?: string[];
  doors?: Door[];
  narrative?: Narrative;
  /** Defaults to { kind: 'killAll' } when omitted. */
  victory?: VictoryCondition;
  loss?: LossCondition;
}
