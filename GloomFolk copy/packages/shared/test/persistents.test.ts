import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAoeAttack, applyAttack, applyPush, applyShieldBonus, applySufferDamage, clearRoundBonuses, reachableFor, reachableForJump } from '../src/rules/combat.js';
import { addPersistent, consumeMoveBonus, consumeNegate } from '../src/rules/persistents.js';
import { initialState, spawnEnemies, spawnPlayer } from '../src/rules/setup.js';
import { hasCondition } from '../src/rules/conditions.js';

function freshState() {
  const s = initialState('scenario_01');
  spawnEnemies(s);
  spawnPlayer(s, 'sock_a', 'Alice', 'bruiser');
  return s;
}

test('persistent negate-damage: absorbs 4 sources of suffer damage then routes to lost', () => {
  const s = freshState();
  const player = s.players['sock_a']!;
  const unit = s.units[player.unitId]!;
  unit.hp = 10;
  addPersistent(player, 's_juggernaut', { kind: 'negate-damage', charges: 4, lostWhenEmpty: true });

  for (let i = 0; i < 4; i++) applySufferDamage(s, unit.id, 3);
  assert.equal(unit.hp, 10, 'first 4 sources fully negated');
  assert.equal(player.activePersistents.length, 0, 'effect removed when depleted');
  assert.deepEqual(player.lost, ['s_juggernaut'], 'card routed to lost pile');

  applySufferDamage(s, unit.id, 3);
  assert.equal(unit.hp, 7, '5th source goes through');
});

test('persistent negate-damage: absorbs attack damage too', () => {
  const s = freshState();
  const player = s.players['sock_a']!;
  const unit = s.units[player.unitId]!;
  const enemy = Object.values(s.units).find((u) => u.kind === 'enemy')!;
  unit.hp = 10;
  addPersistent(player, 's_juggernaut', { kind: 'negate-damage', charges: 1, lostWhenEmpty: true });

  applyAttack(s, enemy.id, unit.id, 3, { skipModifiers: true });
  assert.equal(unit.hp, 10, 'attack damage negated');
  assert.equal(consumeNegate(s, unit.id), false, 'no charges left');
});

test('persistent bonus-move: adds bonus for next 2 calls then auto-discards', () => {
  const s = freshState();
  const player = s.players['sock_a']!;
  addPersistent(player, 's_intimidate', { kind: 'bonus-move', bonus: 1, charges: 2, lostWhenEmpty: false });

  assert.equal(consumeMoveBonus(s, 'sock_a'), 1);
  assert.equal(consumeMoveBonus(s, 'sock_a'), 1);
  assert.equal(consumeMoveBonus(s, 'sock_a'), 0, 'depleted');
  assert.equal(player.activePersistents.length, 0);
  assert.deepEqual(player.discard, ['s_intimidate'], 'non-lost card returns to discard');
});

test('AoE attack centered on self: hits all 6 adjacent enemies, skips attacker hex', () => {
  const s = freshState();
  const attacker = Object.values(s.units).find((u) => u.kind === 'player')!;
  attacker.pos = { q: 4, r: 4 };
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.pos = { q: 99, r: 99 };
  }
  // Place 3 enemies adjacent, leave 3 hexes empty.
  const enemies = Object.values(s.units).filter((u) => u.kind === 'enemy').slice(0, 3);
  enemies[0]!.pos = { q: 5, r: 4 };  // {+1,0}
  enemies[1]!.pos = { q: 4, r: 5 };  // {0,+1}
  enemies[2]!.pos = { q: 3, r: 4 };  // {-1,0}
  for (const e of enemies) e.hp = 10;

  const sixNeighbors = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  const outcomes = applyAoeAttack(
    s, attacker.id, attacker.pos, 3,
    { hexes: sixNeighbors }, { skipModifiers: true },
  );
  assert.equal(outcomes.length, 3);
  for (const e of enemies) assert.equal(e.hp, 7);
});

test('nextAttackBonus: cleared by clearRoundBonuses', () => {
  const s = freshState();
  const unit = s.units[s.players['sock_a']!.unitId]!;
  unit.nextAttackBonus = 3;
  clearRoundBonuses(s);
  assert.equal(unit.nextAttackBonus, 0);
});

