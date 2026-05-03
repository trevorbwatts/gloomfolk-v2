# Attack Modifier Cards and Attack Effects

> Transcribed from the Gloomhaven 2E rulebook. Continuation of [attack.md](attack.md).

## Attack Modifier Card Features

Each attack modifier card can have the following:

- **A — Modifier Value.** Modifies the attack value. The `∅` modifier reduces
  the final attack value to zero. The `2x` modifier doubles the current
  attack value.
- **B — Added Effects.** Some modifiers have elemental infusions, conditions,
  or other added effects. When activated, these added effects function
  exactly as if written on the attack ability.
- **C — Rolling Icon.** When a rolling modifier is drawn, the attacker draws
  additional modifiers, one at a time, until a non-rolling modifier is
  drawn. The drawn modifiers can then be applied in any order.
- **D — Bless / Curse Border.** Bless and curse cards are returned to the
  supply once resolved, instead of placed in the discard pile. Every curse
  card has a `*` or `M` icon to indicate whether it is used in character/
  ally decks or the monster deck.
- **E — Shuffle Icon.** At the end of the round in which a modifier with the
  shuffle icon is drawn, the discard pile is shuffled back into the deck.
  The shuffle is performed immediately if the deck is empty when a modifier
  must be drawn.
- **F — Sorting Icon.** All standard modifiers have a `1`, `2`, `3`, `4`,
  `A`, or `M` icon for easy sorting. Modifiers added to a character deck
  through perks have their class icon. Modifiers added by another effect
  have the `*` icon.

## Attack Effects

An **attack effect** is an effect attached to an attack. Effects are applied
either during damage resolution or after the attack resolves. If applied
after the attack resolves, the attack effect is still applied even if the
attack deals no damage (including due to a `∅` card).

The attacker must choose whether to apply any attack effects **before they
draw an attack modifier card**. All attack effects except `+X Target` are
applied **before any retaliate bonus**. The `+X Target` effect allows the
attacker to perform additional attacks, and each attack must be resolved
completely before another can be performed.

### Timing of Attack Effects

| Effect | Timing |
|---|---|
| `+X Attack` (p. 23) | during damage resolution (must be applied) |
| `Pierce` (p. 25) | during damage resolution |
| `+X Target` (p. 19) | after the attack resolves |
| Conditions (p. 26) | after the attack resolves |
| Forced Movement (p. 30) | after the attack resolves |
| Other Added Effects (written below the attack) | after the attack resolves |
| Elemental Infusions (p. 21) | at the end of the turn |

Some attacks have abilities (e.g., heal abilities) that aren't attack
effects but are still attached to the attack. These abilities are performed
**after the attack is resolved completely** (including after any retaliate
bonus).

Some modifiers have added effects, besides modifying the attack value, and
**an attacking character can always choose whether to apply those effects
after the modifier is drawn**. If another figure uses a character's deck,
the character controls the added effects of the modifier even though the
attacking figure applies them.

Modifiers that affect a character's class-specific resources or abilities
are always applied to that character, no matter who draws the modifier.
Modifiers that specifically target a character's own summons do so no
matter who draws the modifier.

## Implications for the schema

- **Attack effect timing is engine state.** Schema gives the engine *what*
  applies; the timing table tells the engine *when* to apply each kind. We
  don't need to encode timing in the data — the engine resolves it from the
  effect's type:
  - `attackBonus` (from element riders) → during damage resolution
  - `pierce` → during damage resolution
  - Future: `targetsBonus`, `conditions`, `forcedMovement` → after attack resolves
  - `create-element` step that follows an attack → at end of turn

- **"Choose attack effects before modifier draw."** Engine workflow per
  attack: (1) ask player which added/conditional effects to apply, (2) draw
  modifier, (3) ask player about modifier's added effects, (4) resolve
  damage with all bonuses, (5) apply post-resolution effects, (6) apply any
  attached non-attack-effect abilities like heals.

- **Modifier deck contents** (perks, bless/curse, shuffle, rolling, ∅, 2×)
  are entirely engine concerns. Will need its own data model when we get
  there: `AttackModifierCard` discriminated union with value/effects/flags.

- **Added effects on modifier cards** ("function exactly as if written on
  the attack ability") suggests the engine should reuse the same
  `AbilityStep`/`AttackModifiers` resolution path for modifier-added
  effects. Worth keeping in mind when designing the engine.

- **Class-specific modifier targeting** (always goes to drawing character)
  is irrelevant to card data — applies to perks/persona, engine state.

- **Heals attached to an attack are NOT attack effects.** They resolve
  *after* the attack (including retaliate). In our schema today, an attack
  step and a heal step in the same `Ability` are sibling steps. The engine
  should resolve them in printed order, but with the understanding that a
  heal-after-attack waits for retaliate. Worth flagging when we encode a
  card with that pattern.
