import type { GameState, Hex } from './types.js';

export type TurnAction =
  | { kind: 'attack'; targetUnitId: string }
  | { kind: 'heal'; targetUnitId: string }
  | { kind: 'trample'; path: Hex[] }
  | { kind: 'charge'; targetUnitId: string }   // moveTo must lie on a straight line; damage = hexes moved
  | { kind: 'aoe_self' }                       // AoE attack centered on attacker (no target picked)
  | { kind: 'push_all' }                       // push every enemy within range (no target picked)
  | { kind: 'pull_multi' }                     // pull up to N nearest enemies within range (no target picked)
  | { kind: 'none' };

// One step of a two-card turn. The player's selected cards each contribute one half
// (top of one, bottom of the other). Each half has at most one move and at most one
// action, applied in step order. Steps may interleave between the two halves.
export type TurnStep =
  | { kind: 'move'; cardId: string; half: 'top' | 'bottom'; moveTo: Hex }
  | { kind: 'trample_move'; cardId: string; half: 'top' | 'bottom'; actionIndex: number; moveTo: Hex; path: Hex[] }
  | { kind: 'charge_move'; cardId: string; half: 'top' | 'bottom'; actionIndex: number; moveTo: Hex; targetUnitId: string }
  | { kind: 'action'; cardId: string; half: 'top' | 'bottom'; actionIndex: number; action: TurnAction };

export type ClientToServer =
  | { type: 'host_create' }
  | { type: 'join'; name: string; playerId?: string }
  | { type: 'pick_character'; characterId: string }
  | { type: 'start_scenario' }
  | { type: 'select_cards'; leading: string; second: string }
  | { type: 'select_long_rest' }
  | { type: 'play_turn'; steps: TurnStep[] }
  | { type: 'long_rest_turn'; loseCardId: string }
  | { type: 'rest' }
  | { type: 'path'; path: Hex[] | null }
  | { type: 'cursor'; px: { x: number; y: number } | null }
  | { type: 'pending_move'; hex: Hex | null }
  | { type: 'target_hint'; unitId: string | null }
  | { type: 'reset_room' };

export type RoomRole = 'host' | 'player';

export type ServerToClient =
  | { type: 'joined'; playerId: string; role: RoomRole }
  | {
      type: 'state';
      state: GameState;
      you?: { playerId: string; hand: string[]; discard: string[]; lost: string[] };
    }
  | { type: 'your_turn'; unitId: string; leadingCardId: string; secondCardId: string | null; longRest: boolean }
  | { type: 'path'; playerId: string; path: Hex[] | null }
  | { type: 'cursor'; playerId: string; px: { x: number; y: number } | null }
  | { type: 'pending_move'; playerId: string; hex: Hex | null }
  | { type: 'target_hint'; playerId: string; unitId: string | null }
  | { type: 'error'; message: string };
