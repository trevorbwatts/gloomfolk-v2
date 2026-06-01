import type { MonsterStatCard } from './types.js';

/**
 * City Guard — armored melee defender. Carries a Shield bonus at every level
 * and picks up Retaliate from L4 on (both printed on the stat card, so they
 * are persistent bonuses, not card abilities).
 *
 * NOTE: stat values transcribed from the physical card photos and pending
 * Trevor's confirmation — the small rotated numbers (esp. L0–L2) were hard
 * to read. Correct here if any cell is wrong.
 */
export const cityGuard: MonsterStatCard = {
  id: 'city-guard',
  name: 'City Guard',
  setId: 'guard',
  standeeCount: 6,
  levels: {
    0: {
      normal: { hp: 5, movement: 2, attack: 2 },
      elite: {
        hp: 6,
        movement: 2,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
    },
    1: {
      normal: {
        hp: 5,
        movement: 2,
        attack: 2,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
      elite: {
        hp: 6,
        movement: 2,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
    },
    2: {
      normal: {
        hp: 7,
        movement: 2,
        attack: 2,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
      elite: {
        hp: 9,
        movement: 2,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
    },
    3: {
      normal: {
        hp: 8,
        movement: 2,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
      elite: {
        hp: 9,
        movement: 2,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
    },
    4: {
      normal: {
        hp: 9,
        movement: 3,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 1 }],
      },
      elite: {
        hp: 10,
        movement: 3,
        attack: 4,
        persistentBonuses: [
          { kind: 'shield', amount: 2 },
          { kind: 'retaliate', amount: 2 },
        ],
      },
    },
    5: {
      normal: {
        hp: 10,
        movement: 3,
        attack: 3,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
      elite: {
        hp: 13,
        movement: 3,
        attack: 4,
        persistentBonuses: [
          { kind: 'shield', amount: 2 },
          { kind: 'retaliate', amount: 2 },
        ],
      },
    },
    6: {
      normal: {
        hp: 13,
        movement: 3,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
      elite: {
        hp: 15,
        movement: 3,
        attack: 4,
        persistentBonuses: [
          { kind: 'shield', amount: 3 },
          { kind: 'retaliate', amount: 3 },
        ],
      },
    },
    7: {
      normal: {
        hp: 17,
        movement: 3,
        attack: 4,
        persistentBonuses: [{ kind: 'shield', amount: 2 }],
      },
      elite: {
        hp: 20,
        movement: 3,
        attack: 5,
        persistentBonuses: [
          { kind: 'shield', amount: 3 },
          { kind: 'retaliate', amount: 3 },
        ],
      },
    },
  },
};
