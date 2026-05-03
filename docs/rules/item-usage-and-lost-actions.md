# Item Usage and Lost Actions

> Transcribed from the Gloomhaven 2E rulebook.

## Item Usage

- **Spent Icon.** The item is spent after use, indicated by rotating the
  card sideways. Spent items are **recovered the next time the character
  performs a long rest**.
- **Lost Icon.** The item is lost after use, indicated by flipping the card
  face down. Lost items cannot be used again for the rest of the scenario
  (unless recovered). If an item has the **permanent-lost icon**, it
  **cannot be recovered by any means until the end of the scenario**.
- **Flip Icon.** The item is flipped after use, revealing a different use
  on the other side of the card. When the other side is used, the item is
  then flipped back to its front side to be used again. Specific timing of
  the flip is detailed in the item's text. Characters always start the
  scenario with these items on the side with the gold cost.

Some items have **no usage icon**, meaning they apply a **passive effect**
with no usage limit.

Some items can be used multiple times before they are spent, lost, or
flipped — indicated by **use slots**. Use a character token to track these
uses. When an item with multiple uses is recovered, even before fully
spent, reset the character token to the first use slot.

Some recover abilities can recover spent or lost items, just like discarded
or lost ability cards. **All items are returned to their original state
between scenarios. No item can ever be permanently lost.**

### Item-use restrictions

- **Items with use slots and passive effects must be used** if the item's
  requirements are met. All other uses of items are optional.
- If an item affects an attack (e.g., adds a bonus, effect, advantage, or
  disadvantage), it **must be used before an attack modifier card is
  drawn**.
- If an item provides an ability, it **cannot be used during another
  ability**.

## Lost Actions

Lost actions can only be performed once. If an action has the lost icon,
when any part of the action is performed, the card must be placed in the
character's **lost pile**, where it will remain until the end of the
scenario (unless recovered).

If the lost action was used to perform an active bonus ability, the card is
**still considered lost** and must be moved from the active area to the
lost pile **once the active bonus is no longer in effect**.

Some lost actions have the **permanent-lost icon**. If a character performs
an action with this icon, when the card is placed in the lost pile, **rotate
it 180 degrees so that it is upside down**. This card cannot be recovered
by any means until the end of the scenario.

## Implications for the schema

### Permanent-lost is a new disposition variant

We have `'lost'` (recoverable) but no way to express **permanent lost**
(unrecoverable). When we encode a card with this icon, two options:

- **(a) New disposition value:**
  ```ts
  type Disposition = 'discard' | 'lost' | 'permanent-lost' | 'persistent-round' | 'persistent-tracked';
  ```
- **(b) Flag on the half:**
  ```ts
  CardHalf {
    disposition: 'discard' | 'lost' | 'persistent-round' | 'persistent-tracked';
    lostPermanent?: boolean;  // only meaningful when disposition is 'lost' or persistent variants
  }
  ```

Option (b) composes more cleanly with the future
[two-field disposition refactor](active-bonuses.md#implications-for-the-schema)
(active-area-duration + final-pile + permanence flag). Lean toward (b) when
the time comes.

Defer until a Bruiser card has it.

### Active-bonus + lost interaction

The rule confirms our [active-bonuses.md](active-bonuses.md) note: a
persistent half with a lost icon stays in the active area until the bonus
expires, then moves to lost. So the disposition data needs to carry both
"this card is in the active area" and "its eventual destination is lost",
as the [two-field refactor sketch](active-bonuses.md) anticipated.

### Items confirm the earlier sketch

The `ItemUsage` sketch in [items.md](items.md) maps cleanly:

| Rule | Sketch |
|---|---|
| Spent icon | `{ kind: 'spent' }` |
| Lost icon | `{ kind: 'lost' }` |
| Permanent-lost icon | `{ kind: 'lost'; permanent: true }` |
| Flip icon | A two-state flip-card model — extend the sketch when we model items |
| No icon | `{ kind: 'passive' }` |
| Use slots | `{ kind: 'multi-use'; uses; thenUsage }` |

### Engine restrictions worth remembering

- **Pre-attack-draw item-use checkpoint.** When resolving an attack, the
  engine must offer the player a chance to use attack-affecting items
  *before* drawing the modifier. Same workflow checkpoint as added/
  conditional effects on the attack itself.
- **Items providing abilities can't be used during another ability.** No
  reentrancy: the engine's ability resolver must check "currently
  resolving an ability" state before allowing item activation.
- **Mandatory use slots and passive effects** with met requirements fire
  automatically — no player choice. Engine state-machine concern.
