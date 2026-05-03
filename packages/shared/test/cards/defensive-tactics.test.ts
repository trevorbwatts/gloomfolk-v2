import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { defensiveTactics } from '../../src/cards/bruiser/defensive-tactics.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Defensive Tactics (Bruiser, Lvl 5)', () => {
  it('has identity: Defensive Tactics / Lvl 5 / Initiative 39', () => {
    assert.equal(defensiveTactics.id, 'bruiser.defensive-tactics');
    assert.equal(defensiveTactics.name, 'Defensive Tactics');
    assert.equal(defensiveTactics.level, 5);
    assert.equal(defensiveTactics.initiative, 39);
  });

  describe('top half', () => {
    it('is a persistent-scenario half awarding 2 EXP on perform', () => {
      assert.equal(defensiveTactics.top.disposition, 'persistent-scenario');
      assert.equal(defensiveTactics.top.expOnPerform, 2);
      assert.equal(defensiveTactics.top.abilities.length, 1);
    });

    it('section 1: when first-shield-or-retaliate-this-round, gain Shield 1 + Retaliate 1', () => {
      const section = must(defensiveTactics.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const when = must(section.steps[0], 'top section 1 step 0');
      assert.equal(when.type, 'when');
      if (when.type !== 'when') return;
      assert.deepEqual(when.cause, { kind: 'first-shield-or-retaliate-this-round' });
      assert.equal(when.effects.length, 2);

      const shield = must(when.effects[0], 'when effect 0');
      assert.equal(shield.type, 'shield');
      if (shield.type !== 'shield') return;
      assert.equal(shield.amount, 1);

      const retaliate = must(when.effects[1], 'when effect 1');
      assert.equal(retaliate.type, 'retaliate');
      if (retaliate.type !== 'retaliate') return;
      assert.equal(retaliate.amount, 1);
    });
  });

  describe('bottom half', () => {
    it('is a discard half with two abilities', () => {
      assert.equal(defensiveTactics.bottom.disposition, 'discard');
      assert.equal(defensiveTactics.bottom.abilities.length, 2);
    });

    it('ability 1: Move 3 (circle node)', () => {
      const section = must(defensiveTactics.bottom.abilities[0], 'bottom ability 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom ability 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 3);
      assert.equal(move.node, 'circle');
    });

    it('ability 2: Pull 2 hexes, target 2 enemies (square node) at range 3', () => {
      const section = must(defensiveTactics.bottom.abilities[1], 'bottom ability 2');
      assert.equal(section.steps.length, 1);

      const pull = must(section.steps[0], 'bottom ability 2 step 0');
      assert.equal(pull.type, 'pull');
      if (pull.type !== 'pull') return;
      assert.equal(pull.amount, 2);
      assert.deepEqual(pull.target, {
        kind: 'ranged',
        range: 3,
        targets: 2,
        targetsNode: 'square',
      });
    });
  });
});
