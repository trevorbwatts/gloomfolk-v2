import { useEffect } from 'react';
import { getSocket } from './socket.js';
import { useStore } from '../store.js';

export function useSocketBootstrap(): void {
  const setCampaigns = useStore((s) => s.setCampaigns);
  const setJoined = useStore((s) => s.setJoined);
  const setGameState = useStore((s) => s.setGameState);

  useEffect(() => {
    const sock = getSocket();
    const off = sock.on((msg) => {
      switch (msg.type) {
        case 'hello':
          useStore.setState({ connected: true });
          break;
        case 'campaign_list':
          setCampaigns(msg.campaigns);
          break;
        case 'joined':
          setJoined(msg.role, msg.playerId, msg.campaignId);
          if (msg.role === 'player') {
            try {
              localStorage.setItem('gf:playerId', msg.playerId);
              localStorage.setItem('gf:campaignId', msg.campaignId);
            } catch { /* noop */ }
          }
          break;
        case 'state':
          setGameState(msg.state, msg.you ?? null);
          break;
        case 'error':
          console.warn('server error:', msg.message);
          break;
      }
    });
    return off;
  }, [setCampaigns, setJoined, setGameState]);
}

export function useSocket() {
  return getSocket();
}
