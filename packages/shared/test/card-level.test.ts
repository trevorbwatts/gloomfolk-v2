import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cardMatchesLevel } from '../src/cards/types.js';

describe('cardMatchesLevel — level matching for retrieve effects', () => {
  it('matches an exact printed level', () => {
    assert.equal(cardMatchesLevel(1, 1), true);
    assert.equal(cardMatchesLevel(2, 2), true);
    assert.equal(cardMatchesLevel(5, 5), true);
  });

  it('treats X cards as level-1 cards', () => {
    assert.equal(cardMatchesLevel('X', 1), true);
  });

  it('does not treat X cards as any other level', () => {
    assert.equal(cardMatchesLevel('X', 2), false);
    assert.equal(cardMatchesLevel('X', 3), false);
  });

  it('does not match mismatched numeric levels', () => {
    assert.equal(cardMatchesLevel(2, 1), false);
    assert.equal(cardMatchesLevel(1, 2), false);
  });
});
