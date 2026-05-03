import type { Card } from '../types.js';

export const sweepingBlow: Card = {
  id: 'bruiser.sweeping-blow',
  name: 'Sweeping Blow',
  level: 'X',
  initiative: 23,
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
              kind: 'aoe',
              pattern: [
                { q: 0, r: -1 },
                { q: 1, r: -1 },
                { q: 1, r: 0 },
              ],
              nodes: ['circle'],
            },
            modifiers: {
              targetConditionalBonuses: [
                {
                  condition: { kind: 'target-undamaged' },
                  attackBonus: 1,
                },
              ],
            },
          },
          { type: 'apply-condition', condition: 'muddle' },
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
    ],
  },
};
