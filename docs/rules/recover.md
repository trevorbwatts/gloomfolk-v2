# Recover

> Transcribed from the Gloomhaven 2E rulebook.

**Recover** is a positive targeted ability that allows a character to recover
discarded or lost ability cards (see p. 34). The targeted character looks
through their discard pile or lost pile, selects cards up to the number
specified by the ability, and returns those cards to their hand.

In some cases, the recover ability might allow a character to recover spent
or lost items instead (see p. 34). The targeted character rotates or flips
those cards, depending on their usage, so that they can be used again.

## Implications for the schema

- **`recover` is a new `AbilityStep` variant** when a Bruiser card uses it.
  Likely shape:
  ```ts
  | {
      type: 'recover';
      from: 'discard' | 'lost';
      count: number;
      subject?: 'cards' | 'items';   // default 'cards'
      target?: HealTarget;            // self by default; widens later
      mandatory?: boolean;
    }
  ```
- **Positive targeted ability** — same polarity rules apply (allies/self
  only). Engine concern.
- **Card-state consequences** are engine state: discard/lost pile membership
  per character, item spent/lost flips. Not card data.
