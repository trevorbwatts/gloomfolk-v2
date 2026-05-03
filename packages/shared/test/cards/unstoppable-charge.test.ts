import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { unstoppableCharge } from '../../src/cards/bruiser/unstoppable-charge.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Unstoppable Charge (Bruiser, Lvl 3)', () => {
  it('has identity: Unstoppable Charge / Lvl 3 / Initiative 86', () => {
    assert.equal(unstoppableCharge.id, 'bruiser.unstoppable-charge');
    assert.equal(unstoppableCharge.name, 'Unstoppable Charge');
    assert.equal(unstoppableCharge.level, 3);
    assert.equal(unstoppableCharge.initiative, 86);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(unstoppableCharge.top.disposition, 'discard');
      assert.equal(unstoppableCharge.top.abilities.length, 1);
    });

    it('section 1: Attack 3 (diamond node) with +2/+1 EXP rider when moved-this-turn', () => {
      const section = must(unstoppableCharge.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.equal(attack.node, 'diamond');

      const riders = attack.modifiers?.conditionRiders;
      assert.ok(riders && riders.length === 1);
      const rider = must(riders[0], 'condition rider 0');
      assert.deepEqual(rider.when, { kind: 'moved-this-turn' });
      assert.equal(rider.attackBonus, 2);
      assert.equal(rider.gainExp, 1);
    });
  });

  describe('bottom half', () => {
    it('is a lost half awarding 2 EXP on perform, two abilities', () => {
      assert.equal(unstoppableCharge.bottom.disposition, 'lost');
      assert.equal(unstoppableCharge.bottom.expOnPerform, 2);
      assert.equal(unstoppableCharge.bottom.abilities.length, 2);
    });

    it('ability 1: Move 4 (square node)', () => {
      const section = must(unstoppableCharge.bottom.abilities[0], 'bottom ability 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom ability 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 4);
      assert.equal(move.node, 'square');
    });

    it('ability 2: Stun (diamond node) on all enemies within range 1', () => {
      const section = must(unstoppableCharge.bottom.abilities[1], 'bottom ability 2');
      assert.equal(section.steps.length, 1);

      const step = must(section.steps[0], 'bottom ability 2 step 0');
      assert.equal(step.type, 'apply-condition');
      if (step.type !== 'apply-condition') return;
      assert.equal(step.condition, 'stun');
      assert.equal(step.node, 'diamond');
      assert.deepEqual(step.target, { kind: 'all-within-range', range: 1 });
    });
  });
});
