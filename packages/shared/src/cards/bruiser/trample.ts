import type { Card } from '../types.js';

export const trample: Card = {
  id: 'bruiser.trample',
  name: 'Trample',
  level: 1,
  initiative: 72,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'melee' },
            modifiers: { pierce: { amount: 3 } },
            node: 'diamond',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'lost',
    abilities: [
      {
        steps: [
          {
            type: 'move',
            amount: 4,
            traits: ['jump'],
            node: 'square',
          },
        ],
      },
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'enemies-moved-through' },
          },
          {
            type: 'gain-exp',
            amount: 1,
            trigger: { kind: 'per-enemy-targeted' },
          },
        ],
      },
    ],
  },
};
