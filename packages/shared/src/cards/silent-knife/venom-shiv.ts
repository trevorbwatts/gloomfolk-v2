import type { Card } from '../types.js';

export const venomShiv: Card = {
  id: 'silent-knife.venom-shiv',
  name: 'Venom Shiv',
  level: 1,
  initiative: 8,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'melee' },
            modifiers: { pierce: { amount: 1 } },
            node: 'diamond',
          },
          { type: 'apply-condition', condition: 'poison' },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [
          {
            type: 'modify-future-attack',
            pierceBonus: 2,
            appliesTo: 'all-attacks-this-round',
            attackKind: 'ranged',
          },
        ],
      },
    ],
  },
};
