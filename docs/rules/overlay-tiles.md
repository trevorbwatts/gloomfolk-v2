# Overlay Tiles

> Transcribed from the Gloomhaven 2E rulebook.

Overlay tiles are placed on top of map tiles to provide additional features
for the scenario. The **type of overlay tile is defined by the colored
border** of the tile, as depicted in the scenario book — not necessarily
the illustration on the tile.

If the scenario layout depicts an overlay tile covering the **border hex**
of a map tile, the overlay tile **also covers up any adjacent wall lines**.
The overlay tile creates **new wall lines** between it and any adjacent
border hexes without overlay tiles.

## Hex-state terminology

- **Featureless.** A hex with no overlay tiles (except corridors and
  pressure plates).
- **Unoccupied.** A hex with no figure.
- **Empty.** A hex that is both featureless and unoccupied.

Tokens are **not** overlay tiles.

## Overlay types

### Corridors
A corridor is placed on the connection of two map tiles to cover the border
hexes and create a single room out of multiple map tiles. Corridors are
considered **empty hexes** and are **not considered overlay tiles** for the
purposes of determining what other tiles or tokens can be placed in the
same hex.

### Difficult Terrain
A figure requires **2 movement points** to enter a difficult terrain hex,
except when flying or jumping (even if the jump movement ends there).

### Traps
A trap is sprung when any figure enters its hex, except when flying or
jumping (unless the jump movement ends there). When sprung, the trap
applies some effect to the figure that sprang it and is then **removed
from the map**.

