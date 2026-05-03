import type { Card } from '../types.js';

export const eyeForAnEye: Card = {
  id: 'bruiser.eye-for-an-eye',
  name: 'Eye for an Eye',
  level: 1,
  initiative: 13,
  top: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [{ type: 'shield', amount: 1 }],
      },
      {
        steps: [
          { type: 'retaliate', amount: 1 },
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
        steps: [
          {
            type: 'heal',
            amount: 3,
            target: { kind: 'self' },
            node: 'square',
          },
          { type: 'create-element', element: 'earth', mandatory: true },
        ],
      },
    ],
  },
};
