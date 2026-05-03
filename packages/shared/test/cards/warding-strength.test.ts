import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { wardingStrength } from '../../src/cards/bruiser/warding-strength.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Warding Strength (Bruiser, Lvl 1)', () => {
  it('has identity: Warding Strength / Lvl 1 / Initiative 32', () => {
    assert.equal(wardingStrength.id, 'bruiser.warding-strength');
    assert.equal(wardingStrength.name, 'Warding Strength');
    assert.equal(wardingStrength.level, 1);
    assert.equal(wardingStrength.initiative, 32);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(wardingStrength.top.disposition, 'discard');
      assert.equal(wardingStrength.top.abilities.length, 1);
    });

    it('section 1: melee Attack 2 (square node) + Disarm', () => {
      const section = must(wardingStrength.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 2);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, 'square');

      const disarm = must(section.steps[1], 'top section 1 step 1');
      assert.equal(disarm.type, 'apply-condition');
      if (disarm.type !== 'apply-condition') return;
      assert.equal(disarm.condition, 'disarm');
    });
  });

  describe('bottom half', () => {
    it('is persistent-tracked with 6 use slots, lost on expiry', () => {
      assert.equal(wardingStrength.bottom.disposition, 'persistent-tracked');
      assert.equal(wardingStrength.bottom.trackedUses, 6);
    });

    it('advances on attack-targets-self', () => {
      assert.deepEqual(wardingStrength.bottom.persistentTrigger, {
        kind: 'attack-targets-self',
      });
    });

    it('awards 1 EXP on the 1→2, 3→4, and 5→6 transitions (3 EXP total over 5 transitions)', () => {
      assert.deepEqual(wardingStrength.bottom.useSlotExp, [1, null, 1, null, 1]);
    });

    it('section 1: Shield 1 + Retaliate 1 (the active bonus content)', () => {
      const section = must(wardingStrength.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 2);

      const shield = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(shield.type, 'shield');
      if (shield.type !== 'shield') return;
      assert.equal(shield.amount, 1);

      const retaliate = must(section.steps[1], 'bottom section 1 step 1');
      assert.equal(retaliate.type, 'retaliate');
      if (retaliate.type !== 'retaliate') return;
      assert.equal(retaliate.amount, 1);
    });
  });
});
