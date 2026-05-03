# Exhaustion

> Transcribed from the Gloomhaven 2E rulebook.

A character can become exhausted in two ways:

- **A — No Hit Points.** If the character ever reaches zero on their red hit
  point dial.
- **B — No Cards.** If the character does not have at least **two cards in
  their hand** (to play) **or** at least **two cards in their discard pile**
  (to rest) at the start of a round. Becoming exhausted this way does not
  affect their current hit point value.

When a character becomes exhausted, **all of their ability cards, including
any summons and other cards in their active area, are placed in their lost
pile**, and their figure is removed from the map. **This can even occur in
the middle of performing an ability.**

Exhausted characters can no longer participate in the scenario in any way,
so exhaustion should be avoided at all costs.

Exhaustion does not reduce the number of characters in the scenario. **If
all characters become exhausted during a scenario, the scenario is lost.**

## Implications for the schema

- **No schema changes.** Exhaustion is engine state:
  - Per-character `exhausted: boolean` flag.
  - On exhaustion: drain `hand`, `discard`, `active` into `lost`; remove
    figure from board.
  - Mid-ability exhaustion: the in-progress ability halts at the current
    step. Engine must support interrupting ability resolution.

- **The "no cards" check fires at start of round** (Card Selection step,
  before initiative is determined). The engine evaluates:
  ```
  hand.length < 2 && effectiveDiscard.length < 2  →  exhausted
  ```
  where `effectiveDiscard` is the long-rest-eligible set noted in
  [resting.md](resting.md) (discard ∪ non-lost active-area cards).

  Wait — actually re-read: "two cards in their hand (to play) **or** two
  cards in their discard pile (to rest)". The condition for exhaustion is
  `hand < 2 AND discard < 2`. If either pile has ≥ 2, the character can
  still take a turn (play or rest).

- **Card-loss-to-negate damage** ([character-damage.md](character-damage.md))
  can push a character into exhaustion via path B if it drains their hand
  + discard below the threshold. Engine must check after every card-loss
  event, not just at start of round.

- **Mid-ability exhaustion via summon's death** is unusual but possible: if
  a summon dies and the death triggers some chain that brings the
  summoner to 0 HP, the summoner exhausts mid-resolution. Engine needs
  reentrancy-safe interruption.

- **Scenario-loss check** (all exhausted → scenario lost) is engine state
  at the scenario level, evaluated whenever a character becomes exhausted.
