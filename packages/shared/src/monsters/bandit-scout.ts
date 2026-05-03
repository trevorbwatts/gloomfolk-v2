import type { MonsterAttackEffect, MonsterStatCard } from './types.js';

const MUDDLE: readonly MonsterAttackEffect[] = [
  { kind: 'apply-condition', condition: 'muddle' },
];

export const banditScout: MonsterStatCard = {
  id: 'bandit-scout',
  name: 'Bandit Scout',
  setId: 'scout',
  standeeCount: 6,
  levels: {
    0: {
      normal: { hp: 5, movement: 2, attack: 2 },
      elite: { hp: 7, movement: 2, attack: 3 },
    },
    1: {
      normal: { hp: 6, movement: 3, attack: 2 },
      elite: {
        hp: 8,
        movement: 3,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
    },
    2: {
      normal: { hp: 7, movement: 3, attack: 3 },
      elite: {
        hp: 9,
        movement: 3,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
    },
    3: {
      normal: { hp: 10, movement: 3, attack: 3 },
      elite: {
        hp: 12,
        movement: 3,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
    },
    // L4+ attacks apply Muddle to every hit target (both ranks).
    4: {
      normal: { hp: 11, movement: 4, attack: 3, attackEffects: MUDDLE },
      elite: {
        hp: 14,
        movement: 4,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
        attackEffects: MUDDLE,
      },
    },
    5: {
      normal: { hp: 11, movement: 4, attack: 4, attackEffects: MUDDLE },
      elite: {
        hp: 15,
        movement: 4,
        attack: 5,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
        attackEffects: MUDDLE,
      },
    },
    6: {
      normal: { hp: 16, movement: 4, attack: 4, attackEffects: MUDDLE },
      elite: {
        hp: 18,
        movement: 4,
        attack: 5,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
        attackEffects: MUDDLE,
      },
    },
    7: {
      normal: { hp: 19, movement: 4, attack: 4, attackEffects: MUDDLE },
      elite: {
        hp: 22,
        movement: 4,
        attack: 5,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
        attackEffects: MUDDLE,
      },
    },
  },
};
