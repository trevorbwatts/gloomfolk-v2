# Movement (Move, Jump, Flying, Teleport)

> Transcribed from the Gloomhaven 2E rulebook.

## Move

**"Move X"** is an ability that gives a figure X movement points. That figure
may then spend those movement points to move one hex per movement point.

Figures can move through allies but cannot move through enemies, obstacles,
objectives, or walls. Traps and other effects of hexes trigger when a figure
enters them. A figure must always end their movement in an unoccupied hex.

A figure must **enter at least one hex** to be considered to have performed a
move ability. A figure does not have to spend all of their movement points.
All unspent movement points are lost at the end of the move ability.

## Jump

**"Jump"** is an *added effect* of a move ability. Jumping allows a figure to
ignore all enemies, obstacles, objectives, traps, and hazardous terrain,
**except for in the last hex**. Difficult terrain is ignored completely when
jumping. A figure cannot jump through walls.

## Flying

**"Flying"** is an *active bonus* (see p. 28). Flying allows a figure to
completely ignore all enemies, obstacles, objectives, traps, and overlay
terrain, **including in the last hex**. However, a flying figure still cannot
end their movement in a hex occupied by another figure (and vice versa). If a
flying figure occupies a hex with an immobilize trap or stun trap (see p. 27),
treat them as an obstacle when determining the movement of other figures.

If a figure loses flying, treat them as if entering their current hex with a
normal movement. In such cases, if the figure currently occupies a hex with an
obstacle, they instead move into the closest unoccupied hex without an
obstacle, triggering any effects of that hex.

## Teleport

**"Teleport X"** is an ability that transports a figure to any location within
X hexes of their current hex, without evaluating their path through all of
the hexes between. A teleport ability is **not considered a move ability**,
and teleporting is **not considered movement**. Teleportation is not affected
by anything, even walls, in the hexes between.

A figure can only teleport to a valid hex, and any effects of entering that
hex still trigger normally, unless otherwise stated. A figure cannot teleport
into an unrevealed room, but they can teleport to a hex with a closed door,
opening the door as a result.

## Implications for the schema

- **`MoveTrait` should drop the `'fly'` entry I speculatively added.** Flying
  per the rulebook is an active bonus (a character state), not a per-move
  trait like Jump. When we encode it properly later, it'll surface as a
  character-state condition or an active-bonus persistent — not a flag on
  individual `move` steps. Removing `'fly'` now to avoid wrong-shape baggage.

- **Jump stays as a `MoveTrait`.** Confirmed: it is an added effect of a move,
  per-move scope. Our existing model is correct.

- **Move performance threshold.** "Must enter at least one hex" matters for
  disposition triggering. Engine rule: if the half's only performed ability
  was a move that moved zero hexes, the half wasn't actually performed →
  disposition doesn't fire. We model this in the engine, not the data.

- **Teleport is a new ability type.** When a card needs it, add to
  `AbilityStep`:
  ```ts
  | { type: 'teleport'; range: number; node?: NodeShape; mandatory?: boolean }
  ```
  No Bruiser card needs it yet — defer.

- **Movement-related state we'll need in the engine, not the schema:**
  difficult terrain, hazardous terrain, overlay terrain, immobilize/stun
  trap interactions, "treat flying figure as obstacle for others" rule,
  loss-of-flying displacement to nearest non-obstacle hex.
