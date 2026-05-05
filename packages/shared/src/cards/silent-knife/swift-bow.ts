import type { Card } from '../types.js';

export const swiftBow: Card = {
  id: 'silent-knife.swift-bow',
  name: 'Swift Bow',
  level: 1,
  initiative: 36,
  top: {
    disposition: 'discard',
    abilities: [
      {
        steps: [
          {
            type: 'attack',
            amount: 3,
            target: { kind: 'ranged', range: 4 },
            node: 'diamond',
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
            node: 'circle',
            lootEnteredHexes: true,
          },
        ],
      },
    ],
  },
};
