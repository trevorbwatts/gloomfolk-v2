/**
 * Event card content model, shared by the road and city decks
 * (docs/rules/road-events.md, docs/rules/city-phase.md — city events are
 * resolved exactly like road events). The types cover only the mechanics
 * seen on cards transcribed so far and grow as new ones appear.
 *
 * Deck mechanics (draw, return-to-bottom, add/remove) live in events.ts;
 * card data lives in road-event-cards.ts / city-event-cards.ts.
 */

import type { FactionId } from './sheet.js';

/** Character-mat traits referenced by event requirements. Grows as cards
 *  referencing new traits are entered. */
export type CharacterTrait =
  | 'arcane'
  | 'armored'
  | 'chaotic'
  | 'educated'
  | 'hero'
  | 'indebted'
  | 'intimidating'
  | 'nimble'
  | 'outcast'
  | 'persuasive'
  | 'resourceful'
  | 'strong';

/** Character ancestries referenced by event requirements ("SELECTED
 *  CHARACTER IS QUATRYL, VERMLING, AESTHER, OR HARROWER"). Grows as cards
 *  referencing new ancestries are entered. */
export type CharacterAncestry =
  | 'aesther'
  | 'harrower'
  | 'human'
  | 'inox'
  | 'orchid'
  | 'quatryl'
  | 'savvas'
  | 'valrath'
  | 'vermling';

/** Conditions handed out by event outcomes (docs/rules/conditions.md). */
export type EventCondition =
  | 'safeguard'
  | 'ward'
  | 'invisible'
  | 'strengthen'
  | 'bless'
  | 'wound'
  | 'curse'
  | 'poison'
  | 'immobilize'
  | 'disarm'
  | 'muddle';

export type EventRequirement =
  | {
      kind: 'traits';
      /** A trait counts as present when at least one participating character
       *  has it — different characters may cover different traits. In
       *  single-character contexts (e.g. a storybook check on the selected
       *  character, "SELECTED CHARACTER IS CHAOTIC"), only that character's
       *  traits count. */
      traits: readonly CharacterTrait[];
      /** 'all': every listed trait must be present ("ARCANE AND INTIMIDATING").
       *  'any': one listed trait suffices ("ARMORED, NIMBLE, or STRONG"). */
      mode: 'all' | 'any';
    }
  | {
      /** Reputation check against the campaign sheet's per-faction tracks
       *  (sheet.ts): a specific faction's reputation, or any faction's
       *  ("ANY FACTION REPUTATION > 5"), strictly greater than the
       *  threshold. */
      kind: 'faction-reputation';
      faction: FactionId | 'any';
      greaterThan: number;
    }
  | {
      /** "LOSE N COLLECTIVE GOLD": the party pays to meet the requirement.
       *  Met only if they can afford it — the payment itself is the cost
       *  of taking this outcome. */
      kind: 'pay-collective-gold';
      amount: number;
    }
  | {
      /** "LOSE 1 COLLECTIVE <item>" / "LOSE †005, †009, … or †149": the
       *  party gives up one copy of ANY ONE of the listed items to meet
       *  the requirement. `itemId`/`name` may be absent when the card
       *  only prints the item number. */
      kind: 'pay-item';
      items: readonly {
        printedNumber: number;
        itemId?: string;
        name?: string;
      }[];
    }
  | {
      /** A participating character has the named Personal Quest. */
      kind: 'personal-quest';
      name: string;
    }
  | {
      /** A participating character owns the item ("If a character owns
       *  'Steel Ring' †102..."). */
      kind: 'owns-item';
      printedNumber: number;
      itemId?: string;
      name?: string;
    }
  | {
      /** A character's ancestry is one of those listed. Like trait
       *  checks, met when any participating character qualifies
       *  ("ORCHID: ..."); in single-character contexts ("SELECTED
       *  CHARACTER IS QUATRYL, VERMLING, AESTHER, OR HARROWER") only the
       *  character the resolution is about counts. */
      kind: 'ancestry';
      ancestries: readonly CharacterAncestry[];
    }
  | {
      /** A summed check over the characters at a task (75.4's fire):
       *  one point per listed trait/ancestry instance they have, minus
       *  one per `subtract` instance ("Add up the PERSUASIVE,
       *  INTIMIDATING, AND RESOURCEFUL you have. Subtract one for each
       *  CHAOTIC you have."). Met when the sum exceeds the party's
       *  character count minus one ("SUM > C-1"). NPC helpers' printed
       *  traits count too. */
      kind: 'trait-sum';
      /** Task heading as printed ("Herding the crowd"). */
      task?: string;
      add: readonly (CharacterTrait | CharacterAncestry)[];
      subtract?: readonly (CharacterTrait | CharacterAncestry)[];
    };

