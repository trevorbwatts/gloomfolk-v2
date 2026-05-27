import { useEffect, useRef, useState } from 'react';
import type { Hex, MoveAnimation } from '@gloomfolk/shared';

/**
 * Watches `gameState.lastMove` for a new id and produces props for HexBoard.
 *
 * Why this exists: when a player confirms a move, the server stamps a fresh
 * `lastMove` on the state. Every connected client (the mover, other players,
 * the host) gets the same broadcast, so they all see the token slide along
 * the same path. The hook also skips the initial snapshot so a client joining
 * mid-session doesn't replay the last move on connect.
 */
export function useMoveAnim(lastMove: MoveAnimation | null | undefined): {
  moveAnim: { unitId: string; steps: Hex[] } | null;
  onMoveAnimDone: () => void;
} {
  const [moveAnim, setMoveAnim] = useState<{ unitId: string; steps: Hex[] } | null>(null);
  // `undefined` = before first effect run (initial snapshot); after that we
  // store the id we last animated (or null if no move had happened yet).
  const lastSeenIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (lastSeenIdRef.current === undefined) {
      lastSeenIdRef.current = lastMove?.id ?? null;
      return;
    }
    if (!lastMove) return;
    if (lastSeenIdRef.current === lastMove.id) return;
    lastSeenIdRef.current = lastMove.id;
    if (lastMove.path.length < 2) return;
    setMoveAnim({ unitId: lastMove.unitId, steps: lastMove.path });
  }, [lastMove]);

  return {
    moveAnim,
    onMoveAnimDone: () => setMoveAnim(null),
  };
}
