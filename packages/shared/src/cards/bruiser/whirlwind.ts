import type { Card } from '../types.js';

export const whirlwind: Card = {
  id: 'bruiser.whirlwind',
  name: 'Whirlwind',
  level: 4,
  initiative: 28,
  top: {
    disposition: 'lost',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 5,
            node: 'diamond',
            target: { kind: 'all-within-range', range: 1 },
          },
          {
            type: 'gain-exp',
            amount: 1,
            trigger: { kind: 'per-enemy-targeted' },
          },
          { type: 'create-element', element: 'air', mandatory: true },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 4, node: 'circle' }],
      },
      {
        steps: [
          {
            type: 'push',
            amount: 3,
            node: 'square',
            target: { kind: 'all-within-range', range: 1, scope: 'figures' },
          },
        ],
      },
    ],
  },
};
