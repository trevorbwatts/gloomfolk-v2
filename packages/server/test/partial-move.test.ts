import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Hex } from '@gloomfolk/shared';
import { trample, skewer } from '@gloomfolk/shared';

import { makeFixture, startTurn } from './helpers.js';

/** Lay down a straight east-west corridor of floor tiles so the player at
 *  (0,0) can walk along it. Stubs scenarioTiles (the real source reads a
 *  scenario, which the bare fixture doesn't have). */
function floorCorridor(room: unknown, length: number): void {
  const tiles = Array.from({ length }, (_, q) => ({ q, r: 0, kind: 'floor' as const }));
  (room as { scenarioTiles: () => unknown }).scenarioTiles = () => tiles;
}

/** Engage the top slot with a single Move action of the given budget. */
function engageMove(room: unknown, amount: number): void {
  const ct = (room as { currentTurn: { topSlot: unknown; bottomSlot: { status: string } } })
    .currentTurn;
  ct.topSlot = {
    status: 'engaged',
    cardId: null,
    useBasic: true,
    performedCount: 0,
    actions: [{ id: 'm1', type: 'move', amount, done: false }],
  };
  // Leave the other slot done so the turn doesn't try to auto-advance halves.
  ct.bottomSlot.status = 'done';
}

function moveAction(room: unknown): { amount: number; done: boolean } {
  return (
    room as { currentTurn: { topSlot: { actions: { amount: number; done: boolean }[] } } }
  ).currentTurn.topSlot.actions[0]!;
}

describe('partial movement — leftover budget survives a confirm', () => {
  it('keeps the move pending with reduced budget after a partial confirm', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorCorridor(fx.room, 8);
    engageMove(fx.room, 5);

    // Walk 3 of 5 hexes east.
    const path1: Hex[] = [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ];
    const res1 = fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: path1[path1.length - 1],
      path: path1,
    });
    assert.ok(res1.ok, JSON.stringify(res1));

    const action = moveAction(fx.room);
    assert.equal(action.done, false, 'move should stay pending with budget left');
    assert.equal(action.amount, 2, 'remaining budget should drop from 5 to 2');
    assert.deepEqual(fx.unit.hex, { q: 3, r: 0 }, 'unit should sit at the partial destination');
  });

  it('marks the move done once the full budget is spent', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorCorridor(fx.room, 8);
    engageMove(fx.room, 5);

    // First confirm: 3 hexes.
    fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ],
    });
    // Second confirm: the remaining 2 hexes.
    const res2 = fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 5, r: 0 },
      path: [
        { q: 4, r: 0 },
        { q: 5, r: 0 },
      ],
    });
    assert.ok(res2.ok, JSON.stringify(res2));

    const action = moveAction(fx.room);
    assert.equal(action.done, true, 'move should complete when the budget is exhausted');
    assert.deepEqual(fx.unit.hex, { q: 5, r: 0 });
  });

  it('rejects a second move that exceeds the leftover budget', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorCorridor(fx.room, 8);
    engageMove(fx.room, 5);

    fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ],
    });
    // Only 2 movement remains — a 3-hex path must be refused.
    const res = fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 6, r: 0 },
      path: [
        { q: 4, r: 0 },
        { q: 5, r: 0 },
        { q: 6, r: 0 },
      ],
    });
    assert.equal(res.ok, false);
    assert.equal(moveAction(fx.room).done, false, 'a rejected over-budget move leaves it pending');
  });
});
