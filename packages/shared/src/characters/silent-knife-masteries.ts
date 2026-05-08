import type { Mastery } from './masteries.js';

export const silentKnifeMasteries: readonly Mastery[] = [
  {
    id: 'silent-knife.mastery.constrained-targets-ten-attacks',
    text:
      'In a single scenario, only attack enemies that are adjacent to one ' +
      'of your allies or adjacent to none of their allies, and perform at ' +
      'least 10 attacks',
    criterion: {
      kind: 'in-single-scenario',
      inner: {
        kind: 'every-attack-targets-allowed-and-count-at-least',
        predicate: {
          kind: 'any-of',
          predicates: [
            { kind: 'target-adjacent-to-acting-ally' },
            { kind: 'target-has-no-adjacent-allies' },
          ],
        },
        attackCount: 10,
      },
    },
  },
  {
    id: 'silent-knife.mastery.end-three-scenarios-with-twelve-money-tokens',
    text: 'End 3 scenarios with 12 or more money tokens',
    criterion: {
      kind: 'in-distinct-scenarios',
      scenarioCount: 3,
      inner: {
        kind: 'end-of-scenario-money-tokens-at-least',
        amount: 12,
      },
    },
  },
];
