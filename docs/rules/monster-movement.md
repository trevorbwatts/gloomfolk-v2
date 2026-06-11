# Monster Movement

> Transcribed from the Gloomhaven 2E rulebook. Tightly coupled to the
> [focus rules](monster-focus.md) — read those first.

Once a monster has found a focus and identified its path to that focus, it
then performs the abilities listed on its ability card in order — the first
of which is usually to move. **A monster only moves on its turn if
"Move ± X" is listed on its ability card.** This move ability gives the
monster an amount of movement points equal to its base move stat (found on
its stat card) modified by `X` (either positive or negative).

A monster always uses **the fewest movement points required to maximize its
attacks for its current turn**. If a monster cannot attack its focus on its
current turn, it only moves if it can shorten the path to its focus. When a
monster performs a ranged attack on an adjacent target, **it first moves
away from that target if possible, so that the attack does not have
disadvantage**. When a monster performs ranged attacks on multiple targets,
it moves to attack the most possible targets (including its focus), with
the fewest possible disadvantaged attacks, while using the fewest possible
movement points.

Having abilities other than `Move` listed on its ability card does not
affect a monster's movement in any way. It will simply move according to
the above rules and then perform its other abilities as fully as possible.

> *No Monster Path example: The Bruiser is the only character on the map.
> The Vermling Scout cannot find a valid hex from which to perform a melee
> attack, because all hexes adjacent to the Bruiser are occupied or
> invalid, so the Vermling Scout cannot find a focus and does not move.*

> *Blocked Monster Path example: The Vermling Scout wants to be adjacent
> to the Bruiser to perform a melee attack. It has a path to an adjacent
> hex, but only 1 movement point. Since that cannot bring the Vermling
> Scout closer to its focus, it does not move.*

## Implications for the schema

The movement step runs *after* `determineFocus` and *before* attack
resolution. It consumes the focus path and the monster's effective movement
budget for this turn.

### Movement budget

- **Effective movement** = `monster.movement` (from stat card) `+ X`
  (modifier on the drawn ability card's `Move ± X` step). `X` may be
  negative; clamp the result to `0` minimum.
- **No `Move` on the card → movement budget is `0`.** The monster
  resolves the rest of its abilities in place. This is *not* the same as
  "no focus" — a focus may still exist, attacks may still fire, the
  monster simply doesn't relocate.

### Movement decision rules (in priority order)

The "fewest movement points to maximize attacks" rule decomposes into a
lexicographic preference over candidate destination hexes reachable within
budget:

1. **(Inherited from focus) Minimize negative hexes crossed.** Path
   priority from the focus rules continues to apply during the actual
   movement step and **outranks everything below, including target
   maximization** — never trade a clean path for a shorter one through a
   trap (see [appendix B](appendix-b-monster-turn-guide.md), rule B and
   the path-priority text in [monster-focus.md](monster-focus.md): "even
   when that means not maximizing targets").
2. **Maximize total attacks landed this turn** (primary focus + additional
   foci hit from the destination).
3. **Minimize disadvantaged attacks.** Disadvantage on a ranged attack
   triggers when attacking an adjacent enemy — so for ranged abilities,
   prefer destinations that are *not* adjacent to any target.
4. **Minimize movement points spent.**

This ordering matters: a clean path beats everything; then target count
beats disadvantage avoidance, which beats movement economy.

### Special cases

- **Ranged attack while adjacent to focus:** if the monster is already
  adjacent to its focus and is making a ranged attack, it must **move
  away** if any reachable hex within its movement budget puts it
  non-adjacent while still being able to attack. This is the only case
  where a monster spends movement points to *increase* range rather than
  decrease it.

- **Cannot reach focus this turn but can shorten the path:** the monster
  spends movement points to get closer along the focus path, even though
  no attack will fire. "Closer" means fewer remaining movement points
  needed to reach an attack hex — measured the same way focus is
  computed (negative-hex-aware shortest path).

- **Cannot reach focus and cannot shorten the path:** monster does not
  move. The "Blocked Monster Path" example illustrates this — having a
  valid path to an attack hex isn't enough; the budget must let the
  monster make demonstrable progress along it.

- **No focus exists** (per focus rules): movement is skipped entirely,
  but other ability-card steps (heal, summon, condition grants, etc.)
  still resolve.

### Engine implications

- **Movement is computed against the *current* board state**, not the
  state assumed when focus was determined. In principle these are the
  same — focus runs at the start of the turn, no other figure has moved
  — but the engine should not rely on cached pathfinder output. Recompute
  destination evaluation freshly with the actual movement budget.

- **Suggested API:**

  ```ts
  type MovementResult = {
    destination: Hex;        // may equal monster.position if no move
    pointsSpent: number;
    pathTaken: Hex[];        // for animation / replay; [] if no move
  };

  function determineMovement(
    monster: MonsterFigure,
    focus: FocusResult,
    abilityCard: MonsterAbilityCard,
    board: BoardState,
  ): MovementResult;
  ```

- **Candidate-destination enumeration is bounded.** Every hex reachable
  within `effectiveMovement` movement points is a candidate; for a
  typical move-3 to move-5, this is small enough to evaluate
  exhaustively. No need for heuristic search — score every reachable hex
  against the lexicographic preference and pick the winner.

- **"Maximize attacks" must be evaluated *from the destination*.** This
  is where additional foci get re-resolved: the primary focus is fixed
  by the focus step, but which additional enemies fall within the
  attack's reach depends on where the monster actually ends up standing.

- **Disadvantage avoidance is a real tiebreaker, not just a flavor
  preference.** Two destinations that hit the same number of targets but
  differ in disadvantaged-attack count are not equivalent — the monster
  *must* pick the one with fewer disadvantaged attacks. Encode it as a
  hard rank, not a soft heuristic.

- **The "no movement" outcome must be a normal result, not an error.**
  Both blocked-path and no-focus scenarios produce a valid
  `MovementResult` with `pointsSpent: 0` and `destination ===
  monster.position`. Downstream attack resolution still runs.
