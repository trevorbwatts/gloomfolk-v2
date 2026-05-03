# Revealing, Spawning, and Named Monsters

> Transcribed from the Gloomhaven 2E rulebook.

## Revealing and Spawning Monsters

Other than when summoned, monsters can be added to the map in two
different ways:

- **A — Revealing Monsters.** When the section book indicates that
  monsters are revealed in a new room, add them to the map immediately,
  along with any indicated overlay tiles or tokens, as you would when
  setting up a scenario.
- **B — Spawning Monsters.** If the scenario rules indicate that monsters
  spawn in specific locations at specific times, add them to the map
  when specified. **If a specified location is not empty, place the
  monster in the closest empty hex instead.**

Unlike monsters that have been summoned, monsters that have been **revealed
or spawned act during the same round in which they were added to the
map**. If a newly added monster set does not have an ability card drawn
for the current round, **draw one now**.

Check the initiative value for the sets of all added monsters:

- If their initiative value comes **after** the acting figure's
  initiative value, their initiative order token should be in its normal
  position; they will act in normal initiative order.
- If their initiative value comes **before** the acting figure's
  initiative value, **move or insert their initiative order token after
  the acting figure's token**; they will act next.
- When multiple new monster sets would act next, **order their tokens
  based on initiative values**.

When monsters are added to the map, **if there are not enough standees of
the right type**, place as many monsters as possible, **starting with
elite monsters, in order of proximity to an enemy**. Once the standees run
out, do not place the remaining monsters. **If there are not enough bases
of the right color, place the remaining monsters without bases.**

> *Example: The Cragheart uses a Move 4 ability at initiative 25 and
> opens a door after using 2 movement points. The adjacent room is
> revealed.*
>
> *First, three Bandit Archers must be added, but only two standees are
> left, so only two are placed. The Bandit Archers in the previous room
> already acted on initiative 16, but these new Bandit Archers will also
> act this round, so their initiative order token is moved to directly
> after the Cragheart's token.*
>
> *Next, one Forest Imp is added. Because no Forest Imps were in play
> yet, an ability card must be drawn for the monster set. The card shows
> initiative 5, so their initiative order token is inserted after the
> Cragheart's token but before the Bandit Archer token.*
>
> *Finally, the Cragheart resumes their turn, using their remaining 2
> movement points and any other abilities.*

## Named Monsters

Named monsters are a special class of monster. For some scenarios, the
goal is to kill a unique variant of a monster type, which is given a name
in the scenario rules. Place named monster standees in **red bases** to
identify them. Named monsters are **not considered normal or elite**, so
they are not affected by abilities that target those ranks. Named monsters
**act before elites of the same type**.

## Implications for the schema

### Add-to-map sources, summarized

```ts
type FigureAdditionSource =
  | 'scenario-setup'
  | 'reveal'        // section book triggered, e.g. door opened
  | 'spawn'         // scenario-rule triggered (round/turn/event)
  | 'summon'        // monster ability
  ;
```

The summon path differs from reveal/spawn in two ways: summons skip the
round they're added in, and summons require a summoner-adjacent hex.
Reveal and spawn both **act this round**.

### Spawn placement fallback

For spawned monsters whose specified hex is occupied:

```ts
function placeSpawn(target: Hex, board: BoardState): Hex {
  if (board.isEmpty(target)) return target;
  return board.closestEmptyHexTo(target);  // BFS by hex distance
}
```

- **"Closest" tiebreaks aren't specified** — flag as a `MonsterDecision`
  prompt. Likely uncommon at the table; engine should still handle.

### Revealed-room setup

When a reveal triggers mid-turn:

1. **Pause the acting figure's turn.** Their action is interrupted at
   the moment of reveal (typically immediately after the move step that
   opened the door).
2. **Add overlay tiles, tokens, and figures** for the revealed room per
   the section book.
