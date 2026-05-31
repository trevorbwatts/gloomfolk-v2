import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { singleOut, backstab } from '@gloomfolk/shared/cards';
import type { ActiveEffect } from '@gloomfolk/shared';

import { consumeAttackBonus } from '../src/room.js';
import { addMonster, makeFixture, startTurn, type PlayerEntry, type Fixture } from './helpers.js';

/** Engage Single Out's top (Attack 3; +2 Attack & +1 XP vs an isolated target)
 *  with a deterministic +0 modifier, and return its attack action. */
function engageSingleOutTop(fx: Fixture) {
  fx.player.modifierDeck = [
    { id: 'm-0a', card: { kind: 'flat', amount: 0 } },
    { id: 'm-0b', card: { kind: 'flat', amount: 0 } },
  ];
  startTurn(fx.room, fx, { leading: singleOut, second: backstab });
  const engage = fx.room.engageHalf(fx.player.playerId, 'top', singleOut.id, false);
  assert.deepEqual(engage, { ok: true });
  const ct = (fx.room as unknown as { currentTurn: { topSlot: { actions: any[] } } }).currentTurn;
  const attack = ct.topSlot.actions.find((a) => a.type === 'attack');
  assert.ok(attack, 'expected an attack action');
  return attack;
}

describe('Single Out — card data carries the isolated bonus', () => {
  it('top attack declares +2 Attack and +1 XP vs an isolated target', () => {
    const step = singleOut.top.abilities[0]?.steps.find((s) => s.type === 'attack');
    assert.ok(step && step.type === 'attack');
    const bonus = step.modifiers?.targetConditionalBonuses?.[0];
    assert.ok(bonus);
    assert.deepEqual(bonus.condition, { kind: 'target-isolated-from-allies' });
    assert.equal(bonus.attackBonus, 2);
    assert.equal(bonus.gainExp, 1);
  });
});

describe('targetConditionalBonuses — resolved per target at attack time', () => {
  it('adds +2 damage and grants +1 XP when the target is isolated', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 10 });
    const attack = engageSingleOutTop(fx);

    const result = fx.room.performAction(fx.player.playerId, 'top', attack.id, {
      unitId: monster.id,
    });
    assert.deepEqual(result, { ok: true });
    // Attack 3 + 2 (isolated) with a +0 modifier → 5 damage.
    assert.equal(monster.hp, 5, 'isolated target takes the +2 bonus');
    assert.equal(fx.character.xp, 1, 'isolated bonus grants +1 XP');
  });

  it('does NOT add the bonus when another enemy sits adjacent to the target', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 10 });
    // A second monster adjacent to the target breaks its isolation.
    addMonster(fx.room, { id: 'm2', hex: { q: 2, r: 0 }, hp: 10 });
    const attack = engageSingleOutTop(fx);

    const result = fx.room.performAction(fx.player.playerId, 'top', attack.id, {
      unitId: monster.id,
    });
    assert.deepEqual(result, { ok: true });
    // Attack 3, no bonus → 7 left.
    assert.equal(monster.hp, 7, 'non-isolated target takes only the base attack');
    assert.equal(fx.character.xp, 0, 'no conditional XP for a non-isolated target');
  });
});

describe('persistent target-gated attack bonus (Single Out bottom: +3 vs isolated)', () => {
  function addIsolatedBonus(player: PlayerEntry): void {
    player.activeEffects.push({
      id: 'e-iso',
      sourceCardId: singleOut.id,
      kind: 'attack-bonus',
      amount: 3,
      pierceBonus: 0,
      expires: 'end-scenario',
      targetCondition: { kind: 'target-isolated-from-allies' },
    } as ActiveEffect);
  }

  it('applies the +3 on top of the card bonus against an isolated target', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addIsolatedBonus(fx.player);
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 12 });
    const attack = engageSingleOutTop(fx);

    fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    // 3 (base) + 2 (card, isolated) + 3 (persistent, isolated) = 8 → 4 left.
    assert.equal(monster.hp, 4);
  });

  it('does not apply the +3 against a non-isolated target', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addIsolatedBonus(fx.player);
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 12 });
    addMonster(fx.room, { id: 'm2', hex: { q: 2, r: 0 }, hp: 12 });
    const attack = engageSingleOutTop(fx);

    fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    // Neither bonus matches → 3 damage → 9 left.
    assert.equal(monster.hp, 9);
  });

  it('a target-gated bonus is never applied or consumed by consumeAttackBonus', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addIsolatedBonus(fx.player);
    const before = fx.player.activeEffects.length;
    const { amount } = consumeAttackBonus(
      fx.player as unknown as Parameters<typeof consumeAttackBonus>[0],
      'melee',
    );
    assert.equal(amount, 0, 'target-gated bonus is not folded into the unconditional total');
    assert.equal(fx.player.activeEffects.length, before, 'and it is kept, not consumed');
  });
});
