import type { CharacterDef } from '../types.js';

export const CHARACTERS: Record<string, CharacterDef> = {
  bruiser: {
    id: 'bruiser',
    name: 'Bruiser',
    blurb: 'Fast melee bruiser. Closes the gap and hits hard.',
    maxHp: 10,
    cardIds: ['s_flung', 's_plow', 's_grit', 's_impale', 's_dblow', 's_measure', 's_disengage', 's_ward', 's_bash', 's_vault', 's_juggernaut', 's_intimidate', 's_hookchain', 's_charge', 's_whirlwind', 's_pushthrough', 's_skirmish', 's_defensive'],
  },
  support: {
    id: 'support',
    name: 'Support',
    blurb: 'Ranged attacker with healing. Stay back, keep allies up.',
    maxHp: 8,
    cardIds: ['p_quick', 'p_aimed', 'p_heal', 'p_volley', 'p_ward', 'p_snipe', 'p_mend', 'p_step'],
  },
};
