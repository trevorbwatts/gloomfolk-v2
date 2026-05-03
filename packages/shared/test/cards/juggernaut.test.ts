import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { juggernaut } from '../../src/cards/bruiser/juggernaut.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Juggernaut (Bruiser, Lvl 2)', () => {
  it('has identity: Juggernaut / Lvl 2 / Initiative 2', () => {
    assert.equal(juggernaut.id, 'bruiser.juggernaut');
    assert.equal(juggernaut.name, 'Juggernaut');
    assert.equal(juggernaut.level, 2);
    assert.equal(juggernaut.initiative, 2);
  });

  describe('top half', () => {
    it('is a discard half with two separate abilities', () => {
      assert.equal(juggernaut.top.disposition, 'discard');
      assert.equal(juggernaut.top.abilities.length, 2);
    });

    it('ability 1: Move 2 (circle node)', () => {
      const section = must(juggernaut.top.abilities[0], 'top ability 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'top ability 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 2);
      assert.equal(move.node, 'circle');
    });

    it('ability 2: Attack 3 (diamond node)', () => {
      const section = must(juggernaut.top.abilities[1], 'top ability 2');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top ability 2 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.equal(attack.node, 'diamond');
    });
  });

  describe('bottom half', () => {
    it('is persistent-tracked with 4 use slots', () => {
      assert.equal(juggernaut.bottom.disposition, 'persistent-tracked');
      assert.equal(juggernaut.bottom.trackedUses, 4);
    });

    it('advances on damage-suffered (any source, not just attacks)', () => {
      assert.deepEqual(juggernaut.bottom.persistentTrigger, {
        kind: 'damage-suffered',
      });
    });

    it('awards 1 EXP on the 1→2 and 3→4 transitions (2 EXP total over 3 transitions)', () => {
      assert.deepEqual(juggernaut.bottom.useSlotExp, [1, null, 1]);
    });

    it('section 1: negate one source of damage', () => {
      const section = must(juggernaut.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const step = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(step.type, 'negate-damage');
    });
  });
});
