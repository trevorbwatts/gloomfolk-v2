import { create } from 'zustand';
import type {
  CampaignSummary,
  PrivatePlayerState,
  PublicGameState,
  Role,
} from '@gloomfolk/shared';

interface AppState {
  connected: boolean;
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
}

export const useStore = create<AppState>((set) => ({
  connected: false,
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
}));
