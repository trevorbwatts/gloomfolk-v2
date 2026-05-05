import type { ClientToServer, ServerToClient } from '@gloomfolk/shared';

type Listener = (msg: ServerToClient) => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private queue: ClientToServer[] = [];
  private listeners = new Set<Listener>();
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${proto}//${location.host}/ws`;
    }
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      while (this.queue.length > 0) {
        const msg = this.queue.shift()!;
        ws.send(JSON.stringify(msg));
      }
    });
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerToClient;
        for (const l of this.listeners) l(msg);
      } catch {
        // ignore malformed
      }
    });
    ws.addEventListener('close', () => {
      this.ws = null;
      this.scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      try { ws.close(); } catch { /* noop */ }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  }

  send(msg: ClientToServer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
      this.connect();
    }
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

let singleton: GameSocket | null = null;
export function getSocket(): GameSocket {
  if (!singleton) {
    singleton = new GameSocket();
    singleton.connect();
  }
  return singleton;
}
