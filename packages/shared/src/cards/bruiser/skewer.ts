import type { Card } from '../types.js';

export const skewer: Card = {
  id: 'bruiser.skewer',
  name: 'Skewer',
  level: 1,
  initiative: 35,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: {
              kind: 'aoe',
              pattern: [
                { q: 0, r: -1 },
                { q: 0, r: -2 },
              ],
            },
            modifiers: {
              elementRiders: [
                {
                  consume: 'air',
                  attackBonus: 1,
                  pierce: { amount: 1 },
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
    disposition: 'lost',
    expOnPerform: 2,
    abilities: [
      {
        steps: [{ type: 'move', amount: 7 }],
      },
    ],
  },
};
