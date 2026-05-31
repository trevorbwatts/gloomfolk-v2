import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  addMonster,
  makeFixture,
  resolveMonsterAttack,
  syncUnitRetaliate,
} from './helpers.js';

/**
 * Retaliate from multiple sources stacks: when a monster attacks the player,
 * every active retaliate effect within range of the attacker adds its amount to
 * the damage dealt back. This mirrors the summed value shown on the status chip
 * (syncUnitRetaliate). Out-of-range effects don't contribute.
 */
describe('retaliate stacking', () => {
  function grantRetaliate(
    player: { activeEffects: unknown[] },
    amount: number,
    range: number,
  ) {
    player.activeEffects.push({
      id: `e-ret-${player.activeEffects.length + 1}`,
      sourceCardId: 'test',
      kind: 'retaliate',
      amount,
      range,
      expires: 'end-round',
    });
  }

  it('sums all in-range retaliate effects into the damage dealt back', () => {
    const { room, player, unit } = makeFixture();
    grantRetaliate(player, 1, 1);
    grantRetaliate(player, 2, 1);

    const m = addMonster(room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 5 });
    resolveMonsterAttack(room, m, unit, 1);

    // 5 hp - (1 + 2) retaliate = 2.
    assert.equal(m.hp, 2, 'monster takes the combined retaliate (3)');
  });

  it('excludes out-of-range effects from the sum', () => {
    const { room, player, unit } = makeFixture();
    grantRetaliate(player, 1, 1); // reaches an adjacent attacker
    grantRetaliate(player, 5, 0); // range 0 — never reaches an attacker

    const m = addMonster(room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 9 });
    resolveMonsterAttack(room, m, unit, 1);

    // Only the range-1 effect applies: 9 - 1 = 8.
    assert.equal(m.hp, 8, 'range-0 effect does not contribute');
  });

  it('denormalizes retaliate onto the unit as range-grouped bands (display)', () => {
    const { room, player, unit } = makeFixture();
    grantRetaliate(player, 1, 1);
    grantRetaliate(player, 2, 1); // same range → merges with the above
    grantRetaliate(player, 1, 3); // separate range → its own band

    syncUnitRetaliate(room);

    // Bands sorted by ascending range; same-range amounts summed.
    assert.deepEqual(unit.retaliate, [
      { amount: 3, range: 1 },
      { amount: 1, range: 3 },
    ]);
  });

  it('clears the unit bands when no retaliate is active', () => {
    const { room, unit } = makeFixture();
    syncUnitRetaliate(room);
    assert.deepEqual(unit.retaliate, []);
  });
});
