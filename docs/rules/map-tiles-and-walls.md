# Map Tiles and Walls

> Transcribed from the Gloomhaven 2E rulebook.

Each map tile is considered to be full of **empty hexes** (no overlay tiles
or figures). These traversable hexes are surrounded by **walls** consisting
of **border hexes** separated by **wall lines**.

- **Wall lines cannot be crossed.**
- A grouping of hexes surrounded by walls is considered a **room**.
- A hex is considered **adjacent to a wall** if it shares a border with a
  wall line.
- A hex is **not** considered adjacent to a hex on the other side of an
  adjacent wall line.

## Overlay tiles

An overlay tile (for example, a corridor) can be placed on top of two map
tiles, **combining the two rooms into one** and creating new wall lines
where the overlay's edges sit.

## Implications for the schema (notes for later)

Defer until we model scenarios on the board. Sketch:

```ts
type HexKind = 'empty' | 'border';            // wall hexes are border hexes

interface Hex {
  q: number; r: number;                       // axial coords
  kind: HexKind;
  roomId?: string;                            // membership in a room grouping
}

interface WallLine {
  // edge between two adjacent hexes; impassable; defines room boundaries
  a: HexCoord; b: HexCoord;
}

interface OverlayTile {
  id: string;                                 // index/reference number
  footprint: HexCoord[];                      // hexes it covers
  addedWallLines: WallLine[];
  removedWallLines: WallLine[];               // when it merges rooms
}
```

Engine concerns:
- **Adjacency must respect wall lines.** Two hexes that touch on a hex-edge
  are *not* adjacent if a wall line sits on that edge. This affects
  movement, melee range, line of sight, AoE, and "adjacent" effects.
- **Room membership** matters for some abilities and monster activation
  triggers (e.g., revealing rooms — see
  [revealing-spawning-and-named-monsters.md](revealing-spawning-and-named-monsters.md)).
- **Overlay placement** mutates the wall-line set at scenario setup time.
  Treat the board as a derived graph: hexes + edges (with `passable` flag
  per edge) rather than baking walls into hex objects.
