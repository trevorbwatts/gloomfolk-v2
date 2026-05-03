import type { Card } from '../types.js';

export const spareDagger: Card = {
  id: 'bruiser.spare-dagger',
  name: 'Spare Dagger',
  level: 1,
  initiative: 27,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'ranged', range: 3 },
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
            type: 'attack',
            amount: 2,
            target: { kind: 'melee' },
            modifiers: { pierce: { amount: 1, node: 'square' } },
            node: 'diamond',
          },
        ],
      },
    ],
  },
};
