/**
 * Storybook sections — the numbered passages ("read 17.3") that event
 * cards, scenarios, and campaign instructions point at. Transcribed from
 * the physical section book alongside whatever references them, so this
 * grows section by section; reward types only cover mechanics seen so far.
 */

import type { EventEffect } from './event-cards.js';

/** Sections hand out the same effects event cards do (gold, items,
 *  prosperity, next-scenario conditions/damage/discards, ...) plus a few
 *  campaign instructions of their own. */
export type SectionReward =
  | EventEffect
  | {
      /** Campaign instruction: return the event card to its deck — the
       *  same routing as the printed return icon (bottom of the deck, see
       *  resolveDrawnEvent in events.ts). Sections use this when the card
       *  itself has no return icon and the section decides its fate. */
      kind: 'return-event-to-deck';
      deck: 'road' | 'city';
      eventId: string;
    }
  | {
      /** Campaign instruction: remove the event from its deck (see
       *  removeEventFromDeck in events.ts — the deck is shuffled after). */
      kind: 'remove-event-from-deck';
      deck: 'road' | 'city';
      eventId: string;
    }
  | {
      /** Gain the named global achievement (campaign sheet sticker).
       *  Unlike most achievements, the same one can be gained multiple
       *  times — see 'read-section-at-achievement-count'. */
      kind: 'global-achievement';
      name: string;
    }
  | {
      /** Read another section the moment the party's Nth copy of the named
       *  global achievement is gained ("If this is your fifth ...,
       *  read 109.3"). */
      kind: 'read-section-at-achievement-count';
      achievement: string;
      count: number;
      readSection: string;
    };

export interface StorybookSection {
  /** Section number as printed, e.g. '17.3'. */
  id: string;
  /** Heading next to the number, e.g. 'R-03 Resolution'. */
  title: string;
  /** Thematic text of the passage. */
  text: string;
  rewards: readonly SectionReward[];
}

