import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { eyeForAnEye } from '../../src/cards/bruiser/eye-for-an-eye.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Eye for an Eye (Bruiser, Lvl 1)', () => {
  it('has identity: Eye for an Eye / Lvl 1 / Initiative 13', () => {
    assert.equal(eyeForAnEye.id, 'bruiser.eye-for-an-eye');
    assert.equal(eyeForAnEye.name, 'Eye for an Eye');
    assert.equal(eyeForAnEye.level, 1);
    assert.equal(eyeForAnEye.initiative, 13);
  });

  describe('top half', () => {
    it('is a two-section persistent-round half', () => {
      assert.equal(eyeForAnEye.top.disposition, 'persistent-round');
      assert.equal(eyeForAnEye.top.abilities.length, 2);
    });

    it('section 1: Shield 1', () => {
      const section = must(eyeForAnEye.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const shield = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(shield.type, 'shield');
      if (shield.type !== 'shield') return;
      assert.equal(shield.amount, 1);
    });

    it('section 2: Retaliate 1 + EXP 1 on next retaliate this round', () => {
      const section = must(eyeForAnEye.top.abilities[1], 'top section 2');
      assert.equal(section.steps.length, 2);

      const retaliate = must(section.steps[0], 'top section 2 ability 0');
      assert.equal(retaliate.type, 'retaliate');
      if (retaliate.type !== 'retaliate') return;
      assert.equal(retaliate.amount, 1);

      const exp = must(section.steps[1], 'top section 2 ability 1');
      assert.equal(exp.type, 'gain-exp');
      if (exp.type !== 'gain-exp') return;
      assert.equal(exp.amount, 1);
      assert.deepEqual(exp.trigger, { kind: 'on-next-retaliate-this-round' });
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(eyeForAnEye.bottom.disposition, 'discard');
      assert.equal(eyeForAnEye.bottom.abilities.length, 1);
    });

    it('section 1: Heal 3 self + mandatory create Earth element', () => {
      const section = must(eyeForAnEye.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 2);

      const heal = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(heal.type, 'heal');
      if (heal.type !== 'heal') return;
      assert.equal(heal.amount, 3);
      assert.deepEqual(heal.target, { kind: 'self' });
      assert.equal(heal.node, 'square');

      const element = must(section.steps[1], 'bottom section 1 ability 1');
      assert.equal(element.type, 'create-element');
      if (element.type !== 'create-element') return;
      assert.equal(element.element, 'earth');
      assert.equal(element.mandatory, true);
    });
  });
});
