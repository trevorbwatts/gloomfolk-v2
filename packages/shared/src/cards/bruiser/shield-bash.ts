import type { Card } from '../types.js';

export const shieldBash: Card = {
  id: 'bruiser.shield-bash',
  name: 'Shield Bash',
  level: 1,
  initiative: 15,
  top: {
    disposition: 'lost',
    expOnPerform: 2,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 4,
            target: { kind: 'melee' },
            node: 'diamond',
          },
          { type: 'apply-condition', condition: 'stun' },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [{ type: 'move', amount: 2, node: 'square' }],
      },
      {
        steps: [{ type: 'shield', amount: 1 }],
      },
    ],
  },
};
