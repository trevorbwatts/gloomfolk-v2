import type { Card } from '../types.js';

export const balancedMeasure: Card = {
  id: 'bruiser.balanced-measure',
  name: 'Balanced Measure',
  level: 1,
  initiative: 20,
  top: {
    disposition: 'discard',
    expOnPerform: 1,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: { kind: 'hexes-moved-this-turn' },
            target: { kind: 'melee' },
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
            amount: { kind: 'damage-dealt-this-turn' },
          },
        ],
      },
    ],
  },
};
