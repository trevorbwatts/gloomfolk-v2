import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Hex } from '@gloomfolk/shared';
import { trample, skewer } from '@gloomfolk/shared';

import { makeFixture, startTurn } from './helpers.js';

/** Lay down an east-west floor corridor with traps on the given hexes. The stub
 *  honors the room's private `sprungTraps` set, so a sprung/destroyed trap
 *  reverts to floor exactly like the real `scenarioTiles`. */
function floorWithTraps(room: unknown, length: number, traps: Hex[]): void {
  const trapKeys = new Set(traps.map((h) => `${h.q},${h.r}`));
  const r = room as { sprungTraps?: Set<string>; scenarioTiles: () => unknown };
  r.scenarioTiles = () =>
    Array.from({ length }, (_, q) => {
      const key = `${q},0`;
      const live = trapKeys.has(key) && !(r.sprungTraps && r.sprungTraps.has(key));
      return { q, r: 0, kind: live ? ('trap' as const) : ('floor' as const) };
    });
}

type TestAction = Record<string, unknown> & { id: string; type: string; done: boolean };

/** Engage the top slot with the given actions; leave the bottom slot done so the
 *  turn doesn't auto-finish/advance between performs. */
function engageActions(room: unknown, actions: TestAction[]): void {
  const ct = (room as { currentTurn: { topSlot: unknown; bottomSlot: { status: string } } })
    .currentTurn;
  ct.topSlot = { status: 'engaged', cardId: null, useBasic: true, performedCount: 0, actions };
  ct.bottomSlot.status = 'done';
}

const pendingTrapChoice = (room: unknown) =>
  (room as { pendingTrapChoice: { id: string; hex: Hex } | null }).pendingTrapChoice;
const isTrap = (room: unknown, hex: Hex) =>
  (room as { isTrapHex: (h: Hex) => boolean }).isTrapHex(hex);
const enteredTraps = (room: unknown) =>
  (room as { currentTurn: { trapHexesEnteredThisMove: Hex[] } }).currentTurn.trapHexesEnteredThisMove;

describe('traps — spring, bypass, and destroy', () => {
  it('auto-springs an entered trap on a move that cannot bypass', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorWithTraps(fx.room, 6, [{ q: 2, r: 0 }]);
    engageActions(fx.room, [{ id: 'm1', type: 'move', amount: 3, done: false }]);

    const res = fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    });
    assert.ok(res.ok, JSON.stringify(res));
    assert.equal(pendingTrapChoice(fx.room), null, 'no prompt without mayBypassTraps');
    assert.equal(fx.unit.hp, 8, 'trap deals 2 damage at scenario level 0');
    assert.equal(isTrap(fx.room, { q: 2, r: 0 }), false, 'trap is removed after springing');
  });

  it('prompts per trap on a bypass-capable move; springing deals damage + removes it', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorWithTraps(fx.room, 6, [{ q: 2, r: 0 }]);
    engageActions(fx.room, [
      { id: 'm1', type: 'move', amount: 3, mayBypassTraps: true, done: false },
    ]);

    const res = fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    });
    assert.ok(res.ok, JSON.stringify(res));
    const choice = pendingTrapChoice(fx.room);
    assert.ok(choice, 'a bypass-capable move prompts on the trap hex');
    assert.deepEqual(choice!.hex, { q: 2, r: 0 });
    assert.equal(fx.unit.hp, 10, 'no damage until the player decides');

    const r2 = fx.room.resolveTrapChoice(fx.player.playerId, choice!.id, /*spring*/ true);
    assert.ok(r2.ok, JSON.stringify(r2));
    assert.equal(pendingTrapChoice(fx.room), null, 'prompt clears after resolving');
    assert.equal(fx.unit.hp, 8, 'springing deals 2 damage');
    assert.equal(isTrap(fx.room, { q: 2, r: 0 }), false, 'sprung trap removed');
  });

  it('bypassing leaves the trap and makes the hex destroy-eligible; destroy grants XP', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorWithTraps(fx.room, 6, [{ q: 2, r: 0 }]);
    engageActions(fx.room, [
      { id: 'm1', type: 'move', amount: 3, mayBypassTraps: true, done: false },
      { id: 'd1', type: 'destroy-trap', gainExp: 1, eligibleHexes: [], done: false },
    ]);

    fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    });
    const choice = pendingTrapChoice(fx.room)!;
    fx.room.resolveTrapChoice(fx.player.playerId, choice.id, /*spring*/ false);

    assert.equal(fx.unit.hp, 10, 'bypassing deals no damage');
    assert.equal(isTrap(fx.room, { q: 2, r: 0 }), true, 'bypassed trap stays on the board');
    assert.deepEqual(enteredTraps(fx.room), [{ q: 2, r: 0 }], 'hex is recorded as destroy-eligible');

    const xpBefore = fx.character.xp;
    const res = fx.room.performAction(fx.player.playerId, 'top', 'd1', { hex: { q: 2, r: 0 } });
    assert.ok(res.ok, JSON.stringify(res));
    assert.equal(isTrap(fx.room, { q: 2, r: 0 }), false, 'destroyed trap removed');
    assert.equal(fx.character.xp, xpBefore + 1, 'destroying the trap grants its XP');
  });

  it('rejects destroying a trap the actor did not enter this move', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: trample, second: skewer });
    floorWithTraps(fx.room, 6, [{ q: 2, r: 0 }, { q: 4, r: 0 }]);
    engageActions(fx.room, [
      { id: 'm1', type: 'move', amount: 3, mayBypassTraps: true, done: false },
      { id: 'd1', type: 'destroy-trap', gainExp: 1, eligibleHexes: [], done: false },
    ]);

    fx.room.performAction(fx.player.playerId, 'top', 'm1', {
      hex: { q: 3, r: 0 },
      path: [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }],
    });
    fx.room.resolveTrapChoice(fx.player.playerId, pendingTrapChoice(fx.room)!.id, false);

    // (4,0) was never entered — not eligible.
    const res = fx.room.performAction(fx.player.playerId, 'top', 'd1', { hex: { q: 4, r: 0 } });
    assert.equal(res.ok, false, 'cannot destroy a trap outside the entered set');
    assert.equal(isTrap(fx.room, { q: 4, r: 0 }), true, 'untouched trap remains');
  });
});
