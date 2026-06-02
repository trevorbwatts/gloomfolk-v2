import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trickstersReversal, swiftBow } from '@gloomfolk/shared/cards';

import {
  addMonster,
  advanceToNextRound,
  makeFixture,
  resolveMonsterAttack,
  startTurn,
  type Fixture,
} from './helpers.js';

/** Engage Trickster's Reversal bottom (persistent-round: negate next damage)
 *  and perform its action, arming the negate. Returns the active-effect list. */
function armNegate(fx: Fixture) {
  startTurn(fx.room, fx, { leading: swiftBow, second: trickstersReversal });
  const engage = fx.room.engageHalf(fx.player.playerId, 'bottom', trickstersReversal.id, false);
  assert.deepEqual(engage, { ok: true }, JSON.stringify(engage));
  const ct = (fx.room as unknown as {
    currentTurn: { bottomSlot: { actions: { id: string; type: string }[] } };
  }).currentTurn;
  const action = ct.bottomSlot.actions.find((a) => a.type === 'negate-damage');
  assert.ok(action, 'expected a negate-damage action');
  const res = fx.room.performAction(fx.player.playerId, 'bottom', action.id, undefined);
  assert.deepEqual(res, { ok: true }, JSON.stringify(res));
}

describe("Trickster's Reversal — negate the next damage this round", () => {
  it('arms a round-scoped negate effect when performed', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    armNegate(fx);
    const negates = fx.player.activeEffects.filter((e) => e.kind === 'negate-next-damage');
    assert.equal(negates.length, 1, 'one negate effect armed');
    assert.equal(negates[0]!.expires, 'end-round', 'scoped to this round');
  });

  it('negates the next source of damage, then lets the following one through', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    armNegate(fx);
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 } });

    resolveMonsterAttack(fx.room, monster, fx.unit, 4);
    assert.equal(fx.unit.hp, 10, 'first hit is negated');
    assert.equal(
      fx.player.activeEffects.filter((e) => e.kind === 'negate-next-damage').length,
      0,
      'the negate is spent',
    );

    resolveMonsterAttack(fx.room, monster, fx.unit, 4);
    assert.equal(fx.unit.hp, 6, 'the next hit lands normally');
  });

  it('expires unused at the end of the round', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    armNegate(fx);
    advanceToNextRound(fx.room);
    assert.equal(
      fx.player.activeEffects.filter((e) => e.kind === 'negate-next-damage').length,
      0,
      'an unused round-scoped negate is cleared at round end',
    );
  });
});