- Trap effects are specified either by the **scenario key** (when part of a
  room's setup) or by the **ability of the figure who placed the trap**.
- If a trap's effect is listed as **"damage"** in the scenario key, the
  trap deals damage equal to **2 + scenario level**.
- When a trap tile is placed on the map, tokens for the damage and
  conditions it applies (except curse) should be placed on the trap tile
  for easy reference.

### Hazardous Terrain
If any figure enters a hazardous terrain hex, except when flying or jumping
(unless the jump movement ends there), that figure suffers damage equal to
**1 + one-third of the scenario level, rounded up**.

Unlike trap tiles, hazardous terrain tiles are **not removed** after their
effect is applied — they remain on the map indefinitely. Figures do **not**
suffer additional damage when:
- starting a turn in a hazardous terrain hex, or
- exiting a hazardous terrain hex.

### Objectives
Objectives are tied to the goals of some scenarios and typically need to be
**destroyed** or **protected**. The scenario's special rules assign a
maximum hit point value to each objective, usually based on the scenario
level (see p. 15) and the number of characters.

- Objectives can be **targeted by attacks and suffer damage**, but are
  **immune to all conditions and forced movement**.
- Objectives are considered to have **initiative 99** for the purpose of
  focusing, unless otherwise stated by the scenario, but they **do not
  take turns**.
- Damage is marked by placing damage tokens directly on the objective.
  When total damage ≥ max HP, the objective is **destroyed** (not killed)
  and the tile is removed from the map.
- Objectives are considered **figures**, and the hexes they occupy are
  considered **occupied**.
- Objectives are **not considered obstacles**, but like obstacles, figures
  **cannot enter a hex with an objective** except when flying or jumping.
- Objectives **cannot be commanded**.

### Obstacles
Figures cannot enter a hex with an obstacle, except when flying or jumping
(unless the jump movement would end there). Obstacles **do not block
line-of-sight** (see p. 19).

### Pressure Plates
A pressure plate's trigger and all of its effects are defined by the
**special rules for the scenario**. Jump and flying movements **still
trigger pressure plates**. Pressure plates are considered **empty hexes**.

### Doors
A door separates two rooms. Doors are typically **closed to start**. When a
character enters a closed door, they flip over the door tile to its open
side, **revealing the adjacent room** (see p. 42).

- Closed doors **do not hinder normal character movement**, but they
  otherwise **act as walls**.
- **No figure can enter a closed door with forced movement** (see p. 30).
- Once a door is open, it is considered a **corridor** for most purposes,
  but it **still separates rooms** and is **not part of either room**
  adjacent to it.
- Door illustrations vary by environment type, but all door tiles function
  identically.

### Walls (inner)
Like the walls on the border of a map tile, figures **cannot cross the
wall lines into a wall hex by any means**, even when flying or jumping.
Any section of a map tile surrounded by wall lines is considered to be a
**separate room**.

### Treasures
Treasure can be **looted** by characters (see p. 30). When a treasure is
looted, its effect is applied and the treasure tile is **removed from the
map**.

- **Goal treasure** is related to the completion of a scenario, with
  effects specified in the special rules for the scenario.
- **Numbered treasure** is more varied, with effects specified in the
  **Treasure Index** (see p. 66).

Treasure effects:

- **Provides an item.** Find the copy of that item in the unavailable
  supply and add it to your pool of items. You may use it normally for
  the remainder of the scenario as if you had brought it in, **even if it
  puts you above the limit for that type of item**.
- **Provides a random item design.** Draw one random card from the random
  item design deck and add it to the available item supply (see p. 52).
  If the deck is empty, the party gains **15 collective gold** instead.
- **Unlocks a random scenario.** Draw a card from the random scenario
  deck, read the section specified on the card in the section book, then
  remove the card from the game. If the deck is empty, the party gains
  **15 collective gold** instead.

When a numbered treasure is looted, **check it off in the Treasure Index**
(p. 66) and **cross it out in the scenario book or section book** — it
cannot be looted again if the party replays the scenario.

## Overlay tile art

**Many overlay tiles can function as different types of overlays.** For
example, a stone pillar tile can be used as an **obstacle** or an
**objective**, depending on the border shown in the scenario layout and
the banner color shown in the scenario key.

> The type of overlay is determined by its **color and icon**, not
> necessarily the illustration on the tile or the name in the scenario
> book.

## Implications for the schema (notes for later)

Pairs with [map-tiles-and-walls.md](map-tiles-and-walls.md). Sketch:

```ts
type OverlayKind =
  | 'corridor'
  | 'difficult-terrain'
  | 'trap'
  | 'hazardous-terrain'
  | 'objective'
  | 'obstacle'
  | 'pressure-plate'
  | 'door'
  | 'wall'
  | 'treasure';

interface Overlay {
  kind: OverlayKind;
  hex: HexCoord;
  // kind-specific data:
  trap?: { effect: TrapEffect };           // damage = 2 + scenarioLevel if 'damage'
  objective?: { maxHp: number; hp: number; initiative: number /* default 99 */ };
  pressurePlate?: { triggerId: string };   // resolved by scenario script
  door?: { open: boolean };                // closed = wall-like; open = corridor-like, still room boundary
  treasure?:
    | { variety: 'goal' }                  // scenario-defined effect
    | { variety: 'numbered'; index: number; effect: TreasureEffect };
}

type TreasureEffect =
  | { kind: 'item'; itemId: string }                          // bypass loadout limits
  | { kind: 'random-item-design' }                            // empty deck → +15 collective gold
  | { kind: 'unlock-random-scenario' };                       // empty deck → +15 collective gold
```

Engine concerns:

- **Movement cost & blocking** — each overlay kind contributes a per-edge
  or per-hex rule. Build a per-figure movement cost function that consults
  overlays plus flying/jumping flags.
- **Enter-hex triggers** — traps, hazardous terrain, and pressure plates
  all fire on entry. Flying/jumping bypass *unless* a jump *ends* in the
  hex (traps & hazardous yes; pressure plates always trigger).
- **Trap removal vs hazardous persistence** — same trigger semantics but
  different post-effect lifecycle.
- **Objectives as figures** — they take focus slots, occupy hexes, and are
  damage-able, but skip the turn loop and ignore conditions/forced
  movement. Probably a sibling type to `Monster` and `Character` that
  shares a `Figure` interface.
- **Featureless / unoccupied / empty** terms are query predicates over
  board state, used by many ability rules — implement as helpers.
- **Wall-line mutation on overlay placement** — when an overlay covers a
  border hex, recompute adjacent wall lines (cover existing, add new
  boundaries against non-overlay border hexes). Bake this into the
  scenario-setup pipeline.
- **Doors as stateful overlays.** Closed doors block forced movement and
  LoS like walls but allow normal-move entry (which flips them open and
  triggers room reveal). Open doors behave like corridors for movement
  but **still count as room separators** — so room-membership queries
  must treat the door hex as belonging to neither adjacent room.
- **Treasure looting** — see
  [forced-movement-and-loot.md](forced-movement-and-loot.md) for the loot
  trigger; the *effect resolution* (item / random design / unlock)
  belongs here. Numbered treasures need persistent campaign state so
  replays don't re-grant them.
- **Art-vs-type decoupling.** Overlay type is determined by **border
  color + icon** in the scenario layout, not by the tile illustration or
  the name. The same physical tile can be reused as different overlay
  kinds across scenarios — so our scenario data must reference
  `OverlayKind` independently of any tile-art id.
