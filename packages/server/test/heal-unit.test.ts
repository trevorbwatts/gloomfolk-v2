import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Unit } from '@gloomfolk/shared';

import { makeFixture } from './helpers.js';
import type { Room } from '../src/room.js';

/** healUnit is a private Room method. Reach it through an unknown cast — the
 *  signature is stable and this keeps the heal/condition interaction pinned. */
function healUnit(room: Room, unit: Unit, amount: number): number {
  return (
    room as unknown as { healUnit: (u: Unit, n: number) => number }
  ).healUnit(unit, amount);
}

function hasCondition(unit: Unit, kind: string): boolean {
  return unit.conditions.some((c) => c.kind === kind);
}

describe('healUnit — poison vs wound interaction (conditions.md)', () => {
  it('Wound only: cures the wound AND restores HP', () => {
    const fx = makeFixture();
    fx.unit.hp = 5;
    fx.unit.hpMax = 10;
    fx.unit.conditions = [{ kind: 'wound', appliedThisTurn: false }];

    const restored = healUnit(fx.room, fx.unit, 3);

    assert.equal(restored, 3, 'wound does not block HP gain');
    assert.equal(fx.unit.hp, 8);
    assert.equal(hasCondition(fx.unit, 'wound'), false, 'wound is cured');
  });

  it('Poison only: cures the poison but restores NO HP', () => {
    const fx = makeFixture();
    fx.unit.hp = 5;
    fx.unit.hpMax = 10;
    fx.unit.conditions = [{ kind: 'poison', appliedThisTurn: false }];

    const restored = healUnit(fx.room, fx.unit, 3);

    assert.equal(restored, 0, 'poison prevents the heal from increasing HP');
    assert.equal(fx.unit.hp, 5, 'HP unchanged');
    assert.equal(hasCondition(fx.unit, 'poison'), false, 'poison is cured');
  });

  it('Both poison and wound: poison wins — both cured, no HP gain', () => {
    const fx = makeFixture();
    fx.unit.hp = 5;
    fx.unit.hpMax = 10;
    fx.unit.conditions = [
      { kind: 'poison', appliedThisTurn: false },
      { kind: 'wound', appliedThisTurn: false },
    ];

    const restored = healUnit(fx.room, fx.unit, 3);

    assert.equal(restored, 0, 'poison blocks HP gain even when wound is also cured');
    assert.equal(fx.unit.hp, 5);
    assert.equal(hasCondition(fx.unit, 'poison'), false);
    assert.equal(hasCondition(fx.unit, 'wound'), false);
  });

  it('Clean unit: restores HP normally', () => {
    const fx = makeFixture();
    fx.unit.hp = 5;
    fx.unit.hpMax = 10;

    const restored = healUnit(fx.room, fx.unit, 3);

    assert.equal(restored, 3);
    assert.equal(fx.unit.hp, 8);
  });

  it('Clean unit: heal is capped at max HP', () => {
    const fx = makeFixture();
    fx.unit.hp = 9;
    fx.unit.hpMax = 10;

    const restored = healUnit(fx.room, fx.unit, 5);

    assert.equal(restored, 1, 'only the HP up to max counts as restored');
    assert.equal(fx.unit.hp, 10);
  });
});
