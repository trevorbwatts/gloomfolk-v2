import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bruiser } from '@gloomfolk/shared';

import { makeFixture, type PlayerEntry } from './helpers.js';
import type { Room } from '../src/room.js';

/** A ready two-player party sitting in Scenario 0 (Gloomhaven needs ≥2). */
function startScenario0() {
  const fx = makeFixture({ classId: 'bruiser' });
  fx.character.loadout = [];
  fx.character.shoppingDone = true;

  // Add a second ready player so the party meets the two-player minimum.
  fx.room.campaign.characters.push({
    ...fx.character,
    id: 'char-2',
    name: 'Test Character 2',
    claimedByPlayerId: 'p-2',
  });
  const player2: PlayerEntry = {
    playerId: 'p-2',
    name: 'Test Player 2',
    activeCharacterId: 'char-2',
    socket: null,
    hand: [],
    discard: [],
    lost: [],
    active: [],
    activeTracked: [],
    activeEffects: [],
    pendingRetaliateXp: [],
    selection: null,
    modifierDeck: [],
    modifierDiscard: [],
    modifierNeedsReshuffle: false,
    shortRestPending: null,
  };
  (fx.room.players as unknown as Map<string, PlayerEntry>).set('p-2', player2);

  const res = fx.room.startScenario('scenario-0');
  assert.deepEqual(res, { ok: true });

  // Scenario start now drops the party into a placement phase. Drive both
  // players through it (placement completion + Begin require live sockets) so
  // the room reaches card-selection like the tests below expect. We also leave
  // player 2 with a standing card selection so the single-player buildTurnOrder
  // helper can still finalize the round order.
  (fx.player as unknown as { socket: unknown }).socket = { send: () => {} };
  (player2 as unknown as { socket: unknown }).socket = { send: () => {} };
  const starts = fx.room.publicState().startingPositions;
  assert.ok(starts.length >= 2, 'scenario 0 offers at least two starting hexes');
  fx.room.placePlayer('p-1', starts[0]!);
  fx.room.placePlayer('p-2', starts[1]!);
  fx.room.setPlacementReady('p-1', true);
  fx.room.setPlacementReady('p-2', true);
  (player2 as unknown as { selection: unknown }).selection = {
    kind: 'cards',
    leadingId: 'p2-leading',
    secondId: 'p2-second',
  };
  const begin = fx.room.beginScenarioPlay();
  assert.deepEqual(begin, { ok: true });
  return fx;
}

/** Reach into the private monster set on a unit (room/behavior bookkeeping is
 *  internal). Returns the live monster units. */
function monsters(room: Room) {
  return room.units.filter((u) => u.kind === 'monster');
}

/** Drive the private turn-order builder with the player having selected two
 *  cards, suppressing the heavy openTurn/broadcast tail so we can inspect the
 *  built order in isolation. */
function buildTurnOrder(room: Room, player: PlayerEntry) {
  const r = room as unknown as {
    openTurn: () => void;
    broadcastState: () => void;
    maybeBeginTurnResolution: () => void;
    turnOrder: { kind: string; initiative: number; abilityCardId?: string }[];
  };
  r.openTurn = () => {};
  r.broadcastState = () => {};
  (player as unknown as { socket: unknown }).socket = { send: () => {} };
  player.hand = [bruiser.cards[0]!, bruiser.cards[1]!];
  (player as unknown as { selection: unknown }).selection = {
    kind: 'cards',
    leadingId: bruiser.cards[0]!.id,
    secondId: bruiser.cards[1]!.id,
  };
  r.maybeBeginTurnResolution();
  return r.turnOrder;
}

test('Scenario 0 starts with only room 1 revealed and the intro narrative', () => {
  const fx = startScenario0();
  const state = fx.room.publicState();

  // Only room 1's guards are on the board (rooms 2 & 3 are hidden). At
  // 2-player scaling that's 2 of the 4 authored dummies.
  assert.equal(monsters(fx.room).length, 2);
  assert.ok(monsters(fx.room).every((m) => m.defId === 'city-guard'));
  // Tiles are gated to room 09-D.
  assert.ok(state.tiles.length > 0);
  assert.ok(state.tiles.every((t) => t.room === '09-D'));
  // Intro story text is showing.
  assert.equal(state.narrative?.title, 'A New Recruit');
  // No door is openable yet (room 1 not cleared).
  assert.equal(state.openableDoors.length, 0);

  fx.room.dismissNarrative();
  assert.equal(fx.room.publicState().narrative, null);
});

