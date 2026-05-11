# Road Events

> Transcribed from the Gloomhaven 2E rulebook.

A road event is a small thematic interaction that takes place in the world
around Gloomhaven. The party resolves a road event **at the start of each
scenario**, with the following exceptions:

- At the start of scenario 0 and scenario 1.
- When replaying a lost scenario without first returning to Gloomhaven.
- When moving directly to a new scenario that is linked to the previous
  scenario (see p. 46).
- When playing a scenario that takes place within Gloomhaven itself.
- When playing any scenario in casual mode (see p. 57).

## Resolving an event card

The party performs the following steps:

1. **Read the thematic text on the front of the card.**
2. **Collectively choose one of the options.**
3. **Read the thematic text on the back of the card** for the outcome that
   corresponds to the chosen option, then resolve the effect written in
   that section. Only characters who are **participating in the scenario**
   are affected by the outcome. Do not read text for other outcomes.
4. **Remove the card from the game without destroying it.** If the
   **return icon** is depicted in the outcome, return the card to the
   bottom of the road event deck instead.

## Requirements on options and outcomes

Some options and outcomes have requirements. The most common requirement
checks whether any of the characters has a specific **trait** (typically
found on the front of character mats). Other requirements might refer to
gold, other campaign stats, or whether specific **achievement stickers**
are present on the campaign sheet (see p. 50).

- When the word **"collective"** is used, the requirement refers to the
  entire party.
- If the requirement is not met, instead read the outcome labeled
  **"otherwise"**.

## Reference numbers

Each event has a reference number. Throughout the campaign, you will be
instructed to add or remove events from the various event decks. Events
are always referenced by this number so they can be easily found. When an
event is added to or removed from the event deck, **shuffle the deck
afterward**.

## Implications for the schema (notes for later)

Defer until campaign/scenario flow is built. Rough shape when we get there:

```ts
type RoadEventRequirement =
  | { kind: 'trait'; trait: string; scope: 'any' | 'collective' }
  | { kind: 'gold'; min: number; scope: 'any' | 'collective' }
  | { kind: 'achievement'; id: string }
  | { kind: 'campaign-stat'; ... };

interface RoadEventOption {
  id: 'A' | 'B' | ...;
  promptText: string;
  requirement?: RoadEventRequirement;
  outcome: RoadEventOutcome;
  otherwise?: RoadEventOutcome;   // used when requirement fails
}

interface RoadEventOutcome {
  text: string;
  effects: EventEffect[];   // gold, items, prosperity, deck add/remove, etc.
  returnToDeck?: boolean;   // the return icon
}

interface RoadEvent {
  id: number;               // reference number
  frontText: string;
  options: RoadEventOption[];
}
```

Engine concerns:
- Trigger road event at scenario start unless one of the listed exceptions
  applies (track casual mode, linked-scenario flag, in-city scenario flag,
  replay-without-return state).
- "Participating characters" scoping — outcome effects only apply to the
  scenario party, not the whole roster.
- Deck management: shuffle after add/remove; bottom-return for the
  return-icon outcome; otherwise remove from game (but don't destroy —
  the physical card matters across campaigns, but in our digital model
  it just means "set aside, may return later via a campaign instruction").
