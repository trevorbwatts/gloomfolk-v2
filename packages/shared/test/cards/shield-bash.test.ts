import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shieldBash } from '../../src/cards/bruiser/shield-bash.js';

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('Shield Bash (Bruiser, Lvl 1)', () => {
  it('has identity: Shield Bash / Lvl 1 / Initiative 15', () => {
    assert.equal(shieldBash.id, 'bruiser.shield-bash');
    assert.equal(shieldBash.name, 'Shield Bash');
    assert.equal(shieldBash.level, 1);
    assert.equal(shieldBash.initiative, 15);
  });

  describe('top half', () => {
    it('is a single-section lost half awarding 2 EXP on perform', () => {
      assert.equal(shieldBash.top.disposition, 'lost');
      assert.equal(shieldBash.top.expOnPerform, 2);
      assert.equal(shieldBash.top.abilities.length, 1);
    });

    it('section 1: melee Attack 4 (diamond node) + Stun', () => {
      const section = must(shieldBash.top.abilities[0], 'top section 1');
      assert.equal(section.steps.length, 2);

      const attack = must(section.steps[0], 'top section 1 step 0');
      assert.equal(attack.type, 'attack');
      if (attack.type !== 'attack') return;
      assert.equal(attack.amount, 4);
      assert.deepEqual(attack.target, { kind: 'melee' });
      assert.equal(attack.node, 'diamond');

      const stun = must(section.steps[1], 'top section 1 step 1');
      assert.equal(stun.type, 'apply-condition');
      if (stun.type !== 'apply-condition') return;
      assert.equal(stun.condition, 'stun');
    });
  });

  describe('bottom half', () => {
    it('is a two-section persistent-round half', () => {
      assert.equal(shieldBash.bottom.disposition, 'persistent-round');
      assert.equal(shieldBash.bottom.abilities.length, 2);
    });

    it('section 1: Move 2 with square node (one-shot when card is played)', () => {
      const section = must(shieldBash.bottom.abilities[0], 'bottom section 1');
      assert.equal(section.steps.length, 1);

      const move = must(section.steps[0], 'bottom section 1 step 0');
      assert.equal(move.type, 'move');
      if (move.type !== 'move') return;
      assert.equal(move.amount, 2);
      assert.equal(move.node, 'square');
    });

    it('section 2: Shield 1 (active bonus content for the round)', () => {
      const section = must(shieldBash.bottom.abilities[1], 'bottom section 2');
      assert.equal(section.steps.length, 1);

      const shield = must(section.steps[0], 'bottom section 2 step 0');
      assert.equal(shield.type, 'shield');
      if (shield.type !== 'shield') return;
      assert.equal(shield.amount, 1);
    });
  });
});
