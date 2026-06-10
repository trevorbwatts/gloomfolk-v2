import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCatchUpLevelUp,
  catchUpLevelCap,
  clampReputation,
  defaultCampaignSheet,
  normalizeCampaignSheet,
  prosperityBoxesFloor,
  prosperityLevel,
  PROSPERITY_LEVEL_THRESHOLDS,
  scenarioCompletionInspiration,
} from '../src/index.js';

test('clampReputation: [-10, cap], cap defaults to 12', () => {
  assert.equal(clampReputation(15), 12);
  assert.equal(clampReputation(-12), -10);
  assert.equal(clampReputation(5), 5);
  // A raised cap allows the locked 13–20 range.
  assert.equal(clampReputation(15, 20), 15);
});

test('prosperityLevel: thresholds are cumulative boxes', () => {
  assert.equal(prosperityLevel(0), 1);
  const l2 = PROSPERITY_LEVEL_THRESHOLDS[0]!;
  assert.equal(prosperityLevel(l2 - 1), 1);
  assert.equal(prosperityLevel(l2), 2);
  const l9 = PROSPERITY_LEVEL_THRESHOLDS[7]!;
  assert.equal(prosperityLevel(l9), 9);
  assert.equal(prosperityLevel(l9 + 100), 9);
});

test('prosperityBoxesFloor: −X never erases a numbered box or further', () => {
  // At level 1, boxes can be erased to zero.
  assert.equal(prosperityBoxesFloor(2), 0);
  // Past the level-3 box, erasing stops at the level-3 threshold.
  const l3 = PROSPERITY_LEVEL_THRESHOLDS[1]!;
  assert.equal(prosperityBoxesFloor(l3 + 2), l3);
  assert.equal(prosperityBoxesFloor(l3), l3);
});

test('catch-up cap is half prosperity rounded up', () => {
  assert.equal(catchUpLevelCap(1), 1);
  assert.equal(catchUpLevelCap(4), 2);
  assert.equal(catchUpLevelCap(5), 3);
  assert.equal(catchUpLevelCap(9), 5);
  // Eligible only while strictly below the cap.
  assert.equal(canCatchUpLevelUp(1, 4), true);
  assert.equal(canCatchUpLevelUp(2, 4), false);
  assert.equal(canCatchUpLevelUp(1, 1), false);
});

test('scenario completion inspiration: 4 minus party size, floored at 0', () => {
  assert.equal(scenarioCompletionInspiration(2), 2);
  assert.equal(scenarioCompletionInspiration(4), 0);
  assert.equal(scenarioCompletionInspiration(5), 0);
});

test('normalizeCampaignSheet backfills legacy/partial saves', () => {
  assert.deepEqual(normalizeCampaignSheet(undefined), defaultCampaignSheet());
  const partial = normalizeCampaignSheet({
    inspiration: 3,
    reputation: { demons: 4 } as never,
  });
  assert.equal(partial.inspiration, 3);
  assert.equal(partial.reputation.demons, 4);
  assert.equal(partial.reputation.military, 0);
  assert.equal(partial.reputationCap, 12);
  assert.deepEqual(partial.retiredCharacters, []);
});
