import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, spawnEnemies, spawnPlayer, startRound, buildTurnOrder, endRoundCleanup } from '../src/rules/setup.js';
import { CARDS } from '../src/content/cards.js';

function freshState() {
  const s = initialState('scenario_01');
  spawnEnemies(s);
  spawnPlayer(s, 'sock_a', 'Alice', 'bruiser');
  return s;
}

test('spawnPlayer: initializes empty selectedCards', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  assert.deepEqual(p.selectedCards, { leading: null, second: null, longRest: false, submitted: false });
  assert.deepEqual(p.lost, []);
});

test('startRound: resets selectedCards even if previously submitted', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  p.selectedCards = { leading: 's_flung', second: 's_plow', longRest: false, submitted: true };
  startRound(s);
  assert.equal(p.selectedCards.submitted, false);
  assert.equal(p.selectedCards.leading, null);
});

test('startRound: exhausts player with <2 hand and 0 discard', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  const u = s.units[p.unitId]!;
  p.hand = ['s_flung'];
  p.discard = [];
  startRound(s);
  assert.equal(u.exhausted, true);
});

test('startRound: does NOT exhaust if player can long rest', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  const u = s.units[p.unitId]!;
  p.hand = [];
  p.discard = ['s_flung', 's_plow'];
  startRound(s);
  assert.equal(u.exhausted, false);
});

test('buildTurnOrder: uses leading card initiative', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  // s_grit init=13; s_dblow init=61 → leading should set initiative to 13
  p.selectedCards = { leading: 's_grit', second: 's_dblow', longRest: false, submitted: true };
  // Remove other unit complications: make all enemies exhausted to focus on player ordering.
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.exhausted = true;
  }
  buildTurnOrder(s);
  assert.equal(s.turnOrder.length, 1);
  assert.equal(s.turnOrder[0], p.unitId);
  assert.equal(s.phase, 'turn_resolution');
  assert.equal(CARDS['s_grit']!.initiative, 13);
});

test('buildTurnOrder: long-rest player gets initiative 99 (acts last)', () => {
  const s = freshState();
  spawnPlayer(s, 'sock_b', 'Bob', 'support');
  const a = s.players['sock_a']!;
  const b = s.players['sock_b']!;
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.exhausted = true;
  }
  a.selectedCards = { leading: null, second: null, longRest: true, submitted: true };  // late
  b.selectedCards = { leading: 'p_quick', second: 'p_aimed', longRest: false, submitted: true };  // init 25
  buildTurnOrder(s);
  // Bob acts first (init 25), then Alice (long rest = 99).
  assert.equal(s.turnOrder[0], b.unitId);
  assert.equal(s.turnOrder[1], a.unitId);
});

test('endRoundCleanup: discards both selected cards', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  p.selectedCards = { leading: 's_flung', second: 's_plow', longRest: false, submitted: true };
  // hand contains both
  endRoundCleanup(s);
  assert.deepEqual(p.discard.sort(), ['s_flung', 's_plow']);
  assert.equal(p.hand.includes('s_flung'), false);
  assert.equal(p.hand.includes('s_plow'), false);
  assert.equal(p.selectedCards.submitted, false);
});

test('endRoundCleanup: skips cards not in hand (already routed to lost/persistent)', () => {
  const s = freshState();
  const p = s.players['sock_a']!;
  // Simulate: bottom-half lost during play removed s_flung from hand into lost.
  p.hand = p.hand.filter((c) => c !== 's_flung');
  p.lost = ['s_flung'];
  p.selectedCards = { leading: 's_flung', second: 's_plow', longRest: false, submitted: true };
  endRoundCleanup(s);
  // s_flung NOT re-added to discard; s_plow is.
  assert.deepEqual(p.discard, ['s_plow']);
  assert.deepEqual(p.lost, ['s_flung']);
});
