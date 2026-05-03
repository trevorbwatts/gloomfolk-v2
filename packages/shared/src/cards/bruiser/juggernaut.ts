import type { Card } from '../types.js';

export const juggernaut: Card = {
  id: 'bruiser.juggernaut',
  name: 'Juggernaut',
  level: 2,
  initiative: 2,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 2, node: 'circle' }],
      },
      {
        steps: [{ type: 'attack', amount: 3, node: 'diamond' }],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-tracked',
    trackedUses: 4,
    persistentTrigger: { kind: 'damage-suffered' },
    useSlotExp: [1, null, 1],
    abilities: [
      {
        steps: [{ type: 'negate-damage' }],
      },
    ],
  },
};
