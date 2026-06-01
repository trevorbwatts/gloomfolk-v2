import type { MonsterAbilityDeck } from '../types.js';

const setId = 'guard';

export const guardDeck: MonsterAbilityDeck = {
  setId,
  setName: 'Guard',
  cards: [
    {
      id: 'guard.parry-and-thrust',
      setId,
      name: 'Parry and Thrust',
      initiative: 15,
      shuffle: true,
      abilities: [
        { kind: 'shield', amount: 1 },
        { kind: 'retaliate', amount: 2 },
      ],
    },
    {
      id: 'guard.venom-shiv',
      setId,
      name: 'Venom Shiv',
      initiative: 15,
      abilities: [
        {
          kind: 'attack',
          modifier: 0,
          effects: [{ kind: 'apply-condition', condition: 'poison' }],
        },
        { kind: 'shield', amount: 1 },
      ],
    },
    {
      id: 'guard.hasty-assault',
      setId,
      name: 'Hasty Assault',
      initiative: 30,
      abilities: [
        { kind: 'move', modifier: 1 },
        { kind: 'attack', modifier: -1 },
      ],
    },
    {
      id: 'guard.throwing-axe',
      setId,
      name: 'Throwing Axe',
      initiative: 35,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: 0, range: 2 },
      ],
    },
    {
      id: 'guard.nothing-special-1',
      setId,
      name: 'Nothing Special',
      initiative: 50,
      abilities: [
        { kind: 'move', modifier: 0 },
        { kind: 'attack', modifier: 0 },
      ],
    },
    {
      id: 'guard.nothing-special-2',
      setId,
      name: 'Nothing Special',
      initiative: 50,
      abilities: [
        { kind: 'move', modifier: 0 },
        { kind: 'attack', modifier: 0 },
      ],
    },
    {
      id: 'guard.psych-up',
      setId,
      name: 'Psych Up',
      initiative: 55,
      shuffle: true,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: 0 },
        { kind: 'grant-condition', condition: 'strengthen' },
      ],
    },
    {
      id: 'guard.calculated-strike',
      setId,
      name: 'Calculated Strike',
      initiative: 70,
      abilities: [
        { kind: 'move', modifier: -1 },
        { kind: 'attack', modifier: 1 },
      ],
    },
  ],
};