test('door 1 shows token ① (locked), and stepping onto it opens it only after room 1 is cleared', () => {
  const fx = startScenario0();
  fx.room.dismissNarrative();
  const room = fx.room as unknown as {
    maybeOpenDoorAt: (pid: string, hex: { q: number; r: number }) => void;
  };
  const doorHex = { q: 0, r: -1 };

  // The door is on the board with its numbered token, locked while guards live.
  const atStart = fx.room.publicState().doors;
  const door1 = atStart.find((d) => d.id === 'door1');
  assert.ok(door1, 'door 1 is drawn on the map');
  assert.equal(door1!.number, 1, 'door 1 carries token ①');
  assert.equal(door1!.openable, false, 'locked while room 1 has guards');

  // Stepping onto a locked door does nothing.
  room.maybeOpenDoorAt(fx.player.playerId, doorHex);
  assert.ok(
    fx.room.publicState().tiles.every((t) => t.room === '09-D'),
    'room 2 stays hidden while the door is locked',
  );

  // Clear room 1 (drop the monsters, keep the players).
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');
  assert.equal(
    fx.room.publicState().doors.find((d) => d.id === 'door1')?.openable,
    true,
    'door unlocks once room 1 is cleared',
  );

  // Now stepping onto the door opens it, revealing room 2 and firing its text.
  room.maybeOpenDoorAt(fx.player.playerId, doorHex);
  const state = fx.room.publicState();
  assert.ok(state.tiles.some((t) => t.room === '07-D'), 'room 2 revealed');
  assert.equal(state.narrative?.title, 'Sparring Room');
  assert.equal(state.doors.find((d) => d.id === 'door1'), undefined, 'opened door no longer drawn');
});

test('room-1 dummies never get a monster-group turn', () => {
  const fx = startScenario0();
  const order = buildTurnOrder(fx.room, fx.player);
  assert.equal(
    order.filter((e) => e.kind === 'monster-group').length,
    0,
    'all room-1 guards are dummies → no monster turn',
  );
});

test('clearing room 1 unlocks and opens door 1, revealing scripted room 2', () => {
  const fx = startScenario0();
  fx.room.dismissNarrative();

  // Kill room-1 guards.
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');

  // killAll must NOT fire victory while rooms remain hidden.
  (fx.room as unknown as { checkScenarioEnd: () => void }).checkScenarioEnd();
  assert.notEqual(fx.room.publicState().phase, 'victory');

  // Door 1 is now openable.
  const openable = fx.room.publicState().openableDoors;
  assert.equal(openable.length, 1);
  assert.equal(openable[0]!.id, 'door1');

  // Open it → room 2 revealed, its 3 guards spawned, section text fires.
  const res = fx.room.openDoor(fx.player.playerId, 'door1');
  assert.deepEqual(res, { ok: true });
  const state = fx.room.publicState();
  // Room 2 at 2-player scaling: 3 of the 6 authored sparring partners.
  assert.equal(monsters(fx.room).length, 3);
  assert.ok(state.tiles.some((t) => t.room === '07-D'));
  assert.equal(state.narrative?.title, 'Sparring Room');

  fx.room.dismissNarrative();

  // Room-2 guards are scripted: they act as a group at initiative 50.
  const order = buildTurnOrder(fx.room, fx.player);
  const group = order.find((e) => e.kind === 'monster-group');
  assert.ok(group, 'scripted guards take a monster-group turn');
  assert.equal(group!.initiative, 50);
  assert.equal(group!.abilityCardId, 'scripted:guard');
});

test('room 3 guards act on their real ability deck, and clearing it wins', () => {
  const fx = startScenario0();
  fx.room.dismissNarrative();

  // Clear room 1, open door 1.
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');
  fx.room.openDoor(fx.player.playerId, 'door1');
  fx.room.dismissNarrative();

  // Clear room 2, open door 2 → room 3 (normal behavior).
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');
  fx.room.openDoor(fx.player.playerId, 'door2');
  fx.room.dismissNarrative();

  const order = buildTurnOrder(fx.room, fx.player);
  const group = order.find((e) => e.kind === 'monster-group');
  assert.ok(group, 'room-3 guards take a turn');
  // Not the scripted synthetic card — a real drawn guard card.
  assert.notEqual(group!.abilityCardId, 'scripted:guard');
  assert.notEqual(group!.initiative, 50);

  // Clearing the final room (all rooms revealed) wins, firing victory text.
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');
  (fx.room as unknown as { checkScenarioEnd: () => void }).checkScenarioEnd();
  const state = fx.room.publicState();
  assert.equal(state.phase, 'victory');
  assert.equal(state.narrative?.title, 'Sharp Again');
});

test('opening a door mid-round splices the revealed monster set into the live initiative order', () => {
  const fx = startScenario0();
  fx.room.dismissNarrative();

  // Enter turn resolution for the round. Room-1 guards are dummies, so the live
  // order is players-only at this point (no monster-group entry).
  const order = buildTurnOrder(fx.room, fx.player);
  assert.equal(
    order.filter((e) => e.kind === 'monster-group').length,
    0,
    'no monster group while only room-1 dummies are on the board',
  );

  // Clear room 1 (unlocks door 1) and open it WITHOUT rebuilding the round.
  fx.room.units = fx.room.units.filter((u) => u.kind !== 'monster');
  const res = fx.room.openDoor(fx.player.playerId, 'door1');
  assert.deepEqual(res, { ok: true });

  // Per revealing-spawning-and-named-monsters.md, revealed monsters act THIS
  // round: the scripted sparring guards are spliced straight into the live turn
  // order rather than waiting for next round's rebuild.
  const live = (fx.room as unknown as {
    turnOrder: { kind: string; initiative: number; abilityCardId?: string }[];
  }).turnOrder;
  const group = live.find((e) => e.kind === 'monster-group');
  assert.ok(group, 'revealed guards are spliced into the current round');
  assert.equal(group!.abilityCardId, 'scripted:guard');
  assert.equal(group!.initiative, 50);
});
