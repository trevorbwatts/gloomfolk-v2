import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { intimidatingGrowl } from '../../src/cards/bruiser/intimidating-growl.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Intimidating Growl (Bruiser, Lvl 2)', () => {
  it('has identity: Intimidating Growl / Lvl 2 / Initiative 51', () => {
    assert.equal(intimidatingGrowl.id, 'bruiser.intimidating-growl');
    assert.equal(intimidatingGrowl.name, 'Intimidating Growl');
    assert.equal(intimidatingGrowl.level, 2);
    assert.equal(intimidatingGrowl.initiative, 51);
  });

  describe('top half', () => {
    it('is a single-section discard half awarding 1 EXP on perform', () => {
      assert.equal(intimidatingGrowl.top.disposition, 'discard');
      assert.equal(intimidatingGrowl.top.expOnPerform, 1);
      assert.equal(intimidatingGrowl.top.abilities.length, 1);
    });

    it('section 1: AOE Attack 2 (square node, 3-hex triangle, two circle upgrade slots) then Push 2', () => {
      const section = must(intimidatingGrowl.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 2);
      assert.equal(attack.node, 'square');
      assert.ok(attack.target && attack.target.kind === 'aoe');
      if (!attack.target || attack.target.kind !== 'aoe') return;
      assert.deepEqual(attack.target.pattern, [
        { q: 0, r: -1 },
        { q: 1, r: -1 },
        { q: 1, r: 0 },
      ]);
      assert.deepEqual(attack.target.nodes, ['circle', 'circle']);

      const push = must(section.steps[1], 'top section 1 step 1');
      assert.equal(push.type, 'push');
      if (push.type !== 'push') return;
      assert.equal(push.amount, 2);
      assert.equal(push.range, undefined);
    });
  });

  describe('bottom half', () => {
    it('is persistent-tracked with 2 use slots, exhausts to discard (not lost)', () => {
      assert.equal(intimidatingGrowl.bottom.disposition, 'persistent-tracked');
      assert.equal(intimidatingGrowl.bottom.trackedUses, 2);
      assert.equal(intimidatingGrowl.bottom.finalPile, 'discard');
    });

    it('advances on each move ability the actor performs', () => {
      assert.deepEqual(intimidatingGrowl.bottom.persistentTrigger, {
        kind: 'move-ability-performed',
      });
    });

    it('awards 1 EXP on the single 1→2 transition', () => {
      assert.deepEqual(intimidatingGrowl.bottom.useSlotExp, [1]);
    });

    it('section 1 (one-shot on play): Move 2', () => {
      const section = must(intimidatingGrowl.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.oneShot, true);
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 2);
    });

    it('section 2 (active bonus): +1 to future move abilities', () => {
      const section = must(intimidatingGrowl.bottom.abilities[1], 'bottom section 2');
      assert.notEqual(section.oneShot, true);
      assert.equal(section.steps.length, 1);

      const step = must(section.steps[0], 'bottom section 2 step 0');
      assert.equal(step.type, 'modify-future-move');
      if (step.type !== 'modify-future-move') return;
      assert.equal(step.bonusAmount, 1);
    });
  });
});
