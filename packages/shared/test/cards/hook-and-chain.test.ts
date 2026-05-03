import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hookAndChain } from '../../src/cards/bruiser/hook-and-chain.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Hook and Chain (Bruiser, Lvl 3)', () => {
  it('has identity: Hook and Chain / Lvl 3 / Initiative 42', () => {
    assert.equal(hookAndChain.id, 'bruiser.hook-and-chain');
    assert.equal(hookAndChain.name, 'Hook and Chain');
    assert.equal(hookAndChain.level, 3);
    assert.equal(hookAndChain.initiative, 42);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(hookAndChain.top.disposition, 'discard');
      assert.equal(hookAndChain.top.abilities.length, 1);
    });

    it('section 1: ranged Attack 3 (range 4) then Pull 3 (no node)', () => {
      const section = must(hookAndChain.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, { kind: 'ranged', range: 4 });
      assert.equal(attack.node, undefined);

      const pull = must(section.steps[1], 'top section 1 step 1');
      assert.equal(pull.type, 'pull');
      if (pull.type !== 'pull') return;
      assert.equal(pull.amount, 3);
      assert.equal(pull.range, undefined);
      assert.equal(pull.node, undefined);
    });
  });

  describe('bottom half', () => {
    it('is a discard half with two abilities', () => {
      assert.equal(hookAndChain.bottom.disposition, 'discard');
      assert.equal(hookAndChain.bottom.abilities.length, 2);
    });

    it('ability 1: Move 4', () => {
      const section = must(hookAndChain.bottom.abilities[0], 'bottom ability 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom ability 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 4);
    });

    it('ability 2: when moved in a straight line, perform Attack X (X = hexes moved)', () => {
      const section = must(hookAndChain.bottom.abilities[1], 'bottom ability 2');
      assert.equal(section.steps.length, 1);

      const when = must(section.steps[0], 'bottom ability 2 step 0');
      assert.equal(when.type, 'when');
      if (when.type !== 'when') return;
      assert.deepEqual(when.cause, { kind: 'moved-in-straight-line' });
      assert.equal(when.effects.length, 1);

      const attack = must(when.effects[0], 'bottom ability 2 conditional effect 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.deepEqual(attack.amount, { kind: 'hexes-moved-this-turn' });
    });
  });
});
