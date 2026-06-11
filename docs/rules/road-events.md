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

## Starting deck size

Per the official Gloomhaven 2E FAQ (not in the rulebook pages transcribed
above): the initial road and city event decks are each formed by shuffling
**events 1–20**. Higher-numbered events enter the decks later via campaign
instructions.

## Reference numbers

Each event has a reference number. Throughout the campaign, you will be
instructed to add or remove events from the various event decks. Events
are always referenced by this number so they can be easily found. When an
event is added to or removed from the event deck, **shuffle the deck
afterward**.

## Implications for the schema (notes for later)

> **Mostly built:** the deck mechanics live in
> `packages/shared/src/campaign/events.ts` — ordered deck persisted on the
> campaign save, shuffled at campaign start, draw-from-top,
> return-icon-to-bottom, shuffle-on-add/remove. Card *content* lives in
> `packages/shared/src/campaign/road-event-cards.ts` (types + transcribed
> cards); `STARTING_ROAD_EVENT_IDS` is derived from that list, so a card
> joins the starting deck as soon as it's transcribed. The effect/
> requirement types there only cover mechanics seen on transcribed cards so
> far and grow card by card. The in-game resolution flow (presenting the
> card, checking requirements, applying effects) is still deferred.

Rules detail confirmed during transcription: a multi-trait requirement like
"ARCANE AND INTIMIDATING" is satisfied **across the party** — each listed
trait must be on at least one participating character, but they can be
different characters.

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
