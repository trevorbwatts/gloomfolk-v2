# Line-of-Sight

> Transcribed from the Gloomhaven 2E rulebook.

When any figure or hex is targeted by any ability, the acting figure must have a
clear **line-of-sight** to the target in order to perform the ability.

Line-of-sight is established if a line can be drawn from any part of the acting
figure's hex to any part of the target hex without touching a wall line. Only
walls and closed doors block line-of-sight.

Non-targeted abilities are not affected by line-of-sight.

If an ability allows a figure to perform it as if occupying a different hex,
draw the line from that hex.

## Example

There is clear line-of-sight to the Bruiser (**A**) from all three Vermling
Scouts (**1**), but not from the Vermling Priest (**2**) due to a wall.

## Implications for the engine (notes for later)

- **Targeted vs. non-targeted distinction matters.** A LoS check is required
  before resolving any *targeted* ability. In our schema:
  - **Targeted** today: `attack` (any target kind), `heal` with non-self target
    (when we add ally targets).
  - **Non-targeted** today: `move`, `shield`, `retaliate`, `heal` (self),
    `create-element`, `loot`, `gain-exp`. These resolve regardless of LoS.
- **Map model.** LoS resolution requires a map with hex-edge walls and
  doors-with-state (open/closed). Not part of card data — lives in the
  scenario/board model.
- **"As if occupying a different hex".** Some future abilities will phantom the
  acting figure to another hex for LoS purposes. When we hit one, the schema
  will need a per-step `losOriginOverride` or similar.
