import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { smokeBomb } from '@gloomfolk/shared/cards';
import type { ActiveEffect } from '@gloomfolk/shared';

import { consumeAttackBonus } from '../src/room.js';
import { attachTracked, fireTrigger, makeFixture, type PlayerEntry } from './helpers.js';

/** consumeAttackBonus uses the unexported PlayerEntry type. The test's
 *  PlayerEntry is structurally compatible for the fields the function reads
 *  (activeEffects only), so we cast through unknown. */
function consume(p: PlayerEntry, kind: 'melee' | 'ranged') {
  return consumeAttackBonus(p as unknown as Parameters<typeof consumeAttackBonus>[0], kind);
}

describe('modify-future-attack.doubleAttack — Smoke Bomb card data', () => {
  it('top has a non-oneShot ability with doubleAttack on its modify-future-attack step', () => {
    const nonOneShot = smokeBomb.top.abilities.find((a) => !a.oneShot);
    assert.ok(nonOneShot, 'expected at least one non-oneShot ability');
    const mfa = nonOneShot.steps.find((s) => s.type === 'modify-future-attack');
    assert.ok(mfa, 'expected a modify-future-attack step');
    if (mfa.type !== 'modify-future-attack') throw new Error('unreachable');
    assert.equal(mfa.doubleAttack, true);
    assert.equal(mfa.appliesTo, 'while-persistent-active');
  });
});

describe('consumeAttackBonus — doubleAttack reporting', () => {
  function makePlayer(effects: ActiveEffect[]): PlayerEntry {
    return {
      playerId: 'p',
      name: 'p',
      activeCharacterId: 'c',
      socket: null,
      hand: [],
      discard: [],
      lost: [],
      active: [],
      activeTracked: [],
      activeEffects: effects,
      pendingRetaliateXp: [],
      selection: null,
      modifierDeck: [],
      modifierDiscard: [],
      modifierNeedsReshuffle: false,
      shortRestPending: null,
    };
  }

  it('returns double=false when no doubling effects are active', () => {
    const p = makePlayer([
      {
        id: 'e1',
        sourceCardId: 'x',
        kind: 'attack-bonus',
        amount: 2,
        pierceBonus: 0,
        expires: 'end-round',
      },
    ]);
    const { amount, pierce, double } = consume(p, 'melee');
    assert.equal(amount, 2);
    assert.equal(pierce, 0);
    assert.equal(double, false);
  });

  it('returns double=true when any matching effect has doubleAttack', () => {
    const p = makePlayer([
      {
        id: 'e1',
        sourceCardId: 'smoke-bomb',
        kind: 'attack-bonus',
        amount: 0,
        pierceBonus: 0,
        doubleAttack: true,
        expires: 'end-scenario',
      },
    ]);
    const { double } = consume(p, 'melee');
    assert.equal(double, true);
  });

  it('does NOT report doubling when the effect filters by attackKind and the kinds differ', () => {
    const p = makePlayer([
      {
        id: 'e1',
        sourceCardId: 'x',
        kind: 'attack-bonus',
        amount: 0,
        pierceBonus: 0,
        doubleAttack: true,
        attackKind: 'ranged',
        expires: 'end-scenario',
      },
    ]);
    const { double } = consume(p, 'melee');
    assert.equal(double, false, 'ranged-only doubling does not double a melee attack');
  });

  it('does NOT consume a sticky doubling effect (only next-attack expires get filtered)', () => {
    const p = makePlayer([
      {
        id: 'e1',
        sourceCardId: 'smoke-bomb',
        kind: 'attack-bonus',
        amount: 0,
        pierceBonus: 0,
        doubleAttack: true,
        expires: 'end-scenario',
      },
    ]);
    consume(p, 'melee');
    assert.equal(p.activeEffects.length, 1, 'sticky effect survives one attack');
    const { double } = consume(p, 'melee');
    assert.equal(double, true, 'still doubles on the next attack');
  });

  it('multiple doubling effects do not multi-double — OR semantics', () => {
    const p = makePlayer([
      {
        id: 'e1',
        sourceCardId: 'a',
        kind: 'attack-bonus',
        amount: 0,
        pierceBonus: 0,
        doubleAttack: true,
        expires: 'end-scenario',
      },
      {
        id: 'e2',
        sourceCardId: 'b',
        kind: 'attack-bonus',
        amount: 0,
        pierceBonus: 0,
        doubleAttack: true,
        expires: 'end-scenario',
      },
    ]);
    const { double } = consume(p, 'melee');
    // The contract is: double is a boolean. Two flags both true → still true,
    // not "double-double". Caller multiplies the printed value by 2 (once).
    assert.equal(double, true);
  });
});

describe('doubling effect lifecycle via Smoke Bomb expiry', () => {
  it('an attack-bonus ActiveEffect with doubleAttack is cleared when its source tracked card expires', () => {
    const { room, player } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, smokeBomb, 'top');

    // Simulate the activeEffect that performAction creates when Smoke Bomb's
    // modify-future-attack step engages (the new doubleAttack flag is now
    // threaded through).
    player.activeEffects.push({
      id: 'e-double',
      sourceCardId: smokeBomb.id,
      kind: 'attack-bonus',
      amount: 0,
      pierceBonus: 0,
      doubleAttack: true,
      expires: 'end-scenario',
    });

    fireTrigger(room, player, 'attack-while-invisible');

    assert.equal(player.activeTracked.length, 0);
    assert.equal(player.lost.length, 1);
    assert.equal(
      player.activeEffects.filter((e) => e.sourceCardId === smokeBomb.id).length,
      0,
      'doubling effect cleared when its tracked card expires',
    );
  });
});
