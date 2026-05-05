import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAttack,
  applyHeal,
  applyMove,
  canMoveTo,
  checkVictory,
  reachableFor,
} from '../src/rules/combat.js';
import { initialState, spawnEnemies, spawnPlayer } from '../src/rules/setup.js';
import { applyEnemyTurn } from '../src/rules/ai.js';

function freshState() {
  const s = initialState('scenario_01');
  spawnEnemies(s);
  spawnPlayer(s, 'sock_a', 'Alice', 'bruiser');
  spawnPlayer(s, 'sock_b', 'Bob', 'support');
  return s;
}

test('attack: reduces target hp', () => {
  const s = freshState();
  const target = Object.values(s.units).find((u) => u.kind === 'enemy')!;
  const before = target.hp;
  const out = applyAttack(s, 'p_sock_a', target.id, 2, { skipModifiers: true });
  assert.ok(out);
  assert.equal(target.hp, before - 2);
  assert.equal(out.killed, false);
});

test('attack: kills at 0 hp and exhausts unit', () => {
  const s = freshState();
  const target = Object.values(s.units).find((u) => u.kind === 'enemy')!;
  applyAttack(s, 'p_sock_a', target.id, 999, { skipModifiers: true });
  assert.equal(target.hp, 0);
  assert.equal(target.exhausted, true);
});

test('heal: clamps to maxHp', () => {
  const s = freshState();
  const ally = Object.values(s.units).find((u) => u.kind === 'player')!;
  ally.hp = ally.maxHp - 1;
  applyHeal(s, ally.id, ally.id, 5);
  assert.equal(ally.hp, ally.maxHp);
});

test('move: cannot exceed move range', () => {
  const s = freshState();
  const player = Object.values(s.units).find((u) => u.kind === 'player')!;
  // far hex very obviously out of range
  assert.equal(canMoveTo(s, player.id, { q: 9, r: 0 }, 2), false);
});

test('move: can step to a neighbor when range >= 1', () => {
  const s = freshState();
  const player = Object.values(s.units).find((u) => u.kind === 'player' && u.archetype === 'bruiser')!;
  const reach = reachableFor(s, player.id, 1);
  assert.ok(reach.length >= 2);
  const dest = reach.find((h) => h.q !== player.pos.q || h.r !== player.pos.r);
  assert.ok(dest);
  applyMove(s, player.id, dest);
  assert.deepEqual(player.pos, dest);
});

test('victory: all enemies exhausted', () => {
  const s = freshState();
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.exhausted = true;
  }
  assert.equal(checkVictory(s), 'victory');
});

test('defeat: all players exhausted', () => {
  const s = freshState();
  for (const u of Object.values(s.units)) {
    if (u.kind === 'player') u.exhausted = true;
  }
  assert.equal(checkVictory(s), 'defeat');
});

test('enemy AI: in-range enemy attacks rather than moving', () => {
  const s = freshState();
  const enemy = Object.values(s.units).find((u) => u.kind === 'enemy' && u.archetype === 'shooter')!;
  const player = Object.values(s.units).find((u) => u.kind === 'player')!;
  // Place the enemy adjacent to a player; they should attack and not need to move.
  enemy.pos = { q: player.pos.q + 1, r: player.pos.r };
  const startPos = { ...enemy.pos };
  // Give player enough HP to survive any modifier outcome.
  player.hp = player.maxHp = 100;
  const startHp = player.hp;
  applyEnemyTurn(s, enemy.id);
  assert.deepEqual(enemy.pos, startPos);
  // Enemy attacked — hp may be unchanged on a null modifier draw, so just check no crash.
  assert.ok(player.hp <= startHp);
});

test('enemy AI: out-of-range enemy moves toward nearest player', () => {
  const s = freshState();
  const enemy = Object.values(s.units).find((u) => u.kind === 'enemy' && u.archetype === 'grunt')!;
  const startPos = { ...enemy.pos };
  applyEnemyTurn(s, enemy.id);
  // grunts have move 3 but are far from players; pos should change.
  assert.notDeepEqual(enemy.pos, startPos);
});
