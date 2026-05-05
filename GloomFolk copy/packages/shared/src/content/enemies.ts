import type { EnemyDef } from '../types.js';

export const ENEMIES: Record<string, EnemyDef> = {
  grunt: {
    id: 'grunt',
    name: 'Grunt',
    maxHp: 4,
    initiative: 40,
    move: 3,
    attackRange: 1,
    attackDamage: 2,
  },
  shooter: {
    id: 'shooter',
    name: 'Shooter',
    maxHp: 3,
    initiative: 50,
    move: 2,
    attackRange: 3,
    attackDamage: 2,
  },
};
