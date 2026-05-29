import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BATTLE_GOALS,
  evaluateBattleGoal,
  dealBattleGoalIds,
  type BattleGoalEvent,
  type BattleGoalEvaluationContext,
} from '../src/battle-goals/index.js';

const ME = 'char-me';
const ALLY = 'char-ally';

function ctx(
  over: Partial<BattleGoalEvaluationContext> = {},
): BattleGoalEvaluationContext {
  return {
    characterId: ME,
    allCharacterIds: [ME, ALLY],
    lootByCharacter: {},
    monsterTypesInScenario: [],
    ...over,
  };
}

function run(goalId: string, events: BattleGoalEvent[], c = ctx()): boolean {
  return evaluateBattleGoal(goalId, events, c).achieved;
}

// A fully-populated enemy_killed with sensible defaults, overridable per test.
function kill(over: Partial<Extract<BattleGoalEvent, { kind: 'enemy_killed' }>> = {}): BattleGoalEvent {
  return {
    kind: 'enemy_killed',
    killerCharacterId: ME,
    targetUnitId: 'm1',
    targetNegativeConditions: [],
    byAttack: true,
    overkill: 0,
    targetWasUndamaged: false,
    attackAdvantage: 'normal',
    targetRank: 'normal',
    targetDefId: 'bandit-archer',
    droppedLootTokenId: null,
    elementsStrongOrWaning: 0,
    targetAdjacentToKiller: true,
    killerAdjacentToOtherEnemy: false,
    targetHadTakenTurn: true,
    ...over,
  };
}

test('every goal id is unique and evaluable on an empty log', () => {
  const ids = new Set<string>();
  for (const g of BATTLE_GOALS) {
    assert.ok(!ids.has(g.id), `duplicate id ${g.id}`);
    ids.add(g.id);
    // Should not throw on an empty event log.
    evaluateBattleGoal(g.id, [], ctx());
  }
  assert.equal(ids.size, BATTLE_GOALS.length);
});

test('Accountant: empty hand at every rest (vacuous + violation)', () => {
  assert.equal(run('accountant', []), true); // never rested
  assert.equal(
    run('accountant', [
      { kind: 'rest', characterId: ME, restKind: 'short', handSizeAtRest: 0 },
    ]),
    true,
  );
  assert.equal(
    run('accountant', [
      { kind: 'rest', characterId: ME, restKind: 'short', handSizeAtRest: 2 },
    ]),
    false,
  );
});

test('owner filtering: another character resting does not violate Accountant', () => {
  assert.equal(
    run('accountant', [
      { kind: 'rest', characterId: ALLY, restKind: 'short', handSizeAtRest: 3 },
    ]),
    true,
  );
});

test('Executioner: undamaged single-attack kill', () => {
  assert.equal(run('executioner', [kill({ targetWasUndamaged: true })]), true);
  assert.equal(run('executioner', [kill({ targetWasUndamaged: false })]), false);
  // someone else's kill doesn't count
  assert.equal(
    run('executioner', [kill({ killerCharacterId: ALLY, targetWasUndamaged: true })]),
    false,
  );
});

test('Closer vs Opener: last vs first kill ordering', () => {
  const log: BattleGoalEvent[] = [
    kill({ killerCharacterId: ME }),
    kill({ killerCharacterId: ALLY }),
  ];
  assert.equal(run('opener', log), true); // I got the first kill
  assert.equal(run('closer', log), false); // ally got the last
  assert.equal(run('closer', [...log, kill({ killerCharacterId: ME })]), true);
});

test('Slayer: two kills in the same round, reset by round_start', () => {
  const sameRound: BattleGoalEvent[] = [kill(), kill()];
  assert.equal(run('slayer', sameRound), true);
  const split: BattleGoalEvent[] = [
    kill(),
    { kind: 'round_start', round: 2 },
    kill(),
  ];
  assert.equal(run('slayer', split), false);
});

test('Hunter: elite-kill threshold scales with party size', () => {
  const oneElite = [kill({ targetRank: 'elite' })];
  assert.equal(run('hunter', oneElite, ctx()), true); // 2 chars → need 1
  assert.equal(
    run('hunter', oneElite, ctx({ allCharacterIds: ['a', 'b', 'c', ME] })),
    false, // 4 chars → need 2
  );
});

test('Ascetic / Egoist: comparative loot is strict', () => {
  const loot = ctx({ lootByCharacter: { [ME]: 1, [ALLY]: 3 } });
  assert.equal(run('ascetic', [], loot), true);
  assert.equal(run('egoist', [], loot), false);
  const tie = ctx({ lootByCharacter: { [ME]: 2, [ALLY]: 2 } });
  assert.equal(run('ascetic', [], tie), false); // tie doesn't qualify
});

test('Recluse: checkmarks scale with four characters', () => {
  const solo = ctx({ allCharacterIds: [ME] });
  const r1 = evaluateBattleGoal('recluse', [], solo);
  assert.equal(r1.achieved, true);
  assert.equal(r1.checkmarks, 1);
  const four = ctx({ allCharacterIds: [ME, 'b', 'c', 'd'] });
  const r2 = evaluateBattleGoal('recluse', [], four);
  assert.equal(r2.checkmarks, 2);
});

test('Exterminator: must personally kill every monster type present', () => {
  const c = ctx({ monsterTypesInScenario: ['bandit-archer', 'bandit-scout'] });
  assert.equal(run('exterminator', [kill({ targetDefId: 'bandit-archer' })], c), false);
  assert.equal(
    run(
      'exterminator',
      [kill({ targetDefId: 'bandit-archer' }), kill({ targetDefId: 'bandit-scout' })],
      c,
    ),
    true,
  );
});

test('dealBattleGoalIds: deals 3 distinct ids deterministically', () => {
  const ids = dealBattleGoalIds(3, () => 0.42);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
});
