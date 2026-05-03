import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sweepingBlow } from '../../src/cards/bruiser/sweeping-blow.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Sweeping Blow (Bruiser, Lvl X)', () => {
  it('has identity: Sweeping Blow / Lvl X / Initiative 23', () => {
    assert.equal(sweepingBlow.id, 'bruiser.sweeping-blow');
    assert.equal(sweepingBlow.name, 'Sweeping Blow');
    assert.equal(sweepingBlow.level, 'X');
    assert.equal(sweepingBlow.initiative, 23);
  });

  describe('top half', () => {
    it('is a single-section discard half awarding 1 EXP on perform', () => {
      assert.equal(sweepingBlow.top.disposition, 'discard');
      assert.equal(sweepingBlow.top.expOnPerform, 1);
      assert.equal(sweepingBlow.top.abilities.length, 1);
    });

    it('section 1: AOE Attack 2 with 3-hex arc (circle node), +1 atk vs undamaged, then Muddle', () => {
      const section = must(sweepingBlow.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 2);

      assert.equal(attack.target?.kind, 'aoe');
      if (attack.target?.kind !== 'aoe') return;
      assert.deepEqual(attack.target.pattern, [
        { q: 0, r: -1 },
        { q: 1, r: -1 },
        { q: 1, r: 0 },
      ]);
      assert.deepEqual(attack.target.nodes, ['circle']);

      const bonuses = attack.modifiers?.targetConditionalBonuses;
      assert.ok(bonuses && bonuses.length === 1);
      const bonus = must(bonuses[0], 'target conditional bonus 0');
      assert.deepEqual(bonus.condition, { kind: 'target-undamaged' });
      assert.equal(bonus.attackBonus, 1);

      const muddle = must(section.steps[1], 'top section 1 step 1');
      assert.equal(muddle.type, 'apply-condition');
      if (muddle.type !== 'apply-condition') return;
      assert.equal(muddle.condition, 'muddle');
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(sweepingBlow.bottom.disposition, 'discard');
      assert.equal(sweepingBlow.bottom.abilities.length, 1);
    });

    it('section 1: Move 4', () => {
      const section = must(sweepingBlow.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 4);
    });
  });
});
