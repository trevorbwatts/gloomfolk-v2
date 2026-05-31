import { create } from 'zustand';
import type {
  CampaignSummary,
  PrivatePlayerState,
  PublicGameState,
  Role,
} from '@gloomfolk/shared';

interface AppState {
  connected: boolean;
  /** Server's LAN IPv4 (from the `hello` message), for the host join URL.
   *  Null until received or if the server couldn't determine one. */
  lanHost: string | null;
  role: Role | null;
  playerId: string | null;
  campaignId: string | null;
  campaigns: CampaignSummary[];
  gameState: PublicGameState | null;
  you: PrivatePlayerState | null;
  setConnected: (v: boolean) => void;
  setCampaigns: (c: CampaignSummary[]) => void;
  setJoined: (role: Role, playerId: string, campaignId: string) => void;
  setGameState: (s: PublicGameState, you: PrivatePlayerState | null) => void;
  clearCampaign: () => void;
}

export const useStore = create<AppState>((set) => ({
  connected: false,
  lanHost: null,
  role: null,
  playerId: null,
  campaignId: null,
  campaigns: [],
  gameState: null,
  you: null,
  setConnected: (v) => set({ connected: v }),
  setCampaigns: (c) => set({ campaigns: c }),
  setJoined: (role, playerId, campaignId) => set({ role, playerId, campaignId }),
  setGameState: (s, you) => set({ gameState: s, you }),
  clearCampaign: () => set({ campaignId: null, gameState: null }),
}));
