import type { Card } from '../types.js';

export const flankingStrike: Card = {
  id: 'silent-knife.flanking-strike',
  name: 'Flanking Strike',
  level: 1,
  initiative: 4,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'melee' },
            node: 'diamond',
            modifiers: {
              targetConditionalBonuses: [
                {
                  condition: { kind: 'target-adjacent-to-your-ally' },
                  attackBonus: 2,
                  gainExp: 1,
                },
              ],
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
        steps: [{ type: 'move', amount: 5 }],
      },
    ],
  },
};
