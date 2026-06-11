# Appendix B: Monster Turn Guide

> Transcribed from the Gloomhaven 2E rulebook. This is the rulebook's own
> consolidated, step-by-step restatement of the monster-turn rules — the
> chapter versions live in [monster-turns.md](monster-turns.md),
> [monster-focus.md](monster-focus.md), and
> [monster-movement.md](monster-movement.md). Where the chapters describe,
> this appendix **orders**: its numbered/lettered lists are explicit
> priority sequences, which makes it the best reference for the engine's
> tie-breaking.

Diagram legend: movement path, valid movement, invalid movement, attack
hex, enemy focus, attacked enemy, initiative value.

## 1. Initial Check

**① Check for Conditions and Attack Ability**

- Any monster with **disarm** or **without an attack ability** finds a
  focus and moves as if for a single-target melee attack.
- Any monster with **immobilize** ignores all move abilities.
- Any monster with **stun** cannot find a focus, will not move, and
  ignores all abilities.

**② Check for Movement Paths**

Check for movement paths to **attack hexes** (i.e., hexes from which an
attack can be performed). If no path exists, the monster cannot find a
focus and will not move or attack.

## 2. Find Focus

The monster finds an attack hex and focuses on an enemy with the following
**priority list**:

1. A hex with a movement path that triggers **fewer negative hexes**.
2. A hex with a movement path that requires **fewer movement points**.
3. An enemy **closer by range**.
4. An enemy **earlier in the initiative order**, following the normal
   rules for breaking ties for initiative (see p. 17).

> *Diagram captions: (1) The Bandit Scout focuses on the enemy it can
> attack while springing the fewest traps. (2) The Bandit Scout focuses on
> the enemy it can attack while using the fewest movement points. (3) The
> two enemies require equal movement paths, so the Bandit Scout focuses on
> the enemy closer by range. (4) The two enemies are equally close by
> range, so the Bandit Scout focuses on the enemy earlier in the
> initiative order.*

## 3. Perform Monster Abilities

The monster performs all of its abilities **from top to bottom** (move,
attack, and other abilities). For **move** abilities, observe the
following rules:

- **A —** The monster must end its movement with a **shorter path to its
  attack hex** than it had before, or else it will not move.
- **B —** The monster chooses a movement path that triggers the **fewest
  negative hexes**.
- **C —** The monster moves to an attack hex from which it can attack its
  focus. If it can target multiple enemies, it instead moves to a hex from
  which it can attack its focus **and the most other enemies**.
- **D —** The monster moves to a hex from which it can attack the **most
  possible targets** (including its focus) with the **fewest possible
  disadvantaged attacks**.
- **E —** If the monster could move to multiple hexes that maximize the
  previous priorities, it moves to the hex that requires the **fewest
  movement points**.
- **F —** In cases where monster movement is still ambiguous, **the party
  decides**.

> *Diagram captions: (A) The Hound needs 2 movement points to shorten the
> path to its attack hex, but it only has 1, so it does not move. (B) The
> Hound has enough movement points to shorten the path to its attack hex,
> but only if it springs a trap, so it does not move. (C) The Hound can
> attack two enemies, so it moves to the only attack hex from which it can
> attack both of those enemies. (D) The Bandit Archer moves to the closest
> attack hex from which it can attack all three enemies and only have one
> attack with disadvantage. (E) The Bandit Archer has muddle and thus will
> attack with disadvantage regardless, so it does not move away from its
> focus. (F) The Bandit Scout has two equally viable attack hexes, so the
> party decides which of those attack hexes it moves to.*

## Implications for the schema (notes for later)

- This appendix is the canonical ordering for both decision points:
  - **Find focus:** negative hexes → movement points → range → initiative.
  - **Movement:** shorter-path-or-stay → fewest negative hexes → focus +
    most other enemies → most targets with fewest disadvantaged attacks →
    fewest movement points → party decides.
- Note that **negative hexes outrank everything else** in both lists —
  including movement cost in find-focus and target maximization in
  movement (caption B: the Hound refuses to shorten its path at all rather
  than spring a trap; the chapter text agrees: "even when that means not
  maximizing targets").
- ✅ **The engine now follows this ordering** (server `ai.ts`, fixed
  2026-06-10; it originally diverged on all three points below):
  - `determineFocus` uses the terrain-aware search — difficult terrain
    costs 2 and negative hexes are counted — and compares candidates by
    (negative hexes, movement cost, range, initiative).
  - `determineMovement` ranks fewest-negative-hexes **first**
    (negatives → attacks → disadvantage → cost), and its approach
    fallback stays put rather than enter a negative hex (caption B).
  - `terrainSearch` prefers safer paths over cheaper ones when comparing
    routes to the same hex (negatives before cost).
- Caption E is also a subtle rule: a monster that already attacks with
  disadvantage from a condition (muddle) doesn't bother repositioning to
  avoid positional disadvantage.
