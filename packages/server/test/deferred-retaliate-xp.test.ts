import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { eyeForAnEye } from '@gloomfolk/shared/cards';

import {
  addMonster,
  advanceToNextRound,
  awardHalfXp,
  makeFixture,
  resolveMonsterAttack,
} from './helpers.js';

/**
 * `on-next-retaliate-this-round` XP riders (Eye for an Eye, Provoking Roar).
 * Performing the half queues deferred XP; the next retaliate this round grants
 * it, then the queue is cleared. Unfired riders expire at end of round.
 */
describe('deferred retaliate XP (on-next-retaliate-this-round)', () => {
  function grantRetaliate(player: { activeEffects: unknown[] }, amount: number, range: number) {
    player.activeEffects.push({
      id: 'e-ret',
      sourceCardId: eyeForAnEye.id,
      kind: 'retaliate',
      amount,
      range,
      expires: 'end-round',
    });
  }

  it("Eye for an Eye's top queues the rider rather than granting XP immediately", () => {
    const { room, player, character } = makeFixture();

    awardHalfXp(room, player, eyeForAnEye, 'top');

    assert.equal(character.xp, 0, 'no immediate XP');
    assert.deepEqual(player.pendingRetaliateXp, [{ amount: 1, label: 'Eye for an Eye' }]);
  });

  it('grants the queued XP the next time the player retaliates this round', () => {
    const { room, player, character, unit } = makeFixture();
    grantRetaliate(player, 1, 1);
    awardHalfXp(room, player, eyeForAnEye, 'top');

    // Monster steps adjacent and attacks → retaliate fires.
    const m = addMonster(room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 5 });
    resolveMonsterAttack(room, m, unit, 2);

    assert.equal(character.xp, 1, 'deferred XP granted on retaliate');
    assert.deepEqual(player.pendingRetaliateXp, [], 'queue cleared');
  });

  it('grants only once — a second retaliate the same round adds no more XP', () => {
    const { room, player, character, unit } = makeFixture();
    grantRetaliate(player, 1, 1);
    awardHalfXp(room, player, eyeForAnEye, 'top');

    const m1 = addMonster(room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 5 });
    resolveMonsterAttack(room, m1, unit, 2);
    const m2 = addMonster(room, { id: 'm2', hex: { q: -1, r: 0 }, hp: 5 });
    resolveMonsterAttack(room, m2, unit, 2);

    assert.equal(character.xp, 1, 'rider consumed by the first retaliate only');
  });

  it('does not grant if the retaliate is out of range (never fires)', () => {
    const { room, player, character, unit } = makeFixture();
    grantRetaliate(player, 1, 1); // range 1
    awardHalfXp(room, player, eyeForAnEye, 'top');

    // Monster attacks from range 2 — retaliate (range 1) does not reach it.
    const m = addMonster(room, { id: 'm1', hex: { q: 2, r: 0 }, hp: 5 });
    resolveMonsterAttack(room, m, unit, 2);

    assert.equal(character.xp, 0, 'no retaliate, so no deferred XP');
    assert.deepEqual(player.pendingRetaliateXp, [{ amount: 1, label: 'Eye for an Eye' }]);
  });

  it('expires the queued rider at end of round if no retaliate occurred', () => {
    const { room, player, character } = makeFixture();
    awardHalfXp(room, player, eyeForAnEye, 'top');
    assert.equal(player.pendingRetaliateXp.length, 1);

    advanceToNextRound(room);

    assert.equal(character.xp, 0, 'no XP — rider expired unfired');
    assert.deepEqual(player.pendingRetaliateXp, [], 'queue cleared at round end');
  });
});
