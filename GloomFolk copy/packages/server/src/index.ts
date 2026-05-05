import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientToServer } from '@gloomfolk/shared';
import { Room } from './room.js';

const PORT = Number(process.env.PORT ?? 8787);

// Single shared room — no codes, no lookups. Recreate after victory/defeat
// would be a future feature; for now the process restart is the reset.
const room = new Room('main');
const connections = new Map<WebSocket, { playerId: string }>();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    let msg: ClientToServer;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
      return;
    }
    handleMessage(socket, msg);
  });

  socket.on('close', () => {
    if (connections.has(socket)) {
      room.detachSocket(socket);
      connections.delete(socket);
    }
  });

  socket.on('error', () => {
    /* swallow per-connection errors */
  });
});

function handleMessage(socket: WebSocket, msg: ClientToServer): void {
  if (msg.type === 'host_create') {
    connections.set(socket, { playerId: 'host' });
    room.attachHost(socket);
    return;
  }

  if (msg.type === 'join') {
    const playerId = room.attachPlayer(socket, msg.name, msg.playerId);
    if (!playerId) {
      socket.send(JSON.stringify({ type: 'error', message: 'room full' }));
      return;
    }
    connections.set(socket, { playerId });
    return;
  }

  const conn = connections.get(socket);
  if (!conn) {
    socket.send(JSON.stringify({ type: 'error', message: 'not in a room' }));
    return;
  }
  room.handle(conn.playerId, msg);
}

console.log(`[gloomfolk] WebSocket server listening on :${PORT}`);
