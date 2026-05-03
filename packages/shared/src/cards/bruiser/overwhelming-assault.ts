import type { Card } from '../types.js';

export const overwhelmingAssault: Card = {
  id: 'bruiser.overwhelming-assault',
  name: 'Overwhelming Assault',
  level: 1,
  initiative: 61,
  top: {
    disposition: 'lost',
    expOnPerform: 2,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 7,
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
            traits: ['jump'],
            node: 'square',
          },
          { type: 'create-element', element: 'air', mandatory: true },
        ],
      },
    ],
  },
};
