# Active Bonuses

> Transcribed from the Gloomhaven 2E rulebook.

An **active bonus ability** is any ability that provides an active bonus to a
figure or their allies. When a character performs an active bonus ability,
the card is placed in their **active area** to track the bonus. Cards in a
character's active area are not considered to be in their hand.

Active bonus abilities have icons to indicate the duration of the bonuses
they provide. When a bonus expires, even if the action has other active
bonus abilities, the card is removed from the character's active area and
placed in their **discard pile or lost pile, depending on whether the action
has a lost icon** (see p. 34).

## Round Bonuses

These bonuses activate when the ability is performed and expire at the end
of the round.

> **Example.** The Bruiser performs the top action of *Eye for an Eye*,
> gaining Shield 1 and Retaliate 1 for all attacks targeting them until the
> end of the round.

## Persistent Bonuses

These bonuses activate when the ability is performed and expire when the
specified removal condition has been fulfilled.

If the bonus has limited uses, these are tracked by a series of **use slots**.
When the card is placed in the active area, a character token is added to
the first slot. Each time the bonus is triggered, the token advances by one
slot, even if no benefit is gained. When the token passes an experience
icon, the character gains that much experience. When the token leaves the
last slot, the bonus expires.

If no removal condition is specified, the bonus expires at the end of the
scenario.

## Voluntary Removal

A character may voluntarily remove a card with a **persistent bonus** (but
**not a round bonus**) from their active area before the bonus expires, but
doing so removes the bonus. This can be done at any time except during
another ability.

## Other abilities on an active-bonus action

Actions with active bonus abilities might also have other abilities, but
these other abilities are **only performed when the card is played** (one-
shot, not part of the persistent state).

## Implications for the schema

- **Our `Disposition` model is slightly imprecise.** It conflates
  "active-area duration" with "destination pile after expiry":
  ```ts
  type Disposition = 'discard' | 'lost' | 'persistent-round' | 'persistent-tracked';
  ```
  In our model:
  - `'persistent-round'` implicitly assumes the card goes to **discard**
    when the round ends.
  - `'persistent-tracked'` implicitly assumes the card goes to **lost**
    after use slots expire.

  But per the rule, both round and persistent bonuses can resolve to either
  discard or lost, governed by a separate lost icon on the card. The cards
  we've encoded so far happen to fit the implicit assumptions:
  - Eye for an Eye top: round bonus, no lost icon → discard ✓
  - Shield Bash bottom (planned): round bonus, no lost icon → discard ✓
  - The Mind's Weakness (rulebook example): persistent, lost icon → lost ✓

  When we encounter a round bonus that *does* have a lost icon, or a
  persistent that goes to discard, we'll refactor `Disposition` into a
  two-field shape:
  ```ts
  type Disposition =
    | { kind: 'immediate'; pile: 'discard' | 'lost' }
    | { kind: 'round-bonus'; finalPile: 'discard' | 'lost' }
    | { kind: 'persistent-bonus'; trackedUses?: number; finalPile: 'discard' | 'lost' };
  ```
  Until then, the current shorthand works for every encoded card.

- **Active-area state is engine state, not card data.** When a player
  performs an active-bonus ability, the engine moves the card into the
  player's active area, sets a duration tracker (round counter or
  use-slot counter), and applies the bonus during relevant triggers.

- **"One-shot abilities on an active-bonus action" → schema may need a
  per-ability flag.** Today we treat every `Ability` in a persistent half
  as part of the active bonus. The rule says some abilities on the same
  half can be one-shot. We haven't encoded a card with that pattern yet,
  but when we do, expect to add `Ability.oneShot?: boolean` (or
  `Ability.kind: 'active' | 'one-shot'`).

- **Use-slot semantics:**
  - Token advances on **trigger**, not on **benefit gained**. (Important —
    triggering when no benefit applies still spends a slot.)
  - EXP gain when the token passes an EXP icon is a step on the
    use-slot track, not an `AbilityStep` per se. Schema-wise we'll likely
    model this as a parallel `useSlotExp?: readonly (number | null)[]` on
    the persistent-tracked half (per slot, EXP awarded after that slot).
    Defer until needed.

- **Round bonuses cannot be voluntarily removed; persistent bonuses can.**
  Engine rule.
