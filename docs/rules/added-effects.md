# Added Effects

> Transcribed from the Gloomhaven 2E rulebook.

Added effects are attached to an ability and modify it in some way. Common
added effects like **"Pierce X"**, **"+X Attack"**, or conditions are usually
listed in a highlighted section to the right of the ability. All conditional
effects — those dependent on consuming an element (see p. 21) or paying some
other cost — are listed below the ability in a highlighted section with a
dotted line border.

Added effects can be skipped, but the character must choose to do so before
drawing an attack modifier card. Conditional effects can also be skipped; the
character is not required to pay the cost and, even if they do, they may still
choose not to apply the effect. In the case of a skippable effect attached to
a multi-target attack ability, they may skip the effect on an attack-by-attack
basis, in each case choosing before drawing an attack modifier card, unless
otherwise stated.

More complex added effects might be written below the ability, but **not all
text below an ability is an added effect**. Any text that provides rules for
how the ability is performed (e.g., a targeting restriction) is an inherent
part of the ability, not an added effect, and cannot be skipped.

## Three categories of text on an ability

| Category | Skippable? | Examples |
|---|---|---|
| **Inherent** | No | Targeting restrictions, performance preconditions ("Relocate one adjacent 1-hex obstacle tile to an empty hex within Range 4 to perform:") |
| **Added effect** | Yes (decide before attack modifier draw) | Pierce X, +X Attack, conditions (Stun, Poison, …), bonus EXP, custom riders printed in the right-side cluster or below |
| **Conditional effect** | Yes (skippable independent of paying the cost) | Element-consumption riders (printed below the ability with a dotted-line border) |

## Implications for the schema (current state and todos)

- **Our model already separates these two skippable categories**, but
  implicitly. Inside `AttackModifiers`:
  - `pierce` and (future) condition fields are **added effects**.
  - `elementRiders` are **conditional effects**.

  We may eventually want to make this explicit, e.g.:
  ```ts
  AttackModifiers {
    addedEffects?: AddedEffect[]      // pierce, conditions, +damage, +exp, ...
    conditionalEffects?: ConditionalEffect[]  // element riders, cost-payment riders
  }
  ```
  But not yet — premature until we have more added-effect variety.

- **Skippability is the default for added/conditional effects.** Current
  schema uses `mandatory?: boolean` on each step; absence = skippable. That
  matches the rulebook default. The `!` marker we've encoded (Trample's
  Lost, Eye for an Eye's Leaf, Overwhelming Assault's Wind) flips the
  default to non-skippable for that specific atom.

- **Per-target skip on multi-target attacks.** Engine concern: when we
  resolve a Target X attack, we ask the player about each added effect on a
  per-attack basis, before each attack modifier draw.

- **Inherent preconditions** (e.g. Clear the Way's "Relocate ... to perform:")
  will need a new field on `Ability` — likely `precondition?: Precondition`
  — when we encode a card that has one. Defer until then.

- **Counted bonuses** ("+1 Attack for each hex containing an obstacle or wall
  adjacent to you" — Brutal Momentum) are added effects with a map-state
  multiplier. No encoded card needs this yet; will extend `AmountRef` or
  add a bonus-formula type when we hit one.
