import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { overwhelmingAssault } from '../../src/cards/bruiser/overwhelming-assault.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Overwhelming Assault (Bruiser, Lvl 1)', () => {
  it('has identity: Overwhelming Assault / Lvl 1 / Initiative 61', () => {
    assert.equal(overwhelmingAssault.id, 'bruiser.overwhelming-assault');
    assert.equal(overwhelmingAssault.name, 'Overwhelming Assault');
    assert.equal(overwhelmingAssault.level, 1);
    assert.equal(overwhelmingAssault.initiative, 61);
  });

  describe('top half', () => {
    it('is a single-section lost half awarding 2 EXP on perform', () => {
      assert.equal(overwhelmingAssault.top.disposition, 'lost');
      assert.equal(overwhelmingAssault.top.expOnPerform, 2);
      assert.equal(overwhelmingAssault.top.abilities.length, 1);
    });

    it('section 1: melee Attack 7 with diamond node', () => {
      const section = must(overwhelmingAssault.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top section 1 ability 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;

      assert.equal(attack.amount, 7);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, 'diamond');
      assert.equal(attack.modifiers, undefined);
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(overwhelmingAssault.bottom.disposition, 'discard');
      assert.equal(overwhelmingAssault.bottom.expOnPerform, undefined);
      assert.equal(overwhelmingAssault.bottom.abilities.length, 1);
    });

    it('section 1: Move 3 with Jump (square node) + mandatory Air element', () => {
      const section = must(
        overwhelmingAssault.bottom.abilities[0],
        'bottom section 1',
      );
      assert.equal(section.steps.length, 2);

      const move = must(section.steps[0], 'bottom section 1 ability 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 3);
      assert.deepEqual(move.traits, ['jump']);
      assert.equal(move.node, 'square');

      const element = must(section.steps[1], 'bottom section 1 ability 1');
      assert.equal(element.type, 'create-element');
      if (element.type !== 'create-element') return;
      assert.equal(element.element, 'air');
      assert.equal(element.mandatory, true);
    });
  });
});
