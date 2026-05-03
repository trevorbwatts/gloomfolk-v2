# Attack

> Transcribed from the Gloomhaven 2E rulebook.

**"Attack X"** is a negative targeted ability that allows a figure to deal a
base amount of X damage to an enemy within the specified range.

An attack with no specified range value is considered a **melee attack with
range 1**, capable of targeting adjacent enemies only, unless otherwise
stated. For example, if an effect provides "+Y Range" to an attack, it would
give the attack with no specified range value "Range 1+Y" and make it a
ranged attack.

## Vocabulary

- **attack** — a single attack performed against one target.
- **attack ability** — an ability that consists of one or more separate
  attacks.
- **attack action** — any action that contains at least one attack ability.

When performing an attack ability with multiple targets, choose targets one
at a time. For example, with "Attack 3, Target 2," choose the first target,
perform the first attack, and then choose a second valid target (if possible).

## Attack Modification Order

When an attack is performed, the base attack value written on the card can
be modified in four different ways in the following order:

1. **All applicable attack bonuses and penalties** (e.g. `±Attack` effects).
   If there are multiple, the *party* chooses the order.
2. **An attack modifier card is drawn** from the attacker's deck and applied.
3. **The target's shield bonus** is applied (see p. 29).
4. **Ward** is applied (see p. 26).

Once all modifications have been applied, the target suffers the resulting
amount of damage. If the target has any abilities or effects which can negate
a source of damage, including losing cards to negate damage (see p. 34), they
may apply them now.

These steps are repeated for each individual target — different targets can
suffer different amounts of damage from the same attack ability.

## Attack Modifier Cards

Any time an attack ability is performed, **a separate attack modifier card is
drawn for each individual target**. The modifier shown on the card is then
applied to the attack, possibly reducing or increasing its value. Once the
effects of a drawn modifier card have been applied, it is placed in its
discard pile.

Attack modifier cards are only drawn for attacks. They are not used for any
other type of effect that deals damage.

Characters each have their own deck, while all monsters share a single deck.
If a scenario includes scenario allies, they all use the separate ally deck.
Characters, monsters, and allies start with a standard deck of:

- 6 × `+0`
- 5 × `-1`
- 5 × `+1`
- 1 × `-2`
- 1 × `+2`
- 1 × `Null` (∅) — attack misses entirely
- 1 × `2x` (Crit) — attack damage doubled

Characters can customize their decks over time through perks (see p. 54).

## Implications for the schema

- **My terminology aligns nicely after the `Section → Ability` rename.**
  - Rulebook **attack action** ≈ our `CardHalf` containing at least one
    `attack` step.
  - Rulebook **attack ability** ≈ our `Ability` (the unit between ability
    lines) containing attack steps.
  - Rulebook **attack** ≈ one resolved attack step against one target.

- **Default melee range = 1** matches our schema: `{ kind: 'melee' }` is
  range 1 implicitly. No change.

- **`+Range` rider** isn't yet expressible. When a card has it, extend
  `AttackModifiers` with `rangeBonus?: number`. The rule confirms that
  applying `+Range` to a melee attack converts it to ranged with `range = 1 + Y`.
  Defer until needed.

- **`±Attack` bonuses and penalties** are step 1 of modifier order. Today our
  `AttackElementRider.attackBonus?: number` produces a `+Attack` (when the
  rider fires). Future schema needs may include flat `+Attack` from upgrades
  or character-state bonuses. Engine handles ordering between multiple
  bonuses (party chooses).

- **The whole modifier deck system is engine state, not card data.** A
  character has an attack modifier deck (initial composition above; perks
  customize later). Drawing/discarding/shuffling on Null/Crit is engine
  logic.

- **Pierce** (already in `AttackModifiers`) interacts with the target's
  Shield (step 3 of modifier order) — pierce reduces incoming shield by
  Pierce X before the shield reduces damage. Engine concern.

- **Ward** is new vocabulary. Will need to be modeled when we hit a card or
  monster effect that grants/applies Ward. Likely a target-state condition.

- **Damage negation via losing cards** ("losing cards to negate damage") —
  engine state, not card data. Each character can lose cards from hand to
  prevent damage; tracked in player state.
