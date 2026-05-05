import type { WebSocket } from 'ws';
import type {
  Card,
  CardSelection,
  ClientToServer,
  PublicGameState,
  ServerToClient,
  TurnOrderEntry,
  Unit,
} from '@gloomfolk/shared';
import {
  archerDeck,
  banditArcher,
  banditScout,
  bruiser,
  getScenario,
  scoutDeck,
  startingHandFor,
} from '@gloomfolk/shared';

const MONSTER_DECKS = {
  archer: archerDeck,
  scout: scoutDeck,
} as const;
import { type CampaignSave, saveCampaign } from './saves.js';

const MONSTER_DEFS = {
  'bandit-archer': banditArcher,
  'bandit-scout': banditScout,
} as const;

const CHARACTER_NAMES: Record<string, string> = {
  bruiser: 'Bruiser',
  'silent-knife': 'Silent Knife',
};

function characterHp(characterId: string): number {
  if (characterId === 'bruiser') return bruiser.hp[1] ?? 10;
  // Silent Knife class file not yet defined — use a sane default.
  return 8;
}

interface PlayerEntry {
  playerId: string;
  name: string;
  characterId: string | null;
  socket: WebSocket | null;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  selection: CardSelection | null;
}

export class Room {
  campaign: CampaignSave;
  hostSockets = new Set<WebSocket>();
  players = new Map<string, PlayerEntry>();
  units: Unit[] = [];
  phase: PublicGameState['phase'] = 'lobby';
  round = 0;
  turnOrder: TurnOrderEntry[] = [];
  activeTurnIndex = 0;

  constructor(campaign: CampaignSave) {
    this.campaign = campaign;
    for (const p of campaign.players) {
      this.players.set(p.playerId, {
        playerId: p.playerId,
        name: p.name,
        characterId: p.characterId,
        socket: null,
        hand: [],
        discard: [],
        lost: [],
        selection: null,
      });
    }
  }

  attachHost(ws: WebSocket): void {
    this.hostSockets.add(ws);
    this.send(ws, { type: 'state', state: this.publicState() });
  }

  detachHost(ws: WebSocket): void {
    this.hostSockets.delete(ws);
  }

  attachPlayer(ws: WebSocket, name: string, requestedId?: string): string {
    let entry = requestedId ? this.players.get(requestedId) : undefined;
    if (entry) {
      entry.name = name;
      entry.socket = ws;
    } else {
      const playerId = 'p_' + Math.random().toString(36).slice(2, 8);
      entry = {
        playerId,
        name,
        characterId: null,
        socket: ws,
        hand: [],
        discard: [],
        lost: [],
        selection: null,
      };
      this.players.set(playerId, entry);
      this.campaign.players.push({ playerId, name, characterId: null });
      void this.persist();
    }
    this.send(ws, {
      type: 'joined',
      role: 'player',
      playerId: entry.playerId,
      campaignId: this.campaign.id,
    });
    this.broadcastState();
    return entry.playerId;
  }

  detachPlayer(playerId: string): void {
    const entry = this.players.get(playerId);
    if (entry) {
      entry.socket = null;
      this.broadcastState();
    }
  }

  startScenario(scenarioId: string): { ok: true } | { ok: false; reason: string } {
    const scenario = getScenario(scenarioId);
    if (!scenario) return { ok: false, reason: 'unknown_scenario' };

    const playerSlots = scenario.spawns.filter((s) => s.side === 'player');
    const enemySlots = scenario.spawns.filter((s) => s.side === 'enemy');
    const readyPlayers = [...this.players.values()].filter((p) => p.characterId);

    if (readyPlayers.length === 0) {
      return { ok: false, reason: 'no_players_with_characters' };
    }

    this.units = [];
    let unitN = 1;

    readyPlayers.forEach((p, i) => {
      const slot = playerSlots[i];
      if (!slot || !p.characterId) return;
      const hp = characterHp(p.characterId);
      this.units.push({
        id: `u${unitN++}`,
        kind: 'player',
        defId: p.characterId,
        name: p.name,
        hp,
        hpMax: hp,
        hex: slot.hex,
        ownerPlayerId: p.playerId,
      });
      // Deal starting hand
      p.hand = [...startingHandFor(p.characterId)];
      p.discard = [];
      p.lost = [];
      p.selection = null;
    });

    enemySlots.forEach((slot) => {
      if (!slot.monsterId) return;
      const def = MONSTER_DEFS[slot.monsterId as keyof typeof MONSTER_DEFS];
      if (!def) return;
      const stats = def.levels[1]?.normal;
      const hp = stats?.hp ?? 5;
      this.units.push({
        id: `u${unitN++}`,
        kind: 'monster',
        defId: slot.monsterId,
        name: def.name,
        hp,
        hpMax: hp,
        hex: slot.hex,
      });
    });

    this.campaign.scenarioId = scenario.id;
    this.phase = 'card_select';
    this.round = 1;
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  selectCards(
    playerId: string,
    leadingId: string,
    secondId: string,
  ): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (leadingId === secondId) return { ok: false, reason: 'cards_must_differ' };
    const leading = p.hand.find((c) => c.id === leadingId);
    const second = p.hand.find((c) => c.id === secondId);
    if (!leading || !second) return { ok: false, reason: 'card_not_in_hand' };
    p.selection = { kind: 'cards', leadingId, secondId };
    this.maybeBeginTurnResolution();
    this.broadcastState();
    return { ok: true };
  }

  longRest(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    p.selection = { kind: 'long_rest' };
    this.maybeBeginTurnResolution();
    this.broadcastState();
    return { ok: true };
  }

