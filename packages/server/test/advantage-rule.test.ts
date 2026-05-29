import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAdvantage } from '../src/room.js';

describe('resolveAdvantage — advantage/disadvantage cancellation (RAW)', () => {
  it('neither source → normal single draw (null)', () => {
    assert.equal(resolveAdvantage(false, false), null);
  });

  it('advantage only → advantage', () => {
    assert.equal(resolveAdvantage(true, false), 'advantage');
  });

  it('disadvantage only → disadvantage', () => {
    assert.equal(resolveAdvantage(false, true), 'disadvantage');
  });

  it('both at once → cancel to neither (null)', () => {
    assert.equal(resolveAdvantage(true, true), null);
  });
});
