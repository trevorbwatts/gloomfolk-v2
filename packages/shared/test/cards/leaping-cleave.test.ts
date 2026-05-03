import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { leapingCleave } from '../../src/cards/bruiser/leaping-cleave.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Leaping Cleave (Bruiser, Lvl 1)', () => {
  it('has identity: Leaping Cleave / Lvl 1 / Initiative 54', () => {
    assert.equal(leapingCleave.id, 'bruiser.leaping-cleave');
    assert.equal(leapingCleave.name, 'Leaping Cleave');
    assert.equal(leapingCleave.level, 1);
    assert.equal(leapingCleave.initiative, 54);
  });

  describe('top half', () => {
    it('is a single-section discard half awarding 1 EXP on perform', () => {
      assert.equal(leapingCleave.top.disposition, 'discard');
      assert.equal(leapingCleave.top.expOnPerform, 1);
      assert.equal(leapingCleave.top.abilities.length, 1);
    });

    it('section 1: AOE Attack 3 (square node) on a 2-hex melee arc', () => {
      const section = must(leapingCleave.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 3);
      assert.equal(attack.node, 'square');
      assert.deepEqual(attack.target, {
        kind: 'aoe',
        pattern: [
          { q: 1, r: -1 },
          { q: 1, r: 0 },
        ],
      });
    });
  });

  describe('bottom half', () => {
    it('is a two-section discard half', () => {
      assert.equal(leapingCleave.bottom.disposition, 'discard');
      assert.equal(leapingCleave.bottom.abilities.length, 2);
    });

    it('section 1: Move 3 with Jump (square node)', () => {
      const section = must(leapingCleave.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 3);
      assert.deepEqual(move.traits, ['jump']);
      assert.equal(move.node, 'square');
    });

    it('section 2: Push 2 (square node) with Range 1', () => {
      const section = must(leapingCleave.bottom.abilities[1], 'bottom section 2');
      assert.equal(section.steps.length, 1);

      const push = must(section.steps[0], 'bottom section 2 step 0');
      assert.equal(push.type, 'push');
      if (push.type !== 'push') return;
      assert.equal(push.amount, 2);
      assert.equal(push.range, 1);
      assert.equal(push.node, 'square');
    });
  });
});
