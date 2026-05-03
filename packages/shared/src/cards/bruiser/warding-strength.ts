import type { Card } from '../types.js';

export const wardingStrength: Card = {
  id: 'bruiser.warding-strength',
  name: 'Warding Strength',
  level: 1,
  initiative: 32,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 2,
            target: { kind: 'melee' },
            node: 'square',
          },
          { type: 'apply-condition', condition: 'disarm' },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-tracked',
    trackedUses: 6,
    persistentTrigger: { kind: 'attack-targets-self' },
    useSlotExp: [1, null, 1, null, 1],
    abilities: [
      {
        steps: [
          { type: 'shield', amount: 1 },
          { type: 'retaliate', amount: 1 },
        ],
      },
    ],
  },
};
