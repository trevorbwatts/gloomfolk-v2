import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  singleOut,
  smokeBomb,
  trickstersReversal,
  wardingStrength,
} from '@gloomfolk/shared/cards';

import { skewer } from '@gloomfolk/shared/cards';

import {
  addMonster,
  attachTracked,
  disposePlayerCards,
  fireAttackConditional,
  fireTrigger,
  makeFixture,
  startTurn,
} from './helpers.js';

describe('persistent-tracked: Warding Strength (Bruiser, bottom)', () => {
  it('grants Shield 1 + Retaliate 1 on each attack-targets-self trigger', () => {
    const { room, player, unit } = makeFixture();
    attachTracked(player, wardingStrength, 'bottom');

    fireTrigger(room, player, 'attack-targets-self');

    assert.equal(unit.shield, 1, 'shield gained');
    const ret = player.activeEffects.find((e) => e.kind === 'retaliate');
    assert.ok(ret, 'retaliate effect created');
    if (ret?.kind !== 'retaliate') throw new Error('unreachable');
    assert.equal(ret.amount, 1);
    assert.equal(ret.range, 1);
    assert.equal(ret.expires, 'end-round');
    assert.equal(ret.sourceCardId, wardingStrength.id);
  });

  it('does nothing when a non-matching trigger fires', () => {
    const { room, player, unit, character } = makeFixture();
    attachTracked(player, wardingStrength, 'bottom');

    fireTrigger(room, player, 'damage-suffered');

    assert.equal(unit.shield, 0);
    assert.equal(player.activeEffects.length, 0);
    assert.equal(character.xp, 0);
    assert.equal(player.activeTracked[0]?.currentSlot, 1, 'slot not advanced');
  });

  it('awards EXP on slots 1, 3, 5 (3 total) and expires to lost after 6 uses', () => {
    const { room, player, unit, character } = makeFixture();
    attachTracked(player, wardingStrength, 'bottom');

    for (let i = 0; i < 6; i++) {
      fireTrigger(room, player, 'attack-targets-self');
    }

    assert.equal(character.xp, 3, 'EXP awarded on slots 1+3+5');
    assert.equal(unit.shield, 6, '6 stacks of Shield 1');
    assert.equal(player.active.length, 0, 'card removed from active pile');
    assert.equal(player.lost.length, 1, 'card moved to lost (default finalPile)');
    assert.equal(player.lost[0]?.id, wardingStrength.id);
    assert.equal(player.activeTracked.length, 0, 'tracked entry removed');
    assert.equal(
      player.activeEffects.filter((e) => e.sourceCardId === wardingStrength.id).length,
      0,
      'sustaining retaliate effects cleared on expiry',
    );
  });

  it('a 7th trigger after expiry is a no-op', () => {
    const { room, player } = makeFixture();
    attachTracked(player, wardingStrength, 'bottom');
    for (let i = 0; i < 6; i++) fireTrigger(room, player, 'attack-targets-self');

    const result = fireTrigger(room, player, 'attack-targets-self');
    assert.equal(result.damageNegated, false);
    assert.equal(player.activeTracked.length, 0);
  });
});

describe('persistent-tracked: Single Out (Silent Knife, bottom)', () => {
  it('triggerSteps is empty — modify-future-attack runs at engage, not on trigger', () => {
    const { player } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');
    assert.equal(player.activeTracked[0]?.triggerSteps.length, 0);
  });

  it('advances slot on attack-against-isolated-enemy and awards EXP on slots 2 & 4', () => {
    const { room, player, character } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');

    fireTrigger(room, player, 'attack-against-isolated-enemy');
    assert.equal(player.activeTracked[0]?.currentSlot, 2);
    assert.equal(character.xp, 0, 'slot 1 has null exp');

    fireTrigger(room, player, 'attack-against-isolated-enemy');
    assert.equal(player.activeTracked[0]?.currentSlot, 3);
    assert.equal(character.xp, 1, 'slot 2 awards 1 exp');

    fireTrigger(room, player, 'attack-against-isolated-enemy');
    assert.equal(player.activeTracked[0]?.currentSlot, 4);
    assert.equal(character.xp, 1, 'slot 3 null');

    fireTrigger(room, player, 'attack-against-isolated-enemy');
    assert.equal(character.xp, 2, 'slot 4 awards 1 exp; card now expires');
    assert.equal(player.activeTracked.length, 0);
    assert.equal(player.lost.length, 1, 'expires to lost (default finalPile)');
  });

  it('clears the sticky modify-future-attack effect when the card expires', () => {
    const { room, player } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');
    // Simulate the activeEffect that modify-future-attack would have created
    // when the half was engaged.
    player.activeEffects.push({
      id: 'fake-1',
      sourceCardId: singleOut.id,
      kind: 'attack-bonus',
      amount: 3,
      pierceBonus: 0,
      expires: 'end-scenario',
    });
    assert.equal(player.activeEffects.length, 1);

    for (let i = 0; i < 4; i++) fireTrigger(room, player, 'attack-against-isolated-enemy');

    assert.equal(
      player.activeEffects.filter((e) => e.sourceCardId === singleOut.id).length,
      0,
      'sticky bonus removed on card expiry',
    );
  });
});

