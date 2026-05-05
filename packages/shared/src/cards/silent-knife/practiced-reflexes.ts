import type { Card } from '../types.js';

export const practicedReflexes: Card = {
  id: 'silent-knife.practiced-reflexes',
  name: 'Practiced Reflexes',
  level: 1,
  initiative: 64,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 3, node: 'circle' }],
      },
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'melee' },
            node: 'diamond',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'move',
            amount: 3,
            node: 'circle',
            mayBypassTraps: true,
          },
        ],
      },
      {
        steps: [
          {
            type: 'destroy-trap',
            target: { kind: 'hex-entered-this-move-ability' },
            gainExp: 1,
          },
        ],
      },
    ],
  },
};
