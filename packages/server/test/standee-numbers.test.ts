import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { makeFixture } from './helpers.js';

/** The numbering helpers are private on Room; reach in via cast (same pattern
 *  as the other server tests). */
type RoomPrivates = {
  allocateStandeeNumber: (id: string, count: number) => number | undefined;
  freeStandeeNumber: (u: { kind: string; defId: string; standeeNumber?: number }) => void;
};

function privates(room: unknown): RoomPrivates {
  return room as RoomPrivates;
}

describe('standee number allocation', () => {
  it('draws unique numbers within 1..count', () => {
    const r = privates(makeFixture().room);
    const seen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const n = r.allocateStandeeNumber('bandit-archer', 6);
      assert.ok(n !== undefined && n >= 1 && n <= 6, `in range: ${n}`);
      assert.ok(!seen.has(n), 'no duplicate numbers within a type');
      seen.add(n);
    }
    assert.equal(seen.size, 6);
  });

  it('returns undefined once the type pool is exhausted', () => {
    const r = privates(makeFixture().room);
    for (let i = 0; i < 6; i++) r.allocateStandeeNumber('bandit-archer', 6);
    assert.equal(r.allocateStandeeNumber('bandit-archer', 6), undefined);
  });

  it('returns a dead figure number to the pool for reuse', () => {
    const r = privates(makeFixture().room);
    const taken: number[] = [];
    for (let i = 0; i < 6; i++) {
      const n = r.allocateStandeeNumber('bandit-archer', 6);
      if (n !== undefined) taken.push(n);
    }
    assert.equal(r.allocateStandeeNumber('bandit-archer', 6), undefined, 'exhausted');

    const freed = taken[2]!;
    r.freeStandeeNumber({ kind: 'monster', defId: 'bandit-archer', standeeNumber: freed });
    assert.equal(
      r.allocateStandeeNumber('bandit-archer', 6),
      freed,
      'the only free number is the one just returned',
    );
  });

  it('keeps a separate pool per monster type', () => {
    const r = privates(makeFixture().room);
    for (let i = 0; i < 6; i++) r.allocateStandeeNumber('bandit-archer', 6);
    assert.equal(r.allocateStandeeNumber('bandit-archer', 6), undefined, 'archers exhausted');
    assert.notEqual(
      r.allocateStandeeNumber('bandit-scout', 6),
      undefined,
      'scout pool is independent of archers',
    );
  });

  it('ignores players and unnumbered figures when freeing', () => {
    const r = privates(makeFixture().room);
    // Should not throw or corrupt state.
    r.freeStandeeNumber({ kind: 'player', defId: 'char-1', standeeNumber: 1 });
    r.freeStandeeNumber({ kind: 'monster', defId: 'bandit-archer' });
    const n = r.allocateStandeeNumber('bandit-archer', 6);
    assert.ok(n !== undefined);
  });
});
