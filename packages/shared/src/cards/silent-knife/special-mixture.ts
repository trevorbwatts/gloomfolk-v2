import type { Card } from '../types.js';

export const specialMixture: Card = {
  id: 'silent-knife.special-mixture',
  name: 'Special Mixture',
  level: 1,
  initiative: 33,
  top: {
    disposition: 'lost',
    abilities: [
      {
        steps: [
          {
            type: 'heal',
            amount: 3,
            target: { kind: 'self' },
            node: 'diamond',
          },
          { type: 'create-element', element: 'dark' },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 3, node: 'circle' }],
      },
      {
        steps: [
          {
            type: 'apply-condition',
            condition: 'poison',
            target: { kind: 'ranged', range: 1 },
            node: 'diamond',
          },
        ],
      },
    ],
  },
};
