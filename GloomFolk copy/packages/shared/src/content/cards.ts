import type { AbilityCard } from '../types.js';

export const CARDS: Record<string, AbilityCard> = {
  // ── Bruiser — melee bruiser (level 1 cards) ──────────────────────────────

  // Spare Dagger: top = ranged throw, bottom = quick melee stab
  s_flung: {
    id: 's_flung', name: 'Flung Blade', initiative: 27,
    top:    { move: 2, actions: [{ kind: 'attack', range: 3, damage: 3 }] },
    bottom: { move: 2, actions: [{ kind: 'attack', range: 1, damage: 2 }] },
  },

  // Trample: top = pierce strike, bottom = trample charge
  s_plow: {
    id: 's_plow', name: 'Plow Through', initiative: 72,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 3, pierce: 2 }] },
    bottom: { move: 4, actions: [{ kind: 'trample', damage: 3 }] },
  },

  // Pain Tolerance: top = retaliate stance (round bonus), bottom = self-heal
  s_grit: {
    id: 's_grit', name: 'Pain Tolerance', initiative: 13,
    top:    { move: 2, actions: [{ kind: 'retaliate', value: 2 }] },
    bottom: { move: 2, actions: [{ kind: 'heal', range: 0, amount: 3 }] },
  },

  // Skewer: top = melee strike, bottom = sprint (loss)
  s_impale: {
    id: 's_impale', name: 'Impale', initiative: 35,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 3 }] },
    bottom: { move: 7, actions: [] },
  },

  // Overwhelming Assault: top = massive strike (loss), bottom = repositioning
  s_dblow: {
    id: 's_dblow', name: 'Death Blow', initiative: 61,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 7 }] },
    bottom: { move: 3, actions: [] },
  },

  // Balanced Measure: both halves simplified from variable-X effects
  s_measure: {
    id: 's_measure', name: 'Measured Strike', initiative: 20,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 3 }] },
    bottom: { move: 3, actions: [] },
  },

  // Grab and Go: top = minor heal (loot dropped), bottom = pure sprint
  s_disengage: {
    id: 's_disengage', name: 'Disengage', initiative: 87,
    top:    { move: 2, actions: [{ kind: 'heal', range: 0, amount: 2 }] },
    bottom: { move: 4, actions: [] },
  },

  // Iron Ward: top = strike, bottom = shield stance (round bonus)
  s_ward: {
    id: 's_ward', name: 'Iron Ward', initiative: 32,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 2 }] },
    bottom: { move: 2, actions: [{ kind: 'shield', value: 2 }] },
  },

  // Buckler Smash: top = stunning strike, bottom = guard stance
  s_bash: {
    id: 's_bash', name: 'Buckler Smash', initiative: 15,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 4, appliedConditions: ['stun'] }] },
    bottom: { move: 2, actions: [{ kind: 'shield', value: 1 }] },
  },

  // Leaping Cleave: top = cleave (AoE simplified), bottom = leaping strike
  s_vault: {
    id: 's_vault', name: 'Vault Strike', initiative: 54,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 3 }] },
    bottom: { move: 3, actions: [{ kind: 'attack', range: 1, damage: 2 }] },
  },

  // ── Bruiser — level 2 cards ──────────────────────────────────────────────

  s_juggernaut: {
    id: 's_juggernaut', name: 'Juggernaut', initiative: 34,
    top:    { move: 2, actions: [{ kind: 'attack', range: 1, damage: 3 }] },
    bottom: { move: 0, actions: [{ kind: 'persistent', effect: {
      kind: 'negate-damage', charges: 4, lostWhenEmpty: true,
    } }] },
  },

  s_intimidate: {
    id: 's_intimidate', name: 'Intimidating Growl', initiative: 51,
    top: { move: 0, actions: [{
      kind: 'attack', range: 2, damage: 2,
      appliedConditions: ['wound'],
      aoe: { hexes: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }] },
    }] },
    bottom: { move: 2, actions: [{ kind: 'persistent', effect: {
      kind: 'bonus-move', bonus: 1, charges: 2, lostWhenEmpty: false,
    } }] },
  },

  // ── Bruiser — level 3 cards ──────────────────────────────────────────────

  s_hookchain: {
    id: 's_hookchain', name: 'Hook and Chain', initiative: 42,
    top:    { move: 0, actions: [{ kind: 'attack', range: 3, damage: 3, pull: 4 }] },
    bottom: { move: 4, actions: [{ kind: 'charge', range: 1 }] },
  },

  // ── Bruiser — level 4 cards ──────────────────────────────────────────────

  s_whirlwind: {
    id: 's_whirlwind', name: 'Whirlwind', initiative: 28,
    top: {
      move: 0,
      lost: true,
      actions: [{
        kind: 'attack', range: 1, damage: 5,
        aoeCenter: 'self',
        aoe: { hexes: [
          { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
          { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
        ] },
        infuses: 'air',
        selfConditionsOnHit: ['strengthen'],
      }],
    },
    bottom: { move: 4, actions: [{ kind: 'push_all', range: 1, distance: 3 }] },
  },

  s_pushthrough: {
    id: 's_pushthrough', name: 'Push Through', initiative: 57,
    top:    { move: 0, actions: [{ kind: 'heal', range: 0, amount: 5 }] },
    bottom: { move: 3, actions: [{ kind: 'attack_bonus', value: 1 }] },
  },

  s_charge: {
    id: 's_charge', name: 'Unstoppable Charge', initiative: 86,
    top: { move: 0, actions: [{
      kind: 'attack', range: 1, damage: 3,
      conditionalBonus: { ifMovedThisTurn: { damage: 2, selfConditions: ['strengthen'] } },
    }] },
    bottom: {
      move: 4,
      lost: true,
      actions: [{
        kind: 'attack', range: 1, damage: 3,
        aoeCenter: 'self',
        aoe: { hexes: [
          { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
          { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
        ] },
      }],
    },
  },

  // ── Bruiser — level 5 cards ──────────────────────────────────────────────

  // Skirmishing Maneuver (G0020): top = attack 2 → move 2 → attack 3 (multi-action),
  //                                bottom = jump 5 + infuse air on play (lost)
  s_skirmish: {
    id: 's_skirmish', name: 'Skirmishing Maneuver', initiative: 29,
    top: {
      move: 2,
      actions: [
        { kind: 'attack', range: 1, damage: 2 },
        { kind: 'attack', range: 1, damage: 3 },
      ],
    },
    bottom: {
      move: 5,
      jump: true,
      lost: true,
      infusesOnPlay: 'air',
      actions: [],
    },
  },

  // Defensive Tactics (G0021): top = persistent reactive shield/retaliate (lost),
  //                            bottom = move 3 + pull 2 enemies in range 3 by distance 2
  s_defensive: {
    id: 's_defensive', name: 'Defensive Tactics', initiative: 39,
    top: {
      move: 0,
      lost: true,
      actions: [{ kind: 'persistent', effect: { kind: 'react-shield-retaliate', lostWhenEmpty: true } }],
    },
    bottom: {
      move: 3,
      actions: [{ kind: 'pull_multi', range: 3, distance: 2, targetCount: 2 }],
    },
  },

  // ── Support — ranged + healer (placeholder halves until real cards scanned) ─

  p_quick: {
    id: 'p_quick', name: 'Quick Shot', initiative: 25,
    top:    { move: 2, actions: [{ kind: 'attack', range: 3, damage: 2 }] },
    bottom: { move: 3, actions: [] },
  },
  p_aimed: {
    id: 'p_aimed', name: 'Aimed Shot', initiative: 65,
    top:    { move: 1, actions: [{ kind: 'attack', range: 4, damage: 3 }] },
    bottom: { move: 3, actions: [] },
  },
  p_heal: {
    id: 'p_heal', name: 'Healing Light', initiative: 35,
    top:    { move: 2, actions: [{ kind: 'heal', range: 2, amount: 3 }] },
    bottom: { move: 1, actions: [] },
  },
  p_volley: {
    id: 'p_volley', name: 'Volley', initiative: 55,
    top:    { move: 1, actions: [{ kind: 'attack', range: 3, damage: 3 }] },
    bottom: { move: 2, actions: [{ kind: 'attack', range: 2, damage: 2 }] },
  },
  p_ward: {
    id: 'p_ward', name: 'Ward', initiative: 15,
    top:    { move: 2, actions: [{ kind: 'heal', range: 0, amount: 2 }] },
    bottom: { move: 3, actions: [] },
  },
  p_snipe: {
    id: 'p_snipe', name: 'Snipe', initiative: 75,
    top:    { move: 0, actions: [{ kind: 'attack', range: 5, damage: 4 }] },
    bottom: { move: 2, actions: [{ kind: 'attack', range: 3, damage: 2 }] },
  },
  p_mend: {
    id: 'p_mend', name: 'Mend', initiative: 45,
    top:    { move: 1, actions: [{ kind: 'heal', range: 3, amount: 2 }] },
    bottom: { move: 2, actions: [{ kind: 'heal', range: 2, amount: 1 }] },
  },
  p_step: {
    id: 'p_step', name: 'Quick Step', initiative: 5,
    top:    { move: 4, actions: [] },
    bottom: { move: 2, actions: [{ kind: 'heal', range: 0, amount: 1 }] },
  },
};
