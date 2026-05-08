import { bruiserCards } from '../cards/bruiser/index.js';
import { bruiserMasteries } from './bruiser-masteries.js';
import { bruiserPerks } from './bruiser-perks.js';
import type { CharacterClass } from './types.js';

export const bruiser: CharacterClass = {
  id: 'bruiser',
  name: 'Bruiser',
  perks: bruiserPerks,
  masteries: bruiserMasteries,
  cards: bruiserCards,
  handSize: 10,
  hp: {
    1: 10,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
    6: 20,
    7: 22,
    8: 24,
    9: 26,
  },
};
