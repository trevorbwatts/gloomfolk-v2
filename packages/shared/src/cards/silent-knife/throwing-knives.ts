import type { Card } from '../types.js';

export const throwingKnives: Card = {
  id: 'silent-knife.throwing-knives',
  name: 'Throwing Knives',
  level: 1,
  initiative: 10,
  top: {
    disposition: 'discard',
    expOnPerform: 1,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 2,
            target: {
              kind: 'ranged',
              range: 3,
              rangeNode: 'square',
              targets: 2,
              targetsNode: 'square',
            },
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
            type: 'pull',
            amount: 2,
            node: 'square',
            range: 3,
            rangeNode: 'square',
          },
        ],
      },
    ],
  },
};
