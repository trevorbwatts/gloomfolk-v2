import type { Hex } from '../hex.js';

export type TileKind = 'floor' | 'wall' | 'difficult' | 'hazard' | 'door';

export interface Tile {
  q: number;
  r: number;
  kind: TileKind;
}

export interface SpawnSlot {
  hex: Hex;
  side: 'player' | 'enemy';
  /** For enemy slots: monster id to place there. Players fill player slots in join order. */
  monsterId?: string;
}

export interface Scenario {
  id: string;
  name: string;
  /** One-line victory condition shown to players in the Scenario tab. */
  objective: string;
  tiles: Tile[];
  spawns: SpawnSlot[];
}
