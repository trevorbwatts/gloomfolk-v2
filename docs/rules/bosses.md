# Bosses

> Transcribed from the Gloomhaven 2E rulebook.

Bosses are a special class of monster. They use a **different type of stat
card** and a **special boss ability deck**. Place boss standees in **red
bases** to identify them.

Bosses are **not considered normal or elite**, so they are not affected by
abilities that target those ranks. In addition to providing stats, a
boss's stat card describes its **special abilities**, which are activated
by its ability cards. A boss's stats might refer to **"C," which
represents the number of characters in the scenario**.

If the special abilities of a boss are too complex to fit on its stat
card, the scenario rules will provide more information.

## Boss Stat Card Anatomy

- **Level** — same scenario-level convention as monster stat cards.
- **Boss Name** — e.g. "Bandit Commander."
- **Condition Immunities** — listed at the card's edge, as with normal
  monster stat cards.
- **HP / Move / Attack** stats, with HP often expressed in terms of `C`
  (e.g. `C × 17` ⇒ 17 HP per character in the scenario).
- **Special abilities** numbered (e.g. `1:` and `2:`) and referenced by
  the boss's ability cards.
- **Damage track** — physical bosses have a printed damage tracker on
  the card; software representation just uses an HP integer.

## Implications for the schema

### Boss as a fourth rank

Extend the rank enum:

```ts
type Rank = 'normal' | 'elite' | 'named' | 'boss';
```

- **Targeting filters:** abilities targeting `normal` or `elite` exclude
  bosses, same as named monsters. Encode as a strict equality check on
  rank, never as "anything that isn't elite is normal."
- **Acting order within a multi-rank set:** the rules so far don't
  describe a set that mixes bosses with other ranks. Treat bosses as
  their own set in practice; if a future rule introduces mixed sets,
  revisit the acting-order key.

### `C` parameterization

Boss stats can reference `C`, the character count for the scenario.

```ts
type BossStat =
  | { kind: 'flat'; value: number }
  | { kind: 'per-character'; coefficient: number };  // C × coefficient
```

- **`C` is fixed at scenario start** — it doesn't change if a character
  is exhausted mid-scenario.
- HP is the most common `C`-scaled stat, but movement / attack / range
  could also scale in principle. Encode every numeric field as
  `BossStat` rather than special-casing HP.
- **Special-ability text may also reference `C`** (e.g. "summons C imps").
  Need a templating layer for ability text — keep it simple, e.g. tokens
  like `{C}` resolved at runtime.

### Boss stat card shape

Distinct from monster stat card:

```ts
type BossStatCard = {
  bossId: string;
  name: string;
  levels: Record<MonsterLevel, BossStatBlock>;  // no rank dimension
  immunities: Condition[];
  specialAbilities: BossSpecialAbility[];       // numbered list
};

type BossStatBlock = {
  hp: BossStat;
  movement: BossStat;
  attack: BossStat;
  persistentBonuses: BonusEffect[];
  attackEffects: Effect[];
};

type BossSpecialAbility = {
  index: number;       // 1, 2, ...
  description: string; // may contain {C} tokens
  effects: AbilityStep[];  // when machine-encodable; otherwise null
};
```

- **No `(normal | elite)` split** — bosses are a single stat block per
  level. Don't try to share `MonsterStatCard` with bosses; the shape is
  different enough that union/discrimination is cleaner.

### Special boss ability deck

- **Per-boss deck**, not shared with the boss's "set" of standard
  monsters (a Bandit Commander's deck is not the Bandit Archer deck).
- Boss ability cards reference the stat card's numbered special
  abilities (`1:`, `2:`) instead of repeating the rules text. Encoding:

  ```ts
  type BossAbilityStep =
    | AbilityStep                          // standard steps
    | { kind: 'special'; ref: number };    // resolves card-1, card-2, etc.
  ```

  At resolution time, look up `bossStatCard.specialAbilities[ref]` and
  inline its effects.

- **Deck size** — the rule doesn't quote a number; assume the standard
  8-card deck convention from monster ability cards unless a later rule
  contradicts. Flag for confirmation.

### Special abilities that don't fit on the card

The "scenario rules will provide more information" escape hatch means
some boss behaviors live in scenario data, not the stat card. Schema
should support **scenario-level overrides** of a boss's special-ability
list:

```ts
type ScenarioBossOverride = {
  bossId: string;
  additionalSpecialAbilities?: BossSpecialAbility[];
  replaceSpecialAbilities?: BossSpecialAbility[];
};
```

Most bosses won't need this; a few iconic ones probably will. Don't
optimize for the common case — make the override path exist but unused
by default.

### Engine implications

- **Boss focus / movement / attack rules** are not stated to differ from
  normal monster rules — assume the same focus algorithm,
  movement priority, and re-focus-on-kill behavior apply unless a
  special ability says otherwise. Special abilities are the
  customization vector, not exceptions to the AI core.

- **HP integer at runtime is fine** — the `BossStat` `per-character`
  form resolves to a flat number once `C` is known at scenario setup.
  Persist the resolved value on the figure, but keep the unresolved
  `BossStat` on the stat card so re-deriving for a different
  character count works.

- **Rendering:** red base for bosses (same visual as named monsters per
  the rulebook). Disambiguate in UI by rank label, not base color
  alone.
