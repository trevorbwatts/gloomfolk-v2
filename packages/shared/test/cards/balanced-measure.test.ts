import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { balancedMeasure } from '../../src/cards/bruiser/balanced-measure.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Balanced Measure (Bruiser, Lvl 1)', () => {
  it('has identity: Balanced Measure / Lvl 1 / Initiative 20', () => {
    assert.equal(balancedMeasure.id, 'bruiser.balanced-measure');
    assert.equal(balancedMeasure.name, 'Balanced Measure');
    assert.equal(balancedMeasure.level, 1);
    assert.equal(balancedMeasure.initiative, 20);
  });

  describe('top half', () => {
    it('is a single-section discard half awarding 1 EXP on perform', () => {
      assert.equal(balancedMeasure.top.disposition, 'discard');
      assert.equal(balancedMeasure.top.expOnPerform, 1);
      assert.equal(balancedMeasure.top.abilities.length, 1);
    });

    it('section 1: melee Attack X where X = hexes moved this turn', () => {
      const section = must(balancedMeasure.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.deepEqual(attack.amount, { kind: 'hexes-moved-this-turn' });
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, undefined);
      assert.equal(attack.modifiers, undefined);
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(balancedMeasure.bottom.disposition, 'discard');
      assert.equal(balancedMeasure.bottom.expOnPerform, undefined);
      assert.equal(balancedMeasure.bottom.abilities.length, 1);
    });

    it('section 1: Move X where X = damage dealt this turn', () => {
      const section = must(balancedMeasure.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;

      assert.deepEqual(move.amount, { kind: 'damage-dealt-this-turn' });
      assert.equal(move.traits, undefined);
      assert.equal(move.node, undefined);
    });
  });
});
