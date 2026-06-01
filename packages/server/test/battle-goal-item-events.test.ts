import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { BattleGoalEvent } from '@gloomfolk/shared';
import { trample, skewer } from '@gloomfolk/shared';

import { Room } from '../src/room.js';
import { addMonster, makeFixture, startTurn } from './helpers.js';

/** Enable battle-goal logging — emitBG no-ops while no hands are dealt. */
function enableBattleGoals(room: Room, characterId: string): void {
  (
    room as unknown as { battleGoalHands: Map<string, unknown> }
  ).battleGoalHands.set(characterId, { dealtGoalIds: [], chosenGoalId: null });
}

function bgLog(room: Room): BattleGoalEvent[] {
  return (room as unknown as { battleGoalLog: BattleGoalEvent[] }).battleGoalLog;
}

describe('battle goals — item_used emission (Prohibitionist)', () => {
  it('a successful potion use emits item_used with isPotion true', () => {
    const fx = makeFixture();
    enableBattleGoals(fx.room, fx.character.id);
    fx.character.broughtItemIds = ['element-potion'];
    startTurn(fx.room, fx, { leading: trample, second: skewer });

    const res = fx.room.useItem(fx.player.playerId, 'element-potion', undefined, undefined);
    assert.ok(res.ok, JSON.stringify(res));

    const ev = bgLog(fx.room).find(
      (e): e is Extract<BattleGoalEvent, { kind: 'item_used' }> => e.kind === 'item_used',
    );
    assert.ok(ev, 'expected an item_used event');
    assert.equal(ev.itemId, 'element-potion');
    assert.equal(ev.isPotion, true);
    assert.equal(ev.characterId, fx.character.id);
  });

  it('a non-potion item use emits item_used with isPotion false', () => {
    const fx = makeFixture();
    enableBattleGoals(fx.room, fx.character.id);
    fx.character.broughtItemIds = ['winged-shoes']; // jump-this-turn, not a potion
    startTurn(fx.room, fx, { leading: trample, second: skewer });

    const res = fx.room.useItem(fx.player.playerId, 'winged-shoes', undefined, undefined);
    assert.ok(res.ok, JSON.stringify(res));

    const ev = bgLog(fx.room).find(
      (e): e is Extract<BattleGoalEvent, { kind: 'item_used' }> => e.kind === 'item_used',
    );
    assert.ok(ev);
    assert.equal(ev.isPotion, false);
  });

  it('a rejected use emits no item_used (Healing Potion at full HP)', () => {
    const fx = makeFixture();
    enableBattleGoals(fx.room, fx.character.id);
    fx.character.broughtItemIds = ['healing-potion'];
    fx.unit.hp = fx.unit.hpMax; // full → rejected, no effect
    startTurn(fx.room, fx, { leading: trample, second: skewer });

    const res = fx.room.useItem(fx.player.playerId, 'healing-potion', undefined, undefined);
    assert.ok(!res.ok, 'use should be rejected at full HP');
    assert.ok(
      !bgLog(fx.room).some((e) => e.kind === 'item_used'),
      'no item_used event on a rejected use',
    );
  });
});

describe('battle goals — Poison Dagger emits condition_applied (Tormentor)', () => {
  it('poisoning an already-conditioned enemy emits condition_applied with prior conditions', () => {
    const fx = makeFixture();
    enableBattleGoals(fx.room, fx.character.id);
    // A single +0 card so the attack lands (non-Null → poison applies).
    fx.player.modifierDeck = [{ id: 'm1', card: { kind: 'flat', amount: 0 } }];

    const mon = addMonster(fx.room, { id: 'mon', hex: { q: 1, r: 0 }, hp: 10 });
    mon.conditions = [{ kind: 'muddle', appliedThisTurn: false }];

    startTurn(fx.room, fx, { leading: trample, second: skewer });

    const ct = (
      fx.room as unknown as {
        currentTurn: {
          topSlot: unknown;
          bottomSlot: { status: string };
          poisonCharge: boolean;
        };
      }
    ).currentTurn;
    ct.topSlot = {
      status: 'engaged',
      cardId: null,
      useBasic: true,
      performedCount: 0,
      actions: [
        {
          id: 'a1',
          type: 'attack',
          amount: 3,
          range: 1,
          pierce: 0,
          targets: 1,
          targetsRemaining: 1,
          hitsLanded: 0,
          hitTargetIds: [],
          consumeOffers: [],
          acceptedConsumeIndices: [],
          lockedRiderAttack: 0,
          lockedRiderPierce: 0,
          consumesLocked: true,
          done: false,
        },
      ],
    };
    // Skip the auto-finishHalf path: leave the other slot already done.
    ct.bottomSlot.status = 'done';
    ct.poisonCharge = true;

    const res = fx.room.performAction(fx.player.playerId, 'top', 'a1', { unitId: 'mon' });
    assert.ok(res.ok, JSON.stringify(res));

    const ev = bgLog(fx.room).find(
      (e): e is Extract<BattleGoalEvent, { kind: 'condition_applied' }> =>
        e.kind === 'condition_applied' && e.condition === 'poison',
    );
    assert.ok(ev, 'expected a condition_applied event for poison');
    assert.equal(ev.byCharacterId, fx.character.id);
    assert.equal(ev.targetIsEnemy, true);
    assert.deepEqual([...ev.targetPriorNegativeConditions], ['muddle']);
  });
});
