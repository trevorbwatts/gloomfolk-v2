import type { Perk } from './perks.js';

export const silentKnifePerks: readonly Perk[] = [
  {
    id: 'silent-knife.perk.remove-minus2',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Remove one (-2) card',
    effects: [
      {
        kind: 'remove-modifier',
        card: { kind: 'flat', amount: -2 },
      },
    ],
  },
  {
    id: 'silent-knife.perk.remove-two-minus1',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Remove two (-1) cards',
    effects: [
      {
        kind: 'remove-modifier',
        card: { kind: 'flat', amount: -1 },
        count: 2,
      },
    ],
  },
  {
    id: 'silent-knife.perk.replace-minus1-with-plus1',
    slots: { kind: 'unlinked', count: 3 },
    text: 'Replace one (-1) card with one (+1) card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: -1 },
        add: { kind: 'flat', amount: 1 },
      },
    ],
  },
  {
    id: 'silent-knife.perk.replace-plus0-with-plus1-money-on-adjacent',
    slots: { kind: 'unlinked', count: 3 },
    text:
      'Replace one (+0) card with one (+1) "Gain one money token if this ' +
      'attack targeted an adjacent enemy" card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: 0 },
        add: {
          kind: 'flat',
          amount: 1,
          effects: [
            {
              kind: 'gain-money-token',
              amount: 1,
              when: { kind: 'attack-targeted-adjacent-enemy' },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'silent-knife.perk.replace-plus0-with-plus2',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Replace one (+0) card with one (+2) card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: 0 },
        add: { kind: 'flat', amount: 2 },
      },
    ],
  },
  {
    id: 'silent-knife.perk.replace-plus1-with-rolling-invisible-self',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Replace one (+1) card with one (+1) "Invisible, self" Rolling card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: 1 },
        add: {
          kind: 'rolling',
          amount: 1,
          effects: [{ kind: 'apply-condition', condition: 'invisible' }],
        },
      },
    ],
  },
  {
    id: 'silent-knife.perk.add-plus1-disarm',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Add one (+1) Disarm card',
    effects: [
      {
        kind: 'add-modifier',
        card: {
          kind: 'flat',
          amount: 1,
          effects: [{ kind: 'apply-condition', condition: 'disarm' }],
        },
      },
    ],
  },
  {
    id: 'silent-knife.perk.rest-token-strike',
    slots: { kind: 'unlinked', count: 1 },
    text:
      'At the end of each of your rests, you may place one of your money ' +
      'tokens in the hex occupied by an enemy within Range 3 to perform: ' +
      'Attack 1, Target that enemy, Range 3',
    effects: [
      {
        kind: 'grant-active-ability',
        ability: {
          id: 'silent-knife.perk.rest-token-strike.ability',
          timing: 'end-of-rest',
          steps: [
            {
              kind: 'place-money-token',
              target: { kind: 'enemy-hex', range: 3 },
            },
            {
              kind: 'attack',
              amount: 1,
              range: 3,
              target: 'tagged-enemy',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'silent-knife.perk.city-event-virtual-attack-gold',
    slots: { kind: 'unlinked', count: 1 },
    text:
      'Whenever you complete a city event, draw an attack modifier card as ' +
      'though you were performing an Attack 4. Gain an amount of gold equal ' +
      'to the damage the attack would have dealt',
    effects: [
      {
        kind: 'passive-rule',
        trigger: { kind: 'city-event-completed' },
        effect: {
          kind: 'gold-equal-to-virtual-attack-damage',
          attackBase: 4,
        },
      },
    ],
  },
  {
    id: 'silent-knife.perk.once-per-scenario-invisible-self',
    slots: { kind: 'linked', count: 1 },
    text: 'Once each scenario, during your turn, you may perform: Invisible, self',
    effects: [
      {
        kind: 'grant-active-ability',
        ability: {
          id: 'silent-knife.perk.invisible-self.ability',
          timing: 'own-turn',
          usesPerScenario: 1,
          steps: [
            {
              kind: 'apply-condition',
              condition: 'invisible',
              target: 'self',
            },
          ],
        },
      },
    ],
  },
];
