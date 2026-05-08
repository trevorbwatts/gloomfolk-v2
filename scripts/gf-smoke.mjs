import { WebSocket } from 'ws';

const PORT = 8788;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, msg) => ws.send(JSON.stringify(msg));

function open() {
  const tracker = { lastState: null, hand: [], lastYou: null, errors: [] };
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.on('open', () => resolve({ ws, tracker }));
    ws.on('error', reject);
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.type === 'state') {
        tracker.lastState = m.state;
        if (m.you) {
          tracker.lastYou = m.you;
          if (m.you.hand?.length) tracker.hand = m.you.hand;
        }
      } else if (m.type === 'error') {
        tracker.errors.push(m.message);
        console.log('  ERR:', m.message);
      }
    });
  });
}

const { ws: host, tracker: hostT } = await open();
send(host, { type: 'host_create_campaign', name: 'Step13' });
await wait(150);
const cid = hostT.lastState.campaignId;

const { ws: phone, tracker: pT } = await open();
send(phone, { type: 'player_join', campaignId: cid, name: 'Trev' });
await wait(80);
send(phone, { type: 'player_pick_character', characterId: 'bruiser' });
await wait(80);

const { ws: phone2, tracker: p2T } = await open();
send(phone2, { type: 'player_join', campaignId: cid, name: 'Sam' });
await wait(80);
send(phone2, { type: 'player_pick_character', characterId: 'silent-knife' });
await wait(80);

send(host, { type: 'host_start_scenario', scenarioId: 'level1' });
await wait(200);

// Sam picks Throwing Knives (multi-target ranged)
const throwingKnives = p2T.hand.find((c) => c.id === 'silent-knife.throwing-knives');
const fillerSam = p2T.hand.find((c) => c.id !== throwingKnives.id);
console.log('Throwing Knives present?', !!throwingKnives, 'init', throwingKnives?.initiative);

send(phone2, {
  type: 'player_select_cards',
  leadingId: throwingKnives.initiative < fillerSam.initiative ? throwingKnives.id : fillerSam.id,
  secondId: throwingKnives.initiative < fillerSam.initiative ? fillerSam.id : throwingKnives.id,
});
await wait(80);

// Trev picks Skewer (AOE) and any filler
const skewer = pT.hand.find((c) => c.id === 'bruiser.skewer');
const fillerTrev = pT.hand.find((c) => c.id !== skewer.id);
console.log('Skewer present?', !!skewer, 'init', skewer?.initiative);
send(phone, {
  type: 'player_select_cards',
  leadingId: skewer.initiative < fillerTrev.initiative ? skewer.id : fillerTrev.id,
  secondId: skewer.initiative < fillerTrev.initiative ? fillerTrev.id : skewer.id,
});
await wait(400);

console.log('phase:', hostT.lastState.phase);
console.log('order:', hostT.lastState.turnOrder.map((e) =>
  e.kind === 'player' ? `P${e.initiative}` : `M${e.initiative}/${e.setId}`
).join(' '));

// Walk to Sam's turn
const sam = hostT.lastState.units.find((u) => u.name === 'Sam');
while (
  hostT.lastState.phase === 'turn_resolution' &&
  (() => {
    const c = hostT.lastState.turnOrder[hostT.lastState.activeTurnIndex];
    return !c || c.kind !== 'player' || c.unitId !== sam.id;
  })()
) {
  send(host, { type: 'end_turn' });
  await wait(120);
}
console.log('--- Sam turn ---');

// Engage TOP of Throwing Knives — should produce attack action with targets=2
send(phone2, {
  type: 'player_engage_half',
  slot: 'top',
  cardId: throwingKnives.id,
  useBasic: false,
});
await wait(150);
const tkTop = hostT.lastState.currentTurn.topSlot;
console.log('Throwing Knives top action:', JSON.stringify(tkTop.actions));

// Try to attack a monster (it'll likely be out of range/LOS depending on positions)
const archer = hostT.lastState.units.find((u) => u.defId === 'bandit-archer');
const scout = hostT.lastState.units.find((u) => u.defId === 'bandit-scout');
console.log('Sam at', hostT.lastState.units.find((u) => u.id === sam.id).hex, 'archer at', archer?.hex, 'scout at', scout?.hex);

const atkAction = tkTop.actions[0];
if (atkAction.targetsRemaining > 0) {
  // Try archer first
  send(phone2, {
    type: 'player_perform_action',
    slot: 'top',
    actionId: atkAction.id,
    target: { unitId: archer.id },
  });
  await wait(150);
  console.log('After 1st knife — archer hp:', hostT.lastState.units.find((u) => u.id === archer.id)?.hp);
  console.log('  targetsRemaining:', hostT.lastState.currentTurn.topSlot.actions[0].targetsRemaining);
}

// Second target: scout
send(phone2, {
  type: 'player_perform_action',
  slot: 'top',
  actionId: atkAction.id,
  target: { unitId: scout.id },
});
await wait(150);
console.log('After 2nd knife — scout hp:', hostT.lastState.units.find((u) => u.id === scout.id)?.hp);
console.log('  done:', hostT.lastState.currentTurn.topSlot.actions[0].done);

send(phone2, { type: 'player_finish_half', slot: 'top' });
await wait(150);

// Skip bottom
send(phone2, {
  type: 'player_engage_half',
  slot: 'bottom',
  cardId: fillerSam.id,
  useBasic: false,
});
await wait(150);
for (const a of hostT.lastState.currentTurn.bottomSlot.actions) {
  if (!a.done) {
    send(phone2, { type: 'player_skip_action', slot: 'bottom', actionId: a.id });
    await wait(50);
  }
}
send(phone2, { type: 'player_finish_half', slot: 'bottom' });
await wait(80);

send(phone2, { type: 'end_turn' });
await wait(150);

// Walk to Trev's turn
const trev = hostT.lastState.units.find((u) => u.name === 'Trev');
while (
  hostT.lastState.phase === 'turn_resolution' &&
  (() => {
    const c = hostT.lastState.turnOrder[hostT.lastState.activeTurnIndex];
    return !c || c.kind !== 'player' || c.unitId !== trev.id;
  })()
) {
  send(host, { type: 'end_turn' });
  await wait(120);
}
console.log('--- Trev turn ---');

// Engage TOP of Skewer (AOE attack)
send(phone, {
  type: 'player_engage_half',
  slot: 'top',
  cardId: skewer.id,
  useBasic: false,
});
await wait(150);
const skTop = hostT.lastState.currentTurn.topSlot;
console.log('Skewer top action:', JSON.stringify(skTop.actions));

const aoeAction = skTop.actions.find((a) => a.type === 'attack-aoe');
console.log('AOE pattern:', JSON.stringify(aoeAction?.pattern));

// Trev at (0,2). Pattern is [{0,-1}, {0,-2}]. Try anchor at (0,1) (= (0,2)+(0,-1)): one rotation hit.
// No enemies adjacent so this is mostly a parser test.
send(phone, {
  type: 'player_perform_action',
  slot: 'top',
  actionId: aoeAction.id,
  target: { hex: { q: trev.hex.q, r: trev.hex.r - 1 } },
});
await wait(150);
console.log('AOE done:', hostT.lastState.currentTurn.topSlot.actions[0].done);
console.log('Events:');
for (const ev of hostT.lastState.events.slice(-6)) console.log(`  ${ev.text}`);

host.close(); phone.close(); phone2.close();
await wait(100);
console.log('--- DONE ---');
process.exit(0);