  unsubmit(playerId: string): void {
    if (this.phase !== 'card_select') return;
    const p = this.players.get(playerId);
    if (!p) return;
    p.selection = null;
    this.broadcastState();
  }

  endTurn(actorId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'turn_resolution') return { ok: false, reason: 'wrong_phase' };
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur) return { ok: false, reason: 'no_active_turn' };
    // Authorize: the active player, or the host (actorId === 'host')
    if (actorId !== 'host') {
      if (cur.kind !== 'player' || cur.playerId !== actorId) {
        return { ok: false, reason: 'not_your_turn' };
      }
    }
    cur.done = true;
    if (this.activeTurnIndex + 1 < this.turnOrder.length) {
      this.activeTurnIndex += 1;
    } else {
      // All turns done — round end
      this.phase = 'round_end';
    }
    this.broadcastState();
    return { ok: true };
  }

  nextRound(): void {
    if (this.phase !== 'round_end') return;
    this.round += 1;
    this.turnOrder = [];
    this.activeTurnIndex = 0;
    for (const p of this.players.values()) p.selection = null;
    this.phase = 'card_select';
    this.broadcastState();
  }

  private maybeBeginTurnResolution(): void {
    const ready = [...this.players.values()].filter(
      (p) => p.characterId && p.socket !== null,
    );
    if (ready.length === 0) return;
    if (!ready.every((p) => p.selection !== null)) return;
    // All connected players with characters have submitted — build turn order.
    const order: TurnOrderEntry[] = [];

    for (const p of ready) {
      const unit = this.units.find((u) => u.ownerPlayerId === p.playerId);
      if (!unit) continue;
      const sel = p.selection!;
      if (sel.kind === 'long_rest') {
        order.push({
          kind: 'player',
          playerId: p.playerId,
          unitId: unit.id,
          initiative: 99,
          leadingCardId: null,
          done: false,
        });
      } else {
        const leadingCard = p.hand.find((c) => c.id === sel.leadingId);
        order.push({
          kind: 'player',
          playerId: p.playerId,
          unitId: unit.id,
          initiative: leadingCard?.initiative ?? 99,
          leadingCardId: sel.leadingId,
          done: false,
        });
      }
    }

    // Monster groups by setId — one entry per distinct setId on the board.
    const setIds = new Set<string>();
    for (const u of this.units) {
      if (u.kind !== 'monster') continue;
      const def = u.defId === 'bandit-archer' ? banditArcher : u.defId === 'bandit-scout' ? banditScout : null;
      if (def) setIds.add(def.setId);
    }
    for (const setId of setIds) {
      const deck = MONSTER_DECKS[setId as keyof typeof MONSTER_DECKS];
      if (!deck) continue;
      // Round 1 just draws the first card. Shuffle/discard pile is step-7+ work.
      const drawn = deck.cards[(this.round - 1) % deck.cards.length];
      if (!drawn) continue;
      order.push({
        kind: 'monster-group',
        setId,
        abilityCardId: drawn.id,
        abilityCardName: drawn.name,
        initiative: drawn.initiative,
        done: false,
      });
    }

    order.sort((a, b) => a.initiative - b.initiative);
    this.turnOrder = order;
    this.activeTurnIndex = 0;
    this.phase = 'turn_resolution';
  }

  pickCharacter(playerId: string, characterId: string): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    entry.characterId = characterId;
    const saved = this.campaign.players.find((p) => p.playerId === playerId);
    if (saved) saved.characterId = characterId;
    void this.persist();
    this.broadcastState();
  }

  forwardCursor(playerId: string, px: { x: number; y: number }): void {
    const msg: ServerToClient = { type: 'cursor', playerId, px };
    for (const ws of this.hostSockets) this.send(ws, msg);
  }

  forwardPendingMove(
    playerId: string,
    hex: { q: number; r: number } | null,
  ): void {
    const msg: ServerToClient = { type: 'pending_move', playerId, hex };
    for (const ws of this.hostSockets) this.send(ws, msg);
  }

  publicState(): PublicGameState {
    const scenario = this.campaign.scenarioId ? getScenario(this.campaign.scenarioId) : null;
    return {
      campaignId: this.campaign.id,
      campaignName: this.campaign.name,
      phase: this.phase,
      round: this.round,
      scenarioId: this.campaign.scenarioId,
      scenarioName: scenario?.name ?? null,
      tiles: scenario?.tiles ?? [],
      units: this.units,
      turnOrder: this.turnOrder,
      activeTurnIndex: this.activeTurnIndex,
      players: [...this.players.values()].map((p) => ({
        playerId: p.playerId,
        name: p.name,
        characterId: p.characterId,
        connected: p.socket !== null,
        submitted: p.selection !== null,
      })),
    };
  }

  broadcastState(): void {
    const state = this.publicState();
    const baseMsg: ServerToClient = { type: 'state', state };
    for (const ws of this.hostSockets) this.send(ws, baseMsg);
    for (const p of this.players.values()) {
      if (!p.socket) continue;
      this.send(p.socket, {
        type: 'state',
        state,
        you: {
          playerId: p.playerId,
          hand: p.hand,
          discard: p.discard,
          lost: p.lost,
          selection: p.selection,
        },
      });
    }
  }

  private async persist(): Promise<void> {
    try {
      await saveCampaign(this.campaign);
    } catch (err) {
      console.error('persist failed', err);
    }
  }

  private send(ws: WebSocket, msg: ServerToClient): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
}

// Type-narrowed helper used by the index dispatcher
export type AnyClientMsg = ClientToServer;
