import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { spareDagger } from '../../src/cards/bruiser/spare-dagger.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Spare Dagger (Bruiser, Lvl 1)', () => {
  it('has identity: Spare Dagger / Lvl 1 / Initiative 27', () => {
    assert.equal(spareDagger.id, 'bruiser.spare-dagger');
    assert.equal(spareDagger.name, 'Spare Dagger');
    assert.equal(spareDagger.level, 1);
    assert.equal(spareDagger.initiative, 27);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(spareDagger.top.disposition, 'discard');
      assert.equal(spareDagger.top.abilities.length, 1);
    });

    it('section 1: Attack 3 at range 3', () => {
      const section = must(spareDagger.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, { kind: 'ranged', range: 3 });
      assert.equal(attack.modifiers, undefined);
      assert.equal(attack.node, undefined);
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(spareDagger.bottom.disposition, 'discard');
      assert.equal(spareDagger.bottom.abilities.length, 1);
    });

    it('section 1: melee Attack 2 (diamond) with Pierce 1 (square)', () => {
      const section = must(spareDagger.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 2);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, 'diamond');
      assert.deepEqual(attack.modifiers?.pierce, { amount: 1, node: 'square' });
    });
  });
});
