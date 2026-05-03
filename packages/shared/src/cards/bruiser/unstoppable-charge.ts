import type { Card } from '../types.js';

export const unstoppableCharge: Card = {
  id: 'bruiser.unstoppable-charge',
  name: 'Unstoppable Charge',
  level: 3,
  initiative: 86,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            node: 'diamond',
            modifiers: {
              conditionRiders: [
                {
                  when: { kind: 'moved-this-turn' },
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
    disposition: 'lost',
    expOnPerform: 2,
    abilities: [
      {
        steps: [{ type: 'move', amount: 4, node: 'square' }],
      },
      {
        steps: [
          {
            type: 'apply-condition',
            condition: 'stun',
            target: { kind: 'all-within-range', range: 1 },
            node: 'diamond',
          },
        ],
      },
    ],
  },
};
