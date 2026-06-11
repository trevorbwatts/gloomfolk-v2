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
    // must force the clean route via (0,1). (Safer outranks cheaper, so the
    // clean route would win even at a higher cost — equal costs just make
    // this the minimal case.)
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

/**
 * Two routes to a melee attack on the enemy at (6,0): straight down the r=0
 * corridor through a trap at (3,0) (attack from (5,0), 5 movement points), or
 * the long way around via the r=2 corridor (attack from (5,1), 7 movement
 * points, no trap). The rulebook's path priority says take the long way.
 *
 *   (0,0)M (1,0) (2,0) (3,0)T (4,0) (5,0) (6,0)E
 *   (0,1)                            (5,1)
 *   (0,2) (1,2) (2,2) (3,2) (4,2) (5,2)
 */
function twoRouteTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let q = 0; q <= 6; q++) {
    tiles.push({ q, r: 0, kind: q === 3 ? 'trap' : 'floor' });
  }
  for (let q = 0; q <= 5; q++) tiles.push({ q, r: 2, kind: 'floor' });
  tiles.push({ q: 0, r: 1, kind: 'floor' });
  tiles.push({ q: 5, r: 1, kind: 'floor' });
  return tiles;
}

describe('determineFocus — rulebook priority order', () => {
  it('picks a long safe path over a short path through a trap (rulebook example)', () => {
    const enemy = unit('focus', 'player', { q: 6, r: 0 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const board = { tiles: twoRouteTiles(), units: [monster, enemy] };

    const focus = determineFocus(monster, /*range*/ 1, board, new Map());
    assert.ok(focus, 'expected a focus');
    assert.equal(focus.pathNegatives, 0, 'the chosen path springs no traps');
    assert.equal(focus.pathCost, 7, 'the long way round, not 5 through the trap');
    assert.ok(
      !focus.path.some((h) => h.q === 3 && h.r === 0),
      'path avoids the trap hex',
    );
    assert.deepEqual(focus.attackHex, { q: 5, r: 1 });
  });

  it('focuses the enemy reachable without negative hexes over a closer one through a hazard', () => {
    // Enemy A is one step away, but its only attack hex IS the hazard at
    // (1,0); enemy B is three steps down a clean corridor. Fewer negative
    // hexes outranks fewer movement points, so the monster focuses B.
    const tiles: Tile[] = [
      { q: 0, r: 0, kind: 'floor' },
      { q: 1, r: 0, kind: 'hazard' },
      { q: 2, r: 0, kind: 'floor' }, // A
      { q: 0, r: 1, kind: 'floor' },
      { q: 0, r: 2, kind: 'floor' },
      { q: 0, r: 3, kind: 'floor' }, // B
    ];
    const a = unit('A', 'player', { q: 2, r: 0 });
    const b = unit('B', 'player', { q: 0, r: 3 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    // A gets the earlier initiative, so only the negative-hex rule favors B.
    const init = new Map([
      ['A', 10],
      ['B', 50],
    ]);
    const focus = determineFocus(monster, /*range*/ 1, { tiles, units: [monster, a, b] }, init);

    assert.ok(focus, 'expected a focus');
    assert.equal(focus.enemy.id, 'B');
    assert.equal(focus.pathNegatives, 0);
  });

  it('counts difficult terrain as 2 movement points when picking a focus', () => {
    // A and B are both 2 hexes away, but the hexes toward A are difficult
    // (4 movement points vs 2). A hop-count search would tie and fall through
    // to initiative (which favors A); true movement-point accounting picks B.
    const tiles: Tile[] = [
      { q: 0, r: 0, kind: 'floor' },
      { q: 1, r: 0, kind: 'difficult' },
      { q: 2, r: 0, kind: 'difficult' },
      { q: 3, r: 0, kind: 'floor' }, // A
      { q: 0, r: 1, kind: 'floor' },
      { q: 0, r: 2, kind: 'floor' },
      { q: 0, r: 3, kind: 'floor' }, // B
    ];
    const a = unit('A', 'player', { q: 3, r: 0 });
    const b = unit('B', 'player', { q: 0, r: 3 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const init = new Map([
      ['A', 10],
      ['B', 50],
    ]);
    const focus = determineFocus(monster, /*range*/ 1, { tiles, units: [monster, a, b] }, init);

    assert.ok(focus, 'expected a focus');
    assert.equal(focus.enemy.id, 'B');
    assert.equal(focus.pathCost, 2);
  });
});

describe('determineMovement — negative hexes outrank everything', () => {
  it('with enough movement, walks the long safe path to the attack hex', () => {
    const enemy = unit('focus', 'player', { q: 6, r: 0 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const result = plan(monster, enemy, /*range*/ 1, /*budget*/ 7, { tiles: twoRouteTiles() });

    assert.deepEqual(result.destination, { q: 5, r: 1 }, 'attack hex at the end of the safe route');
    assert.equal(result.pointsSpent, 7);
    assert.ok(
      !result.path.some((h) => h.q === 3 && h.r === 0),
      'never steps on the trap',
    );
  });

  it('with too little movement for the safe path, advances without springing the trap', () => {
    // Budget 6 would reach the attack hex through the trap, but path priority
    // forbids it (appendix B caption B) — the monster approaches along the
    // clean corridor instead.
    const enemy = unit('focus', 'player', { q: 6, r: 0 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const result = plan(monster, enemy, /*range*/ 1, /*budget*/ 6, { tiles: twoRouteTiles() });

    assert.deepEqual(result.destination, { q: 4, r: 2 }, 'as far down the clean corridor as 6 points allow');
    assert.ok(
      !result.path.some((h) => h.q === 3 && h.r === 0),
      'never steps on the trap',
    );
  });

  it('hits one target from a clean hex rather than two targets from a hazard hex', () => {
    // Range-2, Target-2 monster in a corridor. From (1,0) it can hit only its
    // focus at (3,0); from the hazard at (2,0) it could hit both enemies.
    // Path priority outranks target maximization: attack once, stay clean.
    const tiles: Tile[] = [
      { q: 0, r: 0, kind: 'floor' },
      { q: 1, r: 0, kind: 'floor' },
      { q: 2, r: 0, kind: 'hazard' },
      { q: 3, r: 0, kind: 'floor' }, // focus
      { q: 4, r: 0, kind: 'floor' }, // second enemy
    ];
    const focus = unit('focus', 'player', { q: 3, r: 0 });
    const second = unit('second', 'player', { q: 4, r: 0 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const result = plan(monster, focus, /*range*/ 2, /*budget*/ 2, {
      enemies: [focus, second],
      targets: 2,
      tiles,
    });

    assert.deepEqual(result.destination, { q: 1, r: 0 });
    assert.equal(result.pointsSpent, 1);
  });

  it('still crosses a trap when it is the only path to any attack hex', () => {
    // Single-file corridor with a trap in the middle: no clean path exists at
    // all, so the monster springs the trap to reach its melee attack hex
    // (monsters only trigger negative hexes when there is no other viable path).
    const tiles: Tile[] = [
      { q: 0, r: 0, kind: 'floor' },
      { q: 1, r: 0, kind: 'trap' },
      { q: 2, r: 0, kind: 'floor' },
      { q: 3, r: 0, kind: 'floor' }, // enemy
    ];
    const focus = unit('focus', 'player', { q: 3, r: 0 });
    const monster = unit('m', 'monster', { q: 0, r: 0 });
    const result = plan(monster, focus, /*range*/ 1, /*budget*/ 3, { tiles });

    assert.deepEqual(result.destination, { q: 2, r: 0 });
    assert.ok(
      result.path.some((h) => h.q === 1 && h.r === 0),
      'walks through the trap',
    );
  });
});

describe('determineMovement — moving through allies', () => {
  // A single-file corridor along r=0 (q in [0..3]); everything off it is void,
  // so the only route is straight down the row.
  const corridor: Tile[] = [];
  for (let q = 0; q <= 3; q++) corridor.push({ q, r: 0, kind: 'floor' });

  it('passes through an ally monster to reach the only attack hex', () => {
    const focus = unit('focus', 'player', { q: 0, r: 0 });
    const ally = unit('ally', 'monster', { q: 2, r: 0 }); // blocks the corridor
    const monster = unit('m', 'monster', { q: 3, r: 0 });
    const board = { tiles: corridor, units: [monster, ally, focus] };
    const focusResult = determineFocus(monster, /*range*/ 1, board, new Map());
    assert.ok(focusResult, 'expected a focus');
    const evaluateFrom = makeEvaluate(focus, [focus], /*range*/ 1, /*targets*/ 1);
    const result = determineMovement(monster, focusResult, 1, /*budget*/ 2, board, evaluateFrom);

    // (1,0) is the only hex adjacent to the focus; reaching it means walking
    // straight through the ally at (2,0).
    assert.deepEqual(result.destination, { q: 1, r: 0 }, 'must reach the attack hex');
    assert.ok(
      result.path.some((h) => h.q === 2 && h.r === 0),
      'path runs through the ally hex',
    );
    assert.equal(result.pointsSpent, 2, 'two normal steps, ally not a wall');
    assert.notDeepEqual(result.destination, { q: 2, r: 0 }, 'never stops on the ally');
  });
});
