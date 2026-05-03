import type { Card } from '../types.js';

export const leapingCleave: Card = {
  id: 'bruiser.leaping-cleave',
  name: 'Leaping Cleave',
  level: 1,
  initiative: 54,
  top: {
    disposition: 'discard',
    expOnPerform: 1,
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: {
              kind: 'aoe',
              // Two adjacent hexes forming a melee arc with the actor.
              // Both adjacent to origin (=> melee classification) and to each
              // other. Rotatable + mirrorable at cast time (12 orientations).
              pattern: [
                { q: 1, r: -1 },
                { q: 1, r: 0 },
              ],
            },
            node: 'square',
          },
        ],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'move',
            amount: 3,
            traits: ['jump'],
            node: 'square',
          },
        ],
      },
      {
        steps: [
          {
            type: 'push',
            amount: 2,
            range: 1,
            node: 'square',
          },
        ],
      },
    ],
  },
};
