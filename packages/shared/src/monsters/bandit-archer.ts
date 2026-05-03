import type { MonsterAttackEffect, MonsterStatCard } from './types.js';

const MUDDLE: readonly MonsterAttackEffect[] = [
  { kind: 'apply-condition', condition: 'muddle' },
];

export const banditArcher: MonsterStatCard = {
  id: 'bandit-archer',
  name: 'Bandit Archer',
  setId: 'archer',
  standeeCount: 6,
  levels: {
    0: {
      normal: { hp: 4, movement: 2, attack: 2 },
      elite: { hp: 6, movement: 2, attack: 3 },
    },
    1: {
      normal: { hp: 5, movement: 3, attack: 2 },
      elite: { hp: 7, movement: 3, attack: 3 },
    },
    2: {
      normal: { hp: 6, movement: 3, attack: 2 },
      elite: { hp: 9, movement: 3, attack: 3 },
    },
    3: {
      normal: { hp: 6, movement: 3, attack: 3 },
      elite: { hp: 10, movement: 3, attack: 4 },
    },
    // L4+ attacks apply Muddle to every hit target.
    4: {
      normal: { hp: 8, movement: 3, attack: 3, attackEffects: MUDDLE },
      elite: { hp: 10, movement: 3, attack: 4, attackEffects: MUDDLE },
    },
    5: {
      normal: { hp: 9, movement: 4, attack: 3, attackEffects: MUDDLE },
      elite: { hp: 12, movement: 4, attack: 4, attackEffects: MUDDLE },
    },
    6: {
      normal: { hp: 9, movement: 4, attack: 4, attackEffects: MUDDLE },
      elite: { hp: 13, movement: 4, attack: 5, attackEffects: MUDDLE },
    },
    7: {
      normal: { hp: 12, movement: 4, attack: 4, attackEffects: MUDDLE },
      elite: { hp: 17, movement: 4, attack: 5, attackEffects: MUDDLE },
    },
  },
};
