# Manipulating Tiles

> Transcribed from the Gloomhaven 2E rulebook.

Manipulating tiles is any ability that allows a figure to alter the layout
of overlay tiles on the map. It is one of the six **targeted** ability
categories (see [target.md](target.md)).

There are six ways to manipulate tiles:

- **Create.** Allows a figure to place an overlay tile.
- **Destroy.** Allows a figure to remove an overlay tile.
- **Relocate.** Allows a figure to remove an overlay tile and place it
  elsewhere.
- **Move.** Allows a figure to move an overlay tile up to the specified
  number of hexes, much like a figure would move. Overlay tiles can only be
  moved through featureless hexes, including occupied hexes.
- **Replace.** Allows a figure to destroy an overlay tile in order to create
  a different overlay tile in the same hex.
- **Spring.** Allows a figure to destroy a trap and apply the effects of the
  trap to themselves, unless otherwise stated.

## Constraints

- No hex can have more than one overlay tile in it (**except corridors and
  open doors**).
- Traps and obstacles cannot be placed in or moved into occupied hexes.
- If hazardous terrain is placed in an occupied hex, its effects are not
  applied to the figure in that hex.
- When manipulating obstacles, **figures cannot cut off one area of the map
  from another**, leaving an area that cannot be entered without going
  through an obstacle.
- Figures cannot manipulate any overlay tile that is covering a **border
  hex** of a map tile.

## Implications for the schema

- **`manipulate-tile` is a new `AbilityStep` variant** when a Bruiser card
  uses it. Six modes:
  ```ts
  | {
      type: 'manipulate-tile';
      mode: 'create' | 'destroy' | 'relocate' | 'move' | 'replace' | 'spring';
      // mode-specific payloads (range, target tile shape/type, distance for 'move',
      //   replacement tile for 'replace', etc.)
      mandatory?: boolean;
    }
  ```
  Will likely become a discriminated sub-union once we encode the first card
  to keep payloads tight per mode. Defer.

- **Inherent precondition pattern.** *Clear the Way* (rulebook example, not
  encoded yet) uses Relocate as a precondition: "Relocate one adjacent 1-hex
  obstacle tile to an empty hex within Range 4 **to perform:**". This ties
  back to the [added-effects rule](added-effects.md) note about inherent
  preconditions — when we encode such a card, we'll add `Ability.precondition?`
  with a `manipulate-tile` step inside it.

- **Targeted ability** — falls under polarity rules. Tile manipulation is
  generally negative-on-enemies (destroying their cover) or positive-on-
  allies (creating cover for them). Engine routes per ability instance.

- **Engine state model needed:** map of hex → overlay tile (with type, state
  for doors/traps/etc.), reachability check for the "cannot cut off" rule,
  border-hex flag per map tile.

- **Spring** is interesting — applies the trap's effect to the manipulating
  figure. Engine reuses the trap-effect resolution path with the actor as
  the target.
