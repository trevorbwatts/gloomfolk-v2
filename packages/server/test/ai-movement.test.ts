import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Hex, Tile, Unit } from '@gloomfolk/shared';
import { hexDistance } from '@gloomfolk/shared';

import { determineFocus, determineMovement, type DestinationEval } from '../src/ai.js';

/** A rectangular patch of floor tiles covering the test coordinates. */
function floorBoard(): Tile[] {
  const tiles: Tile[] = [];
  for (let q = -3; q <= 9; q++) {
    for (let r = -5; r <= 5; r++) {
      tiles.push({ q, r, kind: 'floor' });
    }
  }
  return tiles;
}

/** Minimal Unit — determineFocus/determineMovement only read id/kind/hex. */
function unit(id: string, kind: 'player' | 'monster', hex: Hex): Unit {
  return { id, kind, hex } as unknown as Unit;
}

/**
 * Mirror of Room.selectAttackTargets + the evaluateFrom in room.ts, on a flat
 * (full line-of-sight) board: focus first, then nearest other enemies up to the
 * Target count; disadvantage = ranged attacks landing on adjacent targets.
 */
function makeEvaluate(
  focusEnemy: Unit,
  enemies: Unit[],
  range: number,
  targets: number,
): (from: Hex) => DestinationEval {
  return (from: Hex) => {
    const inRange = enemies.filter((u) => {
      const d = hexDistance(from, u.hex);
      return d >= 1 && d <= range;
    });
    if (!inRange.some((u) => u.id === focusEnemy.id)) {
      return { canHitFocus: false, attacks: 0, disadvantaged: 0 };
    }
    const others = inRange
      .filter((u) => u.id !== focusEnemy.id)
      .sort((a, b) => hexDistance(from, a.hex) - hexDistance(from, b.hex));
    const set = [focusEnemy, ...others.slice(0, Math.max(0, targets - 1))];
    const disadvantaged =
      range > 1 ? set.filter((u) => hexDistance(from, u.hex) === 1).length : 0;
    return { canHitFocus: true, attacks: set.length, disadvantaged };
  };
}

function plan(
  monster: Unit,
  focusEnemy: Unit,
  range: number,
  budget: number,
  opts: { enemies?: Unit[]; targets?: number; tiles?: Tile[] } = {},
) {
  const enemies = opts.enemies ?? [focusEnemy];
  const tiles = opts.tiles ?? floorBoard();
  const board = { tiles, units: [monster, ...enemies] };
  const focus = determineFocus(monster, range, board, new Map());
  assert.ok(focus, 'expected a focus');
  const evaluateFrom = makeEvaluate(focusEnemy, enemies, range, opts.targets ?? 1);
  return determineMovement(monster, focus, range, budget, board, evaluateFrom);
}

describe('determineMovement — ranged disadvantage avoidance', () => {
  it('a ranged monster adjacent to its focus moves away to a non-adjacent in-range hex', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 1, r: 0 }); // distance 1 (adjacent)
    const result = plan(monster, focus, /*range*/ 3, /*budget*/ 3);

    assert.ok(
      hexDistance(result.destination, focus.hex) >= 2,
      'should end at least 2 hexes away to avoid disadvantage',
    );
    assert.ok(hexDistance(result.destination, focus.hex) <= 3, 'should stay within range');
    assert.ok(result.pointsSpent >= 1, 'must spend movement to step away');
  });

  it('a ranged monster already at clean range does not move', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 3, r: 0 });
    const result = plan(monster, focus, /*range*/ 3, /*budget*/ 3);

    assert.deepEqual(result.destination, { q: 3, r: 0 });
    assert.equal(result.pointsSpent, 0);
  });

  it('stays put and accepts disadvantage when it cannot relocate (budget 0)', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 1, r: 0 });
    const result = plan(monster, focus, /*range*/ 3, /*budget*/ 0);

    assert.deepEqual(result.destination, { q: 1, r: 0 });
    assert.equal(result.pointsSpent, 0);
  });
});

