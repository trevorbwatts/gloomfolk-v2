import type { Card } from '../types.js';

export const singleOut: Card = {
  id: 'silent-knife.single-out',
  name: 'Single Out',
  level: 1,
  initiative: 86,
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
                  condition: { kind: 'target-isolated-from-allies' },
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
    disposition: 'persistent-tracked',
    trackedUses: 4,
    persistentTrigger: { kind: 'attack-against-isolated-enemy' },
    useSlotExp: [null, 1, null, 1],
    abilities: [
      {
        steps: [
          {
            type: 'modify-future-attack',
            bonusAmount: 3,
            appliesTo: 'while-persistent-active',
            targetCondition: { kind: 'target-isolated-from-allies' },
          },
        ],
      },
    ],
  },
};
