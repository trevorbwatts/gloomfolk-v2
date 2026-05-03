import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { skewer } from '../../src/cards/bruiser/skewer.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Skewer (Bruiser, Lvl 1)', () => {
  it('has identity: Skewer / Lvl 1 / Initiative 35', () => {
    assert.equal(skewer.id, 'bruiser.skewer');
    assert.equal(skewer.name, 'Skewer');
    assert.equal(skewer.level, 1);
    assert.equal(skewer.initiative, 35);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(skewer.top.disposition, 'discard');
      assert.equal(skewer.top.abilities.length, 1);
      assert.equal(skewer.top.expOnPerform, undefined);
    });

    it('section 1: AOE Attack 3 along a 2-hex line, with Air element rider', () => {
      const section = must(skewer.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, {
        kind: 'aoe',
        pattern: [
          { q: 0, r: -1 },
          { q: 0, r: -2 },
        ],
      });

      const riders = attack.modifiers?.elementRiders;
      assert.ok(riders && riders.length === 1);
      const rider = must(riders[0], 'wind rider');
      assert.equal(rider.consume, 'air');
      assert.equal(rider.attackBonus, 1);
      assert.deepEqual(rider.pierce, { amount: 1 });
      assert.equal(rider.gainExp, 1);
    });
  });

  describe('bottom half', () => {
    it('is a single-section lost half awarding 2 EXP on perform', () => {
      assert.equal(skewer.bottom.disposition, 'lost');
      assert.equal(skewer.bottom.expOnPerform, 2);
      assert.equal(skewer.bottom.abilities.length, 1);
    });

    it('section 1: Move 7', () => {
      const section = must(skewer.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 7);
      assert.equal(move.traits, undefined);
      assert.equal(move.node, undefined);
    });
  });
});
