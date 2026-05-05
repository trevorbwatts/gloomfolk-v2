import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexDistance,
  hexEq,
  neighbors,
  bfsReachable,
  inBounds,
  straightLinePath,
} from '../src/rules/hex.js';

test('hexDistance: identical hexes are 0 apart', () => {
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 }), 0);
});

test('hexDistance: adjacent hexes are 1 apart', () => {
  for (const n of neighbors({ q: 0, r: 0 })) {
    assert.equal(hexDistance({ q: 0, r: 0 }, n), 1);
  }
});

test('hexDistance: across the diagonal', () => {
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 }), 3);
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 }), 4);
});

test('neighbors: returns 6 unique adjacent hexes', () => {
  const n = neighbors({ q: 5, r: 5 });
  assert.equal(n.length, 6);
  const keys = new Set(n.map((h) => `${h.q},${h.r}`));
  assert.equal(keys.size, 6);
});

test('inBounds: rejects negative r', () => {
  assert.equal(inBounds({ q: 0, r: -1 }, { width: 5, height: 5 }), false);
});

test('inBounds: accepts interior hex', () => {
  assert.equal(inBounds({ q: 2, r: 2 }, { width: 10, height: 8 }), true);
});

test('bfsReachable: includes start at distance 0', () => {
  const r = bfsReachable({ q: 0, r: 0 }, 0, () => false, { width: 10, height: 10 });
  assert.equal(r.size, 1);
  const start = r.get('0,0');
  assert.ok(start);
  assert.equal(start.dist, 0);
});

test('bfsReachable: 1-step reaches up to 7 hexes (start + 6 neighbors) when unblocked', () => {
  const r = bfsReachable({ q: 3, r: 3 }, 1, () => false, { width: 10, height: 10 });
  // exactly 7 in the middle of a large field
  assert.equal(r.size, 7);
});

test('bfsReachable: blockers prevent passage', () => {
  const blocked = (h: { q: number; r: number }) => hexEq(h, { q: 1, r: 0 });
  const r = bfsReachable({ q: 0, r: 0 }, 1, blocked, { width: 10, height: 10 });
  // the blocked hex itself is not in the result
  assert.equal(r.has('1,0'), false);
});

test('straightLinePath: same hex returns single-hex path', () => {
  const p = straightLinePath({ q: 2, r: 2 }, { q: 2, r: 2 }, () => false, { width: 10, height: 10 });
  assert.deepEqual(p, [{ q: 2, r: 2 }]);
});

test('straightLinePath: 4-step axial line returns 5-hex path', () => {
  const p = straightLinePath({ q: 0, r: 0 }, { q: 4, r: 0 }, () => false, { width: 10, height: 10 });
  assert.ok(p);
  assert.equal(p.length, 5);
  assert.deepEqual(p[0], { q: 0, r: 0 });
  assert.deepEqual(p[4], { q: 4, r: 0 });
});

test('straightLinePath: non-collinear destination returns null', () => {
  const p = straightLinePath({ q: 0, r: 0 }, { q: 2, r: 1 }, () => false, { width: 10, height: 10 });
  assert.equal(p, null);
});

test('straightLinePath: blocked intermediate returns null', () => {
  const blocked = (h: { q: number; r: number }) => h.q === 2 && h.r === 0;
  const p = straightLinePath({ q: 0, r: 0 }, { q: 4, r: 0 }, blocked, { width: 10, height: 10 });
  assert.equal(p, null);
});

test('straightLinePath: out-of-bounds intermediate returns null', () => {
  const p = straightLinePath({ q: 0, r: 0 }, { q: -3, r: 0 }, () => false, { width: 5, height: 5 });
  assert.equal(p, null);
});
