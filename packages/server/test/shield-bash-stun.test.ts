import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shieldBash, trample } from '@gloomfolk/shared/cards';
import type { Unit } from '@gloomfolk/shared';

import { addMonster, makeFixture, startTurn } from './helpers.js';

function hasStun(unit: Unit): boolean {
  return unit.conditions.some((c) => c.kind === 'stun');
}

/**
 * Shield Bash's top is "Attack 4" with a Stun printed below it and no target of
 * its own — per the rules the Stun is mandatory and lands on whatever the
 * attack hits. The engine must NOT prompt for a second target: the condition
 * rides on the attack and auto-applies to the struck enemy.
 */
describe('Shield Bash — Stun rides on the attack', () => {
  function engagedTop(fx: ReturnType<typeof makeFixture>) {
    // Deterministic +0 modifier so the attack never misses.
    fx.player.modifierDeck = [{ id: 'm-0', card: { kind: 'flat', amount: 0 } }];
    fx.player.hand = [shieldBash, trample];
    startTurn(fx.room, fx, { leading: shieldBash, second: trample });

    const engage = fx.room.engageHalf(fx.player.playerId, 'top', shieldBash.id, false);
    assert.deepEqual(engage, { ok: true });

    const ct = (fx.room as unknown as { currentTurn: { topSlot: { actions: any[] } } })
      .currentTurn;
    return ct.topSlot.actions;
  }

  it('does not emit a standalone apply-condition action', () => {
    const fx = makeFixture();
    const actions = engagedTop(fx);
    assert.equal(
      actions.some((a) => a.type === 'apply-condition'),
      false,
      'the Stun should not be its own targeted action',
    );
  });

  it('attaches the Stun to the attack action as a rider', () => {
    const fx = makeFixture();
    const actions = engagedTop(fx);
    const attack = actions.find((a) => a.type === 'attack');
    assert.ok(attack, 'expected an attack action');
    assert.deepEqual(attack.riderConditions, ['stun']);
  });

  it('Stuns the enemy that the attack hits, with no extra targeting step', () => {
    const fx = makeFixture();
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 5 });
    const actions = engagedTop(fx);
    const attack = actions.find((a) => a.type === 'attack');
    assert.ok(attack);

    const result = fx.room.performAction(fx.player.playerId, 'top', attack.id, {
      unitId: monster.id,
    });
    assert.deepEqual(result, { ok: true });

    assert.ok(hasStun(monster), 'the struck enemy is Stunned');
    assert.ok(attack.done, 'a single-target attack is finished after its one target');
  });

  it('does not Stun when the attack misses (Null modifier)', () => {
    const fx = makeFixture();
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 5 });
    fx.player.hand = [shieldBash, trample];
    startTurn(fx.room, fx, { leading: shieldBash, second: trample });
    // Force a miss.
    fx.player.modifierDeck = [{ id: 'm-null', card: { kind: 'null' } }];

    fx.room.engageHalf(fx.player.playerId, 'top', shieldBash.id, false);
    const ct = (fx.room as unknown as { currentTurn: { topSlot: { actions: any[] } } })
      .currentTurn;
    const attack = ct.topSlot.actions.find((a) => a.type === 'attack');
    assert.ok(attack);

    fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    assert.equal(hasStun(monster), false, 'a missed attack applies no rider condition');
  });
});
