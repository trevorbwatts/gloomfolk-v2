import type { MonsterAbilityDeck } from '../types.js';

const setId = 'archer';

export const archerDeck: MonsterAbilityDeck = {
  setId,
  setName: 'Archer',
  cards: [
    {
      id: 'archer.cruel-bow',
      setId,
      name: 'Cruel Bow',
      initiative: 29,
      shuffle: true,
      abilities: [
        { kind: 'move', modifier: -1 },
        {
          kind: 'attack',
          modifier: -1,
          range: 3,
          effects: [{ kind: 'apply-condition', condition: 'wound' }],
        },
      ],
    },
    {
      id: 'archer.greed',
      setId,
      name: 'Greed',
      initiative: 35,
      shuffle: true,
      abilities: [
        { kind: 'move', modifier: 1, traits: ['jump'] },
        { kind: 'loot', range: 1 },
      ],
    },
    {
      id: 'archer.hasty-assault',
      setId,
      name: 'Hasty Assault',
      initiative: 40,
      abilities: [
        { kind: 'move', modifier: 1 },
        { kind: 'attack', modifier: -1 },
      ],
    },
    {
      id: 'archer.nothing-special',
      setId,
      name: 'Nothing Special',
      initiative: 53,
      abilities: [
        { kind: 'move', modifier: 0 },
        { kind: 'attack', modifier: 0 },
      ],
    },
    {
      id: 'archer.rancid-arrow',
      setId,
      name: 'Rancid Arrow',
      initiative: 54,
      abilities: [
        { kind: 'move', modifier: -2 },
        {
          kind: 'attack',
          modifier: 0,
          range: 3,
          effects: [{ kind: 'apply-condition', condition: 'poison' }],
        },
      ],
    },
    {
      id: 'archer.calculated-strike',
      setId,
      name: 'Calculated Strike',
      initiative: 69,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: 1 },
      ],
    },
    {
      id: 'archer.rapid-bolts',
      setId,
      name: 'Rapid Bolts',
      initiative: 79,
      abilities: [
        {
          kind: 'attack',
          modifier: -1,
          range: 4,
          targets: 2,
        },
      ],
    },
    {
      id: 'archer.noxious-blade',
      setId,
      name: 'Noxious Blade',
      initiative: 92,
      abilities: [
        {
          kind: 'attack',
          modifier: 2,
          effects: [{ kind: 'apply-condition', condition: 'poison' }],
        },
      ],
    },
  ],
};
