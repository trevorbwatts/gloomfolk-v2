import type { Card, NegativeCondition } from './cards/types.js';
import type { Hex } from './hex.js';
import type { ModifierCard, ModifierCardInstance } from './modifiers/index.js';
import type { Tile } from './scenarios/types.js';

export type Role = 'host' | 'player';

export type UnitKind = 'player' | 'monster';

export interface ConditionInstance {
  kind: NegativeCondition;
  /** True if applied during this figure's own current turn (so it survives the
   * upcoming end-of-turn tick and is cleaned at the end of the *next* turn). */
  appliedThisTurn: boolean;
}

export interface Unit {
  id: string;
  kind: UnitKind;
  /** characterId for players, monsterId for monsters */
  defId: string;
  name: string;
  hp: number;
  hpMax: number;
  hex: Hex;
  /** Active Shield value, soaks incoming attack damage. Cleared at round end. */
  shield: number;
  /** Active negative conditions (stun/immobilize/disarm/muddle/etc.). */
  conditions: ConditionInstance[];
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
  /** Live state for the current actor's turn. Null between turns / outside turn_resolution. */
  currentTurn: CurrentTurn | null;
  /** Most recent narration events (oldest first). Capped server-side. */
  events: GameEvent[];
}

export interface GameEvent {
  id: number;
  text: string;
}

/**
 * A single resolvable action extracted from a card half (or basic substitution).
 * The player performs each action in the queue (or skips it). Some actions
 * need a target; others apply immediately on perform.
 */
export type PendingAction =
  | { id: string; type: 'move'; amount: number; done: boolean }
  | {
      id: string;
      type: 'attack';
      amount: number;
      range: number;
      pierce: number;
      /** Number of distinct targets this attack may hit (multi-target ranged). */
      targets: number;
      /** Targets still to pick. Decremented each time the player names one. */
      targetsRemaining: number;
      done: boolean;
    }
  | {
      id: string;
      type: 'attack-aoe';
      amount: number;
      pierce: number;
      /** Hex offsets relative to the actor. pattern[0] is the rotation anchor. */
      pattern: Hex[];
      done: boolean;
    }
  | { id: string; type: 'heal'; amount: number; range: number; selfOnly: boolean; done: boolean }
  | { id: string; type: 'shield'; amount: number; done: boolean }
  | { id: string; type: 'push'; amount: number; range: number; done: boolean }
  | { id: string; type: 'pull'; amount: number; range: number; done: boolean }
  | {
      id: string;
      type: 'apply-condition';
      condition: NegativeCondition;
      range: number;
      done: boolean;
    }
  | {
      id: string;
      type: 'modify-future-move';
      amount: number;
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | {
      id: string;
      type: 'modify-future-attack';
      amount: number;
      pierceBonus: number;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
      done: boolean;
    }
  | {
      id: string;
      type: 'grant-retaliate';
      amount: number;
      range: number;
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | { id: string; type: 'unsupported'; description: string; done: boolean };

/** A persistent self-effect granted by a performed half. */
export type ActiveEffect =
  | {
      id: string;
      sourceCardId: string;
      kind: 'move-bonus';
      amount: number;
      expires: 'end-round' | 'end-scenario';
    }
  | {
      id: string;
      sourceCardId: string;
      kind: 'attack-bonus';
      amount: number;
      pierceBonus: number;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
    }
  | {
      id: string;
      sourceCardId: string;
      kind: 'retaliate';
      amount: number;
      range: number;
      expires: 'end-round' | 'end-scenario';
    };

/**
 * One of the two action slots a player must fill on their turn — top or bottom.
 * - 'unlocked': no card committed yet
 * - 'engaged': a card is committed; player performs/skips actions in `actions`
 * - 'done': committed and all actions resolved (or slot was skipped)
 */
export interface HalfSlot {
  status: 'unlocked' | 'engaged' | 'done';
  /** Committed card id (one of the two selected cards). null while unlocked. */
  cardId: string | null;
  /** True if the basic action (Attack 2 / Move 2) was substituted for the printed half. */
  useBasic: boolean;
  /** Action queue. Empty when unlocked. */
  actions: PendingAction[];
  /** Count of actions actually performed (excluding skipped/unsupported).
   *  Drives whether persistent halves enter the active area on disposition. */
  performedCount: number;
}

/**
 * One revealed attack-modifier card from a player's deck. Emitted per attack
 * (per target on multi-target / AOE attacks). Cleared at the start of the
 * next attack action and at end-of-turn.
 */
export interface ModifierDrawResult {
  /** Stable id for this draw event (animation key). */
  id: string;
  card: ModifierCard;
  targetUnitId: string;
  targetName: string;
  /** Attack value before the modifier was applied (incl. active-effect bonuses). */
  baseAmount: number;
  /** Final attack value after the modifier (before shield/pierce). */
  finalAmount: number;
  /** Damage actually dealt after shield/pierce. */
  damageDealt: number;
}

export interface CurrentTurn {
  unitId: string;
  topSlot: HalfSlot;
  bottomSlot: HalfSlot;
  /** Slot the player is currently performing, if any. */
  activeSlot: 'top' | 'bottom' | null;
  /**
   * Modifier draws revealed by the most recent attack action. Replaced on the
   * next attack and cleared between turns. Used by the client to animate the
   * card flip(s).
   */
  lastModifierDraws: ModifierDrawResult[];
}

export interface PrivatePlayerState {
  playerId: string;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  /** Cards in your active area (performed persistent halves still in effect). */
  active: Card[];
  /** Live persistent effects granted by performed actions. */
  activeEffects: ActiveEffect[];
  selection: CardSelection | null;
  /** Cards still face-down in the attack-modifier deck. Order is the draw order
   *  (index 0 = next to be drawn). */
  modifierDeck: ModifierCardInstance[];
  /** Cards already drawn this round (or since last reshuffle). */
  modifierDiscard: ModifierCardInstance[];
  /** True if a Null or ×2 has been drawn this turn — deck reshuffles at end of turn. */
  modifierNeedsReshuffle: boolean;
}

export type ClientToServer =
  | { type: 'host_hello' }
  | { type: 'host_list_campaigns' }
  | { type: 'host_create_campaign'; name: string }
  | { type: 'host_load_campaign'; campaignId: string }
  | { type: 'host_delete_campaign'; campaignId: string }
  | { type: 'player_join'; campaignId: string; name: string; playerId?: string }
  | { type: 'player_pick_character'; characterId: string }
  | { type: 'host_start_scenario'; scenarioId: string }
  | { type: 'player_select_cards'; leadingId: string; secondId: string }
  | { type: 'player_long_rest' }
  | { type: 'player_unsubmit' }
  | { type: 'end_turn' }
  | { type: 'host_next_round' }
  | {
      type: 'player_perform_action';
      slot: 'top' | 'bottom';
      actionId: string;
      target?: { hex?: Hex; unitId?: string } | undefined;
    }
  | { type: 'player_skip_action'; slot: 'top' | 'bottom'; actionId: string }
  | { type: 'player_engage_half'; slot: 'top' | 'bottom'; cardId: string; useBasic: boolean }
  | { type: 'player_skip_half'; slot: 'top' | 'bottom'; cardId: string }
  | { type: 'player_finish_half'; slot: 'top' | 'bottom' }
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
