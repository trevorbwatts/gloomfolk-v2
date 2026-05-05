// End-to-end smoke test: connects three WebSocket clients (host + 2 players)
// to a running server on :8787 and plays through one full round.
//
// Run with the server already running:
//   npm run dev:server   (in another terminal)
//   npx tsx scripts/smoke.ts

import { WebSocket } from 'ws';
import type { ClientToServer, ServerToClient, GameState } from '@gloomfolk/shared';

const URL = process.env.WS ?? 'ws://localhost:8787';

class Client {
  ws: WebSocket;
  label: string;
  playerId: string | null = null;
  state: GameState | null = null;
  hand: string[] = [];
  yourTurn: { unitId: string; cardId: string } | null = null;
  errors: string[] = [];
  private waiters: Array<(msg: ServerToClient) => boolean> = [];

  constructor(label: string) {
    this.label = label;
    this.ws = new WebSocket(URL);
  }

  ready(): Promise<void> {
    return new Promise((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', (e) => rej(e));
    }).then(() => {
      this.ws.on('message', (data) => {
        const msg: ServerToClient = JSON.parse(data.toString());
        if (msg.type === 'joined') {
          this.playerId = msg.playerId;
        } else if (msg.type === 'state') {
          this.state = msg.state;
          if (msg.you) this.hand = msg.you.hand;
        } else if (msg.type === 'your_turn') {
          this.yourTurn = { unitId: msg.unitId, cardId: msg.cardId };
        } else if (msg.type === 'error') {
          this.errors.push(msg.message);
          console.error(`[${this.label}] error: ${msg.message}`);
        }
        this.waiters = this.waiters.filter((w) => !w(msg));
      });
    });
  }

  send(msg: ClientToServer) {
    this.ws.send(JSON.stringify(msg));
  }

  waitFor(pred: (msg: ServerToClient) => boolean, label = ''): Promise<void> {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`[${this.label}] timeout: ${label}`)), 5000);
      this.waiters.push((msg) => {
        if (pred(msg)) {
          clearTimeout(t);
          res();
          return true;
        }
        return false;
      });
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const host = new Client('host');
  await host.ready();
  host.send({ type: 'host_create' });
  await host.waitFor((m) => m.type === 'joined', 'host joined');
  console.log(`✓ host attached`);

  const a = new Client('alice');
  const b = new Client('bob');
  await Promise.all([a.ready(), b.ready()]);

  a.send({ type: 'join', name: 'Alice' });
  await a.waitFor((m) => m.type === 'joined', 'alice joined');
  console.log(`✓ alice joined as ${a.playerId}`);

  b.send({ type: 'join', name: 'Bob' });
  await b.waitFor((m) => m.type === 'joined', 'bob joined');
  console.log(`✓ bob joined as ${b.playerId}`);

  a.send({ type: 'pick_character', characterId: 'striker' });
  b.send({ type: 'pick_character', characterId: 'support' });
  await a.waitFor(
    (m) => m.type === 'state' && !!m.state.players[a.playerId!]?.characterId,
    'alice character set',
  );
  await b.waitFor(
    (m) => m.type === 'state' && !!m.state.players[b.playerId!]?.characterId,
    'bob character set',
  );
  console.log('✓ both picked characters');

  host.send({ type: 'start_scenario' });
  await host.waitFor((m) => m.type === 'state' && m.state.phase === 'card_select', 'card_select');
  console.log('✓ scenario started, in card_select');

  if (!host.state) throw new Error('no state');
  const enemyCount = Object.values(host.state.units).filter((u) => u.kind === 'enemy').length;
  if (enemyCount !== 6) throw new Error(`expected 6 enemies, got ${enemyCount}`);
  console.log(`✓ ${enemyCount} enemies spawned`);

  // Both pick a card.
  a.send({ type: 'select_card', cardId: 's_quick' });
  b.send({ type: 'select_card', cardId: 'p_quick' });
  await host.waitFor(
    (m) => m.type === 'state' && m.state.phase === 'turn_resolution',
    'turn_resolution',
  );
  console.log('✓ both selected cards, entered turn_resolution');

  // alice has init 20, bob 25 — enemies have 40 and 50.
  // alice should be first.
  await a.waitFor((m) => m.type === 'your_turn', 'alice your_turn');
  console.log(`✓ alice's turn (unit ${a.yourTurn!.unitId}, card ${a.yourTurn!.cardId})`);

  // Alice plays: stay put, skip action (out of attack range).
  const aUnit = host.state!.units[a.yourTurn!.unitId]!;
  a.send({ type: 'play_turn', moveTo: aUnit.pos, action: { kind: 'none' } });

  await b.waitFor((m) => m.type === 'your_turn', "bob's your_turn");
  console.log(`✓ bob's turn`);
  const bUnit = host.state!.units[b.yourTurn!.unitId]!;
  b.send({ type: 'play_turn', moveTo: bUnit.pos, action: { kind: 'none' } });

  // Wait for round to end (back to card_select).
  await host.waitFor(
    (m) =>
      m.type === 'state' &&
      (m.state.phase === 'card_select' ||
        m.state.phase === 'victory' ||
        m.state.phase === 'defeat'),
    'round complete',
  );
  console.log(`✓ round 1 complete, now in phase ${host.state!.phase}`);

  // Verify enemies acted (their initiative was higher; some should have moved).
  const movedEnemies = Object.values(host.state!.units).filter(
    (u) => u.kind === 'enemy' && (u.pos.q !== getOriginalEnemyPos(u.id).q || u.pos.r !== getOriginalEnemyPos(u.id).r),
  );
  if (movedEnemies.length === 0) {
    throw new Error('expected enemies to move toward players, but none did');
  }
  console.log(`✓ ${movedEnemies.length} enemies moved toward players`);

  // Verify hands shrank by 1 each (read from host state to avoid cross-socket race).
  const aHandHost = host.state!.players[a.playerId!]!.hand.length;
  const bHandHost = host.state!.players[b.playerId!]!.hand.length;
  const aDiscardHost = host.state!.players[a.playerId!]!.discard.length;
  const bDiscardHost = host.state!.players[b.playerId!]!.discard.length;
  if (aHandHost !== 7 || bHandHost !== 7) {
    throw new Error(`expected hands of 7, got alice=${aHandHost} bob=${bHandHost}`);
  }
  if (aDiscardHost !== 1 || bDiscardHost !== 1) {
    throw new Error(`expected discard of 1, got alice=${aDiscardHost} bob=${bDiscardHost}`);
  }
  console.log('✓ both hands shrank to 7, discard piles have 1 card each');

  console.log('\nALL SMOKE CHECKS PASSED');

  host.close();
  a.close();
  b.close();
  process.exit(0);
}

const ORIGINAL_ENEMY_POS: Record<string, { q: number; r: number }> = {
  e_0: { q: 2, r: 1 },
  e_1: { q: 4, r: 0 },
  e_2: { q: 6, r: 1 },
  e_3: { q: 8, r: 0 },
  e_4: { q: 3, r: 2 },
  e_5: { q: 7, r: 2 },
};
function getOriginalEnemyPos(id: string) {
  return ORIGINAL_ENEMY_POS[id] ?? { q: -1, r: -1 };
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
