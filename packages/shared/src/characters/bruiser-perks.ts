import type { Perk } from './perks.js';

export const bruiserPerks: readonly Perk[] = [
  {
    id: 'bruiser.perk.replace-minus1-with-plus1',
    slots: { kind: 'unlinked', count: 2 },
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
    id: 'bruiser.perk.replace-minus1-with-rolling-shield1',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Replace one (-1) card with one "Shield 1" Rolling card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: -1 },
        add: {
          kind: 'rolling',
          effects: [{ kind: 'shield', amount: 1 }],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.replace-plus0-with-rolling-reactive-shield2',
    slots: { kind: 'unlinked', count: 2 },
    text:
      'Replace one (+0) card with one "Add this card to your active area. ' +
      'On the next attack performed by an adjacent enemy targeting you, ' +
      'discard this card to gain Shield 2 for the attack" Rolling card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: 0 },
        add: {
          kind: 'rolling',
          effects: [
            {
              kind: 'park-as-reactive',
              trigger: { kind: 'adjacent-enemy-attacks-self' },
              onTrigger: [{ kind: 'shield', amount: 2 }],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.replace-plus0-with-plus0-stun',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Replace one (+0) card with one (+0) Stun card',
    effects: [
      {
        kind: 'replace-modifier',
        remove: { kind: 'flat', amount: 0 },
        add: {
          kind: 'flat',
          amount: 0,
          effects: [{ kind: 'apply-condition', condition: 'stun' }],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.add-plus1-heal2-self',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Add one (+1) "Heal 2, self" card',
    effects: [
      {
        kind: 'add-modifier',
        card: {
          kind: 'flat',
          amount: 1,
          effects: [{ kind: 'heal-self', amount: 2 }],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.add-plus2-push2',
    slots: { kind: 'unlinked', count: 2 },
    text: 'Add one (+2) Push 2 card',
    effects: [
      {
        kind: 'add-modifier',
        card: {
          kind: 'flat',
          amount: 2,
          effects: [{ kind: 'push', amount: 2 }],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.add-plus3',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Add one (+3) card',
    effects: [
      {
        kind: 'add-modifier',
        card: { kind: 'flat', amount: 3 },
      },
    ],
  },
  {
    id: 'bruiser.perk.add-rolling-disarm-and-rolling-muddle',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Add one Disarm Rolling and one Muddle Rolling card',
    effects: [
      {
        kind: 'add-modifier',
        card: {
          kind: 'rolling',
          effects: [{ kind: 'apply-condition', condition: 'disarm' }],
        },
      },
      {
        kind: 'add-modifier',
        card: {
          kind: 'rolling',
          effects: [{ kind: 'apply-condition', condition: 'muddle' }],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.ignore-item-minus-ones-and-add-two-plus1',
    slots: { kind: 'unlinked', count: 1 },
    text: 'Ignore item (-1) effects and add two (+1) cards',
    effects: [
      { kind: 'ignore-item-minus-ones' },
      { kind: 'add-modifier', card: { kind: 'flat', amount: 1 } },
      { kind: 'add-modifier', card: { kind: 'flat', amount: 1 } },
    ],
  },
  {
    id: 'bruiser.perk.once-per-scenario-loot1-refresh-on-money',
    slots: { kind: 'linked', count: 2 },
    text:
      'Once each scenario, during your turn, you may perform: Loot 1, ' +
      'if this ability loots at least one money token, you may Refresh ' +
      'one Spent item',
    effects: [
      {
        kind: 'grant-active-ability',
        ability: {
          id: 'bruiser.perk.loot1-refresh',
          timing: 'own-turn',
          usesPerScenario: 1,
          steps: [
            { kind: 'loot', range: 1 },
            {
              kind: 'when',
              cause: { kind: 'money-token-looted-this-action' },
              effects: [{ kind: 'refresh-item' }],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'bruiser.perk.long-rest-next-move-plus1',
    slots: { kind: 'unlinked', count: 1 },
    text:
      'Whenever you long rest, add +1 Move to your first move ability ' +
      'the following round',
    effects: [
      {
        kind: 'passive-rule',
        trigger: { kind: 'long-rest' },
        effect: { kind: 'next-round-first-move-bonus', amount: 1 },
      },
    ],
  },
  {
    id: 'bruiser.perk.party-first-attack-advantage',
    slots: { kind: 'unlinked', count: 1 },
    text:
      'Each character gains advantage on their first attack during the ' +
      'first round of each scenario',
    effects: [
      {
        kind: 'passive-rule',
        trigger: {
          kind: 'first-attack-of-scenario',
          scope: 'each-character',
        },
        effect: { kind: 'advantage' },
      },
    ],
  },
];
