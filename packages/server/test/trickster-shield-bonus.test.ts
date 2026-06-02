import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { flankingStrike, swiftBow } from '@gloomfolk/shared/cards';
import type { ActiveEffect } from '@gloomfolk/shared';

import { consumeAttackBonus } from '../src/room.js';
import { addMonster, makeFixture, startTurn, type Fixture, type PlayerEntry } from './helpers.js';

/** Trickster's Reversal's active bonus: +(X+2) Attack on a melee attack, where
 *  X is the target's Shield. Mirrors what performing the persistent half pushes. */
function addShieldBonus(player: PlayerEntry): void {
  player.activeEffects.push({
    id: 'e-trick',
    sourceCardId: 'silent-knife.tricksters-reversal',
    kind: 'attack-bonus',
    amount: 0,
    amountRef: { kind: 'target-shield-value', offset: 2 },
    pierceBonus: 0,
    expires: 'end-scenario',
    attackKind: 'melee',
  } as ActiveEffect);
}

/** Engage Flanking Strike's top (a clean melee Attack 3 with a deterministic +0
 *  modifier) and return its attack action. With no allies adjacent its printed
 *  conditional bonus never fires, isolating the active-bonus under test. */
function engageMeleeAttack(fx: Fixture) {
  fx.player.modifierDeck = [
    { id: 'm-0a', card: { kind: 'flat', amount: 0 } },
    { id: 'm-0b', card: { kind: 'flat', amount: 0 } },
  ];
  startTurn(fx.room, fx, { leading: flankingStrike, second: swiftBow });
  const engage = fx.room.engageHalf(fx.player.playerId, 'top', flankingStrike.id, false);
  assert.deepEqual(engage, { ok: true });
  const ct = (fx.room as unknown as { currentTurn: { topSlot: { actions: { id: string; type: string }[] } } })
    .currentTurn;
  const attack = ct.topSlot.actions.find((a) => a.type === 'attack');
  assert.ok(attack, 'expected an attack action');
  return attack;
}

describe("Trickster's Reversal — X+2 from target Shield is applied", () => {
  it('adds (Shield + 2) to a melee attack against a Shielded enemy', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addShieldBonus(fx.player);
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 20, shield: 3 });
    const attack = engageMeleeAttack(fx);

    const res = fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    assert.deepEqual(res, { ok: true });
    // Attack 3 + (Shield 3 + 2) = 8 attack value; Shield 3 absorbs 3 → 5 dealt.
    assert.equal(monster.hp, 15, 'bonus is Shield(3)+2 = +5 to the attack value');
  });

  it('does NOT apply against an unshielded enemy (and keeps the bonus available)', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addShieldBonus(fx.player);
    const monster = addMonster(fx.room, { id: 'm1', hex: { q: 1, r: 0 }, hp: 20, shield: 0 });
    const attack = engageMeleeAttack(fx);

    const res = fx.room.performAction(fx.player.playerId, 'top', attack.id, { unitId: monster.id });
    assert.deepEqual(res, { ok: true });
    // Unshielded → no bonus → plain Attack 3.
    assert.equal(monster.hp, 17, 'no Shield means no bonus');
    assert.equal(
      fx.player.activeEffects.filter((e) => e.kind === 'attack-bonus').length,
      1,
      'the bonus is left unconsumed for a later shielded target',
    );
  });

  it('consumeAttackBonus resolves the ref via the resolver and gates on it', () => {
    const fx = makeFixture({ classId: 'silent-knife' });
    addShieldBonus(fx.player);
    const p = fx.player as unknown as Parameters<typeof consumeAttackBonus>[0];

    // Shielded target (resolver returns Shield+2 = 6).
    const hit = consumeAttackBonus(p, 'melee', (ref) =>
      ref.kind === 'target-shield-value' ? 6 : 0,
    );
    assert.equal(hit.amount, 6, 'ref value is folded into the bonus');

    // Resolver returns null → bonus skipped and kept.
    const before = fx.player.activeEffects.length;
    const miss = consumeAttackBonus(p, 'melee', () => null);
    assert.equal(miss.amount, 0, 'null resolution applies nothing');
    assert.equal(fx.player.activeEffects.length, before, 'and leaves the effect in place');

    // Wrong attack kind (ranged) → filtered out, not applied.
    const ranged = consumeAttackBonus(p, 'ranged', () => 6);
    assert.equal(ranged.amount, 0, 'a melee-only bonus does not apply to ranged attacks');
  });
});
