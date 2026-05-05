import type { Card } from './cards/types.js';
import type { Hex } from './hex.js';
import type { Tile } from './scenarios/types.js';

export type Role = 'host' | 'player';

export type UnitKind = 'player' | 'monster';

export interface Unit {
  id: string;
  kind: UnitKind;
  /** characterId for players, monsterId for monsters */
  defId: string;
  name: string;
  hp: number;
  hpMax: number;
  hex: Hex;
  /** For player units: links to the controlling player. */
  ownerPlayerId?: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scenarioId: string | null;
  playerNames: string[];
}

export interface LobbyPlayer {
  playerId: string;
  name: string;
  characterId: string | null;
  connected: boolean;
  /** True if this player has locked in a card selection (or long rest) for the current round. */
  submitted: boolean;
}

export type CardSelection =
  | { kind: 'cards'; leadingId: string; secondId: string }
  | { kind: 'long_rest' };

export type TurnOrderEntry =
  | {
      kind: 'player';
      playerId: string;
      unitId: string;
      initiative: number;
      /** null when the player chose Long Rest (initiative 99). */
      leadingCardId: string | null;
      done: boolean;
    }
  | {
      kind: 'monster-group';
      /** Stat-card setId, e.g. 'archer' / 'scout'. All monsters of this set act together. */
      setId: string;
      /** The drawn ability card for this round. */
      abilityCardId: string;
      abilityCardName: string;
      initiative: number;
      done: boolean;
    };

export interface PublicGameState {
  campaignId: string;
  campaignName: string;
  phase: 'lobby' | 'card_select' | 'turn_resolution' | 'round_end' | 'victory' | 'defeat';
  round: number;
  players: LobbyPlayer[];
  scenarioId: string | null;
  scenarioName: string | null;
  tiles: Tile[];
  units: Unit[];
  turnOrder: TurnOrderEntry[];
  activeTurnIndex: number;
}

export interface PrivatePlayerState {
  playerId: string;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  selection: CardSelection | null;
}

export type ClientToServer =
  | { type: 'host_hello' }
  | { type: 'host_list_campaigns' }
  | { type: 'host_create_campaign'; name: string }
  | { type: 'host_load_campaign'; campaignId: string }
  | { type: 'player_join'; campaignId: string; name: string; playerId?: string }
  | { type: 'player_pick_character'; characterId: string }
  | { type: 'host_start_scenario'; scenarioId: string }
  | { type: 'player_select_cards'; leadingId: string; secondId: string }
  | { type: 'player_long_rest' }
  | { type: 'player_unsubmit' }
  | { type: 'end_turn' }
  | { type: 'host_next_round' }
  | { type: 'cursor'; px: { x: number; y: number } }
  | { type: 'pending_move'; hex: Hex | null }
  | { type: 'ping' };

export type ServerToClient =
  | { type: 'hello'; serverVersion: string }
  | { type: 'campaign_list'; campaigns: CampaignSummary[] }
  | { type: 'joined'; role: Role; playerId: string; campaignId: string }
  | { type: 'state'; state: PublicGameState; you?: PrivatePlayerState }
  | { type: 'cursor'; playerId: string; px: { x: number; y: number } }
  | { type: 'pending_move'; playerId: string; hex: Hex | null }
  | { type: 'error'; message: string }
  | { type: 'pong' };
