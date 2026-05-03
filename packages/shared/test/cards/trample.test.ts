import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trample } from '../../src/cards/bruiser/trample.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Trample (Bruiser, Lvl 1)', () => {
  it('has identity: Trample / Lvl 1 / Initiative 72', () => {
    assert.equal(trample.id, 'bruiser.trample');
    assert.equal(trample.name, 'Trample');
    assert.equal(trample.level, 1);
    assert.equal(trample.initiative, 72);
  });

  describe('top half', () => {
    it('is a single-section discard half', () => {
      assert.equal(trample.top.disposition, 'discard');
      assert.equal(trample.top.abilities.length, 1);
    });

    it('section 1: Attack 3 with Pierce 3 on a diamond node', () => {
      const section = must(trample.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.deepEqual(attack.modifiers?.pierce, { amount: 3 });
      assert.equal(attack.node, 'diamond');
    });
  });

  describe('bottom half', () => {
    it('is a two-section lost half', () => {
      assert.equal(trample.bottom.disposition, 'lost');
      assert.equal(trample.bottom.abilities.length, 2);
    });

    it('section 1: Move 4 with Jump on a square node', () => {
      const section = must(trample.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;

      assert.equal(move.amount, 4);
      assert.deepEqual(move.traits, ['jump']);
      assert.equal(move.node, 'square');
    });

    it('section 2: Attack 3 vs enemies-moved-through, +1 EXP per enemy targeted', () => {
      const section = must(trample.bottom.abilities[1], 'bottom section 2');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'bottom section 2 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, { kind: 'enemies-moved-through' });

      const exp = must(section.steps[1], 'bottom section 2 ability 1');
      assert.equal(exp.type, 'gain-exp');
      if (exp.type !== 'gain-exp') return;
      assert.equal(exp.amount, 1);
      assert.deepEqual(exp.trigger, { kind: 'per-enemy-targeted' });
    });
  });
});
