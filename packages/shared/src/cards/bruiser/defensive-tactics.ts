import type { Card } from '../types.js';

export const defensiveTactics: Card = {
  id: 'bruiser.defensive-tactics',
  name: 'Defensive Tactics',
  level: 5,
  initiative: 39,
  top: {
    disposition: 'persistent-scenario',
    expOnPerform: 2,
    abilities: [
      {
        steps: [
          {
            type: 'when',
            cause: { kind: 'first-shield-or-retaliate-this-round' },
            effects: [
              { type: 'shield', amount: 1 },
              { type: 'retaliate', amount: 1 },
            ],
          },
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
            type: 'pull',
            amount: 2,
            target: {
              kind: 'ranged',
              range: 3,
              targets: 2,
              targetsNode: 'square',
            },
          },
        ],
      },
    ],
  },
};
