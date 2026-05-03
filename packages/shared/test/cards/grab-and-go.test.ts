import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { grabAndGo } from '../../src/cards/bruiser/grab-and-go.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Grab and Go (Bruiser, Lvl 1)', () => {
  it('has identity: Grab and Go / Lvl 1 / Initiative 87', () => {
    assert.equal(grabAndGo.id, 'bruiser.grab-and-go');
    assert.equal(grabAndGo.name, 'Grab and Go');
    assert.equal(grabAndGo.level, 1);
    assert.equal(grabAndGo.initiative, 87);
  });

  describe('top half', () => {
    it('is a two-section discard half', () => {
      assert.equal(grabAndGo.top.disposition, 'discard');
      assert.equal(grabAndGo.top.abilities.length, 2);
    });

    it('section 1: Loot 1 (range 1)', () => {
      const section = must(grabAndGo.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const loot = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(loot.type, 'loot');
      if (loot.type !== 'loot') return;
      assert.equal(loot.range, 1);
      assert.equal(loot.node, undefined);
    });

    it('section 2: Heal 2 self with square node', () => {
      const section = must(grabAndGo.top.abilities[1], 'top section 2');
      assert.equal(section.steps.length, 1);

      const heal = must(section.steps[0], 'top section 2 ability 0');
      assert.equal(heal.type, 'heal');
      if (heal.type !== 'heal') return;
      assert.equal(heal.amount, 2);
      assert.deepEqual(heal.target, { kind: 'self' });
      assert.equal(heal.node, 'square');
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(grabAndGo.bottom.disposition, 'discard');
      assert.equal(grabAndGo.bottom.abilities.length, 1);
    });

    it('section 1: Move 4 with square node', () => {
      const section = must(grabAndGo.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 4);
      assert.equal(move.node, 'square');
      assert.equal(move.traits, undefined);
    });
  });
});