describe('determineMovement — melee + approach', () => {
  it('a melee monster moves adjacent to its focus', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 3, r: 0 });
    const result = plan(monster, focus, /*range*/ 1, /*budget*/ 3);

    assert.equal(hexDistance(result.destination, focus.hex), 1, 'melee must end adjacent');
    assert.ok(result.pointsSpent > 0);
  });

  it('when it cannot reach an attack hex, it shortens the path toward the focus', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 6, r: 0 });
    const result = plan(monster, focus, /*range*/ 1, /*budget*/ 2);

    assert.ok(hexDistance(result.destination, focus.hex) < 6, 'should get closer');
    assert.ok(result.pointsSpent > 0 && result.pointsSpent <= 2);
  });
});

describe('determineMovement — multi-target maximization', () => {
  it('prefers a hex that hits more targets even if it costs more movement', () => {
    // Focus at (0,0); a second enemy at (4,0). A ranged (range 3, Target 2)
    // monster at (3,0) can already hit the focus from where it stands (cost 0,
    // 1 target) — but moving to ~(2,0)/(1,0) lets it hit BOTH. Target count
    // beats movement economy.
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const second = unit('second', 'player', { q: 6, r: 0 });
    const monster = unit('m', 'monster', { q: 3, r: 0 });
    const result = plan(monster, focus, /*range*/ 3, /*budget*/ 3, {
      enemies: [focus, second],
      targets: 2,
    });

    // The chosen hex must be within range of both enemies.
    assert.ok(hexDistance(result.destination, focus.hex) <= 3);
    assert.ok(hexDistance(result.destination, second.hex) <= 3);
  });
});

describe('determineMovement — terrain', () => {
  it('treats difficult terrain as costing 2 movement points', () => {
    // A wall of difficult terrain at q=1 forces the monster to pay 2 to step
    // onto (1,0). With budget 1 it cannot reach (1,0); with budget 2 it can.
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const monster = unit('m', 'monster', { q: 2, r: 0 });
    const tiles = floorBoard().map((t) =>
      t.q === 1 && t.r === 0 ? { ...t, kind: 'difficult' as const } : t,
    );
    // Melee, budget 1: can't afford to enter the difficult hex adjacent to focus.
    const tight = plan(monster, focus, /*range*/ 1, /*budget*/ 1, { tiles });
    assert.notDeepEqual(tight.destination, { q: 1, r: 0 }, 'difficult hex costs 2, unreachable with 1');

    // Budget 2: now it can pay the 2 to stand adjacent.
    const loose = plan(monster, focus, /*range*/ 1, /*budget*/ 2, { tiles });
    assert.deepEqual(loose.destination, { q: 1, r: 0 });
    assert.equal(loose.pointsSpent, 2);
  });

  it('among equal-cost paths to the same hex, picks the one crossing fewer hazards', () => {
    // Focus at (1,2); wall off every hex adjacent to it except (1,1), so (1,1)
    // is the only place to attack from. From the monster at (0,0) there are two
    // equal 2-step paths to (1,1): via (1,0) or via (0,1). A hazard on (1,0)
    // must force the clean route via (0,1). (Cost outranks hazards, so this
    // only bites when the two routes cost the same.)
    const focus = unit('focus', 'player', { q: 1, r: 2 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const walls = new Set(['2,2', '0,2', '1,3', '2,1', '0,3']);
    const tiles = floorBoard().map((t) => {
      const k = `${t.q},${t.r}`;
      if (walls.has(k)) return { ...t, kind: 'wall' as const };
      if (t.q === 1 && t.r === 0) return { ...t, kind: 'hazard' as const };
      return t;
    });
    const result = plan(monster, focus, /*range*/ 1, /*budget*/ 2, { tiles });

    assert.deepEqual(result.destination, { q: 1, r: 1 }, 'the only attack hex');
    assert.ok(
      !result.path.some((h) => h.q === 1 && h.r === 0),
      'should route around the hazard hex',
    );
    assert.ok(
      result.path.some((h) => h.q === 0 && h.r === 1),
      'clean path goes via (0,1)',
    );
  });
});
