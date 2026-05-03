import type { Card } from '../types.js';

export const fearsomeTaunt: Card = {
  id: 'bruiser.fearsome-taunt',
  name: 'Fearsome Taunt',
  level: 'X',
  initiative: 10,
  top: {
    disposition: 'discard',
    expOnPerform: 1,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'melee' },
            node: 'square',
          },
          { type: 'push', amount: 3, node: 'square' },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [{ type: 'shield', amount: 1 }],
      },
      {
        steps: [
          {
            type: 'redirect-attack',
            when: { kind: 'enemy-targets-adjacent-ally' },
            bypasses: ['range', 'line-of-sight'],
          },
        ],
      },
    ],
  },
};
