# Mandatory Triggers, Experience, End-of-Turn Looting

> Transcribed from the Gloomhaven 2E rulebook.

## Mandatory Triggers

If any part of an action is performed, certain abilities and effects of that
action cannot be skipped. In such cases, the ability or effect is highlighted
in a box with an "!" in front of it. These include:

- **A — Negative Abilities.** The indicated ability creates a negative effect
  for the character or their allies.
- **B — Elemental Infusions.** The indicated elements must be infused at the
  end of the turn.
- **C — Experience.** The character must gain the indicated amount of
  experience.
- **D — Active Icons.** The card must be placed in the character's active
  area.
- **E — Lost Icons.** The card must be lost.

Additionally, **if you choose to perform a non-mandatory ability, you must
perform the entirety of the ability.** The exceptions to this are:

- **Targeting** — you do not have to target the maximum possible number of
  targets.
- **Added effects** — you may choose not to apply them.

> **Example (non-mandatory ability):** The Cragheart performs the bottom
> action of *Crushing Grasp* to create an obstacle. Because they created the
> obstacle, the remainder of the ability must be performed, requiring all
> allies and enemies adjacent to the tile to suffer 1 damage.

## Experience

Experience measures a character's growth and defines when they level up.
When an action depicts an experience icon in the lower right corner, **if
any part of that action is performed**, the character gains the indicated
amount of experience. Experience that a character gains during a scenario
is tracked on their blue experience dial.

Sometimes an ability specifies that experience is only gained under certain
conditions, such as **consuming an element**, **meeting a requirement**, or
**advancing a character token past an experience icon between use slots**.

Characters do not automatically gain experience by killing monsters; they
must perform specific abilities during a scenario to do so.

## End-of-Turn Looting

Characters must loot any money tokens or treasure tiles present in their hex
**at the end of their turn**. No figures beside characters perform end-of-
turn looting.

## Implications for the schema

### Mandatory triggers — vocabulary lock-in

The five categories with `!` clarify which atoms our schema's
`mandatory?: boolean` flag actually applies to:

| Category | Where it lands in our schema |
|---|---|
| Negative Abilities (`!`-marked sub-ability that hurts allies/enemies) | An `Ability` (section)-level mandatory flag — *new*, see below |
| Elemental Infusions | `create-element.mandatory` (already used: Eye for an Eye's `'earth'`, Overwhelming Assault's `'air'`) |
| Experience | A new `expOnPerformMandatory?: boolean` flag on `CardHalf`, or implicit since `expOnPerform` is automatic; defer encoding the flag until a card distinguishes |
| Active Icons | Disposition-cluster mandatory; implicit in our model since dispositions auto-fire |
| Lost Icons | Disposition-cluster mandatory; implicit |

- **Today's encoded `mandatory: true` cases match category B** (mandatory
  element infusions). Good.

- **Category A is new — section-level mandatory.** Stone Pummel's example
  shows a non-mandatory ability ("Create one 1-hex obstacle tile in an
  adjacent empty hex. All allies and enemies adjacent to the created tile
  suffer 1 damage.") and elsewhere a `!`-flagged version where the same
  effect is mandatory. When we encode such a card, we'll add
  `Ability.mandatory?: boolean` (separate from the per-step flag).

### "If you perform a non-mandatory ability, you must perform the entirety"

Sharpens our model:

- **Abilities** (sections) are skippable as whole units. ✓
- **Once an ability is engaged, all its steps must be performed**, EXCEPT:
  - Target counts may be less than max.
  - Added effects (pierce, conditions, +damage riders, etc.) may be skipped.
- The `!` marker on a specific atom flips that atom from skippable to
  mandatory.

So "main" steps (Attack, Move, Heal, Shield, Retaliate, Loot, Push, Pull,
Manipulate-Tile, Suffer-Damage, Recover, Command) are inherently mandatory
once the ability is chosen. The per-step `mandatory?` flag in our schema is
really only meaningful for **added-effect-style steps**:

- `create-element` (skip the infusion unless `!`)
- `gain-exp` with conditional triggers (skip unless `!`)
- Future: `apply-condition`, push/pull as added effects, `+damage` riders

For "main" steps the field is harmless but semantically a no-op. Fine to
leave as-is for uniformity.

### Experience

- **`expOnPerform`** matches the rulebook ("if any part of the action is
  performed"). Already in the schema.
- **Conditional EXP triggers** are partially modeled via `gain-exp.trigger`
  (`per-enemy-targeted`, `on-next-retaliate-this-round`). The rulebook adds
  two more conditions:
  - "Consuming an element" — already covered via `AttackElementRider.gainExp`.
  - "Advancing a token past an EXP icon between use slots" — defer until
    we encode a persistent-tracked card.
- **No auto-EXP for kills.** Engine rule, not data.

### End-of-Turn Looting

- **Engine state.** End of every character turn, the engine auto-loots
  money/treasure in the character's hex. No data implications.
