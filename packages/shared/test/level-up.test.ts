import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bruiser,
  canLevelUp,
  characterIgnoresItemMinusOnes,
  defaultPoolForClass,
  eligibleLevelUpCards,
  experienceRequirementByLevel,
  modifierDeckTemplateForCharacter,
  nextLevelRequirement,
  perkMarksCommitted,
  perkMarksEarned,
  perkResolvedTakes,
  validateLevelUp,
  STARTING_MODIFIER_DECK_TEMPLATE,
} from '../src/index.js';

const level2Cards = bruiser.cards.filter((c) => c.level === 2);
const level3Cards = bruiser.cards.filter((c) => c.level === 3);

test('canLevelUp: threshold is a requirement, not a cost', () => {
  assert.equal(canLevelUp(1, experienceRequirementByLevel[2] - 1), false);
  assert.equal(canLevelUp(1, experienceRequirementByLevel[2]), true);
  assert.equal(canLevelUp(1, experienceRequirementByLevel[2] + 10), true);
  // Level cap: no level 10.
  assert.equal(canLevelUp(9, 99999), false);
  assert.equal(nextLevelRequirement(9), null);
});

test('eligibleLevelUpCards: new level unlocks its cards plus skipped lower ones', () => {
  const pool = defaultPoolForClass(bruiser);
  // Reaching level 2: exactly the two level-2 cards.
  const atTwo = eligibleLevelUpCards(bruiser, pool, 2);
  assert.deepEqual(
    atTwo.map((c) => c.id).sort(),
    level2Cards.map((c) => c.id).sort(),
  );
  // Reaching level 3 having taken one level-2 card: the other level-2 card
  // plus both level-3 cards.
  const poolWithOne = [...pool, level2Cards[0]!.id];
  const atThree = eligibleLevelUpCards(bruiser, poolWithOne, 3);
  assert.deepEqual(
    atThree.map((c) => c.id).sort(),
    [level2Cards[1]!.id, ...level3Cards.map((c) => c.id)].sort(),
  );
});

test('validateLevelUp: rejects bad card, full perk, and missing XP', () => {
  const pool = [...defaultPoolForClass(bruiser)];
  const state = { level: 1, xp: experienceRequirementByLevel[2], pool, perksUnlocked: [] };
  const cardId = level2Cards[0]!.id;

  assert.deepEqual(validateLevelUp(bruiser, state, cardId, 0), {
    ok: true,
    mode: 'xp',
  });
  assert.deepEqual(validateLevelUp(bruiser, { ...state, xp: 0 }, cardId, 0), {
    ok: false,
    reason: 'not_enough_xp',
  });
  // Prosperity catch-up: no XP, but prosperity 4 allows leveling up to 2.
  assert.deepEqual(validateLevelUp(bruiser, { ...state, xp: 0 }, cardId, 0, 4), {
    ok: true,
    mode: 'catch-up',
  });
  // XP path wins when both apply.
  assert.deepEqual(validateLevelUp(bruiser, state, cardId, 0, 9), {
    ok: true,
    mode: 'xp',
  });
  // A level-3 card is not eligible when reaching level 2.
  assert.deepEqual(validateLevelUp(bruiser, state, level3Cards[0]!.id, 0), {
    ok: false,
    reason: 'card_not_eligible',
  });
  // Perk 0 has two unlinked boxes — a third mark is rejected.
  const fullState = { ...state, perksUnlocked: [0, 0] };
  assert.deepEqual(validateLevelUp(bruiser, fullState, cardId, 0), {
    ok: false,
    reason: 'perk_full',
  });
  assert.deepEqual(validateLevelUp(bruiser, state, cardId, 99), {
    ok: false,
    reason: 'bad_perk_index',
  });
});

test('perk mark accounting: levels and checkmark sets, checkmarks capped', () => {
  assert.equal(perkMarksEarned(1, 0), 0);
  assert.equal(perkMarksEarned(3, 0), 2);
  assert.equal(perkMarksEarned(1, 8), 2); // 8 checkmarks → 2 complete sets
  assert.equal(perkMarksEarned(1, 99), 6); // capped at +6
  assert.equal(perkMarksCommitted([0, 2, 0], 0), 2);
});

test('perkResolvedTakes: linked perks resolve only when all marks committed', () => {
  const linked = bruiser.perks.find((p) => p.slots.kind === 'linked')!;
  assert.equal(perkResolvedTakes(linked, linked.slots.count - 1), 0);
  assert.equal(perkResolvedTakes(linked, linked.slots.count), 1);
  const unlinked = bruiser.perks.find((p) => p.slots.kind === 'unlinked')!;
  assert.equal(perkResolvedTakes(unlinked, 2), Math.min(2, unlinked.slots.count));
});

test('modifierDeckTemplateForCharacter applies replace-modifier per take', () => {
  // Perk 0: replace one -1 with one +1, taken twice.
  const idx = bruiser.perks.findIndex(
    (p) => p.id === 'bruiser.perk.replace-minus1-with-plus1',
  );
  const deck = modifierDeckTemplateForCharacter(bruiser, [idx, idx]);
  assert.equal(deck.length, STARTING_MODIFIER_DECK_TEMPLATE.length);
  const count = (amount: number) =>
    deck.filter((c) => c.kind === 'flat' && c.amount === amount && !('effects' in c))
      .length;
  assert.equal(count(-1), 3); // 5 - 2
  assert.equal(count(1), 7); // 5 + 2
  // No perks → unchanged template.
  assert.deepEqual(
    modifierDeckTemplateForCharacter(bruiser, []),
    [...STARTING_MODIFIER_DECK_TEMPLATE],
  );
});

test('characterIgnoresItemMinusOnes reflects the resolved perk', () => {
  const idx = bruiser.perks.findIndex((p) =>
    p.effects.some((e) => e.kind === 'ignore-item-minus-ones'),
  );
  if (idx === -1) return; // class has no such perk; nothing to assert
  assert.equal(characterIgnoresItemMinusOnes(bruiser, []), false);
  const marks = Array.from(
    { length: bruiser.perks[idx]!.slots.kind === 'linked' ? bruiser.perks[idx]!.slots.count : 1 },
    () => idx,
  );
  assert.equal(characterIgnoresItemMinusOnes(bruiser, marks), true);
});
