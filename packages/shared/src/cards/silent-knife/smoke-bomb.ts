import type { Card } from '../types.js';

export const smokeBomb: Card = {
  id: 'silent-knife.smoke-bomb',
  name: 'Smoke Bomb',
  level: 'X',
  initiative: 12,
  top: {
    disposition: 'persistent-tracked',
    trackedUses: 1,
    persistentTrigger: { kind: 'attack-while-invisible' },
    useSlotExp: [1],
    abilities: [
      {
        oneShot: true,
        steps: [
          {
            type: 'apply-condition',
            condition: 'invisible',
            target: { kind: 'self' },
            node: 'diamond',
          },
          { type: 'create-element', element: 'dark' },
        ],
      },
      {
        steps: [
          {
            type: 'modify-future-attack',
            doubleAttack: true,
            appliesTo: 'while-persistent-active',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'move', amount: 4 }],
      },
      {
        steps: [
          {
            type: 'control-enemy-move',
            target: { kind: 'ranged', range: 1 },
            moveAmount: 1,
            endConstraint: 'adjacent-to-actor',
          },
        ],
      },
    ],
  },
};
