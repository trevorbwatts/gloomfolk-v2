import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { whirlwind } from '../../src/cards/bruiser/whirlwind.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Whirlwind (Bruiser, Lvl 4)', () => {
  it('has identity: Whirlwind / Lvl 4 / Initiative 28', () => {
    assert.equal(whirlwind.id, 'bruiser.whirlwind');
    assert.equal(whirlwind.name, 'Whirlwind');
    assert.equal(whirlwind.level, 4);
    assert.equal(whirlwind.initiative, 28);
  });

  describe('top half', () => {
    it('is a single-section lost half', () => {
      assert.equal(whirlwind.top.disposition, 'lost');
      assert.equal(whirlwind.top.abilities.length, 1);
    });

    it('section 1: Attack 5 (diamond, all enemies at range 1) + per-enemy EXP + mandatory create-air', () => {
      const section = must(whirlwind.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 3);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 5);
      assert.equal(attack.node, 'diamond');
      assert.deepEqual(attack.target, { kind: 'all-within-range', range: 1 });

      const exp = must(section.steps[1], 'top section 1 step 1');
      assert.equal(exp.type, 'gain-exp');
      if (exp.type !== 'gain-exp') return;
      assert.equal(exp.amount, 1);
      assert.deepEqual(exp.trigger, { kind: 'per-enemy-targeted' });

      const element = must(section.steps[2], 'top section 1 step 2');
      assert.equal(element.type, 'create-element');
      if (element.type !== 'create-element') return;
      assert.equal(element.element, 'air');
      assert.equal(element.mandatory, true);
    });
  });

  describe('bottom half', () => {
    it('is a discard half with two abilities', () => {
      assert.equal(whirlwind.bottom.disposition, 'discard');
      assert.equal(whirlwind.bottom.abilities.length, 2);
    });

    it('ability 1: Move 4 (circle node)', () => {
      const section = must(whirlwind.bottom.abilities[0], 'bottom ability 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom ability 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 4);
      assert.equal(move.node, 'circle');
    });

    it('ability 2: Push 3 (square node) targeting all figures at range 1 (allies included)', () => {
      const section = must(whirlwind.bottom.abilities[1], 'bottom ability 2');
      assert.equal(section.steps.length, 1);

      const push = must(section.steps[0], 'bottom ability 2 step 0');
      assert.equal(push.type, 'push');
      if (push.type !== 'push') return;
      assert.equal(push.amount, 3);
      assert.equal(push.node, 'square');
      assert.deepEqual(push.target, {
        kind: 'all-within-range',
        range: 1,
        scope: 'figures',
      });
    });
  });
});
