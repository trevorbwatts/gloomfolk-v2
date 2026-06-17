import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '@gloomfolk/shared';
import { grabAndGo } from '@gloomfolk/shared';
import { makeFixture, startTurn } from './helpers.js';

/** Minimal second card so startTurn has a distinct leading/second pair. */
const filler: Card = {
  id: 'filler',
  name: 'Filler',
  level: 1,
  initiative: 50,
  top: { disposition: 'discard', abilities: [{ steps: [{ type: 'shield', amount: 1 }] }] },
  bottom: { disposition: 'discard', abilities: [{ steps: [{ type: 'move', amount: 2 }] }] },
};

function lootActionId(room: ReturnType<typeof makeFixture>['room']): string {
  const ct = (room as unknown as { currentTurn: { topSlot: { actions: { id: string; type: string }[] } } }).currentTurn;
  const a = ct.topSlot.actions.find((x) => x.type === 'loot');
  assert.ok(a, 'expected a loot action in the engaged top half');
  return a!.id;
}

describe('Loot ability (Loot range 1)', () => {
  it('collects money tokens within range and leaves the rest', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: grabAndGo, second: filler });
    // Tokens at distance 0, 1, and 2 from the player at {0,0}.
    fx.room.moneyTokens = [
      { id: 't0', hex: { q: 0, r: 0 } },
      { id: 't1', hex: { q: 1, r: 0 } },
      { id: 't2', hex: { q: 2, r: 0 } },
    ];

    const engaged = fx.room.engageHalf(fx.player.playerId, 'top', grabAndGo.id, false);
    assert.equal(engaged.ok, true);

    const res = fx.room.performAction(fx.player.playerId, 'top', lootActionId(fx.room), undefined);
    assert.equal(res.ok, true);

    assert.equal(fx.unit.moneyTokensHeld, 2, 'looted the in-range tokens (dist 0 + 1)');
    assert.deepEqual(
      fx.room.moneyTokens.map((t) => t.id),
      ['t2'],
      'the out-of-range token remains on the map',
    );
  });

  it('completes harmlessly when there is nothing in range', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: grabAndGo, second: filler });
    fx.room.moneyTokens = [{ id: 'far', hex: { q: 5, r: 0 } }];

    fx.room.engageHalf(fx.player.playerId, 'top', grabAndGo.id, false);
    const res = fx.room.performAction(fx.player.playerId, 'top', lootActionId(fx.room), undefined);
    assert.equal(res.ok, true);
    assert.equal(fx.unit.moneyTokensHeld ?? 0, 0);
    assert.equal(fx.room.moneyTokens.length, 1);
  });
});

describe('unengageHalf (Back button)', () => {
  it('returns an engaged half to unlocked before anything is performed', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: grabAndGo, second: filler });
    fx.room.engageHalf(fx.player.playerId, 'top', grabAndGo.id, false);

    const ct = (fx.room as unknown as { currentTurn: { topSlot: { status: string; cardId: string | null; actions: unknown[] }; activeSlot: string | null } }).currentTurn;
    assert.equal(ct.topSlot.status, 'engaged');

    const res = fx.room.unengageHalf(fx.player.playerId, 'top');
    assert.equal(res.ok, true);
    assert.equal(ct.topSlot.status, 'unlocked');
    assert.equal(ct.topSlot.cardId, null);
    assert.equal(ct.topSlot.actions.length, 0);
    assert.equal(ct.activeSlot, null);
  });

  it('refuses once an action in the half has been performed', () => {
    const fx = makeFixture();
    startTurn(fx.room, fx, { leading: grabAndGo, second: filler });
    fx.room.moneyTokens = [{ id: 't0', hex: { q: 0, r: 0 } }];
    fx.room.engageHalf(fx.player.playerId, 'top', grabAndGo.id, false);
    fx.room.performAction(fx.player.playerId, 'top', lootActionId(fx.room), undefined);

    const res = fx.room.unengageHalf(fx.player.playerId, 'top');
    assert.equal(res.ok, false);
    assert.equal((res as { reason: string }).reason, 'already_performed');
  });
});

describe('Shop undo (same-session purchase)', () => {
  it('refunds gold, restocks, and clears ownership for a session purchase', () => {
    const fx = makeFixture();
    fx.character.gold = 100;

    const buy = fx.room.buyItem(fx.player.playerId, 'weathered-boots');
    assert.equal(buy.ok, true);
    assert.equal(fx.character.gold, 85, 'gold debited by item cost (15)');
    assert.ok(fx.character.ownedItemIds.includes('weathered-boots'));
    assert.ok(fx.character.sessionPurchasedItemIds.includes('weathered-boots'));
    const stockAfterBuy = (fx.room.campaign.shop ?? []).find((s) => s.itemId === 'weathered-boots');
    const remainingAfterBuy = stockAfterBuy?.remaining ?? 0;

    const undo = fx.room.undoBuyItem(fx.player.playerId, 'weathered-boots');
    assert.equal(undo.ok, true);
    assert.equal(fx.character.gold, 100, 'gold fully refunded');
    assert.ok(!fx.character.ownedItemIds.includes('weathered-boots'));
    assert.ok(!fx.character.broughtItemIds.includes('weathered-boots'));
    assert.ok(!fx.character.sessionPurchasedItemIds.includes('weathered-boots'));
    const stockAfterUndo = (fx.room.campaign.shop ?? []).find((s) => s.itemId === 'weathered-boots');
    assert.equal((stockAfterUndo?.remaining ?? 0), remainingAfterBuy + 1, 'item returned to stock');
  });

  it('refuses to undo an item not bought this session', () => {
    const fx = makeFixture();
    // Owned from a previous trip (not in sessionPurchasedItemIds).
    fx.character.ownedItemIds.push('weathered-boots');

    const undo = fx.room.undoBuyItem(fx.player.playerId, 'weathered-boots');
    assert.equal(undo.ok, false);
    assert.equal((undo as { reason: string }).reason, 'not_bought_this_session');
    assert.ok(fx.character.ownedItemIds.includes('weathered-boots'), 'still owned');
  });
});

describe('Shop reputation gate', () => {
  it('blocks a gated item below the faction threshold and allows it at/above', () => {
    const fx = makeFixture();
    fx.character.gold = 100;
    // Studded Leather (†014) requires Military reputation ≥ 3 and isn't in
    // the starting stock — stock it for the test.
    fx.room.campaign.shop = [
      ...(fx.room.campaign.shop ?? []),
      { itemId: 'studded-leather', remaining: 2 },
    ];

    const blocked = fx.room.buyItem(fx.player.playerId, 'studded-leather');
    assert.equal(blocked.ok, false);
    assert.equal((blocked as { reason: string }).reason, 'reputation_too_low');

    fx.room.campaign.sheet!.reputation.military = 3;
    const bought = fx.room.buyItem(fx.player.playerId, 'studded-leather');
    assert.equal(bought.ok, true);
    assert.ok(fx.character.ownedItemIds.includes('studded-leather'));
  });
});
