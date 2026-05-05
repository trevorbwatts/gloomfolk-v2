import { create } from 'zustand';
import type { GameState, Hex, RoomRole } from '@gloomfolk/shared';

type ConnState = 'idle' | 'connecting' | 'connected' | 'closed';

type Store = {
  conn: ConnState;
  role: RoomRole | null;
  playerId: string | null;
  state: GameState | null;
  hand: string[];
  discard: string[];
  lost: string[];
  awaitingTurnUnitId: string | null;
  awaitingLeadingCardId: string | null;
  awaitingSecondCardId: string | null;
  awaitingLongRest: boolean;
  errorMsg: string | null;
  paths: Record<string, Hex[] | null>;
  cursors: Record<string, { x: number; y: number } | null>;
  pendingMoves: Record<string, Hex | null>;
  targetHints: Record<string, string | null>;

  setConn(c: ConnState): void;
  applyJoined(payload: { role: RoomRole; playerId: string }): void;
  applyState(state: GameState, you?: { playerId: string; hand: string[]; discard: string[]; lost: string[] }): void;
  setYourTurn(unitId: string | null, leadingCardId: string | null, secondCardId: string | null, longRest: boolean): void;
  setError(msg: string | null): void;
  setPath(playerId: string, path: Hex[] | null): void;
  setCursor(playerId: string, px: { x: number; y: number } | null): void;
  setPendingMove(playerId: string, hex: Hex | null): void;
  setTargetHint(playerId: string, unitId: string | null): void;
  reset(): void;
};

export const useStore = create<Store>((set) => ({
  conn: 'idle',
  role: null,
  playerId: null,
  state: null,
  hand: [],
  discard: [],
  lost: [],
  awaitingTurnUnitId: null,
  awaitingLeadingCardId: null,
  awaitingSecondCardId: null,
  awaitingLongRest: false,
  errorMsg: null,
  paths: {},
  cursors: {},
  pendingMoves: {},
  targetHints: {},

  setConn: (c) => set({ conn: c }),
  applyJoined: ({ role, playerId }) => {
    if (role === 'player') localStorage.setItem('gf:playerId', playerId);
    set({ role, playerId });
  },
  applyState: (state, you) => {
    set((s) => ({
      state,
      hand: you?.hand ?? s.hand,
      discard: you?.discard ?? s.discard,
      lost: you?.lost ?? s.lost,
      awaitingTurnUnitId:
        state.phase === 'turn_resolution' ? s.awaitingTurnUnitId : null,
      awaitingLeadingCardId: state.phase === 'turn_resolution' ? s.awaitingLeadingCardId : null,
      awaitingSecondCardId: state.phase === 'turn_resolution' ? s.awaitingSecondCardId : null,
      awaitingLongRest: state.phase === 'turn_resolution' ? s.awaitingLongRest : false,
    }));
  },
  setYourTurn: (unitId, leadingCardId, secondCardId, longRest) => set({
    awaitingTurnUnitId: unitId,
    awaitingLeadingCardId: leadingCardId,
    awaitingSecondCardId: secondCardId,
    awaitingLongRest: longRest,
  }),
  setError: (msg) => set({ errorMsg: msg }),
  setPath: (playerId, path) =>
    set((s) => ({ paths: { ...s.paths, [playerId]: path } })),
  setCursor: (playerId, px) =>
    set((s) => ({ cursors: { ...s.cursors, [playerId]: px } })),
  setPendingMove: (playerId, hex) =>
    set((s) => ({ pendingMoves: { ...s.pendingMoves, [playerId]: hex } })),
  setTargetHint: (playerId, unitId) =>
    set((s) => ({ targetHints: { ...s.targetHints, [playerId]: unitId } })),
  reset: () => set({ conn: 'idle', role: null, playerId: null, state: null, hand: [], discard: [], lost: [], awaitingTurnUnitId: null, awaitingLeadingCardId: null, awaitingSecondCardId: null, awaitingLongRest: false, errorMsg: null, paths: {}, cursors: {}, pendingMoves: {}, targetHints: {} }),
}));
