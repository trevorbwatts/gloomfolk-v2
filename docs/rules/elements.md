# Elements

> Transcribed from the Gloomhaven 2E rulebook.

The six elements are **fire, ice, air, earth, light, dark**.

## Infusion

Some actions have an elemental affinity associated with them. If an elemental
infusion is depicted on an action, when the acting figure performs any part of
that action, they must infuse that element **at the end of their turn**. To
infuse an element, move its token to the **strong** column on the element
board. A figure cannot infuse an element this way unless they perform at least
one of that action's abilities.

## Waning

At the end of every round, all infused elements wane, moving one column to
the left on the element board, from **strong** to **waning** or from
**waning** to **inert**.

## Consumption

Infused elements can be consumed to add effects to certain abilities or, in
some cases, perform new abilities. This is represented by an element icon
marked with a consume mark and followed by the added effect. If that element
is **strong** or **waning**, it can be consumed.

Since infusions don't occur until the end of the turn, any consumed element
must be already strong or waning **at the start of the turn**, prior to any
infusions. To consume an element, move its token to the inert column.

If an ability depicts multiple separate elemental consumptions, the acting
figure chooses which ones to activate. If a single elemental consumption
depicts multiple elements, **all** of those elements must be consumed to
activate it. The same element cannot be consumed multiple times in a single
turn.

If an action depicts elemental consumptions in the **upper-left corner**, all
of those elements must be consumed to perform any part of the action.

## Wild and Mixed

The **wild** icon represents any one of the six elements (but not all of
them). A **mixed** element icon, which depicts two elements within the same
border, represents one of those two elements (but not both of them). When a
wild or mixed element is infused, at the end of their turn, the acting figure
chooses which of those elements to infuse.

## Implications for the schema

- **Element renamed.** `Element = 'leaf' | 'wind'` → `Element = 'fire' | 'ice'
  | 'air' | 'earth' | 'light' | 'dark'`. The previous `'leaf'` is `'earth'`,
  `'wind'` is `'air'`.

- **Multi-element single consumption** (one consume icon, multiple elements)
  isn't expressible today: `AttackElementRider.consume: Element` is a single
  element. When a card needs it, change to
  `consume: Element | { readonly all: readonly Element[] }` or just always an
  array. Defer until a card requires.

- **Action-level required consumption** (upper-left corner) is a `CardHalf`
  property, not an ability rider. When we encode a card with one, add
  `CardHalf.requiredElementCost?: readonly Element[]`. Defer.

- **Wild / mixed element targets** — when a card has them, extend
  `Element` to `Element | { kind: 'wild' } | { kind: 'mixed', options: [E, E] }`,
  or split into `ElementSelector`. Defer.

- **Engine state** (not schema, but relevant): an element board with three
  columns (strong / waning / inert), six tokens. Round end: shift everything
  one column left. Turn end: pending infusions land in strong. Consumption:
  any element in strong or waning, move to inert; same element only once per
  turn.
