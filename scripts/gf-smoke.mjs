import { WebSocket } from 'ws';

const PORT = 8788;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, msg) => ws.send(JSON.stringify(msg));

function open(label) {
  const tracker = { lastState: null, hand: [], lastYou: null };
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.on('open', () => resolve({ ws, tracker, label }));
    ws.on('error', reject);
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.type === 'state') {
        tracker.lastState = m.state;
        if (m.you) {
          tracker.lastYou = m.you;
          if (m.you.hand?.length) tracker.hand = m.you.hand;
        }
      }
    });
  });
}

const { ws: host, tracker: hostT } = await open('HOST');
send(host, { type: 'host_create_campaign', name: 'Smoke Test Camp' });
await wait(200);
const cid = hostT.lastState.campaignId;
console.log('Campaign:', cid);

const { ws: phone, tracker: pT } = await open('PHONE');
send(phone, { type: 'player_join', campaignId: cid, name: 'Trev' });
await wait(150);
send(phone, { type: 'player_pick_character', characterId: 'bruiser' });
await wait(150);

const { ws: phone2, tracker: p2T } = await open('PHONE2');
send(phone2, { type: 'player_join', campaignId: cid, name: 'Sam' });
await wait(150);
send(phone2, { type: 'player_pick_character', characterId: 'silent-knife' });
await wait(150);

send(host, { type: 'host_start_scenario', scenarioId: 'level1' });
await wait(300);

console.log('phone1 hand:', pT.hand.length, 'phone2 hand:', p2T.hand.length);
console.log('phase after start:', hostT.lastState.phase);

// Both submit
send(phone, { type: 'player_select_cards', leadingId: pT.hand[0].id, secondId: pT.hand[1].id });
await wait(150);
send(phone2, { type: 'player_select_cards', leadingId: p2T.hand[0].id, secondId: p2T.hand[1].id });
await wait(300);

console.log('phase after both submit:', hostT.lastState.phase);
console.log('round:', hostT.lastState.round);
console.log('turnOrder:');
for (const e of hostT.lastState.turnOrder) {
  if (e.kind === 'player') {
    console.log(`  P  init ${e.initiative}  ${e.playerId} (card ${e.leadingCardId})  done=${e.done}`);
  } else {
    console.log(`  M  init ${e.initiative}  ${e.setId}/${e.abilityCardName}  done=${e.done}`);
  }
}
console.log('active idx:', hostT.lastState.activeTurnIndex);

// Walk all turns
for (let i = 0; i < 6; i++) {
  send(host, { type: 'end_turn' });
  await wait(120);
}
console.log('phase after walking turns:', hostT.lastState.phase);

send(host, { type: 'host_next_round' });
await wait(200);
console.log('phase after next_round:', hostT.lastState.phase, 'round:', hostT.lastState.round);

host.close();
phone.close();
phone2.close();
await wait(100);
console.log('--- DONE ---');
process.exit(0);
