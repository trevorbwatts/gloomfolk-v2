import type { Card } from '../types.js';

export const pushThrough: Card = {
  id: 'bruiser.push-through',
  name: 'Push Through',
  level: 4,
  initiative: 57,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'heal',
            amount: 5,
            target: { kind: 'self' },
            node: 'diamond',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [
          {
            type: 'modify-future-attack',
            bonusAmount: 1,
            appliesTo: 'next-attack-ability',
          },
        ],
      },
      {
        oneShot: true,
        steps: [{ type: 'move', amount: 3, node: 'circle' }],
      },
    ],
  },
};
