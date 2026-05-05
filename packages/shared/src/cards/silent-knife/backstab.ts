import type { Card } from '../types.js';

export const backstab: Card = {
  id: 'silent-knife.backstab',
  name: 'Backstab',
  level: 'X',
  initiative: 6,
  top: {
    disposition: 'lost',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 5,
            target: { kind: 'melee' },
            node: 'diamond',
            modifiers: {
              elementRiders: [
                { consume: 'dark', attackBonus: 2, gainExp: 1 },
              ],
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
        steps: [{ type: 'move', amount: 6 }],
      },
    ],
  },
};
