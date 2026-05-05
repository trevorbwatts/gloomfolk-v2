import { useEffect, useRef } from 'react';
import { GameSocket } from './socket.js';
import { useStore } from '../store.js';
import type { ClientToServer } from '@gloomfolk/shared';

let singleton: GameSocket | null = null;

export function useSocket(): { send: (msg: ClientToServer) => void } {
  const sendRef = useRef<(msg: ClientToServer) => void>(() => {});

  useEffect(() => {
    if (!singleton) {
      singleton = new GameSocket({
        onOpen: () => useStore.getState().setConn('connected'),
        onClose: () => useStore.getState().setConn('closed'),
        onMessage: (msg) => {
          const s = useStore.getState();
          if (msg.type === 'joined') {
            s.applyJoined({ role: msg.role, playerId: msg.playerId });
          } else if (msg.type === 'state') {
            s.applyState(msg.state, msg.you);
          } else if (msg.type === 'your_turn') {
            s.setYourTurn(msg.unitId, msg.leadingCardId || null, msg.secondCardId, msg.longRest);
          } else if (msg.type === 'path') {
            s.setPath(msg.playerId, msg.path);
          } else if (msg.type === 'cursor') {
            s.setCursor(msg.playerId, msg.px);
          } else if (msg.type === 'pending_move') {
            s.setPendingMove(msg.playerId, msg.hex);
          } else if (msg.type === 'target_hint') {
            s.setTargetHint(msg.playerId, msg.unitId);
          } else if (msg.type === 'error') {
            s.setError(msg.message);
            setTimeout(() => useStore.getState().setError(null), 2500);
          }
        },
      });
      useStore.getState().setConn('connecting');
      singleton.connect();
    }
    sendRef.current = (msg) => singleton!.send(msg);
  }, []);

  return { send: (msg) => sendRef.current(msg) };
}
