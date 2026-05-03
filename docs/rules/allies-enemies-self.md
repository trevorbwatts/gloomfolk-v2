# Allies, Enemies, and Self

> Transcribed from the Gloomhaven 2E rulebook.

Characters are allies to other characters, monsters are allies to other
monsters, and characters and monsters are enemies of each other. **Figures are
not their own allies.**

In general, negative abilities can only target enemies, and positive abilities
can only target allies or the acting figure themselves. Some abilities have
specific targeting information that contradicts this rule. An ability
specifying its targets as "all" follows these restrictions, but an ability
specifying its targets as "all figures" targets both allies and enemies.

If any ability specifies its target as "self," the effect can only be applied
to the acting figure.

## Implications for the schema (notes for later)

- **Polarity is implicit per ability type.** Today's mapping:
  - **Negative** (targets enemies): `attack`, `retaliate` (effect on attacker).
  - **Positive** (targets allies/self): `heal`, `shield`.
  - **Self-only or non-targeted**: `move`, `create-element`, `loot`, `gain-exp`.
  We don't currently store polarity as data — the engine can infer from
  ability type. Revisit if a card has an ability whose polarity contradicts
  its type (e.g. an attack that targets allies for some special interaction).

- **"all" vs "all figures" targets.** When a card has these, we'll add
  `{ kind: 'all-in-range' }` and `{ kind: 'all-figures-in-range' }` (or
  similar) variants to `AttackTarget` / `HealTarget`. Polarity rules are
  still applied — "all" filters by polarity, "all figures" overrides.

- **`HealTarget` will need to grow.** Currently only `{ kind: 'self' }`.
  Will need at least `{ kind: 'ally', range: number }` when a card heals
  someone else.
