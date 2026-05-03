# Range

> Transcribed from the Gloomhaven 2E rulebook.

Most abilities target a figure, and a range value added to an ability
determines how far away that figure can be. **"Range X"** means the acting
figure can target any figure within X hexes, including the acting figure when
permitted.

**Range cannot be counted through walls** but can be counted through obstacles,
figures, or anything else. Two hexes that share a wall but still have
line-of-sight between them (e.g., through an open doorway) are considered to
be at range 2 from each other.

Non-attack abilities with no specified range value can target figures at any
range. Any ability with a range value specified in the highlighted section to
its right is considered a **ranged ability**.

**Figures treat the hex they occupy and anything in it as adjacent for the
purpose of targeting.**

## Example

The Bruiser (**A**) is at range 2 from the Vermling Priest (**1**).

## Implications for the schema (notes for later)

- **Range counting rules** are engine-side: BFS over hex graph, edges blocked
  only by walls, costs ignore figures/obstacles. Doors-when-open don't block.
- **Self-as-adjacent** rule means range 1 includes range 0. The engine should
  treat `range >= 1` as including the actor's own hex when polarity allows.
- **Default range for non-attack targeted abilities** is unbounded. In our
  schema, `HealTarget` (and future ally-target variants) will need a way to
  express "any range" — likely just `range: number | 'unbounded'` or omitting
  the field with the engine defaulting to unbounded.
- **"Ranged ability" classification.** A targeted attack with `range > 1` is a
  *ranged* attack — relevant for things like disadvantage on melee monsters
  attacking ranged characters in adjacency, attack modifier interactions,
  etc. Today our `AttackTarget` already distinguishes `melee` (range 1) from
  `ranged { range }`, so this is recoverable from data.
