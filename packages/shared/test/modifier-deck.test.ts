import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyModifierToAttack,
  modifierLabel,
  returnsToSupply,
  triggersReshuffle,
  shuffleCardIntoDeck,
  type ModifierCardInstance,
} from '../src/modifiers/index.js';

describe('Bless / Curse modifier cards', () => {
  it('Bless resolves as ×2, Curse as Null (×0)', () => {
    assert.equal(applyModifierToAttack(5, { kind: 'bless' }), 10);
    assert.equal(applyModifierToAttack(5, { kind: 'curse' }), 0);
  });

  it('label and supply-return flags', () => {
    assert.equal(modifierLabel({ kind: 'bless' }), 'Bless');
    assert.equal(modifierLabel({ kind: 'curse' }), 'Curse');
    assert.equal(returnsToSupply({ kind: 'bless' }), true);
    assert.equal(returnsToSupply({ kind: 'curse' }), true);
    assert.equal(returnsToSupply({ kind: 'flat', amount: 1 }), false);
  });

  it('Bless/Curse carry no reshuffle icon (unlike Null and ×2)', () => {
    assert.equal(triggersReshuffle({ kind: 'bless' }), false);
    assert.equal(triggersReshuffle({ kind: 'curse' }), false);
    assert.equal(triggersReshuffle({ kind: 'null' }), true);
    assert.equal(triggersReshuffle({ kind: 'crit' }), true);
  });

  it('shuffleCardIntoDeck adds exactly one card without touching others', () => {
    const deck: ModifierCardInstance[] = [
      { id: 'a', card: { kind: 'flat', amount: 0 } },
      { id: 'b', card: { kind: 'flat', amount: 1 } },
    ];
    const card: ModifierCardInstance = { id: 'bc1', card: { kind: 'bless' } };
    const next = shuffleCardIntoDeck(deck, card);
    assert.equal(next.length, 3);
    assert.ok(next.some((c) => c.id === 'bc1'));
    assert.ok(next.some((c) => c.id === 'a'));
    assert.ok(next.some((c) => c.id === 'b'));
  });
});
