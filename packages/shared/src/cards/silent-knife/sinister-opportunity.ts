import type { Card } from '../types.js';

export const sinisterOpportunity: Card = {
  id: 'silent-knife.sinister-opportunity',
  name: 'Sinister Opportunity',
  level: 1,
  initiative: 93,
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
                  attackBonus: 1,
                },
                {
                  condition: { kind: 'target-isolated-from-allies' },
                  attackBonus: 1,
                },
                {
                  condition: {
                    kind: 'all-of',
                    conditions: [
                      { kind: 'target-adjacent-to-your-ally' },
                      { kind: 'target-isolated-from-allies' },
                    ],
                  },
                  advantage: true,
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
