import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileScenario,
  getScenario,
  resolveTileHexes,
  tileSideById,
  tileShapeById,
  type ScenarioData,
  type ScenarioRules,
} from '../src/index.js';

test('resolveTileHexes expands a placed tile via its side → shape footprint', () => {
  const side = tileSideById('09-D')!;
  const shape = tileShapeById(side.shapeId)!;
  const hexes = resolveTileHexes({ id: 't', tileSideId: '09-D', origin: { q: 5, r: 7 }, rotation: 0 });
  assert.equal(hexes.length, shape.footprint.length);
  // Every footprint hex appears shifted by the origin.
  for (const f of shape.footprint) {
    assert.ok(
      hexes.some((h) => h.q === f.q + 5 && h.r === f.r + 7),
      `expected ${f.q + 5},${f.r + 7}`,
    );
  }
});

test('compileScenario maps overlays, rooms, behaviors, doors, and spawns', () => {
  const data: ScenarioData = {
    number: 99,
    placedTiles: [
      { id: 't1', tileSideId: '02-A', origin: { q: 0, r: 0 }, rotation: 0 },
    ],
    overlays: [
      { id: 's', kind: 'starting-position', hexes: [{ q: 0, r: 0 }] },
      { id: 'o', kind: 'obstacle', hexes: [{ q: 1, r: 0 }] },
      { id: 'd', kind: 'difficult-terrain', hexes: [{ q: 2, r: 0 }] },
    ],
    monsterSpawns: [
      { id: 'm', hex: { q: 0, r: 1 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'elite', 4: 'elite' } },
    ],
  };
  const rules: ScenarioRules = {
    id: 'test-99',
    name: 'Test 99',
    objective: 'Win.',
    behaviorByRoom: { '02-A': 'dummy' },
  };
  const s = compileScenario(data, rules);

  // Tiles carry their room id and overlay-derived kinds.
  const obstacle = s.tiles.find((t) => t.q === 1 && t.r === 0);
  assert.equal(obstacle?.kind, 'wall');
  const difficult = s.tiles.find((t) => t.q === 2 && t.r === 0);
  assert.equal(difficult?.kind, 'difficult');
  assert.ok(s.tiles.every((t) => t.room === '02-A'));

  // Player spawn from starting-position; enemy spawn from monster spawn.
  const players = s.spawns.filter((sp) => sp.side === 'player');
  const enemies = s.spawns.filter((sp) => sp.side === 'enemy');
  assert.equal(players.length, 1);
  assert.equal(enemies.length, 1);
  assert.equal(enemies[0]!.monsterId, 'city-guard');
  assert.equal(enemies[0]!.room, '02-A');
  // Per-count ranks mapped (3p/4p elite).
  assert.equal(enemies[0]!.ranks?.[3], 'elite');
  assert.equal(enemies[0]!.ranks?.[2], 'normal');
  // Behavior from behaviorByRoom.
  assert.equal(enemies[0]!.behavior, 'dummy');

  // Single placed tile → no room gating list.
  assert.equal(s.rooms, undefined);
});

test('scenario-0 is registered and well-formed', () => {
  const s = getScenario('scenario-0')!;
  assert.ok(s, 'scenario-0 registered');
  assert.deepEqual(s.rooms, ['09-D', '07-D', '02-A']);
  assert.equal(s.doors?.length, 2);

  // 15 guards total (counts scale per party size at runtime).
  const enemies = s.spawns.filter((sp) => sp.side === 'enemy');
  assert.equal(enemies.length, 15);
  const byRoom = (room: string) => enemies.filter((e) => e.room === room);
  assert.equal(byRoom('09-D').length, 4);
  assert.equal(byRoom('07-D').length, 6);
  assert.equal(byRoom('02-A').length, 5);

  // Behaviors per room.
  assert.ok(byRoom('09-D').every((e) => e.behavior === 'dummy'));
  assert.ok(
    byRoom('07-D').every(
      (e) => typeof e.behavior === 'object' && 'scripted' in e.behavior,
    ),
  );
  // Room 3 guards are normal (no behavior override).
  assert.ok(byRoom('02-A').every((e) => e.behavior === undefined));

  // Doors wire unlock + reveal + narrative.
  const d1 = s.doors!.find((d) => d.id === 'door1')!;
  assert.deepEqual(d1.unlock, { allMonstersDeadIn: '09-D' });
  assert.equal(d1.revealsRoom, '07-D');
  assert.equal(d1.narrativeKey, 'door:1');

  // Narrative blocks present.
  assert.ok(s.narrative?.start);
  assert.ok(s.narrative?.['door:1']);
  assert.ok(s.narrative?.victory);

  // Every monster sits on a real tile (rotation/origin resolved correctly).
  const tileAt = new Map(s.tiles.map((t) => [`${t.q},${t.r}`, t]));
  for (const e of enemies) {
    assert.ok(tileAt.has(`${e.hex.q},${e.hex.r}`), `enemy off-tile at ${e.hex.q},${e.hex.r}`);
  }
});
