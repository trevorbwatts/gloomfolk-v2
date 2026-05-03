# Target

> Transcribed from the Gloomhaven 2E rulebook.

Abilities accompanied by **"Target X"** allow the acting figure to target up to
X different figures within the ability's range. Targeting and range
restrictions, as well as additional effects of the ability, apply to all
targets. It is not possible to target the same figure multiple times with the
same ability, unless otherwise stated.

If no target is specified on a targeted ability, the target value is 1, which
means it only targets a single figure. For example, if an effect provides
"+1 Target," it would give an ability with no specified target value
"Target 2."

> Attack (p. 23), conditions (p. 26), heal (p. 27), forced movement (p. 30),
> commanding figures (p. 31), and manipulating tiles (p. 31) are the only
> targeted abilities. Targeted abilities cannot be performed if there is no
> valid target.

## Implications for the schema (notes for later)

- **Default target count is 1.** When a card prints "Target X" we'll add a
  `targets?: number` field. Likely scope: `attack` and (eventually) `heal`,
  forced-movement, condition-application, and tile-manipulation steps. AOE is
  orthogonal — it's about *shape*, not *count* — so the two coexist on
  different fields.
- **"+1 Target" effect.** Will surface as a bonus on an upgrade node, an
  element rider, or a similar conditional. Add `targetsBonus?: number` to
  `AttackModifiers` (and `AttackElementRider`) when needed.
- **Canonical list of targeted ability types** for engine logic (LoS / range
  / "must have valid target" checks): attack, conditions, heal, forced
  movement, commanding figures, manipulating tiles. Today's schema has
  `attack` and `heal`; the rest will be added as cards introduce them.
- **"No valid target → ability cannot be performed"** is an engine rule.
  Combined with the "abilities can be skipped unless mandatory" rule, this
  means a non-mandatory targeted ability with no valid target is simply
  skipped without forcing the player to abandon the surrounding action.
