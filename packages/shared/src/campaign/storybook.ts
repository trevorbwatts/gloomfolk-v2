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
    id: '9.3',
    title: 'C-08 Resolution',
    text:
      '“A Valrath, huh? Demons, the lot of you. Same demons that burn up ' +
      'crops and... Wind. Whatever wind demons do. Wait, no--they suck! ' +
      'That’s... Hic! That’s what they do. You’re not human, you’re a ' +
      'bunch of experiments gone wrong. Monsters. Shouldn’t let you into ' +
      'polite society.”\n\n' +
      'His friend steps forward, grabbing him by his collar. “Please ' +
      'ignore my friend here, he’s just a little into the drink ' +
      'tonight.”\n\n' +
      '“No, you don’t get it. These are demons! Go on, do a trick. Make ' +
      'fire shoot out your eyeballs.”\n\n' +
      'His friend looks mortified. “That’s not a thing they do! They’re ' +
      'just people.” He smacks his Quatryl friend then turns to you with ' +
      'a weak smile. “Please uh, leave the fire in your eyeballs. Again, ' +
      'he’s really sorry.”',
    rewards: [],
  },
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
    id: '32.3',
    title: 'C-08 Resolution',
    text:
      '“An Inox, huh? Fuzzy-faced freaks. Look at those three big dumb ' +
      'horns coming out of your head—yeah, I said that about your horns. ' +
      'I said it! You think you’re so great just because you’re stronger ' +
      'than I am? And taller. And--hic!--stronger. Lots of people are ' +
      'stronger than me, but I make up for it in...in not having hair ' +
      'all over my body.”\n\n' +
      'His friend steps up, a bright shade of red. “Sorry, my friend ' +
      'didn’t mean anything about your horns—they’re really very, uh, ' +
      'nice!”\n\n' +
      'The drunk Quatryl looks personally affronted. “What? No, they’re ' +
      'dumb. I just said that.”\n\n' +
      'His diplomatic friend continues, “Nope, he means nice. And ' +
      'attached to such a strong, muscle-y person, much larger than my ' +
      'Quatryl friend here. Please ignore him. He’s really sorry. And ' +
      'uh, he’s going to buy your table’s tab, just for not pounding him ' +
      'into the dirt like he really deserves.”\n\n' +
      'He gives a weak smile and suddenly realizes the drunken Quatryl ' +
      'has moved on to accosting another table. “Hey, get back here!”',
    rewards: [{ kind: 'collective-gold', amount: 10 }],
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
    id: '59.1',
    title: 'C-08 Resolution',
    text:
      '“An Orchid, huh? Fancy good-for-nothings. I heard you—hic!—I heard ' +
      'your people know everything. But you won’t tell anybody nothin’. ' +
      'That true? Your fancy High Council has somebody for every single ' +
      'thing, perfect experts. And you won’t share nothing with nobody! ' +
      'Someday you’ll get yours.”\n\n' +
      'His friend intervenes, grabbing him by the back of his head. ' +
      '“Please ignore my friend here—”\n\n' +
      'The drunk Quatryl continues. “Yeah, meditate on that! I heard you ' +
      'sleep more than my in-laws! A hundred years is a nap to you, out ' +
      'in the woods, isn’t it?! Sleep this off!”\n\n' +
      'The Quatryl gives you a punch to the knee and an all-out brawl ' +
      'erupts in the Sleeping Lion. By the time the dust settles, you’ve ' +
      'all been kicked out for the night.',
    rewards: [
      { kind: 'next-scenario-condition', condition: 'immobilize' },
    ],
  },
  {
    id: '61.2',
    title: 'C-08 Resolution',
    text:
      '“A Harrower, huh? A big old pile of bugs. Which one of you is in ' +
      'charge? Hah! I bet you don’t even know! You’re all just a creepy ' +
      'crawly mess strung up in a cloak. I heard when you meet another ' +
      'Harrower you don’t even say hello, you just pass bugs back and ' +
      'forth--hic!--can’t even talk to each other like a... a normal ' +
      'person, you just brain swap. That true?”\n\n' +
      'Before you can respond, he grabs a clump of bugs from your chest ' +
      'and starts stomping on it. “Remember crawling into my bed while ' +
      'I was sleeping? I bet you’re sorry now!”\n\n' +
      'With horrified eyes, a friend of the Quatryl rushes up, pushing ' +
      'his friend to the ground. “I am—he is so, so so sorry. Please—” ' +
      'He picks up what’s left of the bugs pulled from inside you, ' +
      'attempting to hand them back in a half-hearted gesture. “I… some ' +
      'of them are probably okay?”\n\n' +
      'Your drunken Quatryl challenger shouts from the floor. “One ov ' +
      '‘em got in my mouf!”\n\n' +
      'His friend turns to you with a weak smile. “We are going to make ' +
      'this up to you, everything your table drinks is on us—please ' +
      'don’t murder my friend?”',
    rewards: [{ kind: 'collective-gold', amount: 15 }],
  },
  {
    id: '63.2',
    title: 'C-03 Resolution',
    text: '',
    rewards: [
      {
        kind: 'bonus',
        requirement: {
          kind: 'ancestry',
          ancestries: ['quatryl', 'vermling', 'aesther', 'harrower'],
        },
        text:
          '“Sorry, it seems like instructions aren’t your strong ' +
          'suit.”\n\n' +
          '“I’m looking for someone else.”',
        effects: [{ kind: 'resolve-option', option: 'B' }],
        otherwise: {
          text:
            'She picks you out of the crowd and invites cheering as you ' +
            'approach the box. Under cover of the applause, she whispers ' +
            'to you without moving her smiling lips: “Follow the ' +
            'instructions inside and you’ll be fine.”\n\n' +
            'Back to full volume, she addresses the crowd again. “Our ' +
            'brave volunteer is ready to enter the IRON MAELSTROM!”\n\n' +
            'She loads you in, shutting the door behind you. As you hear ' +
            'the padlocks snapping shut, a panel dislodges, revealing a ' +
            'difficult-but-possible body position for you in lines on the ' +
            'wall. “And now, we will begin to insert the sharpened ' +
            'swords!”',
          effects: [
            {
              kind: 'bonus',
              requirement: {
                kind: 'traits',
                traits: ['chaotic'],
                mode: 'all',
              },
              text:
                'This can’t be right, and there’s certainly a better way ' +
                'to do this. You strike a modified pose as the first of ' +
                'the blades slips past you. At the third, you realize ' +
                'there’s a problem, and, by the sixth, you cry out as a ' +
                'sword goes straight through your belly. The box is ' +
                'opened and the audience looks on in horror as the ' +
                'magician apologizes profusely.',
              effects: [
                { kind: 'next-scenario-condition', condition: 'wound' },
              ],
              otherwise: {
                text:
                  'You easily strike the position indicated on the side ' +
                  'of the wall, and watch with a smile as each blade ' +
                  'comes close to your body without piercing you. From ' +
                  'the outside, it undoubtedly looks impossible. After ' +
                  'all twelve are in, the magician removes them and ' +
                  're-opens the crate, showing you unharmed. You take a ' +
                  'bow and leave the stage, where eager audience members ' +
                  'rush up and ask what it was like in there. The ' +
                  'Magician gives you a wink and a smile and you decide ' +
                  'to keep her secret.',
                effects: [
                  {
                    kind: 'faction-reputation-change',
                    faction: 'choice',
                    amount: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    ],
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
    id: '75.4',
    title: 'C-15 Resolution',
    text:
      'Resolve each of the following based on the characters assigned ' +
      'to each task. The old man counts as STRONG AND CHAOTIC, and the ' +
      'young woman counts as NIMBLE AND RESOURCEFUL.',
    rewards: [
      {
        kind: 'bonus',
        requirement: {
          kind: 'trait-sum',
          task: 'Herding the crowd',
          add: ['persuasive', 'intimidating', 'resourceful'],
          subtract: ['chaotic'],
        },
        text:
          'You lead the scared citizens away from the chaos in an ' +
          'orderly fashion. With the crowd calmed, it’s easier for the ' +
          'rescuers to do their work.',
        effects: [{ kind: 'adjust-checks', amount: 1, target: 'remaining' }],
        otherwise: {
          text:
            'You fail to control the citizenry, who make every task ' +
            'more difficult in the frenzy.',
          effects: [{ kind: 'adjust-checks', amount: -1, target: 'next' }],
        },
      },
      {
        kind: 'bonus',
        requirement: {
          kind: 'trait-sum',
          task: 'Rescue people from the burning building',
          add: ['strong', 'nimble', 'resourceful', 'savvas'],
          subtract: ['harrower', 'armored'],
        },
        text:
          'The heat licks at your face as you make your way through the ' +
          'fire. Every object you’re carrying feels ten times as heavy, ' +
          'and the ragged air clutches at your insides. You find a group ' +
          'of people hiding in a closet and direct them out, just in ' +
          'time—the floor collapses just as they make it out.',
        effects: [{ kind: 'xp', amount: 5 }],
        otherwise: {
          text:
            'You push your way in, but the raging fire is oppressive. ' +
            'You call out into the inferno and a few people stumble down ' +
            'the stairs to the sound of your voice. Eventually, you have ' +
            'to turn back.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'wound' },
          ],
        },
      },
      {
        kind: 'bonus',
        requirement: {
          kind: 'trait-sum',
          task: 'Temper the flames',
          add: ['arcane', 'resourceful'],
        },
        text:
          'You use everything in your power to calm the raging fire. ' +
          'It’s only thanks to you that the neighboring buildings don’t ' +
          'catch light.',
        effects: [{ kind: 'prosperity', amount: 1 }],
        otherwise: {
          text:
            'You try everything at your disposal to stop the burning ' +
            'building, but it’s too late: the fire has spread. The town ' +
            'guard finally arrives and puts out the blaze, but not ' +
            'before several buildings on campus are reduced to ash.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'choice',
              choiceOf: ['merchants-guild', 'military'],
              amount: -1,
            },
          ],
        },
      },
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
    id: '91.4',
    title: 'C-08 Resolution',
    text:
      '“Human, huh? No surprise, so many of you. You used to control ' +
      'everything, you remember that? The good ol’ days for you, I’m ' +
      'sure. Before everybody else started cropping up. Watch your ' +
      'back, human—gotta be—hic!—careful, right?”\n\n' +
      'His friend intervenes, grabbing him by the scruff of the collar. ' +
      '“Please ignore my friend here, he’s just a little into the drink ' +
      'tonight. Doesn’t mean any harm, really sorry.” He fishes out the ' +
      'drunk’s coin purse. “In fact, he’s so sorry he’s going to pick ' +
      'up your next round.”\n\n' +
      'Your drunken Quatryl challenger speaks up. “Wait, what?”\n\n' +
      'His friend grabs him by the ear, continuing. “Yep, you’re ' +
      'getting the next round, so you don’t get beaten to a pulp by ' +
      'some of the strongest mercenaries in here.” He turns to you with ' +
      'a weak smile. “Again, he’s really sorry.”',
    rewards: [{ kind: 'collective-gold', amount: 5 }],
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
    id: '105.1',
    title: 'C-08 Resolution',
    text:
      '“You’re uh, you’re sure a different one, aren’t you? Never met ' +
      'one of your kind in Gloomhaven. You got weird... Eyes. And your ' +
      'face is all—hic!—wrong. They let you just walk around like you ' +
      'own the place, huh? Not on my watch, I’ll tell you! We got ' +
      'standards.”\n\n' +
      'His friend intervenes, grabbing him by the collar. “Please ' +
      'ignore my friend here, he’s just a little into the drink ' +
      'tonight. Doesn’t mean any harm, really sorry.” He fishes out the ' +
      'drunk’s coin purse. “In fact, he’s so sorry he’s going to pick ' +
      'up your next round.”\n\n' +
      'Your drunken challenger speaks up. “Wait, what?”\n\n' +
      'His friend grabs him by the ear, continuing. “Yep, you’re ' +
      'getting the next round, so you don’t get beaten to a pulp by ' +
      'some of the strongest mercenaries in here.”\n\n' +
      'He turns to you with a weak smile. “Again, he’s really sorry.”',
    rewards: [{ kind: 'collective-gold', amount: 5 }],
  },
  {
    id: '112.5',
    title: 'C-08 Resolution',
    text:
      '“A Quatryl, huh? You’re like me, lemme tell you a see… a secret. ' +
      'You know what my mom told me? She said that I’m lazy. But not ' +
      'like that, she said it like it was a good thing—that I’m always ' +
      'looking for clever ways to avoid doing work. Building robots and ' +
      'making machines do everything for you, like you’re some kinda... ' +
      'some kinda smarty.”\n\n' +
      'He loses the thread of his own thought, suddenly aggressive. “You ' +
      'think you’re better at making stuff than me? I make all kinds of ' +
      'stuff! I made this scar on my face with nothing but a rock!”\n\n' +
      'His friend intervenes, grabbing him by the scruff of the collar. ' +
      '“Please ignore my friend here. He’s really brilliant when he’s ' +
      'not drinking, just comes off as a moron when he is.”\n\n' +
      'The drunken Quatryl suddenly sees you, as though for the first ' +
      'time. “You’re a Quatryl! You should be my best friend!”',
    rewards: [{ kind: 'next-scenario-condition', condition: 'ward' }],
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
    id: '124.4',
    title: 'C-08 Resolution',
    text:
      '“An Aesther, huh? Don’t see many of your kind around—you ' +
      'too—hic!—too good for us? Gonna tell us where you come from? How ' +
      'come whenever somebody asks, you get all aloof? You wanna tell ' +
      'us what your big secret is? What are you hiding, you ' +
      'sparkle-skinned monster? None of us are good enough to know?”\n\n' +
      'His friend intervenes, grabbing him by the collar. He looks ' +
      'totally out of his depth trying to resolve the situation. “We’re ' +
      'going, uh, now. Really sorry about that. Enjoy your… uh, ' +
      'life.”\n\n' +
      'The friend speaks slowly, making large gestures to demonstrate ' +
      'they’re not a threat. After a moment, he nods and they wander ' +
      'off, mumbling about how he’s not even sure if an Aesther can ' +
      'understand language.',
    rewards: [],
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
    id: '132.2',
    title: 'C-08 Resolution',
    text:
      '“A Savvas, huh? You don’t breathe, you don’t got blood, you are ' +
      'barely even--hic!--you’re barely even people! And what’s with ' +
      'those chests of yours? All glowy flashy colors like you’re ' +
      'showing off. I heard you get more colors when you learn more... ' +
      'Colors. Or whatever they’re ca--elements! Elements. And I heard ' +
      'if any one of you tries to learn light and dark you go raving ' +
      'mad. That true? Huh? You all think you’re high and mighty. ' +
      'Where’s the liquid even come out, huh—hic!—where’s your drinks ' +
      'go? You got some hole somewhere in you?!”\n\n' +
      'His friend intervenes, grabbing him by the scruff of the collar. ' +
      '“Please ignore my friend here, he’s just a little into the drink ' +
      'tonight. Doesn’t mean any harm, really sorry.” He fishes out the ' +
      'drunk’s coin purse. “In fact, he’s so sorry he’s going to pick up ' +
      'your next round.”\n\n' +
      'Your drunken challenger speaks up. “Wait, what? Let me get my ' +
      'suit and I could crush this pile of rocks.”\n\n' +
      'His friend grabs him by the ear, continuing. “No, you’re getting ' +
      'the next round, so you don’t get beaten to a pulp by some of the ' +
      'strongest mercenaries in here. You couldn’t read the pressure ' +
      'gauge on your suit right now if you tried.”\n\n' +
      'He turns to you with a weak smile. “Again, he’s really sorry.”',
    rewards: [{ kind: 'collective-gold', amount: 5 }],
  },
  {
    id: '135.2',
    title: 'C-08 Resolution',
    text:
      '“A Vermling, huh? Bottom-feeders. Oh sure, some of y’all got ' +
      'those weird psychic-brains, but what do you use it for? Eating ' +
      'dead bodies. Not like, animal bodies like a proper person, ' +
      'either. Other Vermlings, or humans or... Or anything, really. ' +
      'Monsters. Only good thing good about you—hic!—about you is I ' +
      'never met a Vermling that lived past 35. Good riddance, I say!”\n\n' +
      'His friend steps up, looking down on you. “Did you just pick a ' +
      'fight with my Quatryl friend? He could take you, even drunk as ' +
      'he is.”\n\n' +
      'Enough is enough. You accept the challenge.',
    rewards: [
      {
        kind: 'bonus',
        requirement: { kind: 'traits', traits: ['strong'], mode: 'all' },
        text:
          'You easily pin the Quatryl to the floor, bending his arm ' +
          'behind his back. The bar erupts in excitement and the ' +
          'challenger begrudgingly buys the next round with a ' +
          'semi-convincing apology.',
        effects: [
          { kind: 'collective-gold', amount: 10 },
          { kind: 'next-scenario-condition', condition: 'ward' },
        ],
        otherwise: {
          text:
            'The Quatryl may be short, but he’s a scrappy drunken ' +
            'fighter. It doesn’t get too far before the rest of the bar ' +
            'pulls you apart, but it’s clear you weren’t going to come ' +
            'out on top.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
          ],
        },
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