export type EventEffect =
  | { kind: 'collective-gold'; amount: number }
  | {
      /** Each participating character gains this much XP. */
      kind: 'xp';
      amount: number;
    }
  | {
      /** Each participating character starts the next scenario with the
       *  condition already applied. Listed twice when the outcome grants
       *  the condition twice (bless and curse stack). */
      kind: 'next-scenario-condition';
      condition: EventCondition;
    }
  | {
      /** Each participating character starts the next scenario having
       *  already suffered this much damage. */
      kind: 'next-scenario-damage';
      amount: number;
    }
  | {
      /** Each participating character starts the next scenario discarding
       *  this many cards. */
      kind: 'next-scenario-discard';
      count: number;
    }
  | {
      /** Check this many boxes on the card's printed track
       *  (EventCard.track; checked count persists in
       *  EventDeckState.checks). */
      kind: 'check-boxes';
      count: number;
    }
  | {
      /** The party may collectively remove any number of bless cards from
       *  their attack modifier decks, checking one box per card removed. */
      kind: 'check-boxes-per-bless-removed';
    }
  | {
      /** One character may gain one additional next-scenario curse to
       *  check one additional box. */
      kind: 'check-box-for-extra-curse';
    }
  | {
      /** Roadside shop. The party may pay `price` collective gold to
       *  purchase any ONE not-yet-purchased ware: its box is checked
       *  (persisted in EventDeckState.purchases) and its section read.
       *  Purchasing is optional. Once every ware is purchased, remove this
       *  event from the road deck. */
      kind: 'shop';
      price: number;
      /** Price reductions that apply when their requirement is met; every
       *  applicable reduction stacks. */
      discounts: readonly {
        requirement: EventRequirement;
        amount: number;
        /** Thematic line read when the discount applies. */
        text?: string;
      }[];
      wares: readonly { id: string; text: string; readSection: string }[];
    }
  | {
      /** Resolve another option's outcome on this card instead ("Read
       *  Outcome A..."). The card is then routed by THAT outcome's return
       *  icon, not this one's. */
      kind: 'resolve-option';
      option: 'A' | 'B' | 'C';
      /** Extra shop price reduction, stacking with the shop's own
       *  discounts ("...and reduce the price by 2 gold"). */
      priceReduction?: number;
    }
  | {
      /** Draw and resolve another road event immediately. */
      kind: 'draw-another-road-event';
    }
  | {
      /** "New Scenario": unlock the named scenario on the campaign map. */
      kind: 'new-scenario';
      name: string;
      number: number;
    }
  | {
      /** Gold gained per character rather than into the party pool
       *  ('collective-gold'): each affected character gains this much —
       *  the one character in single-character contexts (a modifier-draw
       *  game, an owns-item bonus), every participant for "Each character
       *  gains 10 gold". */
      kind: 'character-gold';
      amount: number;
    }
  | {
      /** Each affected character individually chooses ONE of the listed
       *  conditions to start the next scenario with. */
      kind: 'next-scenario-condition-choice';
      conditions: readonly EventCondition[];
    }
  | {
      /** The character gains battle-goal checkmarks (perk progress). */
      kind: 'checkmarks';
      count: number;
    }
  | {
      /** Flip the card and resolve its back (EventCard.flipped). */
      kind: 'flip-card';
    }
  | {
      /** The party gains a specific item — same shape as the storybook
       *  reward: `itemId` is the catalog slug (possibly not transcribed
       *  yet), `printedNumber` the number on the physical card. */
      kind: 'gain-item';
      itemId: string;
      name: string;
      printedNumber: number;
    }
  | {
      /** Gloomhaven gains prosperity (boxes on the campaign sheet's
       *  prosperity track). */
      kind: 'prosperity';
      amount: number;
    }
  | {
      /** The party picks ONE of the listed choices and reads its
       *  storybook section (e.g. R-10's crystals). Whether declining is
       *  allowed follows the printed wording ("You MAY touch any one
       *  crystal" vs "What do you touch next?"). */
      kind: 'choose-section';
      prompt: string;
      choices: readonly { id: string; text: string; readSection: string }[];
    }
  | {
      /** Extra effects that apply only when the requirement is met, on
       *  top of the outcome's other effects ("PERSUASIVE: Gain 10
       *  additional collective gold"). */
      kind: 'bonus';
      requirement: EventRequirement;
      /** Thematic line read when the bonus applies. */
      text?: string;
      effects: readonly EventEffect[];
      /** Branch applied instead when the requirement is NOT met — only
       *  when the card prints an OTHERWISE line for the bonus ("If a
       *  character owns 'Steel Ring', they gain 15 gold. OTHERWISE: Gain
       *  'Steel Ring'."). Absent = unmet means no bonus. */
      otherwise?: {
        /** Thematic line read when the requirement is not met. */
        text?: string;
        effects: readonly EventEffect[];
      };
    }
  | {
      /** The wrapped effects apply only to participating characters who
       *  have ('with') or lack ('without') the trait — "Each character
       *  without ARMORED starts the next scenario with wound". */
      kind: 'for-characters';
      trait: CharacterTrait;
      mode: 'with' | 'without';
      effects: readonly EventEffect[];
    }
  | {
      /** Campaign instruction: add the event to its deck, then shuffle
       *  (addEventToDeck in events.ts) — "Add event R-31 to the road
       *  deck." How later-numbered events enter play. */
      kind: 'add-event-to-deck';
      deck: 'road' | 'city';
      eventId: string;
    }
  | {
      /** Each affected character permanently gains the trait, marked on
       *  their character sheet ("Each character gains EDUCATED"; the one
       *  character inside 'for-selected-character'). */
      kind: 'gain-trait';
      trait: CharacterTrait;
    }
  | {
      /** Gain one random item design (unlocks a random item for
       *  purchase). */
      kind: 'random-item-design';
      /** Designs drawn to pick ONE from, the rest returning to their
       *  deck ("Draw 3 random item designs and choose 1, returning the
       *  other 2 to their deck" = 3). Default 1 — no choice. */
      draw?: number;
      /** Also immediately gain one copy of the item ("Gain 1 random
       *  item design and immediately gain that item"). */
      gainItem?: boolean;
    }
  | {
      /** Gain (positive amount) or lose (negative) reputation with the
       *  faction, clamped to the campaign sheet's track. 'choice' = the
       *  party picks the faction(s) ("Gain 1 reputation with any one
       *  faction of your choice"). */
      kind: 'faction-reputation-change';
      faction: FactionId | 'choice';
      /** How many DISTINCT factions to pick when faction is 'choice',
       *  each changed by `amount` ("Lose 1 reputation with any two
       *  factions of your choice" = 2). Default 1. */
      chooseCount?: number;
      /** Factions the 'choice' is limited to ("Lose 1 [merchants] or
       *  [military] reputation"). Absent = any faction. */
      choiceOf?: readonly FactionId[];
      amount: number;
    }
  | {
      /** "Read 63.2.": the outcome is resolved entirely by a storybook
       *  section — read it and apply its rewards. */
      kind: 'read-section';
      section: string;
    }
  | {
      /** "Select one character to ...": the party picks one character and
       *  the wrapped effects apply to them alone. */
      kind: 'for-selected-character';
      effects: readonly EventEffect[];
    }
  | {
      /** The character's maximum hit point value permanently changes by
       *  this much (negative = decrease), noted on their character
       *  sheet. */
      kind: 'max-hp-change';
      amount: number;
    }
  | {
      /** "Collectively gain any one item from †001 - †014": the party
       *  picks any ONE item in the printed-number range. */
      kind: 'gain-item-from-range';
      fromPrintedNumber: number;
      toPrintedNumber: number;
    }
  | {
      /** Adjusts later trait-sum checks in the same resolution ("Add
       *  one to the other two checks", "Subtract one from the following
       *  rescue check"). */
      kind: 'adjust-checks';
      amount: number;
      /** 'remaining': every later check; 'next': only the next one. */
      target: 'remaining' | 'next';
    }
  | {
      /** "Read the section below corresponding to the ancestry of the
       *  selected character": a lookup table from ancestry to storybook
       *  section, with an 'other' row as the fallback. */
      kind: 'ancestry-section';
      sections: readonly {
        ancestry: CharacterAncestry | 'other';
        readSection: string;
      }[];
    };

