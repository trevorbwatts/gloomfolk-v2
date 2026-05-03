import type { Card } from '../types.js';

export const skirmishingManeuver: Card = {
  id: 'bruiser.skirmishing-maneuver',
  name: 'Skirmishing Maneuver',
  level: 5,
  initiative: 29,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [{ type: 'attack', amount: 2, node: 'square' }],
      },
      {
        steps: [{ type: 'move', amount: 2, node: 'circle' }],
      },
      {
        steps: [{ type: 'attack', amount: 3, node: 'diamond' }],
      },
    ],
  },
  bottom: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          { type: 'move', amount: 5, node: 'square', traits: ['jump'] },
          { type: 'create-element', element: 'air', mandatory: true },
        ],
      },
    ],
  },
};
