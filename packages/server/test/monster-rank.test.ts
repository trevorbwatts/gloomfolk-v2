import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { MonsterRank, Unit } from '@gloomfolk/shared';
import { banditArcher } from '@gloomfolk/shared';

import { monsterActOrder } from '../src/room.js';

function mk(id: string, rank: MonsterRank, standee: number): Unit {
  return {
    id,
    kind: 'monster',
    defId: 'bandit-archer',
    name: id,
    hp: 5,
    hpMax: 5,
    hex: { q: 0, r: 0 },
    shield: 0,
    retaliate: [],
    conditions: [],
    rank,
    standeeNumber: standee,
  };
}

describe('monster acting order', () => {
  it('sorts named → elite → normal, ties broken by ascending standee number', () => {
    const units = [
      mk('normal-2', 'normal', 2),
      mk('elite-3', 'elite', 3),
      mk('named-5', 'named', 5),
      mk('elite-1', 'elite', 1),
      mk('normal-1', 'normal', 1),
    ];
    const order = [...units].sort(monsterActOrder).map((u) => u.id);
    assert.deepEqual(order, ['named-5', 'elite-1', 'elite-3', 'normal-1', 'normal-2']);
  });

  it('treats a missing rank as normal', () => {
    const elite = mk('e', 'elite', 9);
    const plain = mk('n', 'normal', 1);
    delete plain.rank; // an unranked figure sorts as normal
    assert.ok(monsterActOrder(elite, plain) < 0, 'elite acts before an unranked figure');
  });
});

describe('elite stat block exists and is stronger', () => {
  it('the bandit archer elite block out-stats the normal block', () => {
    // The setup path picks `def.levels[L].elite` for elite ranks; sanity-check
    // that the data this relies on is present and meaningfully different.
    const lvl1 = banditArcher.levels[1];
    assert.ok(lvl1);
    assert.ok(lvl1.elite.hp > lvl1.normal.hp, 'elite has more HP');
    assert.ok(lvl1.elite.attack >= lvl1.normal.attack, 'elite hits at least as hard');
  });
});
