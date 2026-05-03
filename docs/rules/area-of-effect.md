# Area of Effect

> Transcribed from the Gloomhaven 2E rulebook.

Abilities with an area of effect allow the acting figure to target several
different figures in multiple hexes at the same time. **Rotating and mirroring
the depicted area of effect is permitted.**

**Gray** indicates the hex which the acting figure occupies. Any attack with an
area of effect that includes a gray hex is always considered a melee attack
(see p. 23).

**Red** indicates the hexes in which figures can be targeted. Only one red hex
needs to be within the ability's range. This initial hex does not need to
contain a figure, but it cannot be inside a wall line, though other red hexes
can be inside wall lines. Only figures within line-of-sight can be targeted.
Allies in red hexes are not targeted by negative abilities, and enemies in red
hexes are not targeted by positive abilities, unless otherwise stated.

If an ability with an area of effect gains "+1 Target," an additional figure
within the ability's range, but outside the area of effect, can be targeted.

## Implications for the schema (notes for later)

- **Mirroring is permitted in addition to rotation.** Today the doc comment on
  `AttackTarget.aoe.pattern` says only "Player chooses rotation at cast time" —
  needs updating to include mirroring. Engine concern: when resolving an AOE,
  the search space is all 6 rotations × 2 mirror states = 12 candidate orientations.

- **Melee-vs-ranged classification is derivable from the pattern.** "Includes a
  gray hex" really means "any red hex is adjacent to the actor's hex (origin)."
  Equivalently: if any `{q,r}` in `pattern` has `|q| + |r| + |q+r| <= 2` (axial
  distance ≤ 1 from origin), the AOE is melee; otherwise it's ranged and will
  have a printed Range value. We don't need to store this — derive at resolve
  time.

- **AOE anchoring** (engine concern): the player picks one red hex as the
  "initial" target and that hex must be in range and not inside a wall line.
  Other pattern hexes can land anywhere — including through walls — relative
  to the anchor, subject to per-hex line-of-sight from the actor for figures
  that are actually targeted.

- **Polarity still filters AOE targets.** Allies in red hexes are skipped by
  negative AOEs, enemies skipped by positive AOEs. Same rule as single-target
  abilities, just applied per affected hex.

- **"+1 Target" on AOE = +1 *outside* the AOE.** Distinct semantics from
  +1 Target on single-target attacks (which raises the target count). Will
  matter when we model the +Target rider — the bonus's effect depends on
  whether the base ability is AOE or not.
