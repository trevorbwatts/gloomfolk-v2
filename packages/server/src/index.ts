import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientToServer, ServerToClient } from '@gloomfolk/shared';
import {
  type CampaignSave,
  deleteCampaign,
  listCampaigns,
  loadCampaign,
  newCampaignId,
  saveCampaign,
} from './saves.js';
import { Room } from './room.js';

const PORT = Number(process.env.PORT ?? 8787);
const SERVER_VERSION = '0.1.0';

const rooms = new Map<string, Room>();

interface ConnState {
  role: 'host' | 'player' | null;
  campaignId: string | null;
  playerId: string | null;
}

async function getOrLoadRoom(campaignId: string): Promise<Room | null> {
  let room = rooms.get(campaignId);
  if (room) return room;
  const data = await loadCampaign(campaignId);
  if (!data) return null;
  room = new Room(data);
  rooms.set(campaignId, room);
  return room;
}

function send(ws: WebSocket, msg: ServerToClient): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const conn: ConnState = { role: null, campaignId: null, playerId: null };
  send(ws, { type: 'hello', serverVersion: SERVER_VERSION });

  ws.on('message', async (raw) => {
    let msg: ClientToServer;
    try {
      msg = JSON.parse(raw.toString()) as ClientToServer;
    } catch {
      send(ws, { type: 'error', message: 'invalid_json' });
      return;
    }

    try {
      await handle(ws, conn, msg);
    } catch (err) {
      console.error('handler error', err);
      send(ws, { type: 'error', message: 'server_error' });
    }
  });

  ws.on('close', () => {
    if (conn.role === 'host' && conn.campaignId) {
      rooms.get(conn.campaignId)?.detachHost(ws);
    } else if (conn.role === 'player' && conn.campaignId && conn.playerId) {
      rooms.get(conn.campaignId)?.detachPlayer(conn.playerId);
    }
  });
});