export const STORYBOOK_SECTIONS: readonly StorybookSection[] = [
  {
    id: '17.3',
    title: 'R-03 Resolution',
    text:
      '“I bought all kinds of stuff to try to stop the curse from ' +
      'spreading. Some things worked, some stuff didn’t. Like a hat made ' +
      'of smoke. That blew away, waste of fifty gold, frankly. Or this ' +
      'glass eye. This one worked okay. Sometimes it blinks at me, weirds ' +
      'me out. Hey—come to think of it, you should have it for helping ' +
      'share the burden!”',
    rewards: [
      {
        kind: 'gain-item',
        itemId: 'lucky-eye',
        name: 'Lucky Eye',
        printedNumber: 105,
      },
    ],
  },
  {
    id: '34.4',
    title: 'R-03 Resolution',
    text:
      '“Can you feel that? Grab that rock. Throw it at me!” You do so, and ' +
      'he effortlessly dodges out of the way. “I’m free! That’s the last ' +
      'of the curse, you did it! I can go back to living my life as a ' +
      'productive member of society without fear that I’m going to burn ' +
      'down a building while making salad or kill a horse trying to pick ' +
      'up the mail. This is fantastic! I could kiss you, but I won’t for ' +
      'fear of the curse passing back to me.”\n\n' +
      'He strips out of his pillow-armor, supposedly-lucky trinkets ' +
      'rattling to the ground all around him. He grabs something off the ' +
      'ground, handing it to you. “Here, you should have this, as a token ' +
      'of my gratitude.”',
    rewards: [
      { kind: 'prosperity', amount: 1 },
      { kind: 'random-item-design' },
      { kind: 'remove-event-from-deck', deck: 'road', eventId: 'R-03' },
    ],
  },
  {
    id: '45.4',
    title: 'R-04 Resolution',
    text:
      'You hand over the gold and the old Vermling gestures to the leather ' +
      'tube. “People only keep stuff for a limited time. You’re just ' +
      'holding what you have until the next owner takes it. Remember ' +
      'that.”\n\n' +
      'Inside the tube, you find the plans for something that may come in ' +
      'handy.\n\n' +
      'The Vermling laughs to himself. “Everything rots eventually. Take a ' +
      'fruit for the road, can’t eat all of them.”',
    rewards: [
      { kind: 'random-item-design' },
      {
        kind: 'gain-item',
        itemId: 'amberhollow',
        name: 'Amberhollow',
        printedNumber: 146,
      },
    ],
  },
  {
    id: '50.6',
    title: 'R-04 Resolution',
    text:
      'You hand over the gold and take hold of the metal. Looking more ' +
      'closely at the etchings, it’s clear they’re meaningless scratches ' +
      'made by rats and bugs.\n\n' +
      '“All sales final!”\n\n' +
      'Oh well, sometimes the long shot doesn’t pay off.',
    rewards: [],
  },
  {
    id: '66.1',
    title: 'R-04 Resolution',
    text:
      'You hand over the gold and the old Vermling hands you a cloudy ' +
      'crystal back. It’s light for a rock, and looking deeply into it is ' +
      'like staring at shifting clouds. A tap with your finger sends it ' +
      'ringing as though it were a clear bell. Strange.\n\n' +
      '“Fell off the back of a fancy wagon driven by some fancy Savvas. ' +
      'Guess they forgot to lock it. Should’ve used a fancier lock, heh? ' +
      'Yours now.” The merchant roots around in his satchel, finally ' +
      'discovering some old meat. He takes a bite, chewing it ' +
      'thoughtfully.\n\n' +
      '“I hear Savvas eat rocks. Disgusting.”',
    rewards: [
      {
        kind: 'gain-item',
        itemId: 'resonant-crystal',
        name: 'Resonant Crystal',
        printedNumber: 135,
      },
    ],
  },
  {
    id: '66.5',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The red crystal is pressed ' +
      'fifth, and is the last crystal pressed!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though someone pressed a ' +
      'heavy boot on your spine, knocking you painfully to the floor. When ' +
      'you get your senses back about you, there’s nothing but a ' +
      'smoldering hole in the rock where the device used to be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-condition', condition: 'immobilize' },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '70.4',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The blue crystal is pressed ' +
      'after the green crystal!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though someone snapped a ' +
      'whip across your face, sending you reeling from the sting. When you ' +
      'get your senses back about you, there’s nothing but a smoldering ' +
      'hole in the rock where the device used to be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-condition', condition: 'wound' },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '76.5',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The blue crystal is pressed ' +
      'after the green crystal!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though someone snapped a ' +
      'whip across your face, sending you reeling from the sting. When you ' +
      'get your senses back about you, there’s nothing but a smoldering ' +
      'hole in the rock where the device used to be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-condition', condition: 'wound' },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '76.6',
    title: 'R-04 Resolution',
    text:
      'You hand over the gold and take hold of the metal. It may have been ' +
      'useful at some point, but the thick layer of rust leaves the object ' +
      'nearly crumbling in your hands.\n\n' +
      '“All sales final!”\n\n' +
      'If you were crafty, it could probably still be a decent source of ' +
      'raw metal, but you can’t be bothered with the effort.',
    rewards: [],
  },
  {
    id: '82.5',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The red crystal is pressed ' +
      'fifth, and is the last crystal pressed!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though someone pressed a ' +
      'heavy boot on your spine, knocking you painfully to the floor. When ' +
      'you get your senses back about you, there’s nothing but a ' +
      'smoldering hole in the rock where the device used to be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-condition', condition: 'immobilize' },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '98.5',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The sequence requires six ' +
      'presses, and the first is pressing the center button!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though your mind is being ' +
      'ripped out through your eyes, a sensation that drops you to your ' +
      'knees in pain. When you get your senses back about you, there’s ' +
      'nothing but a smoldering hole in the rock where the device used to ' +
      'be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-discard', count: 1 },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '119.4',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The orange crystal is pressed ' +
      'before any other crystal!”\n\n' +
      'What do you touch next?',
    rewards: [
      {
        kind: 'choose-section',
        prompt: 'What do you touch next?',
        choices: [
          {
            id: 'blue-triangle',
            text: 'Blue diamond crystal',
            readSection: '76.5',
          },
          {
            id: 'red-circular',
            text: 'Red circular crystal',
            readSection: '66.5',
          },
          {
            id: 'orange-hex',
            text: 'Orange hex crystal',
            readSection: '7.3',
          },
          {
            id: 'green-diamond',
            text: 'Green diamond crystal',
            readSection: '117.6',
          },
          {
            id: 'center-button',
            text: 'Center button',
            readSection: '135.3',
          },
        ],
      },
    ],
  },
  {
    id: '122.1',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The orange crystal is pressed ' +
      'before any other crystal!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, you feel a surge of energy rip ' +
      'through your arms, leaving them useless and limp at your sides. ' +
      'When you get your senses back about you, there’s nothing but a ' +
      'smoldering hole in the rock where the device used to be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-condition', condition: 'disarm' },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
  {
    id: '131.5',
    title: 'R-04 Resolution',
    text:
      'You hand over the gold and take hold of the metal. You wipe off the ' +
      'grime and slop to discover a foreign contraption made of large ' +
      'gears and many moving parts. If you can figure out what it is, this ' +
      'device might actually be of some worth.',
    rewards: [
      {
        kind: 'gain-item',
        itemId: 'curious-gear',
        name: 'Curious Gear',
        printedNumber: 112,
      },
      { kind: 'global-achievement', name: 'Ancient Technology' },
      {
        kind: 'read-section-at-achievement-count',
        achievement: 'Ancient Technology',
        count: 5,
        readSection: '109.3',
      },
    ],
  },
  {
    id: '135.5',
    title: 'R-10 Resolution',
    text:
      'The voice rings out in your head. “The sequence requires six ' +
      'presses, and the first is pressing the center button!”\n\n' +
      'A klaxon begins to blare. The system rumbles with a grinding ' +
      'crunch, and, without warning, it feels as though your mind is being ' +
      'ripped out through your eyes, a sensation that drops you to your ' +
      'knees in pain. When you get your senses back about you, there’s ' +
      'nothing but a smoldering hole in the rock where the device used to ' +
      'be.',
    rewards: [
      { kind: 'next-scenario-damage', amount: 2 },
      { kind: 'next-scenario-discard', count: 1 },
      { kind: 'return-event-to-deck', deck: 'road', eventId: 'R-10' },
    ],
  },
];
