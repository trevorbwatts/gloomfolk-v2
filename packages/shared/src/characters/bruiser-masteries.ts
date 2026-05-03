import type { Mastery } from './masteries.js';

export const bruiserMasteries: readonly Mastery[] = [
  {
    id: 'bruiser.mastery.kill-after-forced-move-3-scenarios',
    text:
      'In 3 different scenarios, kill an enemy that you Pushed or Pulled ' +
      'that round',
    criterion: {
      kind: 'in-distinct-scenarios',
      scenarioCount: 3,
      inner: {
        kind: 'event-occurs',
        event: {
          kind: 'kill-after-forced-movement-same-round',
          forcedMovementKinds: ['push', 'pull'],
        },
      },
    },
  },
  {
    id: 'bruiser.mastery.six-cards-seven-damage-three-rounds',
    text:
      'In a single scenario, across 3 consecutive rounds, play 6 different ' +
      'ability cards and cause enemies to suffer 7 or more damage during ' +
      'each of those rounds',
    criterion: {
      kind: 'in-single-scenario',
      inner: {
        kind: 'consecutive-round-window',
        roundCount: 3,
        perRound: [{ kind: 'damage-to-enemies-at-least', amount: 7 }],
        acrossWindow: [
          { kind: 'distinct-ability-cards-played-at-least', count: 6 },
        ],
      },
    },
  },
];
