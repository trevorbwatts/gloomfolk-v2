# Items

> Transcribed from the Gloomhaven 2E rulebook.

Item cards offer a wide variety of bonuses and extra abilities that can be
used in addition to a character's normal two actions per round. Item cards
are acquired by **looting** them during the Scenario Phase and by
**purchasing** them during the City Phase.

## Item Card Features

- **A — Item Name.**
- **B — Item Cost.** The amount of gold required to purchase the item.
- **C — Reputation Requirement.** Characters can only buy items with
  reputation requirements while their party's reputation is greater than
  or equal to that item's reputation requirement (see p. 50).
- **D — Item Usage.** What happens to the item after it has been used (see
  p. 34). Some items are only **spent**, while others are **lost** instead.
  Some items can even be used **multiple times** first.
- **E — Item Effect.** When the item can be used and what bonus or ability
  the character gains.
- **F — Item Type.** Each item counts as one of six types: **Head**, **Body**,
  **Feet**, **One Hand**, **Two Hands**, or **Small**. These types determine
  which items a character can bring into a scenario.
- **G — Negative Modifiers.** Some items, when brought into a scenario, add
  a number of `-1` cards to the character's attack modifier deck. The item
  shows the count of cards to add.
- **H — Quantity.** A count that indicates how many copies of the item exist
  in the game and which number this copy is within the count.
- **I — Index Number.** A unique number that identifies the item, on the
  card back. When an item is referenced, using the index icon, it can be
  found by its card back. This prevents the party from inadvertently seeing
  items they have not discovered yet.

## Item Limits

All items a character brings into a scenario are placed below their character
mat and can be used as specified by the items themselves.

A character can use any item as long as it is in their possession, even if
the party no longer has the reputation needed to purchase it. However,
characters can only bring a limited number of items into a scenario:

- **1 Head item**
- **1 Body item**
- **1 Feet item**
- Up to **2 One-Hand items** *— OR —* **1 Two-Hands item**
- A number of **Small items** up to **half their level (rounded up)**

A character can own more items than they bring into a scenario, but **they
cannot own more than one copy of any single item**. All items that a
character owns are kept in their tuck box. Different characters cannot own
the same copy of the same item. **Items cannot be transferred or traded
between characters.**

## Implications for the schema (notes for later)

Items are a **separate data model** from ability cards. We don't need to
build it now — Bruiser ability cards don't reference items, and we have no
inventory or item-effect engine. When we get there, expect a sketch like:

```ts
type ItemSlot = 'head' | 'body' | 'feet' | 'one-hand' | 'two-hands' | 'small';

type ItemUsage =
  | { kind: 'spent' }                          // single-use, recoverable on long rest
  | { kind: 'lost' }                            // single-use, not recoverable
  | { kind: 'multi-use'; uses: number; thenUsage: 'spent' | 'lost' };

interface Item {
  id: string;            // matches the index number on card back
  name: string;
  cost: number;
  reputationRequirement?: number;
  slot: ItemSlot;
  usage: ItemUsage;
  negativeModifierCount?: number;  // -1 cards added to deck when brought
  quantity: { copyNumber: number; totalCopies: number };
  effect: ItemEffect;    // discriminated union — defer specific shapes
}
```

A separate `packages/shared/src/items/` directory would mirror the
`cards/` structure when we build it. Defer.

Engine concerns (not data):
- Per-character `inventory` (owned items) and `loadout` (items brought into
  this scenario).
- Per-item state during a scenario: ready / spent / lost (with
  multi-use counter for items that allow it).
- Long rest recovers all spent items.
- Item-limit enforcement at scenario start.
- Negative-modifier injection into the attack modifier deck at scenario
  start; removal at scenario end.
- City Phase: purchasing flow with reputation check, gold deduction,
  ownership tracking.
- Looting item tiles already touched on in
  [forced-movement-and-loot.md](forced-movement-and-loot.md).
