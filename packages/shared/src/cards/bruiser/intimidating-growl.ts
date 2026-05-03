import type { Card } from '../types.js';

export const intimidatingGrowl: Card = {
  id: 'bruiser.intimidating-growl',
  name: 'Intimidating Growl',
  level: 2,
  initiative: 51,
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
              nodes: ['circle', 'circle'],
            },
            node: 'square',
          },
          { type: 'push', amount: 2 },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-tracked',
    finalPile: 'discard',
    trackedUses: 2,
    persistentTrigger: { kind: 'move-ability-performed' },
    useSlotExp: [1],
    abilities: [
      {
        oneShot: true,
        steps: [{ type: 'move', amount: 2 }],
      },
      {
        steps: [{ type: 'modify-future-move', bonusAmount: 1 }],
      },
    ],
  },
};
