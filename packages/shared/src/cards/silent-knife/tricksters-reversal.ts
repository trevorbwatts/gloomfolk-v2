import type { Card } from '../types.js';

export const trickstersReversal: Card = {
  id: 'silent-knife.tricksters-reversal',
  name: "Trickster's Reversal",
  level: 'X',
  initiative: 9,
  top: {
    disposition: 'persistent-tracked',
    trackedUses: 1,
    persistentTrigger: { kind: 'melee-attack-against-shielded-enemy' },
    useSlotExp: [1],
    finalPile: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'modify-future-attack',
            bonusAmount: { kind: 'target-shield-value', offset: 2 },
            appliesTo: 'while-persistent-active',
            attackKind: 'melee',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'persistent-round',
    abilities: [
      {
        steps: [{ type: 'negate-damage' }],
      },
    ],
  },
};