async function handle(
  ws: WebSocket,
  conn: ConnState,
  msg: ClientToServer,
): Promise<void> {
  switch (msg.type) {
    case 'ping':
      send(ws, { type: 'pong' });
      return;

    case 'host_hello':
      conn.role = 'host';
      send(ws, { type: 'campaign_list', campaigns: await listCampaigns() });
      return;

    case 'host_list_campaigns':
      send(ws, { type: 'campaign_list', campaigns: await listCampaigns() });
      return;

    case 'host_create_campaign': {
      let id: string;
      try {
        id = await newCampaignId();
      } catch {
        send(ws, { type: 'error', message: 'campaign_slots_full' });
        return;
      }
      const data: CampaignSave = {
        id,
        name: msg.name.trim() || 'Untitled Campaign',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scenarioId: null,
        characters: [],
        players: [],
      };
      await saveCampaign(data);
      const room = new Room(data);
      rooms.set(id, room);
      conn.role = 'host';
      conn.campaignId = id;
      room.attachHost(ws);
      send(ws, { type: 'joined', role: 'host', playerId: 'host', campaignId: id });
      return;
    }

    case 'host_delete_campaign': {
      if (conn.role !== 'host') {
        send(ws, { type: 'error', message: 'not_host' });
        return;
      }
      const room = rooms.get(msg.campaignId);
      if (room) room.kickAll();
      rooms.delete(msg.campaignId);
      const ok = await deleteCampaign(msg.campaignId);
      if (!ok) {
        send(ws, { type: 'error', message: 'campaign_not_found' });
        return;
      }
      if (conn.campaignId === msg.campaignId) conn.campaignId = null;
      send(ws, { type: 'campaign_list', campaigns: await listCampaigns() });
      return;
    }

    case 'host_leave_campaign': {
      if (conn.campaignId) {
        rooms.get(conn.campaignId)?.detachHost(ws);
        conn.campaignId = null;
      }
      send(ws, { type: 'campaign_list', campaigns: await listCampaigns() });
      return;
    }

    case 'host_load_campaign': {
      const room = await getOrLoadRoom(msg.campaignId);
      if (!room) {
        send(ws, { type: 'error', message: 'campaign_not_found' });
        return;
      }
      conn.role = 'host';
      conn.campaignId = room.campaign.id;
      room.attachHost(ws);
      send(ws, {
        type: 'joined',
        role: 'host',
        playerId: 'host',
        campaignId: room.campaign.id,
      });
      return;
    }

    case 'player_join': {
      const room = await getOrLoadRoom(msg.campaignId);
      if (!room) {
        send(ws, { type: 'error', message: 'campaign_not_found' });
        return;
      }
      const playerId = room.attachPlayer(ws, msg.playerId);
      if (!playerId) return;
      conn.role = 'player';
      conn.campaignId = room.campaign.id;
      conn.playerId = playerId;
      return;
    }

    case 'player_create_character': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) {
        send(ws, { type: 'error', message: 'not_a_player' });
        return;
      }
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.createCharacter(conn.playerId, msg.classId, msg.name);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_claim_character': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) {
        send(ws, { type: 'error', message: 'not_a_player' });
        return;
      }
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.claimCharacter(conn.playerId, msg.characterInstanceId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_pick_character': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) {
        send(ws, { type: 'error', message: 'not_a_player' });
        return;
      }
      rooms.get(conn.campaignId)?.pickCharacter(conn.playerId, msg.characterId);
      return;
    }

    case 'player_unclaim_character': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      rooms.get(conn.campaignId)?.unclaimCharacter(conn.playerId);
      return;
    }

    case 'player_set_loadout': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.setLoadout(conn.playerId, msg.cardIds);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_select_cards': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.selectCards(conn.playerId, msg.leadingId, msg.secondId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_long_rest': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      rooms.get(conn.campaignId)?.longRest(conn.playerId);
      return;
    }

    case 'player_short_rest': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.shortRest(conn.playerId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_short_rest_reroll': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.shortRestReroll(conn.playerId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_short_rest_accept': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      rooms.get(conn.campaignId)?.shortRestAccept(conn.playerId);
      return;
    }

    case 'player_unsubmit': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      rooms.get(conn.campaignId)?.unsubmit(conn.playerId);
      return;
    }

    case 'end_turn': {
      if (!conn.campaignId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const actor = conn.role === 'host' ? 'host' : conn.playerId;
      if (!actor) return;
      const result = r.endTurn(actor);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'host_skip_monster_anim': {
      if (conn.role !== 'host' || !conn.campaignId) return;
      rooms.get(conn.campaignId)?.requestSkipMonsterAnim();
      return;
    }

    case 'player_perform_action': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.performAction(conn.playerId, msg.slot, msg.actionId, msg.target);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_skip_action': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.skipAction(conn.playerId, msg.slot, msg.actionId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_toggle_consume_rider': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.toggleConsumeRider(
        conn.playerId,
        msg.slot,
        msg.actionId,
        msg.riderIndex,
      );
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_resolve_element_choice': {
      if (!conn.campaignId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const actor = conn.role === 'host' ? 'host' : conn.playerId;
      if (!actor) return;
      const result = r.resolveElementChoice(actor, msg.choiceId, msg.element);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_engage_half': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.engageHalf(conn.playerId, msg.slot, msg.cardId, msg.useBasic);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_finish_half': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.finishHalf(conn.playerId, msg.slot);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_confirm_persistent_half': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.confirmPersistentHalf(conn.playerId, msg.slot);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'player_skip_half': {
      if (conn.role !== 'player' || !conn.campaignId || !conn.playerId) return;
      const r = rooms.get(conn.campaignId);
      if (!r) return;
      const result = r.skipHalf(conn.playerId, msg.slot, msg.cardId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'host_start_scenario': {
      if (conn.role !== 'host' || !conn.campaignId) {
        send(ws, { type: 'error', message: 'not_a_host' });
        return;
      }
      const room = rooms.get(conn.campaignId);
      if (!room) {
        send(ws, { type: 'error', message: 'no_room' });
        return;
      }
      const result = room.startScenario(msg.scenarioId);
      if (!result.ok) send(ws, { type: 'error', message: result.reason });
      return;
    }

    case 'cursor': {
      if (conn.role === 'player' && conn.campaignId && conn.playerId) {
        rooms.get(conn.campaignId)?.forwardCursor(conn.playerId, msg.px);
      }
      return;
    }

    case 'pending_move': {
      if (conn.role === 'player' && conn.campaignId && conn.playerId) {
        rooms
          .get(conn.campaignId)
          ?.forwardPendingMove(conn.playerId, msg.hex);
      }
      return;
    }

    case 'player_preview_forced_move': {
      if (conn.role === 'player' && conn.campaignId && conn.playerId) {
        rooms
          .get(conn.campaignId)
          ?.setForcedMovePreview(conn.playerId, msg.preview);
      }
      return;
    }
  }
}

console.log(`gloomfolk server listening on ws://localhost:${PORT}`);
