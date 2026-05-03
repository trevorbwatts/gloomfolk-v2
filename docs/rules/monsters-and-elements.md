# Monsters and Elements

> Transcribed from the Gloomhaven 2E rulebook. Pairs with the general
> [elements](elements.md) rules.

Monsters can **infuse** and **consume** elements. When a monster ability
card depicts an infusion or consumption, it triggers if **at least one
monster of the set performs an ability**. An **infusion** occurs when the
**last monster of the set ends their turn**, while a **consumption**
occurs when the **first monster of the set starts their turn** and
**benefits every monster of the set**.

If any monsters of the same set act later in the initiative order, because
they were **revealed or spawned**, they **do not gain the benefit of a
previous consumption**, but they **can consume an element that was infused
in the intervening time**.

If a monster infuses or consumes a **wild or mixed element**, the **party
decides** which element is infused or consumed.

## Implications for the schema

### Trigger condition

Both infuse and consume require **at least one monster of the set to
perform an ability** during the set's turn block. If every figure in the
set is stunned / has no valid action / etc., neither effect fires.

- "Performs an ability" should be interpreted broadly — any non-skipped
  ability step on a single member counts. The engine should track an
  `anyMemberActed` flag per set per round.

### Timing

Two distinct firing points within a set's turn block:

```
set turn block:
  ├── (consumption fires here, before the first member's turn,
  │    if at least one member will act)
  ├── member 1 turn
  ├── member 2 turn
  ├── ...
  └── (infusion fires here, after the last member's turn)
```

- **Consumption is per-set, not per-figure.** It resolves once at the
  start of the set's block and applies to every member acting in that
  block.
- **Infusion is per-set as well.** Single deferred resolution at the end
  of the block — the element enters the "strong" column on the elemental
  infusion table at that moment.

### Late arrivals (revealed / spawned mid-round)

If a member of the set spawns or is revealed *after* the set's turn block
has resolved (e.g. summoned by another set, revealed by a door opening
later in the round):

- **They do not retroactively benefit from the consumption.** The
  consumption window has already closed for this round.
- **They may still consume an element that was infused later in the
  round.** If their ability card has a consume step, they evaluate it
  against the *current* element state at the moment they act.
- Implication: **per-set consume-benefit must be tracked per-figure**,
  not just as a set-level flag. A figure's "did this consume apply to
  me?" answer depends on whether they were on the map when the
  consumption fired.

### Wild / mixed elements

When the depicted element is wild or mixed, the resolution prompts the
party for a choice:

- **For consume:** which strong/waning element to consume (must be
  available on the elemental infusion table).
- **For infuse:** which element to push to strong.

This is another `MonsterDecision` prompt — same machinery as the
focus/movement ambiguity prompts.

### Engine implications

- **Set-turn-block bracketing.** The turn resolver needs explicit
  start-of-block and end-of-block hooks for monster sets, not just
  per-figure turn hooks. Consumption fires in the start hook, infusion
  in the end hook.

- **`anyMemberActed` gate** must wrap both hooks. Easiest implementation:
  defer the consumption check until the first member is *about to* act
  (we know at that point that the block has at least one acting member),
  and defer infusion until the end-of-block hook (which only runs if at
  least one member acted — set the flag on first action).

- **Consume-benefit tracking on the figure:**

  ```ts
  type MonsterFigure = {
    // ...
    consumedThisTurn: ConsumedElement[];  // for the block this figure is in
  };
  ```

  Spawned-late figures get `consumedThisTurn: []` and can't have it
  retroactively populated.

- **Mid-round element state changes are visible to later actors.** The
  elemental infusion table is shared mutable state across the round —
  consumes and infuses by characters and other monster sets between this
  set's first-member action and a late-arriving member's action all
  alter what's available. Don't snapshot.

- **Suggested step types** to add to the `AbilityStep` union from
  [other-monster-abilities.md](other-monster-abilities.md):

  ```ts
  | { kind: 'infuse'; element: Element | 'wild' | 'mixed' }
  | { kind: 'consume'; element: Element | 'wild' | 'mixed';
      effect: ConsumeEffect }
  ```

  Note these *aren't* per-figure ability steps in the same sense as
  attack/move — they fire at the set-block boundaries. The card
  representation can still list them as steps; the resolver routes them
  to the block hooks instead of executing them inline.
