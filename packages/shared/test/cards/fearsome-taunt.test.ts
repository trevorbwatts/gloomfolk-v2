import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fearsomeTaunt } from '../../src/cards/bruiser/fearsome-taunt.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Fearsome Taunt (Bruiser, Lvl X)', () => {
  it('has identity: Fearsome Taunt / Lvl X / Initiative 10', () => {
    assert.equal(fearsomeTaunt.id, 'bruiser.fearsome-taunt');
    assert.equal(fearsomeTaunt.name, 'Fearsome Taunt');
    assert.equal(fearsomeTaunt.level, 'X');
    assert.equal(fearsomeTaunt.initiative, 10);
  });

  describe('top half', () => {
    it('is a single-section discard half awarding 1 EXP on perform', () => {
      assert.equal(fearsomeTaunt.top.disposition, 'discard');
      assert.equal(fearsomeTaunt.top.expOnPerform, 1);
      assert.equal(fearsomeTaunt.top.abilities.length, 1);
    });

    it('section 1: melee Attack 3 (square) + Push 3 (square)', () => {
      const section = must(fearsomeTaunt.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, 'square');

      const push = must(section.steps[1], 'top section 1 step 1');
      assert.equal(push.type, 'push');
      if (push.type !== 'push') return;
      assert.equal(push.amount, 3);
      assert.equal(push.range, undefined);
      assert.equal(push.node, 'square');
    });
  });

  describe('bottom half', () => {
    it('is a two-section persistent-round half', () => {
      assert.equal(fearsomeTaunt.bottom.disposition, 'persistent-round');
      assert.equal(fearsomeTaunt.bottom.abilities.length, 2);
    });

    it('section 1: Shield 1', () => {
      const section = must(fearsomeTaunt.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const shield = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(shield.type, 'shield');
      if (shield.type !== 'shield') return;
      assert.equal(shield.amount, 1);
    });

    it('section 2: redirect adjacent-ally attacks to self, bypassing range and LoS', () => {
      const section = must(fearsomeTaunt.bottom.abilities[1], 'bottom section 2');
      assert.equal(section.steps.length, 1);

      const redirect = must(section.steps[0], 'bottom section 2 step 0');
      assert.equal(redirect.type, 'redirect-attack');
      if (redirect.type !== 'redirect-attack') return;
      assert.deepEqual(redirect.when, { kind: 'enemy-targets-adjacent-ally' });
      assert.deepEqual(redirect.bypasses, ['range', 'line-of-sight']);
    });
  });
});