3. **Run the standee-shortage allocation** (see below).
4. **For each newly-on-map set with no ability card this round, draw
   one.** This includes sets that are *being introduced* by the reveal.
5. **Splice initiative tokens** into the round's order using the
   "before/after acting figure" rule.
6. **Resume the acting figure's turn** with their remaining
   movement/abilities.

### Standee-shortage allocation

When demand exceeds standee supply for a type:

```
priority order:
  1. elite monsters first
  2. ties broken by proximity to nearest enemy (ascending)
```

- **Apply only to the figures being added in this batch** — don't
  reshuffle existing on-map members.
- **Proximity is hex-distance to nearest enemy** (same metric as
  positive-condition closeness), measured at placement time.
- **No bases of the right color ⇒ place without a base.** This is a
  physical-edition concern; in software, the "color" maps to the rank
  field on the figure and "no base" doesn't apply. Engine should not
  fail placement on this condition.

### Initiative splice

The round's initiative order is mutable mid-round. When a new set joins:

```ts
function spliceNewSet(
  order: InitiativeEntry[],
  newSet: InitiativeEntry,
  actingFigure: InitiativeEntry,
): InitiativeEntry[];
```

- If `newSet.initiative > actingFigure.initiative`: insert in normal
  sorted position among entries that haven't acted yet.
- If `newSet.initiative <= actingFigure.initiative`: insert
  *immediately after* `actingFigure`. Multiple such inserts sort among
  themselves by initiative.
- **The acting figure's turn is not done yet** when the splice happens
  — they finish, then the next entry (which may now be the just-spliced
  set) acts.

### Ability-card draw on first appearance

A set's first time on the map this round triggers a draw. Subsequent
introductions of the same set in the same round (e.g. a reveal followed
by a spawn) **don't re-draw** — they use the already-drawn card.

This is the same rule that applied for cross-set summons in
[other-monster-abilities.md](other-monster-abilities.md): once a set has
an initiative this round, additional members joining inherit it.

### Named monsters

A third rank tier:

```ts
type Rank = 'normal' | 'elite' | 'named';
```

- **Acting order within a set:** named → elite → normal, ascending
  standee number within each rank. Update the acting-order key from
  [monster-turns.md](monster-turns.md).
- **Stat block:** the rule doesn't specify whether named monsters use
  the elite stat block, the normal stat block, or a scenario-specific
  override. Almost certainly scenario-overridden — flag for
  confirmation against later rules / a concrete named-monster scenario.
- **Targeting filters:** abilities that target "normal" or "elite"
  ranks **do not affect named monsters**. Engine must treat named as
  its own rank for predicate checks (`target.rank === 'elite'` should
  return false for named monsters, not coerce).
- **Standee identification:** red base. In software, this is purely a
  rendering concern (`figure.rank === 'named'` ⇒ red ring).
- **Scenario goals:** "kill the named X" is a victory condition.
  Belongs in scenario data, not in monster data — the named monster is
  flagged via the figure's rank, the win condition references the
  figure id.

### Engine implications

- **Turn interruption is a first-class concept.** Reveals can fire
  mid-turn (after movement steps that open doors); the resolver must
  support pause-resume of an in-flight character or monster turn. Don't
  model character turns as atomic — model them as a stream of step
  resolutions with reveal/spawn checkpoints between steps.

- **Initiative order is a mutable list, not a precomputed sort.** The
  splice operation needs to be efficient and well-tested. Easiest
  representation: a linked list keyed on entry id, with an `actedThisRound`
  flag per entry to make "entries that haven't acted yet" trivial to
  filter.

- **Standee pool is per-type, scenario-scoped state.** Track
  `standeesAvailable[type]` and decrement on placement. A figure
  that dies returns its standee to the pool (relevant for scenarios
  with continuous spawns).

- **`placedWithoutBase` is not a state we need to model**, but
  `figure.rank` is — the rank determines the stat block. Always set rank
  even when the physical edition would have run out of bases.
