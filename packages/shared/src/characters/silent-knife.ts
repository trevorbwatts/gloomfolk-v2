import { silentKnifeCards } from '../cards/silent-knife/index.js';
import { silentKnifeMasteries } from './silent-knife-masteries.js';
import { silentKnifePerks } from './silent-knife-perks.js';
import type { CharacterClass } from './types.js';

export const silentKnife: CharacterClass = {
  id: 'silent-knife',
  name: 'Silent Knife',
  perks: silentKnifePerks,
  masteries: silentKnifeMasteries,
  cards: silentKnifeCards,
  handSize: 9,
  hp: {
    1: 8,
    2: 9,
    3: 11,
    4: 12,
    5: 14,
    6: 15,
    7: 17,
    8: 18,
    9: 20,
  },
};
