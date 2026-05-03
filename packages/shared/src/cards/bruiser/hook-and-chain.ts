import type { Card } from '../types.js';

export const hookAndChain: Card = {
  id: 'bruiser.hook-and-chain',
  name: 'Hook and Chain',
  level: 3,
  initiative: 42,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'ranged', range: 4 },
          },
          { type: 'pull', amount: 3 },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 4 }],
      },
      {
        steps: [
          {
            type: 'when',
            cause: { kind: 'moved-in-straight-line' },
            effects: [
              {
                type: 'attack',
                amount: { kind: 'hexes-moved-this-turn' },
              },
            ],
          },
        ],
      },
    ],
  },
};
