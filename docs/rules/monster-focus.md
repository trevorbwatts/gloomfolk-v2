# Monster Focus

> Transcribed from the Gloomhaven 2E rulebook. **High-priority rule** —
> historically a source of confusion at the physical table; the engine
> needs to enforce it deterministically.

## Focus

At the start of its turn, a monster finds a focus. This focus is **the
enemy it can perform its attack on using the fewest movement points**.
Determining the shortest possible path takes into consideration the effects
of difficult terrain.

For a **melee attack**, the monster identifies the shortest possible path
to a hex from which it can perform the melee attack. For a **ranged
attack**, the monster identifies the shortest possible path to a hex from
which it can perform the ranged attack within the specified range. If the
monster cannot attack on its turn — either because it does not have an
attack ability or because it has **disarm** — it focuses as if for a
single-target melee attack.

If the shortest possible path would bring the monster within range of
multiple enemies, it focuses on the one who is **closest by range to its
current hex**. If those enemies are all equally close, it focuses on the
one who **acts earliest in the initiative order**.

> *Example: Even though the Vermling Scout is closer by range to the
> Tinkerer, the monster can perform its melee attack on the Bruiser using
> fewer movement points, so it focuses on the Bruiser.*

## Additional Foci

If a monster's attack ability allows it to attack multiple targets, it
first finds a primary focus, then finds additional foci for the extra
attacks. The monster does this by identifying the shortest possible path to
a hex from which it can attack its primary focus **and as many additional
targets as the attack ability allows during its current turn**.

## Path Priority

Monsters always prioritize a path that triggers the **fewest negative
hexes**, even when that means not maximizing targets. Negative hexes are
hexes that contain traps or hazardous terrain, and **monsters treat all
negative hexes the same**. Monsters only trigger negative hexes when there
is no other viable path to attack an enemy. For example, if a monster could
attack by moving two hexes and springing a trap on the way, or by moving
10 hexes and avoiding the trap, it would take the longer path.

It does not matter whether the monster can actually reach the end of the
path on its current turn. As long as there is a path to reach a hex from
which to attack an enemy, the monster can focus on that enemy. **Focus
does not require line-of-sight.**

## No Focus

It is possible that a monster is unable to find a focus if it cannot reach
a valid hex, given infinite movement, from which it can perform its attack.
In such cases, the monster does not move or attack but **still performs any
other abilities listed on its ability card**.

## Implications for the schema

This is the heart of monster AI. The algorithm has to be precise — the
rulebook intends a single deterministic answer (modulo the explicit
"party decides" escape hatch from the previous section).

### The focus algorithm, formalized

For a monster `M` on its turn with attack ability `A`:

1. **Enumerate attack hexes.** Build the set `H_attack` = every hex from
   which `M` could legally perform `A` against *some* enemy, ignoring
   movement budget. For melee: every hex adjacent to an enemy. For ranged
   `range R`: every hex within `R` of an enemy with line-of-sight from
   that hex to the enemy. (LOS is required for the *attack itself* even
   though it is not required for *focus determination* — see below.)

2. **For each enemy `E`**, find the minimum-cost path from `M`'s current
   hex to any hex in `H_attack` from which `E` can be attacked. Cost
   accounting:
   - Difficult terrain costs as defined in movement rules.
   - **Path priority overrides cost minimization with respect to negative
     hexes**: among all paths that reach an attack hex for `E`, pick the
     one that crosses the fewest negative hexes (traps + hazardous
     terrain, undifferentiated). Among those, pick the shortest by
     movement cost.
   - Infinite movement is assumed — paths longer than `M.movement` are
     still valid for focus determination.
   - **LOS is not required to *focus* on an enemy**; it is only required
     at the moment of attack. The pathfinder ignores LOS when computing
     the focus path.

3. **Tiebreak across enemies:**
   - Lowest `(negativeHexCount, pathCost)` wins as the focus.
   - If still tied: focus on the enemy **closest by range** to `M`'s
     current hex. *Range* here is hex-distance ignoring obstacles, not
     path cost.
   - If still tied: focus on the enemy **earliest in initiative order**
     this round.

4. **Disarm / no-attack fallback:** if `M` is disarmed or its drawn
   ability card has no attack, run the algorithm as if `A` were a
   single-target melee attack — i.e. `H_attack` = hexes adjacent to any
   enemy. Focus is still computed and still used by movement, even though
   no attack will fire.

### Additional foci

For a multi-target attack `A` (target count `T > 1`):

1. Find the primary focus `F1` per the algorithm above.
2. Recompute paths: for each candidate path that reaches an attack hex for
   `F1`, count how many *additional* enemies could be attacked from that
   destination hex within `A`'s constraints. Pick the path that maximizes
   the number of additional foci hit, subject to the same negative-hex
   minimization (path priority still wins over target count).
3. Additional foci are *the enemies actually hit by the attack from the
   chosen destination hex*, up to `T - 1` of them. The rules don't
   specify a tiebreak when more enemies are reachable than slots
   available — flag this as a likely "party decides" prompt.

### Engine implications

- **Pathfinder must return all minimum-cost paths**, not just one, so the
  tiebreak chain (negative-hex count → path cost → range → initiative)
  can be applied. A naive A* that returns the first path found will
  produce wrong-but-plausible results.

- **Negative hexes are a separate cost dimension**, not just extra
  movement. Lexicographic ordering: `(negativeHexCount, pathCost)`. Do
  not collapse them into a single weighted sum.

- **`negativeHex` is a hex predicate, not a property of a tile type.** A
  hex is negative if it currently contains a trap or hazardous terrain.
  Allies' presence, obstacles, etc. don't make a hex negative — they
  make it impassable or expensive but not "negative" in the
  path-priority sense.

- **Range in tiebreak step ≠ path cost.** "Closest by range" means
  hex-distance (the same metric used for ranged attacks), measured from
  `M`'s current hex to `E`'s current hex, ignoring terrain. Two separate
  distance functions in the same algorithm — name them clearly
  (`pathCost` vs. `hexRange`) to avoid bugs.

- **Initiative tiebreak uses *this round's* initiative**, which for
  characters is their committed leading card and for monster sets is
  the drawn ability card. Already a known value at focus-determination
  time since focus is computed at the start of the monster's turn,
  after all initiatives are revealed.

- **No-focus outcome is not a no-op.** The monster still resolves any
  non-move, non-attack abilities on its card (heal, summon, grant
  conditions to allies, etc.). The turn resolver should iterate all
  ability steps and skip only the ones gated on having a focus.

- **Suggested API shape:**

  ```ts
  type FocusResult =
    | { kind: 'focused'; primary: FigureId; additional: FigureId[];
        path: Hex[]; destination: Hex }
    | { kind: 'no-focus' };

  function determineFocus(
    monster: MonsterFigure,
    abilityCard: MonsterAbilityCard,
    board: BoardState,
  ): FocusResult;
  ```

  `path` is included so the movement step can replay it directly rather
  than re-pathfinding (and risking a different tiebreak outcome).

- **Determinism is non-negotiable.** Every step of this algorithm must be
  a pure function of board state + initiative order. Two engines given
  the same inputs must produce the same focus, or the rule is broken.
  Property-test heavily.