describe('persistent-tracked: Smoke Bomb (Silent Knife, top)', () => {
  it('expires after a single attack-while-invisible trigger and awards 1 EXP', () => {
    const { room, player, character } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, smokeBomb, 'top');

    // triggerSteps should be empty — only modify-future-attack is non-oneShot
    // on this card, and it's excluded from triggerSteps.
    assert.equal(player.activeTracked[0]?.triggerSteps.length, 0);

    fireTrigger(room, player, 'attack-while-invisible');

    assert.equal(character.xp, 1);
    assert.equal(player.activeTracked.length, 0);
    assert.equal(player.lost.length, 1);
    assert.equal(player.lost[0]?.id, smokeBomb.id);
  });
});

describe("persistent-tracked: Trickster's Reversal (Silent Knife, top)", () => {
  it('expires to DISCARD (not lost) per finalPile and awards 1 EXP', () => {
    const { room, player, character } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, trickstersReversal, 'top');

    fireTrigger(room, player, 'melee-attack-against-shielded-enemy');

    assert.equal(character.xp, 1);
    assert.equal(player.activeTracked.length, 0);
    assert.equal(player.lost.length, 0, 'should NOT go to lost');
    assert.equal(player.discard.length, 1, 'goes to discard per finalPile');
    assert.equal(player.discard[0]?.id, trickstersReversal.id);
  });
});

describe('fireAttackConditionalTriggers dispatch', () => {
  it('fires attack-against-isolated-enemy when the target has no adjacent monsters', () => {
    const { room, player, unit, character } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');
    const lone = addMonster(room, { id: 'm-lone', hex: { q: 5, r: 0 } });

    fireAttackConditional(room, player, unit, lone, 'melee');

    assert.equal(player.activeTracked[0]?.currentSlot, 2, 'isolated trigger advanced slot');
    assert.equal(character.xp, 0, 'slot 1 has null exp');
  });

  it('does NOT fire isolated trigger when an ally monster is adjacent', () => {
    const { room, player, unit } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');
    const target = addMonster(room, { id: 'm-target', hex: { q: 5, r: 0 } });
    addMonster(room, { id: 'm-friend', hex: { q: 6, r: 0 } }); // adjacent to target

    fireAttackConditional(room, player, unit, target, 'melee');

    assert.equal(player.activeTracked[0]?.currentSlot, 1, 'not isolated → no advance');
  });

  it('fires melee-attack-against-shielded-enemy only for melee, not ranged', () => {
    const { room, player, unit } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, trickstersReversal, 'top');
    const shielded = addMonster(room, { id: 'm-shield', hex: { q: 5, r: 0 }, shield: 2 });

    fireAttackConditional(room, player, unit, shielded, 'ranged');
    assert.equal(player.activeTracked.length, 1, 'ranged: no trigger, card still active');

    fireAttackConditional(room, player, unit, shielded, 'melee');
    assert.equal(player.activeTracked.length, 0, 'melee: trigger fired, card expired');
    assert.equal(player.discard.length, 1);
  });

  it('fires attack-while-invisible when the attacker is invisible', () => {
    const { room, player, unit } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, smokeBomb, 'top');
    unit.invisible = true;
    const target = addMonster(room, { id: 'm-1', hex: { q: 5, r: 0 } });

    fireAttackConditional(room, player, unit, target, 'melee');

    assert.equal(player.activeTracked.length, 0, 'invisible-attacker trigger fired');
    assert.equal(player.lost.length, 1);
  });

  it('does NOT fire attack-while-invisible when the attacker is visible', () => {
    const { room, player, unit } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, smokeBomb, 'top');
    const target = addMonster(room, { id: 'm-1', hex: { q: 5, r: 0 } });

    fireAttackConditional(room, player, unit, target, 'melee');

    assert.equal(player.activeTracked.length, 1, 'visible attacker → no trigger');
  });

  it('a single hit can fire multiple matching triggers (isolated + invisible)', () => {
    const { room, player, unit, character } = makeFixture({ classId: 'silent-knife' });
    attachTracked(player, singleOut, 'bottom');
    attachTracked(player, smokeBomb, 'top');
    unit.invisible = true;
    const lone = addMonster(room, { id: 'm-lone', hex: { q: 5, r: 0 } });

    fireAttackConditional(room, player, unit, lone, 'melee');

    const singleOutTracked = player.activeTracked.find((t) => t.cardId === singleOut.id);
    assert.equal(singleOutTracked?.currentSlot, 2, 'Single Out advanced');
    const smokeBombTracked = player.activeTracked.find((t) => t.cardId === smokeBomb.id);
    assert.equal(smokeBombTracked, undefined, 'Smoke Bomb expired (1 use)');
    assert.equal(character.xp, 1, 'Smoke Bomb slot 1 awarded 1 exp');
  });
});

