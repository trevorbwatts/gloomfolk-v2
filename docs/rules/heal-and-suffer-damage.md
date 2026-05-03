# Heal and Suffer Damage

> Transcribed from the Gloomhaven 2E rulebook.

## Heal

**"Heal X"** is a positive targeted ability that allows the target to heal X
amount of damage, increasing their current hit point value. Characters heal
damage by rotating their red dial. Monsters heal damage by removing damage
tokens from their section of the stat sleeve.

A figure's current hit point value can never exceed their maximum hit point
value, though it is **permitted to heal a figure that is already at their
maximum hit point value** (useful for clearing wound/poison without HP gain).

Heal effects from attack modifier cards function exactly like heal abilities.
If multiple modifiers with heal effects are drawn, they are considered a
single heal ability.

A single heal can remove **both** wound and poison from a figure. However, if
poison is present, the hit point increase is prevented.

## Suffer Damage

Some abilities cause figures to suffer damage without an attack being
performed. **This damage is not modified by anything except ward.** Suffer
damage is **not a targeted ability**.

> Note: in the printed rulebook the Suffer Damage icon is shown as the Loot
> icon by mistake. The creators corrected this in a later document. The
> icon shown alongside the rules text in our copy is wrong; the rule itself
> stands.

## Implications for the schema

- **`heal` step is in the schema and matches the rule.** No change.
  - Max-HP cap, "heal at max HP allowed," and the wound/poison cleanup are
    all engine resolution. Data layer just records the heal amount and target.
  - Heals from modifier cards reuse the same engine path — no special-casing
    in card data.

- **`suffer-damage` is a new ability type** when we encode a card that uses
  it. Distinct from `attack` because:
  - **Not targeted** → no LoS, no range, no target validity check, no
    polarity (it can hit anyone, including self/allies depending on the
    card's wording).
  - **Not modified by attack modifiers, +Attack, advantage, pierce/shield,
    etc.** Only Ward halves it.
  - **No attack-modifier deck draw.**

  When a card needs it:
  ```ts
  | { type: 'suffer-damage'; amount: Amount; target: SufferDamageTarget;
      mandatory?: boolean }
  ```
  with a fresh `SufferDamageTarget` (likely `{ kind: 'self' } | ...`).
  Defer until a card uses it.

- **Heal targeting will need to widen** when a card heals an ally (the
  current `HealTarget` is only `{ kind: 'self' }`). Per the
  [allies-enemies-self rule](allies-enemies-self.md), heal as a positive
  ability targets self or allies; negative-condition removal via heal
  reaches the same target set.
