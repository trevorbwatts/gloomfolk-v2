import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { skirmishingManeuver } from '../../src/cards/bruiser/skirmishing-maneuver.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Skirmishing Maneuver (Bruiser, Lvl 5)', () => {
  it('has identity: Skirmishing Maneuver / Lvl 5 / Initiative 29', () => {
    assert.equal(skirmishingManeuver.id, 'bruiser.skirmishing-maneuver');
    assert.equal(skirmishingManeuver.name, 'Skirmishing Maneuver');
    assert.equal(skirmishingManeuver.level, 5);
    assert.equal(skirmishingManeuver.initiative, 29);
  });

  describe('top half', () => {
    it('is a discard half with three abilities', () => {
      assert.equal(skirmishingManeuver.top.disposition, 'discard');
      assert.equal(skirmishingManeuver.top.abilities.length, 3);
    });

    it('ability 1: Attack 2 (square node)', () => {
      const section = must(skirmishingManeuver.top.abilities[0], 'top ability 1');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top ability 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 2);
      assert.equal(attack.node, 'square');
    });

    it('ability 2: Move 2 (circle node)', () => {
      const section = must(skirmishingManeuver.top.abilities[1], 'top ability 2');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'top ability 2 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 2);
      assert.equal(move.node, 'circle');
    });

    it('ability 3: Attack 3 (diamond node)', () => {
      const section = must(skirmishingManeuver.top.abilities[2], 'top ability 3');
      assert.equal(section.steps.length, 1);

      const attack = must(section.steps[0], 'top ability 3 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 3);
      assert.equal(attack.node, 'diamond');
    });
  });

  describe('bottom half', () => {
    it('is a single-section discard half', () => {
      assert.equal(skirmishingManeuver.bottom.disposition, 'discard');
      assert.equal(skirmishingManeuver.bottom.abilities.length, 1);
    });

    it('section 1: Move 5 with Jump (square node) + mandatory create-air', () => {
      const section = must(skirmishingManeuver.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 2);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 5);
      assert.equal(move.node, 'square');
      assert.deepEqual(move.traits, ['jump']);

      const element = must(section.steps[1], 'bottom section 1 step 1');
      assert.equal(element.type, 'create-element');
      if (element.type !== 'create-element') return;
      assert.equal(element.element, 'air');
      assert.equal(element.mandatory, true);
    });
  });
});
