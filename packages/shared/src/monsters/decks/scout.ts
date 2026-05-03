import type { MonsterAbilityDeck } from '../types.js';

const setId = 'scout';

export const scoutDeck: MonsterAbilityDeck = {
  setId,
  setName: 'Scout',
  cards: [
    {
      id: 'scout.set-trap',
      setId,
      name: 'Set Trap',
      initiative: 14,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: -1, range: 5 },
        {
          kind: 'create-trap',
          damage: 3,
          placement: 'adjacent-empty-closest-to-enemy',
        },
      ],
    },
    {
      id: 'scout.hasty-assault',
      setId,
      name: 'Hasty Assault',
      initiative: 16,
      abilities: [
        { kind: 'move', modifier: 1 },
        { kind: 'attack', modifier: -1, range: 4 },
      ],
    },
    {
      id: 'scout.shoot-foot',
      setId,
      name: 'Shoot Foot',
      initiative: 29,
      shuffle: true,
      abilities: [
        { kind: 'move', modifier: 0 },
        {
          kind: 'attack',
          modifier: -1,
          range: 5,
          effects: [{ kind: 'apply-condition', condition: 'immobilize' }],
        },
      ],
    },
    {
      id: 'scout.nothing-special',
      setId,
      name: 'Nothing Special',
      initiative: 31,
      abilities: [
        { kind: 'move', modifier: 0 },
        { kind: 'attack', modifier: 0, range: 4 },
      ],
    },
    {
      id: 'scout.close-in',
      setId,
      name: 'Close In',
      initiative: 32,
      abilities: [
        { kind: 'move', modifier: 0 },
        { kind: 'attack', modifier: 1, range: 3 },
      ],
    },
    {
      id: 'scout.calculated-strike',
      setId,
      name: 'Calculated Strike',
      initiative: 44,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: 1, range: 4 },
      ],
    },
    {
      id: 'scout.twin-bolts',
      setId,
      name: 'Twin Bolts',
      initiative: 56,
      abilities: [{ kind: 'attack', modifier: -1, range: 4, targets: 2 }],
    },
    {
      id: 'scout.power-shot',
      setId,
      name: 'Power Shot',
      initiative: 64,
      shuffle: true,
      abilities: [{ kind: 'attack', modifier: 1, range: 5 }],
    },
  ],
};
