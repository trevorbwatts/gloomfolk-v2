# Item Supplies

> Transcribed from the Gloomhaven 2E rulebook.

Items that are not in a character's pool are split into two groups: the
**available supply** and the **unavailable supply**. These two groups are
kept separate in the game box with a divider card.

Items can be **added to the available supply** in the following ways:

- **Prosperity:** When Gloomhaven reaches a new prosperity level, move the
  listed items in the table below from the unavailable supply to the
  available supply.
- **Selling:** When a character sells an item for gold (see p. 57), return
  the item to the available supply.
- **Retiring Characters:** When a character retires (see p. 55), return
  all of their items to the available supply.
- **Gaining Random Item Designs:** When the party gains a random item
  design, draw one random card from the random item design deck and add it
  to the available supply.

Items are only returned to the **unavailable** supply when a game effect
specifically instructs the party to do so.

## Items unlocked by prosperity level

| Prosperity | Item Number |
| ---------- | ----------- |
| Level 1    | 001–016     |
| Level 2    | 017–024     |
| Level 3    | 025–032     |
| Level 4    | 033–040     |
| Level 5    | 041–048     |
| Level 6    | 049–053     |
| Level 7    | 054–058     |
| Level 8    | 059–063     |
| Level 9    | 064–068     |

## Implications for the schema (notes for later)

- The campaign shop (`shop: ShopEntry[]` in messages.ts) is today seeded
  from `DEFAULT_SHOP_STOCK`; this page says stock should be *derived*:
  available supply = items at or below the current prosperity level
  ([campaign-sheet.md](campaign-sheet.md)), minus copies owned by
  characters, plus random-design unlocks.
- Selling and retirement return items to the supply — both flows are
  unbuilt; when they land, "return to available supply" means restocking
  the shop entry rather than deleting the item.
- See [items.md](items.md) for the item card model and per-character
  ownership rules.
