# Resting

> Transcribed from the Gloomhaven 2E rulebook.

Resting is the main way that a character can retrieve cards from their
discard pile. They have two options when they rest: a **short rest** or a
**long rest**. In both cases, the rest can only be performed if the
character has at least two cards in their discard pile. Resting always
results in losing one card from their discard pile.

## Short Rest

During the **End of Round** step (see p. 44), a character may perform a
short rest. When a character short rests, they:

- Lose one **random** card from their discard pile.
- Return the remaining cards to their hand.
- *Optional:* if they would like to keep the card that was lost, they can
  suffer **1 damage** to lose a different random card instead. This can
  only be done **once per short rest**.

## Long Rest

During the **Card Selection** step (see p. 16), a character may declare a
long rest. This **constitutes their entire turn for the round**, instead of
playing two cards, and it is performed on **initiative 99**. The character
follows these steps:

1. **Lose one card of their choice** from their discard pile and return the
   remaining cards to their hand. *(Mandatory.)*
2. Perform **"Heal 2, self"**. *(Optional.)*
3. **Recover all of their spent items.** *(Optional.)* Items can be used
   during the same turn in which they are recovered.

## Active-area cards and resting

Cards **without lost icons** in your active area count as being in your
discard pile **for the purposes of**:

- Whether you can long rest (need ≥ 2 cards effectively in discard).
- What is eligible to lose during a long rest.

But these cards **do not have to be returned to your hand** when resting.

## Implications for the schema

- **No schema changes.** Resting is entirely engine state and workflow:
  - Discard / lost / hand / active-area piles per character.
  - Short rest random selection (with optional 1-damage reroll once).
  - Long rest as a special turn at initiative 99 (Heal 2 self optional,
    recover spent items optional).

- **Active-area-card-counts-as-discard rule** means the engine's "effective
  discard" for resting purposes = `discard ∪ {c ∈ active : c has no lost
  icon}`. The "no lost icon" check translates to "the card's *active half*
  has `disposition !== 'lost'`" — though our `Disposition` model
  ([active-bonuses.md](active-bonuses.md)) only implicitly captures the
  lost-icon-on-an-active card. When the disposition refactor lands (split
  active-area duration from final pile), this check becomes a clean
  `finalPile === 'discard'`.

- **Long rest's "Heal 2, self" step is the same heal vocabulary** the
  engine uses elsewhere — reuse the same path, just sourced from the rest
  workflow rather than a card.
