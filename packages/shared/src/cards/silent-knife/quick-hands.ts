import type { Card } from '../types.js';

export const quickHands: Card = {
  id: 'silent-knife.quick-hands',
  name: 'Quick Hands',
  level: 1,
  initiative: 23,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'loot', range: 1 }],
      },
      {
        steps: [{ type: 'move', amount: 2, node: 'circle' }],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    expOnPerform: 1,
    abilities: [
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
};
