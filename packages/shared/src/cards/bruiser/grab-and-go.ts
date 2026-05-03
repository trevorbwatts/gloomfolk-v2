import type { Card } from '../types.js';

export const grabAndGo: Card = {
  id: 'bruiser.grab-and-go',
  name: 'Grab and Go',
  level: 1,
  initiative: 87,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'loot', range: 1 }],
      },
      {
        steps: [
          {
            type: 'heal',
            amount: 2,
            target: { kind: 'self' },
            node: 'square',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 4, node: 'square' }],
      },
    ],
  },
};
