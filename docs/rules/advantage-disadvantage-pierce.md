# Advantage, Disadvantage, and Pierce

> Transcribed from the Gloomhaven 2E rulebook.

## Advantage and Disadvantage

Some effects cause an attack to gain advantage or disadvantage. With
**advantage**, the attacker draws two modifiers and uses one of them. A
monster always uses the better one, but a character may use either one. With
**disadvantage**, the attacker draws two modifiers and always uses the worse
one.

### Rolling modifiers under advantage/disadvantage

If the first draw with advantage or disadvantage is a rolling modifier, the
attacker draws additional modifiers, one at a time, until a non-rolling
modifier is drawn. **They then draw one more modifier and ignore any rolling
icon on it.**

The first non-rolling modifier and the one after it are compared:

- **Advantage:** the attacker uses all initial rolling modifiers and whichever
  of the last two modifiers they choose.
- **Disadvantage:** the attacker ignores all initial rolling modifiers and
  uses whichever of the last two modifiers is worse.

If the first draw is not a rolling modifier but the second draw is, the
rolling icon on the second is still ignored.

### Ambiguity rule

When there is ambiguity about which modifier is worse, the attacker must use
the one drawn first. Ambiguity occurs when comparing the non-numeric effects
of some modifiers (e.g., elemental infusions or negative conditions). Any
non-numeric effect is considered to have a **positive but undefined value**.

### Stacking

An attack cannot gain multiple instances of advantage or disadvantage. If an
attack has both advantage and disadvantage, it is considered to have neither.

### Automatic disadvantage

**Any ranged attack on an adjacent enemy automatically gains disadvantage.**

## Pierce

**"Pierce X"** is an added effect that reduces the target's shield bonus
(see p. 29) by X. Multiple `Pierce X` effects can be combined. For example,
if an attack with `Pierce 2` gains `Pierce 3`, the effect would reduce the
target's shield bonus by 5 for that attack.

## Implications for the schema

- **Advantage / disadvantage is engine state**, not card data. Some abilities
  (and conditions like Strengthen / Muddle) grant adv/disadv to attacks. The
  engine tracks per-attack adv/disadv state at resolve time.

- **Auto-disadvantage from ranged-on-adjacent.** Derived rule: engine
  inspects the attack's target/range and the target's distance from the
  attacker. Today's `AttackTarget.kind === 'ranged'` and the attacker–target
  distance check feeds this directly.

- **Pierce stacking is engine arithmetic.** Multiple `pierce` sources sum
  before being subtracted from the target's shield. Today our schema can
  carry pierce in two places — `AttackModifiers.pierce` (printed on the
  card) and `AttackElementRider.pierce` (granted by element consumption).
  When both fire, the engine sums them. Future sources (modifier-card
  added effects, character-state pierce bonuses) sum in the same way.

- **No new schema needed.** All of this is engine resolution logic; the data
  layer just records the printed Pierce values and the abilities that grant
  adv/disadv when we encounter them.
