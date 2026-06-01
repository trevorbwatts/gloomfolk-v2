import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  bfsPath,
  bfsReachable,
  pathCost,
  hexKey,
  type Hex,
} from '../src/hex.js';

// A passable open plane. `difficult` keys cost 2 movement to *enter*. With no
// figures around, every hex is both walkable (traversable) and a legal endpoint.
function makeTerrain(difficult: readonly Hex[]) {
  const diff = new Set(difficult.map(hexKey));
  const passable = (_h: Hex) => true;
  const enterCost = (h: Hex) => (diff.has(hexKey(h)) ? 2 : 1);
  return { passable, enterCost };
}

// (0,0)-(1,0)-(2,0)-(3,0) form a straight, contiguous corridor along the q-axis.
describe('bfsReachable with difficult terrain', () => {
  it('charges 2 to enter a difficult hex, free to leave', () => {
    const { passable, enterCost } = makeTerrain([{ q: 1, r: 0 }]);
    const reach = bfsReachable({ q: 0, r: 0 }, 2, passable, passable, enterCost);
    // Entering the difficult hex (1,0) costs the whole budget of 2.
    assert.equal(reach.get('1,0'), 2, 'difficult hex costs 2 to enter');
    // (2,0) sits past the difficult hex: 2 (enter difficult) + 1 = 3 > budget,
    // and there is no 2-cost detour, so it is unreachable.
    assert.equal(reach.has('2,0'), false, 'cannot afford to step past difficult terrain');
  });

  it('default cost of 1 reaches the same hex (regression for plain BFS)', () => {
    const { passable } = makeTerrain([]);
    const reach = bfsReachable({ q: 0, r: 0 }, 2, passable, passable);
    assert.equal(reach.get('2,0'), 2, 'two normal steps cost 2');
  });

  it('does not charge for leaving a difficult hex you start on', () => {
    // Start standing on difficult terrain; moving off it is a normal 1-cost step.
    const { passable, enterCost } = makeTerrain([{ q: 0, r: 0 }]);
    const reach = bfsReachable({ q: 0, r: 0 }, 1, passable, passable, enterCost);
    assert.equal(reach.get('0,0'), 0);
    assert.equal(reach.get('1,0'), 1, 'leaving difficult terrain is free');
  });
});

describe('bfsPath with difficult terrain', () => {
  it('needs the inflated budget to cross difficult terrain', () => {
    const { passable, enterCost } = makeTerrain([{ q: 1, r: 0 }]);
    const goal: Hex = { q: 2, r: 0 };
    // Crossing costs 2 (enter difficult) + 1 = 3.
    assert.equal(
      bfsPath({ q: 0, r: 0 }, goal, 2, passable, passable, enterCost),
      null,
      'budget 2 falls short',
    );
    const path = bfsPath({ q: 0, r: 0 }, goal, 3, passable, passable, enterCost);
    assert.ok(path, 'budget 3 is enough');
    assert.equal(path!.length, 3, 'still only two physical hexes moved (3 incl. start)');
  });
});

// A figure may move *through* its allies but not *stop* on them: an ally hex is
// `walkable` (traversable) but fails `canEnd` (illegal destination).
describe('moving through allies', () => {
  // Ally sits at (1,0), directly between start (0,0) and the open hex (2,0).
  const ally: Hex = { q: 1, r: 0 };
  const walkable = (_h: Hex) => true; // walls would block here; none in this map
  const canEnd = (h: Hex) => !(h.q === ally.q && h.r === ally.r);

  it('reaches the far hex through the ally but cannot stop on the ally', () => {
    const reach = bfsReachable({ q: 0, r: 0 }, 2, walkable, canEnd);
    assert.equal(reach.has(hexKey(ally)), false, 'cannot end on an ally');
    assert.equal(reach.get('2,0'), 2, 'can pass through the ally to the hex beyond');
  });

  it('routes a path straight through the ally hex', () => {
    const path = bfsPath({ q: 0, r: 0 }, { q: 2, r: 0 }, 2, walkable, canEnd);
    assert.ok(path, 'path exists through the ally');
    assert.deepEqual(path, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
  });

  it('refuses to end on the ally hex itself', () => {
    assert.equal(bfsPath({ q: 0, r: 0 }, ally, 2, walkable, canEnd), null);
  });
});

describe('pathCost', () => {
  it('sums entry cost, charging 2 per difficult hex', () => {
    const { enterCost } = makeTerrain([{ q: 1, r: 0 }]);
    // Walk through (1,0) [difficult, 2] then (2,0) [normal, 1] = 3 points over 2 hexes.
    const path: Hex[] = [{ q: 1, r: 0 }, { q: 2, r: 0 }];
    assert.equal(pathCost(path, enterCost), 3);
    assert.equal(path.length, 2, 'two physical hexes moved');
  });
});
