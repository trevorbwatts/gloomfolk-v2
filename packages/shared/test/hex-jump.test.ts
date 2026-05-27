import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  bfsPathJump,
  bfsReachableJump,
  hexKey,
  type Hex,
} from '../src/hex.js';

// Build predicates for a small map.
//   - `walls`     : hex keys that block (walls).
//   - `occupied`  : hex keys with enemies on them (block endpoint only).
function makePredicates(walls: readonly Hex[], occupied: readonly Hex[]) {
  const wallSet = new Set(walls.map(hexKey));
  const occSet = new Set(occupied.map(hexKey));
  const walkable = (h: Hex) => !wallSet.has(hexKey(h));
  const canEnd = (h: Hex) => !wallSet.has(hexKey(h)) && !occSet.has(hexKey(h));
  return { walkable, canEnd };
}

describe('bfsReachableJump', () => {
  it('returns hexes within budget through walkable terrain', () => {
    const { walkable, canEnd } = makePredicates([], []);
    const reach = bfsReachableJump({ q: 0, r: 0 }, 2, walkable, canEnd);
    // Center plus 6 neighbours plus 12 second-ring = 19.
    assert.equal(reach.size, 19);
    assert.equal(reach.get('0,0'), 0);
    assert.equal(reach.get('1,0'), 1);
    assert.equal(reach.get('2,0'), 2);
  });

  it('treats walls as impassable mid-path AND as illegal endpoints', () => {
    const wall: Hex = { q: 1, r: 0 };
    const { walkable, canEnd } = makePredicates([wall], []);
    const reach = bfsReachableJump({ q: 0, r: 0 }, 1, walkable, canEnd);
    // The wall hex itself is excluded.
    assert.equal(reach.has(hexKey(wall)), false);
    // But other neighbours are still reachable.
    assert.equal(reach.has('0,1'), true);
  });

  it('lets the path pass through an occupied hex but excludes it as endpoint', () => {
    // Enemy at (1,0). With budget 2 we should still reach (2,0) by jumping
    // over them, but (1,0) itself is not a valid destination.
    const enemy: Hex = { q: 1, r: 0 };
    const { walkable, canEnd } = makePredicates([], [enemy]);
    const reach = bfsReachableJump({ q: 0, r: 0 }, 2, walkable, canEnd);
    assert.equal(reach.has(hexKey(enemy)), false, 'occupied hex is not a legal endpoint');
    assert.equal(reach.has('2,0'), true, 'can jump over to the far side');
    assert.equal(reach.get('2,0'), 2);
  });
});

describe('bfsPathJump', () => {
  it('returns start→goal path through an occupied hex', () => {
    const enemy: Hex = { q: 1, r: 0 };
    const { walkable, canEnd } = makePredicates([], [enemy]);
    const path = bfsPathJump({ q: 0, r: 0 }, { q: 2, r: 0 }, 2, walkable, canEnd);
    assert.deepEqual(path, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
  });

  it('refuses to end on an occupied hex even when reachable', () => {
    const enemy: Hex = { q: 1, r: 0 };
    const { walkable, canEnd } = makePredicates([], [enemy]);
    const path = bfsPathJump({ q: 0, r: 0 }, enemy, 1, walkable, canEnd);
    assert.equal(path, null);
  });

  it('refuses to cross walls even in pass-through', () => {
    // Wall directly between start and goal forces a detour.
    const wall: Hex = { q: 1, r: 0 };
    const { walkable, canEnd } = makePredicates([wall], []);
    const path = bfsPathJump({ q: 0, r: 0 }, { q: 2, r: 0 }, 2, walkable, canEnd);
    // Budget 2 is not enough for the detour around (1,0).
    assert.equal(path, null);
  });

  it('returns null when goal is outside the budget', () => {
    const { walkable, canEnd } = makePredicates([], []);
    const path = bfsPathJump({ q: 0, r: 0 }, { q: 3, r: 0 }, 2, walkable, canEnd);
    assert.equal(path, null);
  });

  it('returns [start] when start equals goal', () => {
    const { walkable, canEnd } = makePredicates([], []);
    const path = bfsPathJump({ q: 0, r: 0 }, { q: 0, r: 0 }, 3, walkable, canEnd);
    assert.deepEqual(path, [{ q: 0, r: 0 }]);
  });
});
