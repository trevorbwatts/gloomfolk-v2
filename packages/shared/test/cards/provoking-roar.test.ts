import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { provokingRoar } from '../../src/cards/bruiser/provoking-roar.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Provoking Roar (Bruiser, Lvl X)', () => {
  it('has identity: Provoking Roar / Lvl X / Initiative 18', () => {
    assert.equal(provokingRoar.id, 'bruiser.provoking-roar');
    assert.equal(provokingRoar.name, 'Provoking Roar');
    assert.equal(provokingRoar.level, 'X');
    assert.equal(provokingRoar.initiative, 18);
  });

  describe('top half', () => {
    it('is a two-section persistent-round half', () => {
      assert.equal(provokingRoar.top.disposition, 'persistent-round');
      assert.equal(provokingRoar.top.abilities.length, 2);
    });

    it('section 1: Pull 2 (square) Range 3 (square) + Muddle', () => {
      const section = must(provokingRoar.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const pull = must(section.steps[0], 'top section 1 step 0');
      assert.equal(pull.type, 'pull');
      if (pull.type !== 'pull') return;
      assert.equal(pull.amount, 2);
      assert.equal(pull.range, 3);
      assert.equal(pull.rangeNode, 'square');
      assert.equal(pull.node, 'square');

      const muddle = must(section.steps[1], 'top section 1 step 1');
      assert.equal(muddle.type, 'apply-condition');
      if (muddle.type !== 'apply-condition') return;
      assert.equal(muddle.condition, 'muddle');
    });

    it('section 2: Retaliate 2 + EXP on next retaliate this round', () => {
      const section = must(provokingRoar.top.abilities[1], 'top section 2');
      assert.equal(section.steps.length, 2);

      const retaliate = must(section.steps[0], 'top section 2 step 0');
      assert.equal(retaliate.type, 'retaliate');
      if (retaliate.type !== 'retaliate') return;
      assert.equal(retaliate.amount, 2);

      const exp = must(section.steps[1], 'top section 2 step 1');
      assert.equal(exp.type, 'gain-exp');
      if (exp.type !== 'gain-exp') return;
      assert.equal(exp.amount, 1);
      assert.deepEqual(exp.trigger, { kind: 'on-next-retaliate-this-round' });
    });
  });

  describe('bottom half', () => {
    it('is a two-section discard half', () => {
      assert.equal(provokingRoar.bottom.disposition, 'discard');
      assert.equal(provokingRoar.bottom.abilities.length, 2);
    });

    it('section 1: Move 2', () => {
      const section = must(provokingRoar.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 2);
      assert.equal(move.node, undefined);
      assert.equal(move.traits, undefined);
    });

    it('section 2: Pull 2 (square) Range 3 (square)', () => {
      const section = must(provokingRoar.bottom.abilities[1], 'bottom section 2');
      assert.equal(section.steps.length, 1);

      const pull = must(section.steps[0], 'bottom section 2 step 0');
      assert.equal(pull.type, 'pull');
      if (pull.type !== 'pull') return;
      assert.equal(pull.amount, 2);
      assert.equal(pull.range, 3);
      assert.equal(pull.rangeNode, 'square');
      assert.equal(pull.node, 'square');
    });
  });
});
