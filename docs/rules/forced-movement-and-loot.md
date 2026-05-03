# Forced Movement and Loot

> Transcribed from the Gloomhaven 2E rulebook.

## Forced Movement

Forced movement is any **negative targeted ability** that allows a figure to
control another figure's movement or to teleport another figure. Forced
movement must follow all normal movement rules for the target. For example,
if a flying figure is forced to move, flying still applies.

There are two primary forced movement abilities:

- **"Push X"** forces the target to move up to X hexes **away** from the
  acting figure. Each individual hex entered must place the target **farther
  by range** from the acting figure.
- **"Pull X"** forces the target to move up to X hexes **toward** the acting
  figure. Each individual hex entered must place the target **closer by
  range** to the acting figure.

When a character performs a push or a pull, **they decide** the direction and
distance that the target moves. When a monster performs a push or a pull,
**the party decides** the direction, but the target must move **as far as
possible**.

Push and pull are unaffected by difficult terrain, but all other normal
movement rules are still applied (including the rules for flying figures).
**Immobilized or stunned figures can still be affected by push, pull, and
teleport** but not by any other type of forced movement.

Push and pull can also be added to other abilities as an added effect,
allowing the forced movement of one or more targets of that ability after
its main effect is resolved. If the ability is an attack, the target can be
forced to move even if the attack dealt no damage, but they cannot be forced
to move if the attack killed or exhausted them.

Multiple push or pull effects are combined. For example, if an ability with
"Push 1" gains "Push 2," the result is a "Push 3" ability.

## Loot

**"Loot X"** is an ability that allows a figure to loot all money tokens and
treasure tiles **within range X, including any in their current hex**. This
ability is unaffected by the presence of figures or overlay tiles. **If
there are no money tokens or treasure tiles within the specified range, the
ability cannot be performed.**

When a money token is looted, it is removed from the map. If the looting
figure is a monster, nothing else happens. If the looting figure is a
character, they place the token on their character mat.

When a treasure tile is looted, it is removed from the map. **Monsters
cannot loot treasure tiles.** If the looted treasure tile is a numbered
treasure, reference the treasure's number in the Treasure Index and apply
the effect (see p. 66). Only the looting character gains the reward, unless
it is a random item design or random scenario. If a looting character gains
another copy of an item they already own, they must give it to another
character or sell it immediately.

## Implications for the schema

### Forced Movement

- **`push` and `pull` are new `AbilityStep` variants** when a Bruiser card
  uses them:
  ```ts
  | { type: 'push'; amount: number; node?: NodeShape; mandatory?: boolean }
  | { type: 'pull'; amount: number; node?: NodeShape; mandatory?: boolean }
  ```
  Or as a single `forced-movement` variant with `direction: 'push' | 'pull'`.
  Lean toward two variants for symmetry with how the rulebook treats them
  as separate ability names. Defer until needed.

- **Push/pull as added effects on attacks** = sibling steps in the same
  `Ability`. Attack resolves first, then push/pull (per the
  [attack-modifiers-and-effects timing table](attack-modifiers-and-effects.md)).
  Trample's Section 2 already follows this sibling pattern with
  `[Attack, Gain-EXP]`; future cards will follow the same pattern with
  `[Attack, Push]` etc. No special "rider" wrapper needed.

- **Multiple push/pull combining** (Push 1 + Push 2 = Push 3) is engine
  arithmetic when bonuses or modifier-card effects add to a base push.
  No data-layer concern.

- **Decision-maker rule** (character chooses, monster forces max distance) is
  engine logic, not data.

- **Push/pull bypass immobilize and stun.** Engine rule: the action-gating
  conditions block self-initiated movement, not externally-imposed movement.

### Loot

- **Already in schema** as `{ type: 'loot', range, node?, mandatory? }`.
  The rule confirms our `range` semantics:
  - Range 0 = own hex only (the standard end-of-turn loot).
  - Range X ≥ 1 = own hex + everything within X hexes.

- **"Cannot be performed if no valid loot in range"** is an engine rule —
  similar in spirit to the "no valid target" rule for targeted abilities,
  even though loot itself is not technically a targeted ability per the
  [target rule](target.md). Combined with the
  [added-effects rule](added-effects.md), a non-mandatory `loot` step in
  an `Ability` with no loot in range simply skips.

- **Monsters cannot loot treasure tiles** — engine rule, doesn't affect
  card data.
