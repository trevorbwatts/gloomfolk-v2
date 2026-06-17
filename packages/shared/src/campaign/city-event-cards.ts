/**
 * City event card content, transcribed verbatim from the physical deck
 * (docs/rules/city-phase.md — resolved exactly like road events). The
 * content model lives in event-cards.ts.
 */

import type { EventCard } from './event-cards.js';

export const CITY_EVENT_CARDS: readonly EventCard[] = [
  {
    id: 'C-01',
    front:
      'You’re at the University, doing guard duty for a special museum ' +
      'exhibition sponsored by the Merchant’s Guild. The artifacts on ' +
      'display were unearthed from an archeological dig near the city of ' +
      'Demonsgate, and the focal piece is an ancient suit of armor made of ' +
      'thousands of links of steel. It’s seen better days, but is in good ' +
      'condition for something crafted millennia ago. The placard next to ' +
      'it says that it belonged to an ancient leader with legendary luck ' +
      'who never fell in battle.\n\n' +
      'The day passes uneventfully, and your voice is sore by the end from ' +
      'reminding people not to touch the chainmail. The curators pack up ' +
      'the exhibits and give you your payment, wheeling the display out to ' +
      'the courtyard for transit to the next city on the schedule.\n\n' +
      'You’re about to step out towards the Sleeping Lion for a drink when ' +
      'you spot a steel link on the ground—it must’ve fallen off the armor ' +
      'you were guarding. You scoop it up and feel the heft in your hand… ' +
      'those ancient warriors weren’t fooling around.',
    options: [
      {
        id: 'A',
        prompt: 'Call after the curators and return it to them.',
        outcome: {
          text:
            'The link reattaches easily and the armor is loaded into the ' +
            'back of the transport carriage. The curators thank you ' +
            'profusely for your perceptiveness and are sure to put in a ' +
            'good word with their sponsors.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: 1,
            },
            { kind: 'collective-gold', amount: 10 },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'It won’t be missed. Keep the link for good luck.',
        outcome: {
          text:
            'The steel link has softened with age, and you’re able to bend ' +
            'it to nicely fit around your finger. It feels somehow right ' +
            'to bring a piece of a legendary warrior’s armor back into ' +
            'battle, albeit on a smaller scale.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            {
              kind: 'bonus',
              requirement: {
                kind: 'owns-item',
                printedNumber: 102,
                itemId: 'steel-ring',
                name: 'Steel Ring',
              },
              effects: [{ kind: 'character-gold', amount: 15 }],
              otherwise: {
                effects: [
                  {
                    kind: 'gain-item',
                    itemId: 'steel-ring',
                    name: 'Steel Ring',
                    printedNumber: 102,
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
    id: 'C-02',
    front:
      'The difference between rich people and poor people is that rich ' +
      'people have enough money to pay someone else to solve their ' +
      'problems. A wealthy businessman has set his sights on some real ' +
      'estate on the border of the Coin District. Unfortunately for him, ' +
      'it’s owned by a particularly obstinate old Savvas who has no ' +
      'intention of giving up its home for a new shop or apothecary or ' +
      'restaurant or whatever dazzling new property the businessman has in ' +
      'mind. The businessman has tried everything and after being refused, ' +
      'again, he’s turned to you as a last resort.\n\n' +
      '“I’ll give you ten gold just to knock on the door and remind it I ' +
      'want to buy the place. Thirty if you can convince that crusty ' +
      'Savvas to take the deal.” Seems like a good job either way.\n\n' +
      'You walk up to the Savvas’ door and discuss your plan amongst ' +
      'yourselves.',
    options: [
      {
        id: 'A',
        prompt:
          'Turn on the charm and explain why the businessman’s deal is an ' +
          'excellent offer.',
        requirement: { kind: 'traits', traits: ['persuasive'], mode: 'all' },
        outcome: {
          text:
            'You give a broad smile to the Savvas and lay out why the ' +
            'businessman’s offer would be an excellent opportunity. “It ' +
            'sounds much more reasonable coming from you than that ' +
            'block-headed businessman. I’ll sign.”',
          effects: [{ kind: 'collective-gold', amount: 30 }],
        },
        otherwise: {
          text:
            'You attempt to convince the Savvas, but it refuses outright. ' +
            '“I already told that ninny I’m not going anywhere! Find some ' +
            'other old rock to bother.”',
          effects: [{ kind: 'collective-gold', amount: 10 }],
        },
      },
      {
        id: 'B',
        prompt: 'Threaten the Savvas to encourage it to leave.',
        requirement: {
          kind: 'traits',
          traits: ['intimidating'],
          mode: 'all',
        },
        outcome: {
          text:
            'The Savvas attempts to slam the door in your face, but you ' +
            'push inside. You start plucking a collection of vases off the ' +
            'wall and “accidentally” dropping them. “Stop! Stop! I’ll ' +
            'sign! You monsters.”',
          effects: [{ kind: 'collective-gold', amount: 30 }],
        },
        otherwise: {
          text:
            '“Get off my property!” You try to force your way inside, but ' +
            'the Savvas effortlessly conjures a gust of wind that knocks ' +
            'you back into the street.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            { kind: 'next-scenario-damage', amount: 1 },
          ],
        },
      },
      {
        id: 'C',
        prompt:
          'Pocket the payment and head back to the Sleeping Lion without ' +
          'knocking.',
        outcome: {
          text:
            'Let the Savvas stonewall the businessman some more. You ' +
            'report that your negotiation was a failure and take the ' +
            'payment without doing a lick of work.',
          effects: [{ kind: 'collective-gold', amount: 10 }],
        },
      },
    ],
  },
  {
    id: 'C-03',
    front:
      'An enthusiastic crowd has gathered around a lone magician in the ' +
      'New Market. She adeptly produces silks and snowbirds from an empty ' +
      'hat, divines a merely thought-of card, and finds coins behind the ' +
      'ears of nearby children. The building audience is delighted by her ' +
      'presentation, clapping and laughing at her jokes.\n\n' +
      '“It is time for the main event! Children and the sensitive or ' +
      'infirmed, I invite you to look away… All other viewers, behold!” ' +
      'She dramatically rips a red curtain off a painted wooden box. The ' +
      'sides are pierced to the hilt by a dozen curved swords, embedded in ' +
      'every direction. She opens a pair of padlocks on the side to reveal ' +
      'the interior: sure enough, blades occupy every available space, ' +
      'leaving no room for much else.\n\n' +
      'She begins to draw the swords one by one, demonstrating each is ' +
      'real and solid with a firm twang against the cobblestones.\n\n' +
      '“Now, I’ll need a full-sized, corporeal volunteer… Quatryls, ' +
      'Vermlings, Aesthers, and Harrowers, you can sit this one out.”',
    options: [
      {
        id: 'A',
        prompt:
          'Raise your hand (select which party member is volunteering ' +
          'now).',
        outcome: {
          text: 'Read 63.2.',
          effects: [{ kind: 'read-section', section: '63.2' }],
        },
      },
      {
        id: 'B',
        prompt: 'Watch the trick closely to see how it’s done.',
        preamble:
          'A volunteer climbs into the case, and the magician begins ' +
          'rapidly pushing blades through from one side to the other. The ' +
          'swords are removed and out steps the volunteer, unharmed. It ' +
          'seems absolutely impossible, but surely there’s a way?',
        requirement: { kind: 'traits', traits: ['educated'], mode: 'all' },
        outcome: {
          text:
            'Watching carefully, you deduce there must be a series of ' +
            'mirrors that reflect the blade handles despite appearing to ' +
            'pierce through. You discuss it later at the Sleeping Lion and ' +
            'are pleased you figured it out.',
          effects: [{ kind: 'xp', amount: 5 }],
        },
        otherwise: {
          text:
            'You watch the blades go in, the blades come out, and the ' +
            'volunteer emerges unharmed. Even after everything you’ve seen ' +
            'on the battlefield, this? This is clearly true magic. You ' +
            'erupt in applause.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'C-04',
    front:
      'It’s rare that you’re called in for such high-profile work, but ' +
      'you’re being paid ten gold each to staff extra protection for a ' +
      'visiting nobleman. The town guard was supposed to be running the ' +
      'security detail, but the nobleman wound up on their bad side after ' +
      'promoting “rebellious ideologies.”\n\n' +
      'You’re making a path through the crowd to allow him to enter the ' +
      'town hall when you spot it: a glimmer of steel at the crest of a ' +
      'nearby rooftop. The unmistakable THUNK of a crossbow confirms the ' +
      'threat—you have just a split second before impact into the chest ' +
      'of your charge.',
    options: [
      {
        id: 'A',
        prompt: 'Leap in front of the crossbow bolt to save the nobleman.',
        outcome: {
          text:
            'You were paid for protection, and you’re as good as your ' +
            'word. It takes just a shift in your stance, and the crossbow ' +
            'bolt intended for the nobleman hits you instead.',
          effects: [
            {
              kind: 'for-selected-character',
              effects: [
                { kind: 'max-hp-change', amount: -1 },
                { kind: 'gain-trait', trait: 'hero' },
              ],
            },
            { kind: 'read-section', section: '27.1' },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Call out a warning.',
        outcome: {
          text:
            'You cry out before the impact, but it’s no use: the crossbow ' +
            'bolt finds its mark dead-center in the nobleman’s chest. He ' +
            'slumps to the ground and is dead long before help arrives. ' +
            'The assassin uses the commotion to slip away.\n\n' +
            'It’s a good thing you always ask for payment up front.',
          effects: [
            { kind: 'character-gold', amount: 10 },
            {
              kind: 'faction-reputation-change',
              faction: 'choice',
              chooseCount: 2,
              amount: -1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-05',
    front:
      '“Hey, looking for some cash?” A smarmy-looking Vermling with a mug ' +
      'of ale slides into your booth at the Sleeping Lion. His hair is ' +
      'unnaturally slicked back with a transparent oil, pulling his ' +
      'eyebrows a bit too high.\n\n' +
      '“You’ve been preapproved, just got word this afternoon. Came here ' +
      'straightaway to let you know. You’ve been looking at some shiny new ' +
      'toys in the shops, no? Some cash could make a big difference in ' +
      'your survivability out there.”\n\n' +
      'Wary, you ask what the catch is.\n\n' +
      '“No catch. Just a loan. You get 50 gold today. You pay back a ' +
      'little interest here and there. You’ll barely even notice, you’ll ' +
      'have so much extra lying around.” You inquire about the interest ' +
      'rate, and just who is offering this loan.\n\n' +
      'The Vermling clicks his tongue. “It’s a lotta math, beads on the ' +
      'abacus. I would focus on the today, you might not even be around ' +
      'tomorrow. Maybe you die? Maybe you retire? A lot of maybes, I ' +
      'think. Don’t worry your head about it.”',
    options: [
      {
        id: 'A',
        prompt: 'Accept the money.',
        outcome: {
          text:
            'If someone offers you 50 gold, you take 50 gold. The ' +
            'transaction is very simple and doesn’t even require ' +
            'paperwork. It’s apparently a family business and they’ll ' +
            'just keep track and remind you about interest payments as ' +
            'needed.\n\n' +
            '“Pleasure getting you signed up, here’s your new money.” The ' +
            'Vermling hands over a pouch that looks less impressive than ' +
            'you expected. “Bonecruncher will let you know when it’s time ' +
            'to collect. Until then, just live it up!”\n\n' +
            '…Bonecruncher?',
          effects: [
            { kind: 'collective-gold', amount: 50 },
            { kind: 'add-event-to-deck', deck: 'city', eventId: 'C-44' },
            { kind: 'gain-trait', trait: 'indebted' },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Refuse the loan.',
        outcome: {
          text:
            'It takes some repetition, but you finally make clear you’re ' +
            'not going to take this mysterious, anonymous loan. When he ' +
            'hears the finality in your voice, he shrugs, dropping the ' +
            'smarmy smile. He throws a few coins on the table for his ' +
            'drink and leaves the Sleeping Lion without another word.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'C-06',
    front:
      'Down an alley shortcut, you come across an unusual addition: a ' +
      'Valrath, bound and gagged, lying by the side of the road. You roll ' +
      'him onto his side and his frantic eyes confirm he’s still alive. A ' +
      'note strapped to his chest in excellent handwriting reads:\n\n' +
      '“To the Town Guards: This man was apprehended removing jewelry ' +
      'from nearby homes. Govern him accordingly.\n\n' +
      'By the verdant light of the scarab, The Green Carapace”\n\n' +
      'You see a pair of guards patrolling down the alley in your ' +
      'direction, but it doesn’t seem like they’ve spotted you in the ' +
      'dark yet. The bound man’s guttural groans suggests he’s trying to ' +
      'say something. You pull down the gag and he wastes no time:\n\n' +
      '“That crazed vigilante got me all wrong! You’ve gotta let me go. ' +
      'I’m—listen. You’re like me, right? Just trying to get by in this ' +
      'city. I can help you! I… I’ve got jewelry. Magic jewelry. You ' +
      'untie me and I’ll tell you where it is. It’s all yours!”',
    options: [
      {
        id: 'A',
        prompt: 'Untie the man.',
        outcome: {
          text:
            'A knife makes quick work of the silk ropes tying the man ' +
            'down, and you help him to his feet. He’s badly bruised and ' +
            'in no condition to run, but you still keep a firm grasp on ' +
            'him. All it takes is a smile to the unsuspecting guards and ' +
            'you’re in the clear. True to his word, he pulls a small ' +
            'glimmering earring out of his pocket and hands it to you.\n\n' +
            '“I knew you were like me. Good working with you. And watch ' +
            'out for that green psycho, they’re everywhere these days.”',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'moon-earring',
              name: 'Moon Earring',
              printedNumber: 36,
            },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Shout for the guards.',
        outcome: {
          text:
            'You alert the passing patrol and they quickly apprehend the ' +
            'criminal.\n\n' +
            '“Another one by the Green Carapace. Third this week, don’t ' +
            'know when this guy has time to sleep.” The other guard ' +
            'answers quickly: “They’re a Harrower, I don’t think they ' +
            'need to sleep. Tell you what, though, I appreciate their ' +
            'help. Somebody needs to smack some sense into these ' +
            'thieves.”\n\n' +
            'There’s a small bounty for the criminal, and it doesn’t look ' +
            'like the Green Carapace is going to show up to collect it. ' +
            'The guards hand it over to you in thanks.',
          effects: [
            { kind: 'collective-gold', amount: 10 },
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-07',
    front:
      'You’re taking a shortcut through Town Hall when an assistant ' +
      'approaches you. “Excuse me? Could you please assist me? We need an ' +
      'unbiased opinion.” You follow her into the central rotunda, where ' +
      'you find the council in session.\n\n' +
      'Councilwoman Vale furrows her brow at the sight of you. “Surely ' +
      'there are others that would be better suited to providing ' +
      'insight?”\n\n' +
      'Councilman Greymare interjects: “It’s a fine choice. Mercenaries ' +
      'are the lifeblood of a city, particularly one where the military ' +
      'is demonstrably inferior to the services a sellsword can provide.” ' +
      'His words trail out like thick barbs against the pro-military ' +
      'councilmembers.\n\n' +
      '“So be it,” Vale continues, ignoring the comment. “Mercenaries, ' +
      'speak for the populace: is a functional economy more important ' +
      'than security? Does the average citizen of Gloomhaven care more ' +
      'for their pocketbooks or their safety?” The councilmembers lean in ' +
      'to hear your response.',
    options: [
      {
        id: 'A',
        prompt: 'The economy is the most important function of government.',
        outcome: {
          text:
            'You attempt to provide an even-handed response about the ' +
            'importance of both aspects of civic life, but the true test ' +
            'of a city is not how it threatens its populace, but how it ' +
            'supports their opportunities to better their own lives.\n\n' +
            '“Thank you, mercenaries, for such a compelling argument. I ' +
            'think we’d all agree that, without a vibrant market for ' +
            'goods and services, a city is little more than a transient ' +
            'police state.” Councilman Greymare looks pleased. By the ' +
            'nods, it’s clear the listeners have been hearing only the ' +
            'aspects that support their own arguments. Politicians.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: 1,
            },
          ],
        },
      },
      {
        id: 'B',
        prompt:
          'The defense of the city is the most important function of ' +
          'government.',
        outcome: {
          text:
            'You attempt to provide an even-handed response about both ' +
            'aspects of civic life, but the true test of a city is ' +
            'whether it can defend its borders and its people against ' +
            'threats to their lives. Livelihoods are necessarily ' +
            'secondary to this primary government goal.\n\n' +
            'Councilwoman Vale gives the faintest hint of a smile. ' +
            '“Truer words have not been spoken, mercenaries. Your city ' +
            'thanks you for your contributions both in oration today and ' +
            'in your own efforts to defend Gloomhaven.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-08',
    front:
      '“Which one of you thinks they’re all that?” A drunken Quatryl ' +
      'patron at the Sleeping Lion steps up to your usual table, wavering ' +
      'as he addresses you. His eyes pass in an out of focus, and it’s ' +
      'not clear who he means to be accosting.',
    options: [],
    resolution: {
      text:
        'Select a character to step up to the challenger, then flip this ' +
        'card.',
      effects: [{ kind: 'flip-card' }],
    },
    flipped: {
      text:
        'Read the section below corresponding to the ancestry of the ' +
        'selected character.',
      effects: [
        {
          kind: 'ancestry-section',
          sections: [
            { ancestry: 'orchid', readSection: '59.1' },
            { ancestry: 'valrath', readSection: '9.3' },
            { ancestry: 'inox', readSection: '32.3' },
            { ancestry: 'savvas', readSection: '132.2' },
            { ancestry: 'vermling', readSection: '135.2' },
            { ancestry: 'quatryl', readSection: '112.5' },
            { ancestry: 'harrower', readSection: '61.2' },
            { ancestry: 'aesther', readSection: '124.4' },
            { ancestry: 'human', readSection: '91.4' },
            { ancestry: 'other', readSection: '105.1' },
          ],
        },
      ],
      returnToDeck: true,
    },
  },
  {
    id: 'C-09',
    front:
      'The Sekhem Gardens are a massive enclosed greenhouse in the ' +
      'Traveler’s District. Exotic plants and humid air make for an ' +
      'attraction to all walks of life, but the primary visitors are the ' +
      'Valraths that take comfort in the oasis-like natural beauty of ' +
      'their ancestral home. Temperatures inside are high enough to make ' +
      'even most Valraths sweat, but Councilwoman Vale doesn’t show a ' +
      'drop of perspiration as she winds an iridescent blue vine along ' +
      'some trelliswork.\n\n' +
      '“I’ve discovered some unusual legends.” She expertly weaves it in ' +
      'and out, tracing the glazing of the window. “Or rather, my ' +
      'daughter did. She spends altogether too much time with her nose ' +
      'in a book.” The councilwoman snips the end of the vine, tying it ' +
      'to the trellis with a velvet ribbon.\n\n' +
      '“I am told of a tower between the Watcher Mountains and the ' +
      'Dagger Forest, that a machine of war there challenges all comers. ' +
      'If it is true, you are to defeat it, dismantle it, and bring it ' +
      'to me. I suspect that, like most knowledge committed to books, it ' +
      'is fanciful hyperbole. But regardless, you will see it ' +
      'investigated.” She makes it sound much less optional than most ' +
      'people who hire you.',
    options: [
      {
        id: 'A',
        prompt: 'Ask to keep the machine if you can defeat it.',
        requirement: {
          kind: 'faction-reputation',
          faction: 'military',
          greaterThan: 6,
        },
        outcome: {
          text:
            '“I am pleased by your readiness to wield such a device, as ' +
            'many do not have the stomach for war. All of my endeavors ' +
            'in this life are in pursuit of greater peace for ' +
            'Gloomhaven.” She tilts her head in acknowledgment, and you ' +
            'can’t help but feel a sense of pride. “If you will champion ' +
            'such a cause in the defense of Gloomhaven, I would expect ' +
            'nothing less than your service in its use.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
            { kind: 'new-scenario', name: 'Arcane Library', number: 88 },
          ],
        },
        otherwise: {
          text:
            'She raises an eyebrow. “If it is as dangerous as the ' +
            'legends claim, it will be best managed in the hands of ' +
            'those loyal to the city.” There’s no question that she’s ' +
            'sizing up your trustworthiness. “Prove yourself and I will ' +
            'consider your request.”',
          effects: [
            { kind: 'new-scenario', name: 'Arcane Library', number: 88 },
          ],
        },
      },
      {
        id: 'B',
        prompt:
          'Ask for access to the city armory to prepare for the quest.',
        outcome: {
          text:
            '“As the city’s armory is the finest collection of materials ' +
            'for war, it is no surprise to hear your request. I’ll see ' +
            'to it that First Shield Harmon permits you access.”',
          effects: [
            {
              kind: 'gain-item-from-range',
              fromPrintedNumber: 1,
              toPrintedNumber: 14,
            },
            { kind: 'new-scenario', name: 'Arcane Library', number: 88 },
          ],
        },
      },
    ],
  },
  {
    id: 'C-10',
    front:
      '“Okay, don’t freak out. This is a totally consensual thing that ' +
      'is happening, and I need everyone to just stay calm, okay?” ' +
      'You’re standing in the apartment of Xain, a local Orchid barfly ' +
      'who frequents the Sleeping Lion. Also standing in Xain’s ' +
      'apartment is a full-sized sun demon, dumping light into the room ' +
      'and crouching to fit under the low ceiling. It quietly watches ' +
      'the proceedings.\n\n' +
      '“Mercenaries, meet Sunny. Sunny: these’re the best mercenaries at ' +
      'the Sleeping Lion, at least on short notice. Great—hit it, ' +
      'Sunny.” Sunny picks up a metal paperweight from the bookshelf and ' +
      'compresses it tightly within its brightly-glowing hands. You ' +
      'avert your gaze, but when it’s done, you see the paperweight has ' +
      'been reformed into a tiny, perfectly-formed replica of a man-made ' +
      'island with unintelligible contraptions sticking out of it. Xain ' +
      'closes his eyes and touches the display with a fingertip, ' +
      'interpreting the object.\n\n' +
      '“Sunny says bugs have taken over some specialty forge built by ' +
      'his kind. Help Sunny clear out the infestation, and it’ll use the ' +
      'forge to make you something amazing.” Xain opens his eyes and ' +
      'looks at you. “Deal?”',
    options: [
      {
        id: 'A',
        prompt: 'Agree to help Sunny clear out the infestation.',
        outcome: {
          text:
            'Not entirely sure of the protocol, you attempt to mime ' +
            'acceptance at Sunny. Sunny holds out a sun-drenched hand in ' +
            'response, focusing the energy to a singular point and ' +
            'deftly slicing the display into something new: a diorama of ' +
            'a sword. It returns to a resting position, eyeing you ' +
            'closely without apparent emotion. Xain closes his eyes and ' +
            'touches the miniature.\n\n' +
            '“Sunny says it knows how to make some kind of fancy sword ' +
            'with the forge. Get the bugs out, and Sunny will use the ' +
            'facility to sinter it for you.” Xain’s eyes pop open, and ' +
            'he looks grumpily at Sunny. “You’re giving away the sword? ' +
            'Then you and I need to rework our arrangement.”',
          effects: [
            { kind: 'new-scenario', name: 'Sintering Forge', number: 99 },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Demand to speak with Sunny alone.',
        requirement: { kind: 'ancestry', ancestries: ['orchid'] },
        outcome: {
          text:
            'You ask Sunny a series of questions with Xain out of the ' +
            'room. It responds with intricate dioramas, and by touching ' +
            'each, you can tease out the meaning of the psychic patterns ' +
            'that created them. You gather that Sunny met Xain after ' +
            'being trapped in his belt buckle, a story which doesn’t get ' +
            'elaborated on. The two formed an unlikely alliance when ' +
            'Xain offered to help clear the Sintering Forge in exchange ' +
            'for using the manufacturing facilities. Xain impatiently ' +
            'returns to the room. “Well?”',
          effects: [
            { kind: 'xp', amount: 10 },
            { kind: 'resolve-option', option: 'A' },
          ],
        },
        otherwise: {
          text:
            'With Xain out of the room, you attempt to communicate with ' +
            'the Sun Demon. Sunny melts many objects from around the ' +
            'room into dioramas, but you can’t make sense of any of ' +
            'them. Xain returns after a few minutes, exasperatedly ' +
            'surveying the destruction. “Well, this looks productive. ' +
            'Ready to help?”',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
            { kind: 'resolve-option', option: 'A' },
          ],
        },
      },
    ],
  },
  {
    id: 'C-11',
    front:
      'Rain tumbles from the sky, driving most of the citizenry to drier ' +
      'confines indoors. You’re heading back home from the Sleeping Lion ' +
      'when you see a portly man in a black cloak nearly dragging a limp ' +
      'teen through the alleyways.\n\n' +
      'The cloaked man notices you approach and moves to block your ' +
      'view. “Ah, sorry, my friend took a spill. I will ensure he ' +
      'returns home safely from here. Thank you for your interest, ' +
      'regardless.” You push him aside easily enough to get a better ' +
      'look, and the teen he’s carrying slumps face-down into a puddle. ' +
      'You prod him with the edge of your boot and he stirs, sitting ' +
      'upright and sputtering water. He looks just to the side of you as ' +
      'though he’s seeing something that isn’t there.\n\n' +
      'With uncanny stilted movement, the teen nods to you. “Yes, thank ' +
      'you for your interest. I’ll be returned home safely.”',
    options: [
      {
        id: 'A',
        prompt: 'Let the cloaked man return the teen home.',
        outcome: {
          text:
            '“Thank you for your understanding. My poor friend will not ' +
            'cause such trouble again.” The portly man places his cloak ' +
            'protectively over his charge, disappearing into the night.',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Refuse to release the teen to the cloaked man.',
        outcome: {
          text:
            'You help the nearly-drowned teen to his feet. The portly ' +
            'man steps forward, “I assure you, there is no reason for ' +
            'alarm—” he reaches out to grab the teen, and you shove him ' +
            'to the ground, splashing him into the muddy runoff. He dabs ' +
            'his face with a black handkerchief, and with a dramatic ' +
            'clearing of his throat rushes off to somewhere without ' +
            'another word.\n\n' +
            'No sooner than he’s out of sight than the teen seems to ' +
            'come out of his daze. “Thank you, I was telling that man ' +
            'about the Sect when I started feeling winded… then ' +
            'everything got cloudy. I could’ve sworn he said the word ' +
            '‘sacrifice’ right before everything went black.” He shakes ' +
            'his head, pushing away whatever he has the displeasure of ' +
            'recalling. “The Sect is doing such important work, I feel ' +
            'the need to tell any who will listen. I don’t want… thank ' +
            'you. I don’t know where I’d be without you.”',
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
    id: 'C-12',
    front:
      '“This is the greatest invention ever created!” A Quatryl has set ' +
      'up a display stand on a streetcorner, tapping a black cane on the ' +
      'ground in an effort to draw a crowd. “Behold!” With a flourish, ' +
      'she yanks a curtain off a curious, brass-bound box.\n\n' +
      '“This marvel—using the exacting powers of science—can induce the ' +
      'feelings of drunkenness without a sip of alcohol or inhalation of ' +
      'smokes of any kind! Tend a bar without spirits, enliven a party ' +
      'without consequence. Gather round, and experience the wonder!” ' +
      'With that, she reaches up and throws a brass-handled lever on the ' +
      'side of the contraption, and the box gets noisy. The box is ' +
      'noisy. BRRRrr. BRRR! It’s noisy—the, the box.\n\n' +
      'Your near the box and it’s noisy and you feel noisy.\n\n' +
      'Did the street get noisy to you? It feels noisy. brrrr is like ' +
      'that kind of sound. It’s like that. brrrrrr. That’s fun ' +
      'to—brrrr.\n\n' +
      '“Oh no, no no—that’s not right.”',
    options: [
      {
        id: 'A',
        prompt: 'Throw the lever down.',
        outcome: {
          text:
            'You stretch out and throw the lever down. Down is up and up ' +
            'is, oh, wow, do you feel sick. But at least the sky is ' +
            'where is should be. Now if it would just stop moving.\n\n' +
            'The Quatryl, choking back a gag, addresses the crowd ' +
            'sheepishly. “Sorry, sorry, that... oh wow, that really was ' +
            'turned up much too high. But—but think about how potent it ' +
            'is!” The crowd doesn’t seem impressed.',
          effects: [],
        },
      },
      {
        id: 'B',
        prompt: 'Throw the lever up.',
        outcome: {
          text:
            'You stretch out and throw the lever up. Unfortunately, what ' +
            'you believe to be the direction you want to push the lever ' +
            'is so, so wrong. With a lurch, the machine turns on even ' +
            'stronger, sending the gathered crowd reeling. When the ' +
            'Orchid finally gets control of her machine, no amount of ' +
            'apologies will make up for the distress of the crowd, and ' +
            'she packs up and scurries off as quickly as her ' +
            'still-wobbly legs will let her.',
          effects: [
            { kind: 'next-scenario-condition', condition: 'muddle' },
          ],
        },
      },
      {
        id: 'C',
        prompt: 'Throw up.',
        outcome: {
          text:
            'There’s no mistaking the feeling of relief, but the results ' +
            'wind up all over the machine. With a gurgle, it stops all ' +
            'at once.\n\n' +
            '“My machine! It just needed some tweaking...” You continue ' +
            'on your way rather than stick around to be berated, ' +
            'confident you made the right decision.',
          effects: [],
        },
      },
    ],
  },
  {
    id: 'C-13',
    front:
      'You hear screams from the south as you approach the docks.\n\n' +
      'A group of women run toward you in a panic, nearly knocking you ' +
      'over as they race by. One of them shouts: “An invasion!”\n\n' +
      'You hurry to the docks and find a crowd of workers on edge, armed ' +
      'with makeshift weapons and circling one particular pier.\n\n' +
      'Standing at the far end of the wooden planks is a group of ' +
      'Lurkers—terrifying crab-like monsters as big as an Inox and ' +
      'equally ferocious. Except these Lurkers don’t appear to be ' +
      'hostile. They are simply standing on the dock, clacking their ' +
      'claws in a strange rhythm.',
    options: [
      {
        id: 'A',
        prompt: 'Raise arms and fight the Lurkers back into the sea.',
        outcome: {
          text:
            'The crowd parts as you approach the dock with weapons ' +
            'drawn. You step onto the soft wood and the Lurkers turn ' +
            'toward you and stop clacking. They all hiss and brandish ' +
            'their claws in aggression. You charge forward and meet the ' +
            'threat head-on, hacking away at their carapaces until they ' +
            'scuttle off the dock and back into the water.',
          effects: [{ kind: 'xp', amount: 10 }],
        },
      },
      {
        id: 'B',
        prompt:
          'Approach the Lurkers cautiously and attempt to communicate ' +
          'with them.',
        outcome: {
          text:
            'The crowd parts as you move toward the dock with both ' +
            'confidence and care. The Lurkers notice your approach and ' +
            'continue to clack in your direction. You call out to them ' +
            'and ask why they are here, but all you get in response is a ' +
            'change in tempo of their clacking. When you express ' +
            'confusion, they clack again in frustration and scuttle back ' +
            'into the ocean. The crowd is very impressed that you ' +
            'managed to ward off the creatures without using force.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'choice',
              amount: 2,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-14',
    front:
      'You’re standing in the cramped room of Pinter Droman, a fledgling ' +
      'Quatryl inventor. Stacked to the ceiling are plans, parts, and ' +
      'pieces of various machines in half-built stages. He wastes no ' +
      'time launching into his issue.\n\n' +
      '“I bought this off a Vermling—they’re the ones most likely to ' +
      'acquire these things, you see. It’s an old ledger showing mining ' +
      'routes. Compare them to what’s still in operation today, and ' +
      'there! Right there! This tunnel is on the old maps, but not on ' +
      'the current ones.” Pinter flips a magnifying glass down from his ' +
      'visor, leaning in close to the paperwork strewn across his ' +
      'desk.\n\n' +
      '“But this rock is dense—it’s more like what you’d find in the ' +
      'mountains to the north than the ones around here. You couldn’t ' +
      'cut into it even with the tools of today. If there really is a ' +
      'mine there, then they used technology that exceeds our own. ' +
      'Imagine what we could build! Gather that for me, would you? I’m ' +
      'sort of between incomes at the moment, but I can compensate you ' +
      'with my inventions.”',
    options: [
      {
        id: 'A',
        prompt: 'Accept one of his inventions as payment.',
        outcome: {
          text:
            '“Ah, this is a Pinter Droman original! May it never ' +
            'explode, unless you need it to explode, in which case may ' +
            'it explode spectacularly.”',
          effects: [
            { kind: 'random-item-design', gainItem: true },
            { kind: 'new-scenario', name: 'Sulfur Mine', number: 87 },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Ask to browse through his unfinished blueprints.',
        outcome: {
          text:
            '“Certainly, please, take your time. They’re all equally ' +
            'useful, I assure you. I’m just a bit pinched on gold at the ' +
            'moment, so I can’t build everything that comes to mind ' +
            'myself.” You sort through the blueprints and scrawled ' +
            'diagrams and narrow it down to a few that look promising.',
          effects: [
            { kind: 'random-item-design', draw: 3 },
            { kind: 'new-scenario', name: 'Sulfur Mine', number: 87 },
          ],
        },
      },
    ],
  },
  {
    id: 'C-15',
    front:
      'The acrid smell of smoke assaults your senses. The university’s ' +
      'southern annex is on fire. Citizens are fleeing every direction ' +
      'in panic, hindering relief efforts. If no one intervenes, it’s ' +
      'likely to spread, and the town guard hasn’t yet arrived.\n\n' +
      '“You’re going to do something, right?” A pair of street-denizens ' +
      'rushes up to you, ready to assist. One is an older gentleman who ' +
      'looks a bit crazed, but his build suggests a strength about him. ' +
      'The other is a meek younger woman who looks quick on her feet. ' +
      '“Tell us where to go and we’ll help!”',
    options: [],
    resolution: {
      text:
        'Distribute your characters, along with the older gentleman and ' +
        'the younger woman, among the following tasks:\n\n' +
        'Herding the panicking citizens.\n\n' +
        'Entering the burning building to rescue people.\n\n' +
        'Attempting to temper the flames.\n\n' +
        'When everyone is assigned to tasks, flip this card over.',
      effects: [{ kind: 'flip-card' }],
    },
    flipped: {
      text: 'Read 75.4.',
      effects: [{ kind: 'read-section', section: '75.4' }],
    },
  },
  {
    id: 'C-16',
    front:
      'You spot a member of the Sect, a group of curious individuals who ' +
      'worship demons, picking produce at a shop in the New Market. He’s ' +
      'pointing at decadent displays of fruits and honeyed sweets, each ' +
      'of which is piled into his cart by the shop keep. The store owner ' +
      'loads the last of the selections—a crate of plump red radishes—' +
      'onto the scales for weighing. “That will be... 10 gold.”\n\n' +
      'The Sect member twists within its clothes and removes a leather ' +
      'satchel of coins, passing it over to the store owner for ' +
      'counting. Before he gets to the exit, though, the store owner ' +
      'speaks up, concerned. “Hey. Hey! I don’t know what this is, but ' +
      'either you pay, or I’ll summon the guards.” You peek inside the ' +
      'satchel and see a variety of dirt-encrusted gold coins, none of ' +
      'which are recognizable as currency. The Sect member looks to the ' +
      'store owner and then to you, pleading.',
    options: [
      {
        id: 'A',
        prompt:
          'Offer to pay for the produce in exchange for the coinage ' +
          '(requires 10 gold).',
        availableIf: { kind: 'pay-collective-gold', amount: 10 },
        outcome: {
          text:
            'You step in and pay for the Sect member’s purchase before ' +
            'the store owner can raise the alarm. “You shouldn’t help ' +
            'them. Monstrous people, those Sect members. I heard they’re ' +
            'trying to summon Demons right into Gloomhaven. They needle ' +
            'you to join their cult one day, and then, the next, they’re ' +
            'ripping you off with this filthy scrap. I wish the market ' +
            'would ban them entirely, let them shop in the Sinking ' +
            'Market with the rest of the detritus. Do you want this?”\n\n' +
            'You take the bag of coins to a dealer in the Coin District, ' +
            'whose eyes widen at the sight. “These must be a thousand ' +
            'years old, perhaps more! Yes, of course I’ll take them.”',
          effects: [
            { kind: 'collective-gold', amount: 20 },
            {
              kind: 'faction-reputation-change',
              faction: 'demons',
              amount: 1,
            },
          ],
          returnToDeck: true,
        },
      },
      {
        id: 'B',
        prompt: 'Support the store owner in demanding proper currency.',
        outcome: {
          text:
            'The Sect member bolts out the door with an armful of ' +
            'produce. You’re left with no other choice but to give chase ' +
            'into the New Market streets. He’s no match for your speed, ' +
            'and in no time at all you’ve tackled him to the ground, ' +
            'spilling expensive produce everywhere. He thrashes against ' +
            'you, trying to snap his jaws onto your forearm. A quick ' +
            'blow to the forehead knocks him out cold, and the town ' +
            'guard arrives a few moments later.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: 1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-17',
    front:
      '“Excuse me, mercenaries?” A silver-cloaked man approaches you, a ' +
      'brooch of fresh flowers pinned to his jacket. The sickly-sweet ' +
      'perfume he carries overwhelms you as he rushes up.\n\n' +
      '“There is a crate that will be exiting Gloomhaven momentarily... ' +
      'the gentlemen at the gate will not open it, yes?”\n\n' +
      'Is he asking you or telling you? A trickle of black liquid leaks ' +
      'out the side of his mouth, and he dabs it with a black ' +
      'handkerchief. “If you can assist in its exit, you will be ' +
      'compensated. Well? Compensated.”\n\n' +
      'The guards will give extreme scrutiny to anyone with his odd ' +
      'behavior, but it should be no issue for you to push the crate ' +
      'through as supposed supplies for a mission.',
    options: [
      {
        id: 'A',
        prompt: 'Help the cloaked man get his crate through the checkpoint.',
        outcome: {
          text:
            'As regulars transiting in and out of the city, you chat ' +
            'with the guards for a few minutes before they wave you and ' +
            'the crate through without inspection. An hour later, your ' +
            'silver-cloaked friend catches up to you further down the ' +
            'road.\n\n' +
            '“Well. Done? You have crate.” The cloaked man smiles a ' +
            'disconcerting grin, cracking it open and handing you a pair ' +
            'of boots from the rows stowed inside. “They will remember. ' +
            'Don’t forget.” You can’t quite tell if it’s a threat.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'gust-striders',
              name: 'Gust Striders',
              printedNumber: 114,
            },
            {
              kind: 'faction-reputation-change',
              faction: 'demons',
              amount: 1,
            },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Alert the guards to the fishy behavior.',
        outcome: {
          text:
            'You give the guards a subtle look, tapping your thumb ' +
            'against the side of the crate. They catch on immediately, ' +
            'and, with some whispered instructions, wave you through.\n\n' +
            'When the silver-cloaked man later catches up to you, the ' +
            'guards spring out of hiding, clasping him in irons. He ' +
            'snarls at you, spitting black ichor. “Demons remember! ' +
            'Don’t forget.” The guards thank you for your help in ' +
            'getting this demon sympathizer off the streets, and are ' +
            'even kind enough to look away while you grab a set of ' +
            'contraband boots from inside the crate. It’s a nice tip.',
          effects: [
            {
              kind: 'gain-item',
              itemId: 'gust-striders',
              name: 'Gust Striders',
              printedNumber: 114,
            },
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
            {
              kind: 'faction-reputation-change',
              faction: 'demons',
              amount: -1,
            },
          ],
        },
      },
    ],
  },
  {
    id: 'C-18',
    front:
      '“Perhaps you do not understand, she is the most beautiful girl to ' +
      'have ever walked this earth, and her eyes are like stars sparkling ' +
      'in a summer’s breeze! I care not what my father thinks or what her ' +
      'witch of a mother believes—I must wed her! I simply must!” ' +
      'Greggory Greymare, teenage son of pro-merchant Councilman ' +
      'Greymare, has flopped unceremoniously on a fainting couch in his ' +
      'father’s estate. He’s called you here to buy your services in ' +
      'delivering a love letter to Nectar Vale, the teenage daughter of ' +
      'pro-military Councilwoman Vale—the archnemesis to his father’s ' +
      'dealings. He’s prattling on instead of paying you so you can be on ' +
      'your way.\n\n' +
      '“I would give all my possessions for a look into her eyes. My ' +
      'father would admonish me, surely, if he knew the depths of my ' +
      'heart. Her own mother would surely forbid our union should she ' +
      'hear the beating of our two chests in time. Will you help me? What ' +
      'would it cost to deliver this simple letter of love to my sweet ' +
      'Nectar? Fifteen gold?”',
    options: [
      {
        id: 'A',
        prompt: 'Deliver the note to Nectar Vale.',
        outcome: {
          text:
            'It’s evening before Nectar is outside her mother’s manor ' +
            'and watchful eyes, browsing the markets in the Coin ' +
            'District. You approach her and are stopped by her ' +
            'handmaiden before you explain the situation. Nectar’s eyes ' +
            'light up at the mention of Greggory, and she tears open the ' +
            'letter immediately. She reads through it twice before ' +
            'clutching it to her chest, tears of joy dotting her eyes. ' +
            '“Yes, of course I’ll marry him!”',
          effects: [
            { kind: 'collective-gold', amount: 15 },
            { kind: 'next-scenario-condition', condition: 'safeguard' },
            { kind: 'add-event-to-deck', deck: 'city', eventId: 'C-41' },
          ],
        },
      },
      {
        id: 'B',
        prompt: 'Show the note to the boy’s father, Councilman Greymare.',
        outcome: {
          text:
            'You immediately hand the note over to his father, ' +
            'Councilman Greymare. “It’s good that you’ve brought this to ' +
            'me, I’ll see to it that this foolishness is taken care of. ' +
            'He will understand and obey his father.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: 1,
            },
            { kind: 'collective-gold', amount: 15 },
            { kind: 'add-event-to-deck', deck: 'city', eventId: 'C-41' },
          ],
        },
      },
      {
        id: 'C',
        prompt: 'Show the note to the girl’s mother, Councilwoman Vale.',
        outcome: {
          text:
            'You march the letter over to the Sekhem Gardens, where you ' +
            'find Councilwoman Vale entertaining a few Valraths over ' +
            'tea. She reviews the message then excuses herself to speak ' +
            'with you. “That monstrous merchant and his family will ' +
            'never lay a finger on my daughters, mark my words. I ' +
            'absolutely forbid it! You have proven yourselves a valuable ' +
            'asset.”',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'military',
              amount: 1,
            },
            { kind: 'collective-gold', amount: 15 },
            { kind: 'add-event-to-deck', deck: 'city', eventId: 'C-41' },
          ],
        },
      },
    ],
  },
  {
    id: 'C-19',
    front:
      'A group of Merchant’s Guild tax collectors are winding through ' +
      'the stalls of the Sinking Market. The central collector is a ' +
      'balding man with a bronze pin on his lapel. He’s flanked by two ' +
      'wiry associates wearing well-fitting suits. “Taxes,” he states ' +
      'matter-of-factly, a leather ledger in hand.\n\n' +
      'The grocer expresses his frustration: “I just paid you jokers! I ' +
      'can’t make a profit with all the nonsense ‘taxes’ your guild ' +
      'applies.”\n\n' +
      'The tax collector speaks some pre-rehearsed words: “Taxes today ' +
      'pay for improvements tomorrow. Pay, or hawk your wares outside ' +
      'the protection of the Sinking Market. There’s plenty of real ' +
      'estate outside the city.”\n\n' +
      '“Protection? It’s the Sinking Market! The whole thing is sinking ' +
      'into the bay! I’ve moved my stand twice this year!” The grocer ' +
      'grabs a meat mallet and brandishes it at them. Taken aback, the ' +
      'tax collectors approach you with a proposition: “Mercenaries, ' +
      'right? Help us collect what’s due the merchant guild, and we’ll ' +
      'compensate you.”',
    options: [
      {
        id: 'A',
        prompt: 'Help the tax collectors recover the taxes they’re owed.',
        outcome: {
          text:
            'The Merchant’s Guild provides valuable services to these ' +
            'people, and everyone needs to pay their fair share. You ' +
            'step forward with the stern look your enemies learned too ' +
            'well, and after a moment of consternation, the grocer turns ' +
            'over a handful of coins to the tax collectors.\n\n' +
            'The collectors give you a nod, handing over a few coins for ' +
            'your assistance. “It is unfortunate some merchants only ' +
            'respond to threats of violence. Truly a base outlook, but ' +
            'thank you for your efforts.”',
          effects: [
            { kind: 'collective-gold', amount: 5 },
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: 1,
            },
          ],
          returnToDeck: true,
        },
      },
      {
        id: 'B',
        prompt: 'Help the grocer drive off the tax collectors.',
        requirement: {
          kind: 'traits',
          traits: ['intimidating'],
          mode: 'all',
        },
        outcome: {
          text:
            'You step up to show this group of shakedown artists just ' +
            'how little their “protection” really means. You grab the ' +
            'central collector by his collar and stare straight into his ' +
            'eyes. He stammers an apology and assures you the error must ' +
            'be in his ledger. “I’ll fix it—I’ll fix it immediately.” ' +
            'The stand operator looks delighted.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: -1,
            },
            { kind: 'next-scenario-condition', condition: 'ward' },
          ],
          returnToDeck: true,
        },
        otherwise: {
          text:
            'You intercede on behalf of the grocer, and after some brief ' +
            'protests, the three tax collectors brush you off and head ' +
            'off to harass someone else. The grocer breathes a sigh of ' +
            'relief, thanking you for your help before turning back to ' +
            'selling his wares.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'merchants-guild',
              amount: -1,
            },
          ],
          returnToDeck: true,
        },
      },
    ],
  },
  {
    id: 'C-20',
    front:
      'After a long night helping load a merchant’s caravan, you head ' +
      'through the Sinking Market to pick up payment for your efforts. ' +
      'Your employer made clear they were heading out to Jhinda at noon, ' +
      'so if you want the gold before they leave town, you’ll need to ' +
      'hurry. You’re hustling as best you can when a frail, white-haired ' +
      'woman approaches you and grabs you by the arm. She reeks of grime ' +
      'and sewage, and passersby are turning their noses up in ' +
      'disgust.\n\n' +
      '“Rats! So many rats! I don’t know where they’re coming from, but ' +
      'they’re living in my cellar! They ate through three jars of my ' +
      'preserves just yesterday!” She tugs weakly at your sleeve, which ' +
      'leaves a noticeable dirty mark. “I’ve asked dozens of ' +
      'mercenaries, but they’ve turned me away because I can’t pay ' +
      'enough! Please, can you help me?”\n\n' +
      'If you don’t find the merchant in the next few minutes you won’t ' +
      'get paid for last night’s work.',
    options: [
      {
        id: 'A',
        prompt:
          'Tell the woman you can’t help her and find the merchant who ' +
          'owes you money.',
        outcome: {
          text:
            'You shake the woman off and explain as best you can that ' +
            'you can’t assist her right now. You make some vague ' +
            'promises about trying to find her later, but it’s no use: ' +
            'soon the woman is bawling in the street, lamenting that no ' +
            'one will help her and how the rats will kill her in her ' +
            'sleep, then feast on her corpse. The whole speech is very ' +
            'graphic, and passersby begin to give you odd looks, ' +
            'wondering what you could have done to upset the poor woman ' +
            'so intensely.\n\n' +
            'At least you catch the merchant in time to collect your ' +
            'payment.',
          effects: [
            {
              kind: 'faction-reputation-change',
              faction: 'choice',
              amount: -1,
            },
            { kind: 'collective-gold', amount: 20 },
          ],
        },
      },
      {
        id: 'B',
        prompt:
          'Help the woman and forgo collecting payment for the ' +
          'merchant’s work.',
        outcome: {
          text:
            'You take pity on the poor woman and follow her back to her ' +
            'home, a ramshackle dwelling half-sunk into the muddy ' +
            'foundation. Sure enough, a family of three Vermlings has ' +
            'illegally moved into her cellar, living off her meager food ' +
            'supplies. You make a big show of reporting them to the ' +
            'guards and they begrudgingly pack their things to go. The ' +
            'old woman thanks you profusely and pays what she can.',
          effects: [{ kind: 'character-gold', amount: 3 }],
        },
      },
    ],
  },
];
