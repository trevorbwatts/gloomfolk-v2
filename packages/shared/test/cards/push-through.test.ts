import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pushThrough } from '../../src/cards/bruiser/push-through.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Push Through (Bruiser, Lvl 4)', () => {
  it('has identity: Push Through / Lvl 4 / Initiative 57', () => {
    assert.equal(pushThrough.id, 'bruiser.push-through');
    assert.equal(pushThrough.name, 'Push Through');
    assert.equal(pushThrough.level, 4);
    assert.equal(pushThrough.initiative, 57);
  });

  describe('top half', () => {
    it('is a single-section discard half: Heal 5 self (diamond node)', () => {
      assert.equal(pushThrough.top.disposition, 'discard');
      assert.equal(pushThrough.top.abilities.length, 1);

      const section = must(pushThrough.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const heal = must(section.steps[0], 'top section 1 step 0');
      assert.equal(heal.type, 'heal');
      if (heal.type !== 'heal') return;
      assert.equal(heal.amount, 5);
      assert.deepEqual(heal.target, { kind: 'self' });
      assert.equal(heal.node, 'diamond');
    });
  });

  describe('bottom half', () => {
    it('is a persistent-round half with two abilities', () => {
      assert.equal(pushThrough.bottom.disposition, 'persistent-round');
      assert.equal(pushThrough.bottom.abilities.length, 2);
    });

    it('ability 1 (active bonus): +1 to all attacks of your next attack ability this round', () => {
      const section = must(pushThrough.bottom.abilities[0], 'bottom ability 1');
      assert.notEqual(section.oneShot, true);
      assert.equal(section.steps.length, 1);

      const step = must(section.steps[0], 'bottom ability 1 step 0');
      assert.equal(step.type, 'modify-future-attack');
      if (step.type !== 'modify-future-attack') return;
      assert.equal(step.bonusAmount, 1);
      assert.equal(step.appliesTo, 'next-attack-ability');
    });

    it('ability 2 (one-shot on play): Move 3 (circle node)', () => {
      const section = must(pushThrough.bottom.abilities[1], 'bottom ability 2');
      assert.equal(section.oneShot, true);
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom ability 2 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 3);
      assert.equal(move.node, 'circle');
    });
  });
});