/** A resolution procedure driven by attack modifier draws instead of an
 *  A/B choice (e.g. R-07's fishing). Each character plays individually;
 *  a result's effects apply to the character who drew the card. */
export interface ModifierDrawGame {
  /** Procedure text printed on the card. */
  instructions: string;
  /** Result bands by the drawn card's numerical value. */
  results: readonly {
    draw: '-1-or-lower' | '+0' | '+1-or-higher' | '2x' | 'null';
    text: string;
    effects: readonly EventEffect[];
  }[];
  /** The return icon printed beside the game. */
  returnToDeck?: boolean;
}

export interface EventTrack {
  /** Number of checkboxes printed on the card. */
  boxes: number;
  /** Storybook sections to read the moment the Nth box is checked. */
  milestones: readonly { box: number; readSection: string }[];
}

export interface EventOutcome {
  /** Thematic text read aloud for this outcome. */
  text: string;
  effects: readonly EventEffect[];
  /** The return icon: the resolved card goes to the bottom of the deck
   *  instead of out of the game. */
  returnToDeck?: boolean;
}

export interface EventCardOption {
  id: 'A' | 'B' | 'C';
  /** The choice as printed on the front, e.g. "Tell a scary story." */
  prompt: string;
  /** Thematic text printed before the requirement check, read regardless
   *  of which branch applies (e.g. R-13 A's seer speech). */
  preamble?: string;
  /** Front-printed gate ("requires X"): the option cannot be CHOSEN
   *  unless met. No otherwise-branch — contrast with `requirement`,
   *  which branches between outcome and otherwise after choosing. */
  availableIf?: EventRequirement;
  requirement?: EventRequirement;
  /** Outcome when the requirement is met (or there is none). */
  outcome: EventOutcome;
  /** The "OTHERWISE" outcome, read when the requirement is not met. */
  otherwise?: EventOutcome;
}

export interface EventCard {
  /** Reference number printed on the card, e.g. 'R-01'. Campaign
   *  instructions add/remove events by this id. */
  id: string;
  /** Thematic text on the front of the card. */
  front: string;
  /** Empty for cards resolved by a `game` or a `resolution` instead of
   *  an A/B choice. */
  options: readonly EventCardOption[];
  /** Modifier-draw procedure replacing the usual options (e.g. R-07). */
  game?: ModifierDrawGame;
  /** Choice-free resolution replacing the usual options — instructions
   *  followed immediately ("Select a character to step up to the
   *  challenger, then flip this card."). */
  resolution?: EventOutcome;
  /** The card's back, for cards whose back is reached via a 'flip-card'
   *  effect rather than holding per-option outcomes. */
  flipped?: EventOutcome;
  /** Checkbox track printed on the card, for events resolved cumulatively
   *  across multiple draws (the card returns to the deck between draws). */
  track?: EventTrack;
}