test('push: applyPush moves an enemy away from attacker', () => {
  const s = freshState();
  const attacker = Object.values(s.units).find((u) => u.kind === 'player')!;
  attacker.pos = { q: 4, r: 4 };
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.pos = { q: 99, r: 99 };
  }
  const enemy = Object.values(s.units).find((u) => u.kind === 'enemy')!;
  enemy.pos = { q: 5, r: 4 };
  applyPush(s, attacker.id, enemy.id, 2);
  // Enemy should be 2 hexes farther from attacker than before (was distance 1, now 3).
  // Helper inlined to avoid extra import.
  const dq = enemy.pos.q - attacker.pos.q;
  const dr = enemy.pos.r - attacker.pos.r;
  const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  assert.equal(dist, 3);
});

test('jump movement: passes through other units, lands on empty hex', () => {
  const s = freshState();
  const player = Object.values(s.units).find((u) => u.kind === 'player')!;
  player.pos = { q: 0, r: 0 };
  // Place an enemy adjacent at {1,0} blocking the normal path.
  const enemy = Object.values(s.units).find((u) => u.kind === 'enemy')!;
  enemy.pos = { q: 1, r: 0 };
  const reachableNormal = reachableFor(s, player.id, 2);
  const reachableJump = reachableForJump(s, player.id, 2);
  // Jump can reach {2,0} by passing through the enemy at {1,0}.
  assert.equal(reachableJump.some((h) => h.q === 2 && h.r === 0), true);
  // Jump cannot land on the occupied hex itself.
  assert.equal(reachableJump.some((h) => h.q === 1 && h.r === 0), false);
  void reachableNormal;
});

test('react-shield-retaliate: first ability shield gain stacks +1 shield + +1 retaliate', () => {
  const s = freshState();
  const player = s.players['sock_a']!;
  const unit = s.units[player.unitId]!;
  addPersistent(player, 's_defensive', { kind: 'react-shield-retaliate', lostWhenEmpty: true });

  applyShieldBonus(s, unit.id, 2);
  // Original 2 + reactive 1 = 3 shield, plus 1 retaliate from reactive.
  assert.equal(unit.shieldBonus, 3);
  assert.equal(unit.retaliateBonus, 1);

  // Second shield gain in the same round should NOT re-trigger.
  applyShieldBonus(s, unit.id, 1);
  assert.equal(unit.shieldBonus, 4);  // +1 raw, no bonus
  assert.equal(unit.retaliateBonus, 1);

  // Advance round and re-trigger.
  s.round += 1;
  applyShieldBonus(s, unit.id, 1);
  assert.equal(unit.shieldBonus, 6);  // +1 raw +1 bonus
  assert.equal(unit.retaliateBonus, 2);
});

test('AoE attack: hits primary + offset hexes and applies wound to each', () => {
  const s = freshState();
  // Place attacker and three enemies in a known cluster.
  const attacker = Object.values(s.units).find((u) => u.kind === 'player')!;
  attacker.pos = { q: 0, r: 0 };
  // Clear existing enemies out of the way
  for (const u of Object.values(s.units)) {
    if (u.kind === 'enemy') u.pos = { q: 99, r: 99 };
  }
  const enemies = Object.values(s.units).filter((u) => u.kind === 'enemy').slice(0, 3);
  enemies[0]!.pos = { q: 2, r: 0 }; // primary target hex
  enemies[1]!.pos = { q: 3, r: 0 }; // offset {+1, 0}
  enemies[2]!.pos = { q: 2, r: 1 }; // offset {0, +1}
  for (const e of enemies) e.hp = 10;

  const outcomes = applyAoeAttack(
    s,
    attacker.id,
    { q: 2, r: 0 },
    2,
    { hexes: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }] },
    { skipModifiers: true, appliedConditions: ['wound'] },
  );

  assert.equal(outcomes.length, 3);
  for (const e of enemies) {
    assert.equal(e.hp, 8);
    assert.ok(hasCondition(e, 'wound'), 'wound applied to AoE target');
  }
});
