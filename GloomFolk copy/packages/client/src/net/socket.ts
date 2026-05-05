import type { ClientToServer, ServerToClient } from '@gloomfolk/shared';

const WS_URL = (() => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Ride the same origin as the page — Vite proxies /ws to the game server
  // in dev. This keeps everything on a single port/host so phones on the LAN
  // (or behind a tunnel) don't need a second port opened.
  return `${proto}//${location.host}/ws`;
})();

export type SocketHandlers = {
  onMessage: (msg: ServerToClient) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export class GameSocket {
  private ws: WebSocket | null = null;
  private handlers: SocketHandlers;
  private queue: ClientToServer[] = [];

  constructor(handlers: SocketHandlers) {
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      for (const msg of this.queue) ws.send(JSON.stringify(msg));
      this.queue = [];
      this.handlers.onOpen?.();
    };
    ws.onmessage = (ev) => {
      try {
        const msg: ServerToClient = JSON.parse(String(ev.data));
        this.handlers.onMessage(msg);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      this.handlers.onClose?.();
    };
    ws.onerror = () => {
      /* swallow */
    };
  }

  send(msg: ClientToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
