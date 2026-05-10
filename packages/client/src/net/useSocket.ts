import { useEffect } from 'react';
import { getSocket } from './socket.js';
import { useStore } from '../store.js';

function saveSession(playerId: string, campaignId: string, name: string): void {
  try {
    sessionStorage.setItem('gf:playerId', playerId);
    sessionStorage.setItem('gf:campaignId', campaignId);
    sessionStorage.setItem('gf:name', name);
  } catch { /* noop */ }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem('gf:playerId');
    sessionStorage.removeItem('gf:campaignId');
    sessionStorage.removeItem('gf:name');
  } catch { /* noop */ }
}

export function getSavedSession(): { playerId: string; campaignId: string; name: string } | null {
  try {
    const playerId = sessionStorage.getItem('gf:playerId');
    const campaignId = sessionStorage.getItem('gf:campaignId');
    const name = sessionStorage.getItem('gf:name');
    if (playerId && campaignId && name) return { playerId, campaignId, name };
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
          const saved = getSavedSession();
          if (saved) {
            sock.send({
              type: 'player_join',
              campaignId: saved.campaignId,
              name: saved.name,
              playerId: saved.playerId,
            });
          }
          break;
        }
        case 'campaign_list':
          setCampaigns(msg.campaigns);
          break;
        case 'joined': {
          setJoined(msg.role, msg.playerId, msg.campaignId);
          if (msg.role === 'player') {
            const name = useStore.getState().gameState?.players.find(
              (p) => p.playerId === msg.playerId,
            )?.name ?? sessionStorage.getItem('gf:name') ?? '';
            saveSession(msg.playerId, msg.campaignId, name);
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
