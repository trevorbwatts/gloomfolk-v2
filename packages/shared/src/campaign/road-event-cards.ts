/**
 * Road event card content, transcribed verbatim from the physical deck
 * (docs/rules/road-events.md). The content model lives in event-cards.ts.
 */

import type { EventCard } from './event-cards.js';

export const ROAD_EVENT_CARDS: readonly EventCard[] = [
  {
    id: 'R-01',
    front:
      'A collection of travelers surround a campfire up ahead and beckons ' +
      'you to join them. They are sharing stories as the sun sets for the ' +
      'evening and seem friendly enough.\n\n' +
      'A Valrath passes a flagon of sweet meekseed wine around the circle ' +
      'as he tells of his adventures along the southern coast. It’s an ' +
      'incredible mix of adventure, fun, and bad fortune with impossible ' +
      'odds, and it certainly makes for a good campfire story. The story ' +
      'winds down and the assembled group looks to you to contribute a tale.',
    options: [
      {
        id: 'A',
        prompt: 'Tell a scary story.',
        requirement: {
          kind: 'traits',
          traits: ['arcane', 'intimidating'],
          mode: 'all',
        },
        outcome: {
          text:
            'You spin a tale of true terror. The fire flares up at the just ' +
            'the right times, then descends to near blackness when the mood ' +
            'requires. The travelers have trouble sleeping, and the ' +
            'following morning ask you to escort them to their destination ' +
            'for a fee—on the condition you don’t tell any more stories.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            { kind: 'next-scenario-condition', condition: 'safeguard' },
          ],
        },
        otherwise: {
          text:
            'You attempt to tell a scary tale, but after some snickers, ' +
            'it’s clear you didn’t frighten anyone at all.',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Make up an adventure and claim it’s true.',
        requirement: {
          kind: 'traits',
          traits: ['educated', 'persuasive'],
          mode: 'all',
        },
        outcome: {
          text:
            'You spin a tale of fantastic adventure, recapping the travels ' +
            'of a group similar to your own. You sprinkle in true facts ' +
            'from the region and smart anecdotes that paint the tale with ' +
            'an air of realism so strong it surely must be true. The mouths ' +
            'hanging open at the shocking conclusion are better than any ' +
            'applause. They ask that you join them for as long as you’re ' +
            'heading the same direction to share more of your epic tales, ' +
            'and they’re happy to pay for the company.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            { kind: 'next-scenario-condition', condition: 'ward' },
          ],
        },
        otherwise: {
          text:
            'You attempt to tell a grand tale of adventure, but it winds up ' +
            'a jumbled mess of improbable situations and long-winded ' +
            'explanations. They’re polite in their response, and you part ' +
            'ways the next morning.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'R-02',
    front:
      'The scraping snap of claws warns you of what’s coming before you see ' +
      'it: there’s a Lurker up ahead. You have no desire to tangle with the ' +
      'massive crab creatures, and with any luck, it hasn’t heard you yet.\n\n' +
      'When you finally lay eyes on it, you see what’s causing the ruckus: ' +
      'a full-sized Lurker has gotten itself caught in a bear trap by the ' +
      'river bank. It is frantically snapping its claws at the metal but ' +
      'can’t get a decent angle to detach the jaws. Judging by how slowly ' +
      'it’s moving, it’s been struggling for some time.\n\n' +
      'When it spots you, it rears up, brandishing its claws in your ' +
      'direction. With one leg trapped, though, this one looks far from ' +
      'the fearsome tyrants they normally are on the battlefield—instead, ' +
      'this one looks like easy prey.',
    options: [
      {
        id: 'A',
        prompt: 'Take down the Lurker before it frees itself.',
        outcome: {
          text:
            'A Lurker is still a formidable adversary, even with one leg ' +
            'immobilized. But you come at it from multiple sides and after ' +
            'a few good blows it falls, defeated.',
          effects: [
            { kind: 'xp', amount: 5 },
            { kind: 'next-scenario-condition', condition: 'wound' },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Assist the Lurker in removing the trap.',
        requirement: {
          kind: 'traits',
          traits: ['armored', 'nimble', 'strong'],
          mode: 'any',
        },
        outcome: {
          text:
            'The Lurker doesn’t seem to fully understand you’re assisting ' +
            'and struggles throughout the process, lashing out wherever it ' +
            'can. It takes some coordinated effort, but you manage to ' +
            'distract the beast long enough to pry the trap from its leg.\n\n' +
            'The Lurker, confused, gives a final twist of its head before ' +
            'galloping into the stream. You’ll interpret that as a “thank ' +
            'you,” which will perhaps ease the lacerations it left you with.',
          effects: [
            { kind: 'next-scenario-damage', amount: 1 },
            { kind: 'next-scenario-condition', condition: 'bless' },
            { kind: 'next-scenario-condition', condition: 'bless' },
          ],
        },
        otherwise: {
          text:
            'You attempt to pacify the beast long enough to get closer to ' +
            'the trap, but the Lurker is having none of it. Finally, you ' +
            'commit to being beaten around the head with its terrifying ' +
            'claws while you pry the metal jaws free. It takes a final ' +
            'swipe at you before diving into the shallow river.',
          effects: [
            { kind: 'next-scenario-damage', amount: 2 },
            { kind: 'next-scenario-condition', condition: 'bless' },
            { kind: 'next-scenario-condition', condition: 'bless' },
          ],
        },
      },
    ],
  },
  {
    id: 'R-03',
    front:
      '“Don’t come any closer! On penalty of death! Your death! From ' +
      'unluckiness!” Standing up the road is a stout Quatryl with various ' +
      'cushions and pillows strapped to his body. The configuration seems ' +
      'to make it difficult for him to breathe. “I’m warning you! I am ' +
      'dangerously unlucky! Approach at your own risk!” As if to emphasize ' +
      'the point, he promptly falls over, smashing his nose into the ground.\n\n' +
      'A trickle of blood runs down his face. “Oh no, it’s… yeah, that’s ' +
      'blood.” At the sight of it he gives a half-stumble, then promptly ' +
      'passes out in the road.\n\n' +
      'You prop him up to be comfortable, then splash cool water across ' +
      'his face. He wakes up with a start. “No! You’re too near me! You’ll ' +
      'get the curse! I’m the unluckiest Quatryl that ever lived, you need ' +
      'to stay back!”',
    options: [
      {
        id: 'A',
        prompt: 'Assure him you’re here to help however you can.',
        outcome: {
          text:
            'It takes a lot of comforting words and a slow approach, but ' +
            'you finally get him to calm down and reveal his plight.\n\n' +
            '“I’m cursed! Every step I take, every move I make, it’s ' +
            'watching me. Looming. You’re already going to feel the ' +
            'effects, I can tell. It’s like I’m a big pot of unlucky, and ' +
            'it wants me to ladle myself onto everyone I come in contact ' +
            'with. But I’m not going to thrust that on someone else, even ' +
            'to save my own skin.”\n\n' +
            'Against his protests, you offer to siphon off some of his ' +
            'extreme unluckiness.\n\n' +
            '“Hey, that actually feels… better. I might be uncursed!” He ' +
            'gives a celebratory jump, but stubs his toe on a rock in the ' +
            'process. “Maybe still a little unlucky.”',
          effects: [
            { kind: 'next-scenario-condition', condition: 'curse' },
            { kind: 'check-boxes', count: 1 },
            { kind: 'check-boxes-per-bless-removed' },
            { kind: 'check-box-for-extra-curse' },
          ],
          returnToDeck: true,
        },
      },
      {
        id: 'B',
        prompt: 'Kill the Quatryl to release him from his accursed fate.',
        outcome: {
          text:
            'You deal a final, merciful blow, and the Quatryl falls ' +
            'peacefully. You can’t help but feel that some of whatever ' +
            'afflicted him has washed off on you, though…',
          effects: [{ kind: 'next-scenario-condition', condition: 'curse' }],
        },
      },
    ],
    track: {
      boxes: 8,
      milestones: [
        { box: 3, readSection: '17.3' },
        { box: 8, readSection: '34.4' },
      ],
    },
  },
  {
    id: 'R-04',
    front:
      'By the side of the road, you find a carriage parked, its owner ' +
      'wiping sweat from his brow. An old Vermling gives a toothless grin ' +
      'in your direction, waving you over to the makeshift shop he’s set ' +
      'up.\n\n' +
      '“Gloomhaven Council Law 119.5, important one, you heard of it? Sets ' +
      'the patrol boundary for the town guard just over that ridge there. ' +
      'This patch of road is outside their jurisdiction. Lets me keep the ' +
      'prices low, eh? Lots to see, priced to move. Wheels to move, too,” ' +
      'He kicks the side of his carriage, “just in case that law ever ' +
      'changes. Heh heh.” He chuckles to himself as he lays thick carpets ' +
      'by the side of the road, spreading out his wares—several unusual ' +
      'artifacts catch your eye.\n\n' +
      '“I’m just doing my part to make sure these hard-to-find items stay ' +
      'in circulation, eh? No touching! Browse with your eyes, not your ' +
      'hands.”',
    options: [
      {
        id: 'A',
        prompt: 'Browse the available wares.',
        outcome: {
          text:
            'LOSE 20 COLLECTIVE GOLD: You may purchase any one of the ' +
            'below items. If you do, check the box and read the associated ' +
            'entry in the section book. When all boxes are checked, remove ' +
            'this event from the road deck.',
          effects: [
            {
              kind: 'shop',
              price: 20,
              discounts: [
                {
                  requirement: {
                    kind: 'traits',
                    traits: ['outcast'],
                    mode: 'all',
                  },
                  amount: 2,
                  text:
                    '“Last thing I need is word to get around. You look ' +
                    'like someone with a closed jaw. Heh.”',
                },
              ],
              wares: [
                {
                  id: 'white-crystal',
                  text: 'A dense white crystal shedding chalky powder.',
                  readSection: '66.1',
                },
                {
                  id: 'etched-gear',
                  text: 'A curious-looking gear with unusual etchings.',
                  readSection: '50.6',
                },
                {
                  id: 'greased-gear',
                  text: 'A curious-looking gear covered in a thick layer of grease.',
                  readSection: '131.5',
                },
                {
                  id: 'rusted-gear',
                  text: 'A curious-looking gear with rusted edges.',
                  readSection: '76.6',
                },
                {
                  id: 'leather-tube-document',
                  text: 'A document inside a leather tube.',
                  readSection: '45.4',
                },
              ],
            },
          ],
          returnToDeck: true,
        },
      },
      {
        id: 'B',
        prompt: 'Assure him you’re not concerned with where his items come from.',
        requirement: {
          kind: 'faction-reputation',
          faction: 'military',
          greaterThan: 12,
        },
        outcome: {
          text:
            'You engage the traveling merchant on how well-connected you ' +
            'are, but in the course of the conversation, something clicks, ' +
            'and he narrows his eyes. “Store’s closed. Sold out. Go away.”',
          effects: [],
        },
        otherwise: {
          text: '“Glad to hear it.”',
          effects: [
            { kind: 'resolve-option', option: 'A', priceReduction: 2 },
          ],
        },
      },
    ],
  },
  {
    id: 'R-05',
    front:
      'You’re a few steps outside of Gloomhaven’s walls when a man with a ' +
      'pair of horses and a wagon stops you. He flashes a broad, inviting ' +
      'smile.\n\n' +
      '“Care for a ride to your destination? Anywhere you want to go, just ' +
      'five gold.”',
    options: [
      {
        id: 'A',
        prompt: 'Take the man up on his offer.',
        requirement: { kind: 'pay-collective-gold', amount: 5 },
        outcome: {
          text:
            'The wagon ride isn’t luxurious, but it sure beats having to ' +
            'walk yourself. You arrive at your destination well-rested and ' +
            'ready for whatever circumstances are thrown at you.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'strengthen' },
          ],
          returnToDeck: true,
        },
        otherwise: {
          text: 'Read Outcome B.',
          effects: [{ kind: 'resolve-option', option: 'B' }],
        },
      },
      {
        id: 'B',
        prompt: 'Take your chances on the road.',
        outcome: {
          text:
            'You wave the man off. You’ve arrived under your own power ' +
            'every time before, and today won’t be any different. What’s ' +
            'the worst that could happen?',
          effects: [{ kind: 'draw-another-road-event' }],
        },
      },
    ],
  },
  {
    id: 'R-06',
    front:
      'You stop to allow a procession of Inox to pass. They’re dressed in ' +
      'ceremonial garb and led by a trio of Savvas chanting a solemn dirge ' +
      'and thumping their chests in time to the group’s footfalls. At the ' +
      'center of the group, you spot a young Inox woman sobbing behind a ' +
      'white veil, her hands bound with silk rope. No one appears willing ' +
      'to comfort her.\n\n' +
      'The display is unusual enough that you peel off an Inox at the back ' +
      'of the congregation to ask what’s going on.\n\n' +
      '“We’re heading to the Rupture.” He gestures to black smoke rising ' +
      'from a far-off peak. “The beast awakens and demands a sacrifice. We ' +
      'must sate its anger! The mountain is aflame!”\n\n' +
      'The woman falls to her knees, wailing in terror. The Savvas stop ' +
      'their chanting to order the group into action, and two men in ' +
      'flowing robes pick her off the ground. When she refuses to walk, ' +
      'they drag her as best they can, still sobbing.',
    options: [
      {
        id: 'A',
        prompt: 'Let the procession pass.',
        outcome: {
          text:
            'They head towards the smoking mountain, and a few days later ' +
            'at sunset, you feel an uneasy stillness, as though the ' +
            'mountain has finally come to rest. Odd.',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Offer yourself as a sacrifice in her stead.',
        outcome: {
          text:
            'You demand to take the young woman’s place. The Savvas ' +
            'deliberate with each other for a moment, then acquiesce. ' +
            '“Retrieve the sacred artifacts and cast the greater into the ' +
            'liquid flame so the mountain will rest. Fail, and you have ' +
            'doomed our village and this land.”',
          effects: [
            { kind: 'new-scenario', name: 'Burning Mountain', number: 90 },
          ],
        },
      },
      {
        id: 'C',
        prompt: 'Kill the convoy and free the woman.',
        outcome: {
          text:
            'The woman’s captors are no match for trained mercenaries, but ' +
            'she is less than appreciative.\n\n' +
            '“You’ve doomed us! Now the mountain will flow with liquid ' +
            'flame and destroy my village!” She falls to her knees, ' +
            'sobbing. In an attempt to pacify her, you agree to complete ' +
            'the ritual in her party’s stead.\n\n' +
            '“Really? You’ll need to push past the guardians to retrieve ' +
            'the sacred artifacts. Take the greater of the two and cast it ' +
            'into the mountain’s fires. Oh, and I’m told a sacrifice of ' +
            'innocent blood will help appease the beast.” You nod, but ' +
            'make no promises about that last part.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'wound' },
            { kind: 'new-scenario', name: 'Burning Mountain', number: 90 },
          ],
        },
      },
    ],
  },
  {
    id: 'R-07',
    front:
      'A set of abandoned fishing poles rests beside a feeder stream. The ' +
      'poles look like they were hastily discarded in the tall grass, and ' +
      'a bucket of worms writhe in a wicker basket beside them. With your ' +
      'stomach rumbling, you grab a pole and make use of your good fortune.',
    options: [],
    game: {
      instructions:
        'Each character may cast their line up to five times, and may stop ' +
        'at any time. Characters may cast in any order of their choosing, ' +
        'but should not shuffle between casts. Each time a character casts ' +
        'their line, draw a card from their attack modifier deck. Evaluate ' +
        'only the numerical value of the card, ignoring any additional ' +
        'effects. If there is no numerical value, set it aside and draw ' +
        'again.',
      results: [
        {
          draw: '-1-or-lower',
          text: 'You pull up a chunk of half-eaten meat.',
          effects: [],
        },
        {
          draw: '+0',
          text: 'You find some discarded jewelry in the stream.',
          effects: [{ kind: 'character-gold', amount: 2 }],
        },
        {
          draw: '+1-or-higher',
          text: 'You pull a massive homefish from the stream.',
          effects: [
            {
              kind: 'next-scenario-condition-choice',
              conditions: ['safeguard', 'ward', 'strengthen'],
            },
          ],
        },
        {
          draw: '2x',
          text:
            'It puts up a fight, but you reel in an iridescent gimmelfish.',
          effects: [{ kind: 'checkmarks', count: 1 }],
        },
        {
          draw: 'null',
          text: 'Flip this card.',
          effects: [{ kind: 'flip-card' }],
        },
      ],
      returnToDeck: true,
    },
    flipped: {
      text:
        'The nibble at the end of your line suggests a tasty lunch is ' +
        'about to be served, but you didn’t realize who was on the menu. ' +
        'When the rows of scalpel-like teeth burst from the edge of the ' +
        'stream, the idyllic fishing spot turns to a traumatic race for ' +
        'cover. Tentacles whip sludge-filled barbs at anything within ' +
        'terrifying range. The eye-stalk breaches the water last: a ' +
        'crimson orb hunting you down among the tall grass.\n\n' +
        'You regain your wits and defend yourself, finally taking down the ' +
        'deep terror, but it will be weeks before you wake up in anything ' +
        'but a cold sweat.',
      effects: [
        { kind: 'next-scenario-condition', condition: 'wound' },
        { kind: 'next-scenario-condition', condition: 'poison' },
        {
          kind: 'next-scenario-condition-choice',
          conditions: ['immobilize', 'disarm'],
        },
      ],
      returnToDeck: true,
    },
  },
  {
    id: 'R-08',
    front:
      'That’s strange. There’s something in the road here… ah, it’s a ' +
      'corpse. A freshly-gnawed corpse. But it’s beside a sturdy-looking ' +
      'mace that would look great on your hip—\n\n' +
      'Pfft-TUFF!\n\n' +
      'A sharp barb lodges itself into your leg, and the idyllic hillside ' +
      'takes a turn for drowsy. You try to keep your bearings as a group ' +
      'of Vermlings rappel down from the trees and launch their attack, ' +
      'blow darts and spears in tow.\n\n' +
      'As you fight the sedative effects of the poison and struggle to ' +
      'stay awake, you recall that Vermlings have been known to eat the ' +
      'dead. It is not a comforting thought as your eyelids get heavy.',
    options: [
      {
        id: 'A',
        prompt: 'Defend yourself through the sleepiness.',
        requirement: {
          kind: 'traits',
          traits: ['armored', 'intimidating', 'strong'],
          mode: 'any',
        },
        outcome: {
          text:
            'You fight through the unbearable urge to sleep. You make a ' +
            'hasty retreat—but you make note of the location to return ' +
            'someday better prepared.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
            { kind: 'new-scenario', name: 'Vermling Camp', number: 97 },
          ],
        },
        otherwise: {
          text:
            'The only thing keeping you awake is the punctures of ' +
            'spearpoints as you attempt to retreat. You manage to make it ' +
            'to safety and note the location for the future. Whether it’s ' +
            'the blood loss or the poison you’re not sure, but you are due ' +
            'for a nap.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
            { kind: 'next-scenario-condition', condition: 'poison' },
            { kind: 'new-scenario', name: 'Vermling Camp', number: 97 },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Grab the heavy mace and try to make a run for it.',
        requirement: {
          kind: 'traits',
          traits: ['nimble', 'strong'],
          mode: 'any',
        },
        outcome: {
          text:
            'With heavy eyelids, you grab the handle of the mace and start ' +
            'running, dodging projectiles as you go. You mark the location ' +
            'to return someday.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'heavy-mace',
              name: 'Heavy Mace',
              printedNumber: 51,
            },
            { kind: 'new-scenario', name: 'Vermling Camp', number: 97 },
          ],
        },
        otherwise: {
          text:
            'You grab the handle of the mace, but it’s heavier than it ' +
            'looks. With the extra weight, a poorly-timed nap is in your ' +
            'future.',
          effects: [
            { kind: 'next-scenario-damage', amount: 3 },
            { kind: 'resolve-option', option: 'A' },
          ],
        },
      },
    ],
  },
  {
    id: 'R-09',
    front:
      'Not far outside Gloomhaven, you look up to see a large bird flying ' +
      'overhead. Something is odd, though. Its movements are jerky, and ' +
      'there is smoke billowing out of it. Then you see it plunge into a ' +
      'sudden nose-dive and crash to the ground off in the east.\n\n' +
      'You rush to the scene and find a limping, soot-covered Quatryl ' +
      'kicking a giant winged contraption made of leather and metal.\n\n' +
      '“Curse this wretched thing!” He yells in frustration. “I thought ' +
      'I’d worked it out, and then I suddenly lost pressure in the piston ' +
      'chamber!”\n\n' +
      'He looks over at you. “You there! Wonderful timing! Help me get ' +
      'this thing back into the air. There is no time to waste—the world ' +
      'needs my invention!”',
    options: [
      {
        id: 'A',
        prompt:
          'Examine the machinery yourself to determine the cause of the ' +
          'malfunction.',
        requirement: { kind: 'traits', traits: ['educated'], mode: 'all' },
        outcome: {
          text:
            'A cursory look is all it takes to confirm your suspicion: the ' +
            'piston chamber is losing pressure due to icing at higher ' +
            'altitudes. It’s a small matter to better insulate the valve ' +
            'and the system is again flight-worthy. You stand clear and ' +
            'watch in awe as the thing begins flapping wildly and lifts ' +
            'off the ground.',
          effects: [{ kind: 'prosperity', amount: 1 }],
        },
        otherwise: {
          text:
            'It’s pretty clear what the problem is: there isn’t a feather ' +
            'anywhere on the thing. The leather is from ground-based ' +
            'animals and wood also grows out of the ground. The Quatryl ' +
            'sighs as you explain it to him. “…right. Okay, I’ll just ' +
            'finish this one on my own. Thanks.”\n\n' +
            'A short time later you see the machine scream past above you. ' +
            'Unfortunately, the flight is short-lived, and the second ' +
            'crash is not nearly as forgiving. You find the Quatryl dead ' +
            'on impact, and there’s nothing more to do except harvest the ' +
            'machine for valuable parts. You did try to warn him.',
          effects: [{ kind: 'collective-gold', amount: 10 }],
        },
      },
      {
        id: 'B',
        prompt: 'Follow the inventor’s directions and perform the repairs.',
        outcome: {
          text:
            'You set the wings and bang out a few dents while the Quatryl ' +
            'repairs his pressure problem. In under an hour the Quatryl ' +
            'declares the contraption airworthy and jumps in the cockpit. ' +
            'Unfortunately, the flight is short-lived, and the second ' +
            'crash is not nearly as forgiving. You find the Quatryl dead ' +
            'on impact, and there’s nothing more to do except harvest the ' +
            'machine for valuable parts.',
          effects: [{ kind: 'collective-gold', amount: 10 }],
        },
      },
    ],
  },
  {
    id: 'R-10',
    front:
      'The distant whine of machinery draws you to a curious contraption: ' +
      'impossibly embedded into the mountainside is a metal doorway and ' +
      'several blinking crystals. A plaque at the top reads “Emergency ' +
      'Temporal Stash.”',
    options: [
      {
        id: 'A',
        prompt: 'The crystals have a sheen unlike any you’ve seen. Touch one.',
        outcome: {
          text: 'You may touch any one crystal.',
          effects: [
            {
              kind: 'choose-section',
              prompt: 'You may touch any one crystal.',
              choices: [
                {
                  id: 'blue-triangle',
                  text: 'BLUE TRIANGLE CRYSTAL',
                  readSection: '76.5',
                },
                {
                  id: 'red-circular',
                  text: 'RED CIRCULAR CRYSTAL',
                  readSection: '66.5',
                },
                {
                  id: 'orange-hex',
                  text: 'ORANGE HEX CRYSTAL',
                  readSection: '122.1',
                },
                {
                  id: 'green-diamond',
                  text: 'GREEN DIAMOND CRYSTAL',
                  readSection: '135.5',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Press the button in the center of the console.',
        outcome: {
          text:
            'You press the big button in the center of the console. The ' +
            'system whirrs to life, the lights dancing in a pattern beyond ' +
            'your comprehension. A voice rings inside your head, but you ' +
            'can’t find the source of the sound.\n\n' +
            '“This is Qualco’s Temporal Stash, keep out! This stash made ' +
            'possible through lots of trial and error and error and also ' +
            'some help from a pair of helpful Aesthers. But this is for ' +
            'Qualco’s eyes only! Since time is a bit wobbly, I’ll remind ' +
            'you—ME, Qualco only!—of the most important rule: No crystal ' +
            'is pressed more than once!\n\n' +
            '“But future-Qualco: if you do manage to get it wrong, that’ll ' +
            'discharge the crystal matrix, reset the stash’s location, and ' +
            'initiate defense measures. Take that, any not-Qualcos! I said ' +
            'for Qualco’s eyes only and I mean it!”',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
            {
              kind: 'choose-section',
              prompt: 'You may touch any one crystal.',
              choices: [
                {
                  id: 'blue-triangle',
                  text: 'BLUE TRIANGLE CRYSTAL',
                  readSection: '70.4',
                },
                {
                  id: 'red-circular',
                  text: 'RED CIRCULAR CRYSTAL',
                  readSection: '82.5',
                },
                {
                  id: 'orange-hex',
                  text: 'ORANGE HEX CRYSTAL',
                  readSection: '119.4',
                },
                {
                  id: 'green-diamond',
                  text: 'GREEN DIAMOND CRYSTAL',
                  readSection: '98.5',
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'R-11',
    front:
      'You are feeling a tad hungry as you walk down the road. You are ' +
      'considering stopping for a meal when you come across a thicket of ' +
      'bushes covered in red berries.\n\n' +
      'The berries look delicious, but you hesitate. They could be ' +
      'poisonous.',
    options: [
      {
        id: 'A',
        prompt: 'Eat the berries.',
        outcome: {
          text:
            'You shrug and grab a handful of berries to stuff in your ' +
            'mouth. They are incredibly sweet and just the right amount of ' +
            'tart. You couldn’t feel better about your decision. That is, ' +
            'until you start vomiting. Your stomach is incredibly unhappy ' +
            'with you, and the situation doesn’t improve much by the time ' +
            'you arrive at your destination.',
          effects: [{ kind: 'next-scenario-condition', condition: 'poison' }],
          returnToDeck: true,
        },
      },
      {
        id: 'B',
        prompt: 'Pass by the berries and just eat your normal rations.',
        outcome: {
          text:
            'Not wanting to regret making a stupid decision, you refrain ' +
            'from eating the berries and continue on down the road.',
          effects: [],
          returnToDeck: true,
        },
      },
    ],
  },
  {
    id: 'R-12',
    front:
      'As you walk down a dirt path, you see a hard-looking mercenary ' +
      'sitting in a patch of grass. He nods as you pass.\n\n' +
      '“Hey, friends,” he says. There is something off about his tone, ' +
      'though.\n\n' +
      '“I don’t suppose one of you might be willing to part with a ' +
      'stamina potion, would you? I’m headed toward Gloomhaven, but I’ve ' +
      'just come from such a long way, and I’m not feeling too good about ' +
      'the stretch I have left.”\n\n' +
      'With the clank of his sword sheath against his armor and a loud ' +
      'groan, the man stands up. “I’ll pay you well for it.”',
    options: [
      {
        id: 'A',
        prompt: 'Sell the man a stamina potion.',
        requirement: {
          kind: 'pay-item',
          items: [
            {
              printedNumber: 12,
              itemId: 'stamina-potion',
              name: 'Minor Stamina Potion',
            },
          ],
        },
        outcome: {
          text:
            'After some oddly tense negotiations, you are able to agree ' +
            'upon a price. With one hand firmly on his sword hilt, the man ' +
            'grabs a coin pouch with the other hand and extends it toward ' +
            'you. You exchange goods and continue on your journey without ' +
            'further incident.',
          effects: [
            { kind: 'collective-gold', amount: 20 },
            {
              kind: 'bonus',
              requirement: {
                kind: 'traits',
                traits: ['persuasive'],
                mode: 'all',
              },
              effects: [{ kind: 'collective-gold', amount: 10 }],
            },
          ],
        },
        otherwise: {
          text: 'Read Outcome B.',
          effects: [{ kind: 'resolve-option', option: 'B' }],
        },
      },
      {
        id: 'B',
        prompt: 'Politely decline and move quickly on your way.',
        outcome: {
          text:
            'There was something off-putting about that man. You are more ' +
            'than happy to move along and put some distance between you.',
          effects: [
            {
              kind: 'bonus',
              requirement: {
                kind: 'traits',
                traits: ['outcast'],
                mode: 'all',
              },
              text:
                'It feels good to snub that mercenary. Is that how they ' +
                'feel when they look at you? Empowering, really.',
              effects: [
                { kind: 'next-scenario-condition', condition: 'strengthen' },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'R-13',
    front:
      'After a heavy rain, the roads are dark streaks of slushy dirt. A ' +
      'group of exhausted attendants are pitifully attempting to free a ' +
      'wagon caught in knee-deep mud. The side of the wagon is emblazoned ' +
      'with “The Great Dallum—the Seer Who Knows.”\n\n' +
      'With a moment of help you manage to clear it out of the rut. As ' +
      'soon as it’s free, the side door opens and out steps a man with a ' +
      'charisma unlike any you’ve seen. Long, sandy-brown hair cascades ' +
      'down his shoulders, and his watery blue eyes gently meet your gaze. ' +
      'With a warm smile, he addresses you by name, then gives a friendly ' +
      'chuckle at your surprise.\n\n' +
      '“Thank you for your help—I know not how long we would have been ' +
      'trapped here were it not for you.” He clasps your hands in his own, ' +
      'and you feel the earnest callouses of a man who is no stranger to ' +
      'hard work. “I can see eddies flowing through us, and I use my gifts ' +
      'to help others. We were on our way to Gloomhaven when the rains ' +
      'caught us. Before we continue, can I thank you by lending my sight ' +
      'to your needs?”',
    options: [
      {
        id: 'A',
        prompt: 'Ask that he looks into the future of Gloomhaven.',
        preamble:
          'He speaks slowly and softly: “Gloomhaven is a troubled city… I ' +
          'hope to speak with the leadership there. I only hope that my ' +
          'warnings will not fall on deaf ears.” He gives a somber look. ' +
          '“Sometimes all that’s required is a friendly introduction…”',
        requirement: {
          kind: 'faction-reputation',
          faction: 'any',
          greaterThan: 5,
        },
        outcome: {
          text:
            'You agree to put in a good word for him with your contacts ' +
            'when you return to town. “This comes as no surprise… this ' +
            'world delights in providing what we need precisely when ' +
            'necessary.”',
          effects: [{ kind: 'prosperity', amount: 1 }],
        },
        otherwise: {
          text:
            '“No matter, sometimes the smallest seed is all that’s needed ' +
            'to blossom into great change.”',
          effects: [{ kind: 'checkmarks', count: 1 }],
        },
      },
      {
        id: 'B',
        prompt: 'Ask that he looks into the future of your party.',
        outcome: {
          text:
            'He speaks slowly and softly: “Your journey is nearly at an ' +
            'end, but there are others like you that will take up your ' +
            'standard. Your upcoming retirement will be arguably as good ' +
            'as you dream, but I fear adversity looms in the change.”\n\n' +
            'You turn to leave, but he calls you back. “Oh, one more ' +
            'thing: be wary in your upcoming travels. I foresee that a ' +
            'minor injury will prevent a more serious incident. Good ' +
            'luck.”',
          effects: [
            { kind: 'next-scenario-condition', condition: 'safeguard' },
            { kind: 'next-scenario-condition', condition: 'ward' },
            { kind: 'next-scenario-condition', condition: 'bless' },
          ],
        },
      },
    ],
  },
  {
    id: 'R-14',
    front:
      'It’s late afternoon when your progress is stopped by a thicket of ' +
      'brambles that have overtaken the road. It’s hard work clearing the ' +
      'path, and during a break, you spot a small outpost with a good ' +
      'vantage point to the horizon. It’s a little ways off the road, and ' +
      'even from a distance you can see it is being strangled by the same ' +
      'brambles that have made your journey frustrating so far.\n\n' +
      'There are a few hours before nightfall: diverting and clearing a ' +
      'path to the outpost would be hard labor for the rest of the ' +
      'afternoon, but having a safe place to rest would be welcome. If you ' +
      'do a good job, you may even be able to use it in the future. Is it ' +
      'worth the effort today?',
    options: [
      {
        id: 'A',
        prompt: 'Spend the rest of the day clearing brambles to get to the outpost.',
        outcome: {
          text:
            'The sticky brambles scratch and tear whatever gets within ' +
            'reach, and in short order, you’re covered in pinpricks. When ' +
            'you do finally make it up to the outpost, you’re dead tired. ' +
            'You hope that a future trip is made easier by your efforts, ' +
            'but you can’t help but grumble at how much work it was for so ' +
            'little reward.\n\n' +
            'You’re back on your way shortly before sunrise, sore muscles ' +
            'and all.',
          effects: [
            { kind: 'add-event-to-deck', deck: 'road', eventId: 'R-31' },
            { kind: 'next-scenario-discard', count: 2 },
            {
              kind: 'for-characters',
              trait: 'armored',
              mode: 'without',
              effects: [
                { kind: 'next-scenario-damage', amount: 1 },
                { kind: 'next-scenario-condition', condition: 'wound' },
              ],
            },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Clear only what’s needed to continue to your destination.',
        outcome: {
          text:
            'Bushwhacking the sticky brambles is frustrating work. While ' +
            'it may just be your imagination, you can nearly feel the ' +
            'bushes regrowing behind you. Several hours of work later, you ' +
            'emerge on the other side of the thicket and resume your ' +
            'journey.',
          effects: [
            {
              kind: 'for-characters',
              trait: 'armored',
              mode: 'without',
              effects: [
                { kind: 'next-scenario-condition', condition: 'wound' },
              ],
            },
          ],
          returnToDeck: true,
        },
      },
    ],
  },
  {
    id: 'R-15',
    front:
      'The distant sound of popping washes over the landscape, increasing ' +
      'in intensity as you approach. Before you is a field of trees ' +
      'bearing amberhollow, a brittle, hollow fruit that is entirely ' +
      'comprised of its shell with nothing but a bit of sweet liquid and ' +
      'an intense vacuum at its center. They’re a novel treat enjoyed for ' +
      'the explosive cracking sound they make when opened. The larger the ' +
      'fruit, the larger the vacuum and the harder they are to transport, ' +
      'leaving a very short (and sometimes dangerous) window for picking.\n\n' +
      'This orchard of amberhollow trees is certainly ripe, and all signs ' +
      'would point to it being an excellent harvest. Unfortunately, a pair ' +
      'of flame demons are wreaking havoc up and down the rows, lighting ' +
      'the heavy branches aflame, and the fire has spread to the only ' +
      'building on the property. The whole crop will be nothing but ash in ' +
      'minutes, and the burned corpse of the farmer at your feet probably ' +
      'won’t be enjoying the fruits of his labor, either.',
    options: [
      {
        id: 'A',
        prompt: 'Confront the flame demons.',
        requirement: {
          kind: 'faction-reputation',
          faction: 'demons',
          greaterThan: 12,
        },
        outcome: {
          text:
            'You brazenly confront the flame demons, ordering them to ' +
            'stand down. They recognize you and tone down the heat, but ' +
            'most of the crop is already lost. They eventually depart, ' +
            'leaving you to sort through the remains of the farmer’s home ' +
            'and crops.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'amberhollow',
              name: 'Amberhollow',
              printedNumber: 146,
            },
            { kind: 'collective-gold', amount: 15 },
          ],
        },
        otherwise: {
          text:
            'The demons don’t take kindly to your tone. There isn’t ' +
            'anything left of the farmer’s home by the time the fight is ' +
            'over, but you do find a few fruits still intact.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'amberhollow',
              name: 'Amberhollow',
              printedNumber: 146,
            },
            { kind: 'next-scenario-condition', condition: 'wound' },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Gather some fruits from the trees and make a quick exit.',
        outcome: {
          text:
            'It doesn’t look like there’s any reason to get involved ' +
            'defending a dead man. You pick a few of the ripest looking ' +
            'fruits from the trees and depart before the rest of the ' +
            'orchard burns down.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'amberhollow',
              name: 'Amberhollow',
              printedNumber: 146,
            },
          ],
        },
      },
      {
        id: 'C',
        prompt: 'Push past the demons and raid the farmer’s former home before it burns up.',
        outcome: {
          text:
            'Pursued by the flame demons, you hastily make your way into ' +
            'the burning building, gathering whatever valuables you can ' +
            'find. Soot and ash rain down on you as the thatched roof ' +
            'ignites. It takes everything you have to beat back the demons ' +
            'in the chaos and make it out with your lives.',
          effects: [
            { kind: 'collective-gold', amount: 15 },
            { kind: 'next-scenario-condition', condition: 'wound' },
          ],
        },
      },
    ],
  },
  {
    id: 'R-16',
    front:
      'You’re trudging along by the confidence of moonlight when an ' +
      'unfortunate misstep sends you tumbling down into a ditch. To your ' +
      'horror, your fall is stopped by slamming into an old Orchid ' +
      'meditating out of sight from the road. An Orchid sustains itself ' +
      'merely from contact with the ground and exposure to the sun, so ' +
      'it’s not uncommon for one to detach from society for days or even ' +
      'months at a time. With a yawn she rouses herself, taking stock of ' +
      'the night air.\n\n' +
      '“Ho there! Been napping for a spell, what year is it?” The year? ' +
      'You tell her it’s 1958 LO. “That’ll make it just shy of two hundred ' +
      'years between measurements, then. And on a full moon, too! ' +
      'Excellent timing.” She drags a heavy blanket off an apparatus next ' +
      'to her which reveals the largest telescope you’ve ever seen.\n\n' +
      '“Drat! The optic’s cracked. Must’ve had a snap frost some year. ' +
      'Suppose I’ll have to journey to the nearest town for parts. Can you ' +
      'point me towards Wayward? I assume the Sharp ’n’ Sturdy still ' +
      'stands, even after all these years.”',
    options: [
      {
        id: 'A',
        prompt: 'Attempt to repair the optics yourself.',
        requirement: {
          kind: 'pay-item',
          items: [
            { printedNumber: 5, itemId: 'scouting-lens', name: 'Scouting Lens' },
            { printedNumber: 9, itemId: 'focusing-rod', name: 'Focusing Rod' },
            {
              printedNumber: 26,
              itemId: 'eagle-eye-goggles',
              name: 'Eagle-Eye Goggles',
            },
            {
              printedNumber: 59,
              itemId: 'telescopic-lens',
              name: 'Telescopic Lens',
            },
            {
              printedNumber: 149,
              itemId: 'aesther-spyglass',
              name: 'Aesther Spyglass',
            },
          ],
        },
        outcome: {
          text:
            'You dismantle your possession and, with a bit of effort, are ' +
            'able to repair the damaged telescope. “See there? That ' +
            'twinkling teal crystal budding right out of the soil on the ' +
            'moon?” She makes some excited marks in her journal. “It’s ' +
            'growing. I’ve been observing it every few centuries. But the ' +
            'real interesting part? When the moon rotates clear around to ' +
            'the other side, there’s another one, straight across from ' +
            'each other if you drew a line through the core.”\n\n' +
            'She stretches her back with a crack that sounds decades in ' +
            'the making. “Two crystals, opposite sides of a moon that’ll ' +
            'never get the chance to see each other. Who put them there? I ' +
            'have my theories. Maybe it’s nothing. Or maybe it’ll be very ' +
            'important someday.”',
          effects: [
            { kind: 'xp', amount: 15 },
            { kind: 'gain-trait', trait: 'educated' },
          ],
        },
        otherwise: {
          text: 'Read Outcome B.',
          effects: [{ kind: 'resolve-option', option: 'B' }],
        },
      },
      {
        id: 'B',
        prompt: 'Explain that Gloomhaven is much closer than Wayward.',
        outcome: {
          text:
            '“Gloomhaven? Miserable name for a city, just dreadful. Things ' +
            'really have changed while I was asleep!” You draw her a crude ' +
            'map of the region and showcase where Gloomhaven sits at the ' +
            'mouth of the Still River. She raises an eyebrow, but doesn’t ' +
            'explain why. “Well, thank you for the help.”',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'R-17',
    front:
      'A human boy is pacing back and forth in front of the mouth of a ' +
      'cave. When he sees you, the teen starts in your direction, then ' +
      'thinks better of it, turning back to his pacing. You approach and ' +
      'ask him what’s the matter. He wrings his hands as he explains.\n\n' +
      '“It’s… I lost a bet with some older kids. I’m supposed to go into ' +
      'this cave to prove I’m not a coward. It’s just… those friends were ' +
      'supposed to meet me here to watch.” He starts speaking at his ' +
      'shoes, unwilling to make eye contact with you. “I… I think they ' +
      'got here first and they’re waiting in there to scare me. But if I ' +
      'don’t go in, then they’ll know I really am a coward. I don’t know ' +
      'what to do.”',
    options: [
      {
        id: 'A',
        prompt: 'Convince him to face his fear and go into the cave.',
        requirement: { kind: 'traits', traits: ['persuasive'], mode: 'all' },
        outcome: {
          text:
            'After a rousing pep talk, the young man gives a somber nod ' +
            'and heads into the mouth of the cave. You wait a few minutes ' +
            'for his return, but with the sun setting soon, you head off ' +
            'towards your destination.',
          effects: [],
        },
        otherwise: {
          text:
            'You give an explanation of how his cowardice will haunt him ' +
            'for the rest of his life, but it doesn’t overcome his fear of ' +
            'entering the dark cave. After more than an hour of attempts, ' +
            'you leave him to build up the courage himself.',
          effects: [{ kind: 'next-scenario-discard', count: 1 }],
        },
      },
      {
        id: 'B',
        prompt: 'Explain he has nothing to prove.',
        requirement: { kind: 'traits', traits: ['outcast'], mode: 'all' },
        outcome: {
          text:
            'You explain to the boy that those “friends” were bullies, and ' +
            'that he’s better off without them. He eventually nods his ' +
            'understanding and starts the walk back to Gloomhaven, alone. ' +
            'It feels like you inspired something in the boy.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'safeguard' },
            { kind: 'next-scenario-condition', condition: 'ward' },
          ],
        },
        otherwise: {
          text:
            'You take pity on the boy’s circumstances and escort him in, ' +
            'ready to get the jump on these “friends” that are so willing ' +
            'to bully him. The cave is surprisingly deep—and then the ' +
            'growling starts. Two full-grown cave bears are finishing up a ' +
            'meal, but they have room for dessert. It’s a bloody fight, ' +
            'but you emerge victorious.\n\n' +
            'The boy, although unharmed, looks pretty shaken up.',
          effects: [{ kind: 'next-scenario-condition', condition: 'wound' }],
        },
      },
    ],
  },
  {
    id: 'R-18',
    front:
      'A few minutes outside of Gloomhaven, a well-fed raven is pacing in ' +
      'the middle of the road. It cocks its head as you approach, ' +
      'seemingly unafraid and used to interacting with people. When you ' +
      'get close enough, it hops forward, presenting its left leg. A small ' +
      'scrap of parchment is tied to it with a black ribbon.\n\n' +
      'The note is sealed with black wax and the insignia of a serpent ' +
      'wrapped around a dagger. You unfurl the note and read:\n\n' +
      '“It has been nearly a month since your last check-in. Advise ' +
      'immediately whether you have installed the puppet stewards as ' +
      'agreed.”\n\n' +
      'The raven presents its other leg, waiting for a reply to be tied ' +
      'on.',
    options: [
      {
        id: 'A',
        prompt: 'Report that the preparations are on track.',
        outcome: {
          text:
            'You pen a short missive confirming everything is on schedule ' +
            'and tie it onto the raven’s other leg. It is seemingly ' +
            'waiting for something, and after a moment, you break off a ' +
            'piece of your trail ration. Satisfied, it takes to the air, ' +
            'and you quickly lose sight of it amongst the tree tops. Oh ' +
            'well.',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Report that this went to the wrong individual.',
        outcome: {
          text:
            'You write a short note explaining that this bird seems to ' +
            'have confused you with someone else. You sign at the bottom ' +
            'and tie it to the bird, giving it a few pats on the head. It ' +
            'looks confused, but eventually takes off. A few hours down ' +
            'the trail, you come across a black leather coin purse, ' +
            'seemingly left for you.',
          effects: [{ kind: 'collective-gold', amount: 10 }],
        },
      },
      {
        id: 'C',
        prompt:
          'Report back with a surprise (requires “Escaping the Sin-Ra” ' +
          'Personal Quest).',
        availableIf: { kind: 'personal-quest', name: 'Escaping the Sin-Ra' },
        outcome: {
          text:
            'As a former Sin-Ra operative, you know their methods when you ' +
            'see them. You write a return note and carefully—carefully ' +
            'place a single drop of concentrated poison in the folds. You ' +
            'tie it to the raven, and with a sharp whistle, you order it ' +
            'back into the air.\n\n' +
            'A few hours down the trail, you come across a dead man in the ' +
            'road, the note clutched in his hand. With one less operative ' +
            'in the world, you take what you can and move on.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            { kind: 'random-item-design' },
          ],
        },
      },
    ],
  },
  {
    id: 'R-19',
    front:
      'You’re a long distance from Gloomhaven when an exhausted Valrath ' +
      'approaches on foot from the other direction, leading an equally ' +
      'spent hristek by its reins.\n\n' +
      '“Hello, travelers,” the Valrath says. “I’m embarrassed to ask, but ' +
      'I was on a mission from the city, and I seem to have ridden too ' +
      'far, too fast. Both my mount and I are tired and out of supplies—' +
      'would you allow us to rest with you this evening?”\n\n' +
      'You agree, and when you finally stop to make camp, the grateful ' +
      'traveler opens his saddlebag to share his remaining supplies. As he ' +
      'does, a wooden lockbox tumbles out onto the ground. He quickly ' +
      'scoops it up, but not before you catch sight of the symbol carved ' +
      'into its lid: a trident rising through a spiral.\n\n' +
      '“Silly me,” he smiles as he stuffs the box back into his bag and ' +
      'produces a few paltry pieces of cured meat. “Now, friends, let’s ' +
      'sit around the fire and eat, yes?”',
    options: [
      {
        id: 'A',
        prompt: 'Sneak over and open the lockbox while he’s distracted with dinner.',
        requirement: {
          kind: 'traits',
          traits: ['resourceful', 'nimble'],
          mode: 'any',
        },
        outcome: {
          text:
            'You always keep a few pins around in case you need to open ' +
            'something you shouldn’t. You easily pick the lock, finding ' +
            'only a notebook and a small mechanical bell—which begins ' +
            'clanging loudly.\n\n' +
            '“THIEVES!” cries the Valrath, ripping the box from your hands ' +
            'before riding away on his exhausted hristek. “I’ll take my ' +
            'chances on my own.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'demons',
              amount: -1,
            },
          ],
        },
        otherwise: {
          text:
            'Your clumsy efforts to pick the lock disturb the Hristek, who ' +
            'honks angrily. You pretend you were merely petting the ' +
            'animal, and the traveler laughs. “Yes, she dislikes ' +
            'strangers, I’m afraid.”',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Let his secrets lie—ask him about his mission instead.',
        outcome: {
          text:
            'The traveler’s business is his own, and besides, you’re ' +
            'curious–what brings a lone rider into the dangerous wilds? ' +
            '“I’m a scout,” the Valrath confides, “I work for a secret ' +
            'group that will bring salvation to Gloomhaven.”\n\n' +
            '“If you’re of like mind, simply look for the symbol of the ' +
            'trident, and together we’ll save our city.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'demons',
              amount: 1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'R-20',
    front:
      'Headed in the opposite direction, back towards Gloomhaven, are a ' +
      'pair of guards escorting four men clasped in manacles. As you pass ' +
      'them, one of the prisoners forces the gag out of his mouth, ' +
      'shouting at you for assistance: “Help us, please! We’re political ' +
      'prisoners!”\n\n' +
      'One of the guards gives him a swift jab in the stomach and replaces ' +
      'the gag. “Sure, political prisoners. More like these four are ' +
      'treasonous scum. We’re taking them back to the Ghost Fortress for ' +
      'processing.” The guard yanks the chain-gang forward, snarling at ' +
      'the one who spoke up. “Enjoy the rest of your walk, it’s the last ' +
      'gulps of fresh air you’ll have before they seal you away for good.”\n\n' +
      'The guards give a laugh, turning to you for your reaction. That’s ' +
      'all it takes for the four men to make a run for it, stumbling up ' +
      'the embankment towards the cover of trees.\n\n' +
      'It takes a moment before the guards realize what’s happening, and ' +
      'even then, all they manage is an impotent cry of, “Stop them!”',
    options: [
      {
        id: 'A',
        prompt: 'Assist the guards in recapturing their charges.',
        outcome: {
          text:
            'The prisoners are already worse for wear from the long walk, ' +
            'and it doesn’t take much to subdue them. You make sure the ' +
            'manacles are in place before you bid the guards a good day. ' +
            'They nod their thanks and are sure to let you know they’ll ' +
            'put in a good word with their superiors.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Let the prisoners escape.',
        outcome: {
          text:
            'In a flash, the prisoners rush past you and into the cover of ' +
            'the trees. It’s perfectly plausible that you just didn’t ' +
            'react quickly enough, but that doesn’t save you from the ' +
            'admonishment of the guards.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: -1,
            },
          ],
        },
      },
    ],
  },
];
