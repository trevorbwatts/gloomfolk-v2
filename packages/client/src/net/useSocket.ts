import { useEffect } from 'react';
import { getSocket } from './socket.js';
import { useStore } from '../store.js';

function saveSession(playerId: string, campaignId: string): void {
  try {
    localStorage.setItem('gf:playerId', playerId);
    localStorage.setItem('gf:campaignId', campaignId);
  } catch { /* noop */ }
}

export function clearSession(): void {
  try {
    localStorage.removeItem('gf:playerId');
    localStorage.removeItem('gf:campaignId');
  } catch { /* noop */ }
}

export function getSavedSession(): { playerId: string; campaignId: string } | null {
  try {
    const playerId = localStorage.getItem('gf:playerId');
    const campaignId = localStorage.getItem('gf:campaignId');
    if (playerId && campaignId) return { playerId, campaignId };
  } catch { /* noop */ }
  return null;
}

export function useSocketBootstrap(): void {
  const setCampaigns = useStore((s) => s.setCampaigns);
  const setJoined = useStore((s) => s.setJoined);
  const setGameState = useStore((s) => s.setGameState);

  useEffect(() => {
    const sock = getSocket();
    const off = sock.on((msg) => {
      switch (msg.type) {
        case 'hello': {
          useStore.setState({ connected: true });
          // Only auto-rejoin a saved player session on the player route.
          // On the host route (/) a stale player session would yank the
          // host into a scenario view on every refresh.
          const onPlayerRoute = location.pathname.startsWith('/p');
          if (onPlayerRoute) {
            const saved = getSavedSession();
            if (saved) {
              sock.send({
                type: 'player_join',
                campaignId: saved.campaignId,
                playerId: saved.playerId,
              });
            }
          }
          break;
        }
        case 'campaign_list':
          setCampaigns(msg.campaigns);
          break;
        case 'joined': {
          setJoined(msg.role, msg.playerId, msg.campaignId);
          if (msg.role === 'player') {
            saveSession(msg.playerId, msg.campaignId);
          }
          break;
        }
        case 'state':
          setGameState(msg.state, msg.you ?? null);
          break;
        case 'error':
          if (msg.message === 'campaign_not_found' || msg.message === 'campaign_deleted') {
            clearSession();
            useStore.setState({
              role: null,
              playerId: null,
              campaignId: null,
              gameState: null,
              you: null,
            });
          }
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
