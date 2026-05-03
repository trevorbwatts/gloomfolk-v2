import type { Card } from '../types.js';

export const provokingRoar: Card = {
  id: 'bruiser.provoking-roar',
  name: 'Provoking Roar',
  level: 'X',
  initiative: 18,
  top: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [
          {
            type: 'pull',
            amount: 2,
            range: 3,
            rangeNode: 'square',
            node: 'square',
          },
          { type: 'apply-condition', condition: 'muddle' },
        ],
      },
      {
        steps: [
          { type: 'retaliate', amount: 2 },
          {
            type: 'gain-exp',
            amount: 1,
            trigger: { kind: 'on-next-retaliate-this-round' },
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 2 }],
      },
      {
        steps: [
          {
            type: 'pull',
            amount: 2,
            range: 3,
            rangeNode: 'square',
            node: 'square',
          },
        ],
      },
    ],
  },
};
