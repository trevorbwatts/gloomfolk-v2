import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { smokeBomb, flankingStrike, swiftBow } from '@gloomfolk/shared/cards';
import type { ActiveEffect } from '@gloomfolk/shared';

import { addMonster, makeFixture, startTurn, type Fixture, type PlayerEntry } from './helpers.js';

/** Smoke Bomb's active bonus: double your next attack, but only while Invisible. */
function addInvisibleDouble(player: PlayerEntry): void {
  player.activeEffects.push({
    id: 'e-smoke',
    sourceCardId: smokeBomb.id,
    kind: 'attack-bonus',
    amount: 0,
    requiresInvisible: true,
    doubleAttack: true,
    pierceBonus: 0,
    expires: 'end-scenario',
  } as ActiveEffect);
}

/** Engage Flanking Strike's top (clean melee Attack 3, deterministic +0) and
 *  return its attack action — a plain attack to carry the doubling. */
function engageMeleeAttack(fx: Fixture) {
  fx.player.modifierDeck = [
    { id: 'm-0a', card: { kind: 'flat', amount: 0 } },
    { id: 'm-0b', card: { kind: 'flat', amount: 0 } },
  ];
  startTurn(fx.room, fx, { leading: flankingStrike, second: swiftBow });
  const engage = fx.room.engageHalf(fx.player.playerId, 'top', flankingStrike.id, false);
  assert.deepEqual(engage, { ok: true });
  const ct = (fx.room as unknown as {
    currentTurn: { topSlot: { actions: { id: string; type: string }[] } };
  }).currentTurn;
  const attack = ct.topSlot.actions.find((a) => a.type === 'attack');
  assert.ok(attack, 'expected an attack action');
  return attack;
}

describe('Smoke Bomb — doubling is gated on being Invisible', () => {
  it('engaging the top arms a doubleAttack bonus flagged requiresInvisible', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    startTurn(fx.room, fx, { leading: smokeBomb, second: swiftBow });
    const engage = fx.room.engageHalf(fx.player.playerId, 'top', smokeBomb.id, false);
    assert.deepEqual(engage, { ok: true });
    const ct = (fx.room as unknown as {
      currentTurn: { topSlot: { actions: { id: string; type: string }[] } };
    }).currentTurn;
    const mfa = ct.topSlot.actions.find((a) => a.type === 'modify-future-attack');
    assert.ok(mfa, 'expected a modify-future-attack action');
    const res = fx.room.performAction(fx.player.playerId, 'top', mfa.id, undefined);
    assert.deepEqual(res, { ok: true }, JSON.stringify(res));
    const bonus = fx.player.activeEffects.find((e) => e.kind === 'attack-bonus');
    assert.ok(bonus && bonus.kind === 'attack-bonus');
    assert.equal(bonus.doubleAttack, true, 'doubles the attack');
    assert.equal(bonus.requiresInvisible, true, 'gated on Invisible');
  });

  it('doubles the attack while Invisible', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addInvisibleDouble(fx.player);
    fx.unit.invisible = true;
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 20 });
    const attack = engageMeleeAttack(fx);

    fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    // Attack 3 doubled → 6 dealt.
    assert.equal(monster.hp, 14, 'attack value is doubled while Invisible');
  });

  it('does NOT double while not Invisible, and keeps the bonus armed', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addInvisibleDouble(fx.player);
    fx.unit.invisible = false;
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 20 });
    const attack = engageMeleeAttack(fx);

    fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    // Plain Attack 3 — no doubling.
    assert.equal(monster.hp, 17, 'no doubling without Invisible');
    assert.equal(
      fx.player.activeEffects.filter((e) => e.kind === 'attack-bonus').length,
      1,
      'the bonus is left armed for an attack made while Invisible',
    );
  });
});