describe('engage → confirm → dispose (Warding Strength bottom, end-to-end)', () => {
  it('engageHalf produces an empty action queue for a deferred-only tracked half', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: wardingStrength, second: skewer });
    const result = fx.room.engageHalf(fx.player.playerId, 'bottom', wardingStrength.id, false);
    assert.equal(result.ok, true);
    const ct = (fx.room as unknown as { currentTurn: { bottomSlot: { status: string; actions: unknown[] } } }).currentTurn;
    assert.equal(ct.bottomSlot.status, 'engaged');
    assert.equal(
      ct.bottomSlot.actions.length,
      0,
      'all steps are deferred for tracked halves — engage queue is empty',
    );
  });

  it('confirmPersistentHalf credits performedCount and finishes the slot', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: wardingStrength, second: skewer });
    fx.room.engageHalf(fx.player.playerId, 'bottom', wardingStrength.id, false);

    const result = fx.room.confirmPersistentHalf(fx.player.playerId, 'bottom');
    assert.equal(result.ok, true);

    const ct = (fx.room as unknown as { currentTurn: { bottomSlot: { status: string; performedCount: number } } }).currentTurn;
    assert.equal(ct.bottomSlot.status, 'done');
    assert.equal(ct.bottomSlot.performedCount, 1);
  });

  it('end-of-turn dispose routes the confirmed card to active and creates the tracked entry', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: wardingStrength, second: skewer });
    fx.room.engageHalf(fx.player.playerId, 'bottom', wardingStrength.id, false);
    fx.room.confirmPersistentHalf(fx.player.playerId, 'bottom');

    disposePlayerCards(fx.room, fx.player);

    // wardingStrength → active; skewer (the un-engaged second card) → discard.
    assert.equal(fx.player.active.length, 1, 'confirmed card moved to active');
    assert.equal(fx.player.active[0]?.id, wardingStrength.id);
    assert.equal(fx.player.discard.length, 1, 'unused second card discards');
    assert.equal(fx.player.discard[0]?.id, skewer.id);
    assert.equal(fx.player.activeTracked.length, 1, 'tracked entry created');
    const tracked = fx.player.activeTracked[0]!;
    assert.equal(tracked.cardId, wardingStrength.id);
    assert.equal(tracked.halfKind, 'bottom');
    assert.equal(tracked.currentSlot, 1);
    assert.equal(tracked.trackedUses, 6);
    assert.equal(tracked.persistentTrigger.kind, 'attack-targets-self');
    assert.equal(tracked.triggerSteps.length, 2, 'Shield + Retaliate deferred');
  });

  it('skip path (finishHalf without confirm) discards the card and does NOT create a tracked entry', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: wardingStrength, second: skewer });
    fx.room.engageHalf(fx.player.playerId, 'bottom', wardingStrength.id, false);

    // Skip: just call finishHalf directly — no performedCount credit.
    const result = fx.room.finishHalf(fx.player.playerId, 'bottom');
    assert.equal(result.ok, true);

    disposePlayerCards(fx.room, fx.player);

    assert.equal(fx.player.active.length, 0);
    assert.equal(fx.player.activeTracked.length, 0);
    // Both selected cards discard (wardingStrength was skipped, skewer was unused).
    assert.equal(fx.player.discard.length, 2, 'skipped + unused both discard');
    const discardIds = fx.player.discard.map((c) => c.id).sort();
    assert.deepEqual(discardIds, [skewer.id, wardingStrength.id].sort());
  });

  it('confirmPersistentHalf rejects when the slot is not engaged', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: wardingStrength, second: skewer });
    const result = fx.room.confirmPersistentHalf(fx.player.playerId, 'bottom');
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('unreachable');
    assert.equal(result.reason, 'slot_not_engaged');
  });

  it('confirmPersistentHalf rejects a non-persistent half', () => {
    const fx = makeFixture();
    // Skewer top is an attack (discard disposition). Engaging it produces a
    // non-empty queue, but if it were empty for some reason confirm should
    // still refuse — only persistent halves go to the active area.
    startTurn(fx.room, fx, { leading: skewer, second: wardingStrength });
    fx.room.engageHalf(fx.player.playerId, 'bottom', skewer.id, false);
    const result = fx.room.confirmPersistentHalf(fx.player.playerId, 'bottom');
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('unreachable');
    // Either 'queue_not_empty' (if skewer bottom has actions) or
    // 'half_not_persistent' is an acceptable rejection — both mean the same
    // user-visible thing: this isn't a confirmable persistent.
    assert.ok(
      result.reason === 'half_not_persistent' || result.reason === 'queue_not_empty',
      `unexpected reason: ${result.reason}`,
    );
  });
});
