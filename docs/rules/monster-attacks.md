# Monster Attacks

> Transcribed from the Gloomhaven 2E rulebook. Pairs with
> [monster-focus.md](monster-focus.md) and
> [monster-movement.md](monster-movement.md).

A monster only attacks on its turn if **"Attack ± X"** is listed on its
ability card. This attack ability allows the monster to attack using its
**base attack stat** (found on its stat card) modified by `X` (either
positive or negative). The **range** of the attack is specified on the
ability card. **If no range is specified, it is a melee attack.** If a
monster lists multiple targets as an attack effect on its stat card, the
number of targets can be modified by **"± Target X"** effects.

A monster only attacks its **focus** (or foci in the case of multiple
targets). When its ability card lists multiple attack abilities, a monster
**can perform all of those attacks on a single focus**. If a monster
**kills or exhausts its focus and still has attacks remaining, it will use
the focus rules to find a new focus**.

> *Example: The elite Vermling Priest has 3 movement points, but only
> needs 1 to perform its Range 3 attack on either the Cragheart or the
> Mindthief. So the Vermling Priest moves one hex closer and attacks the
> Cragheart, who acts earlier in the initiative order.*

## Implications for the schema

### Attack value composition

Final attack damage is computed by summing modifiers from three layers:

1. **Base attack** — `monster.statBlock.attack` (from stat card, indexed
   by `(level, rank)`).
2. **Card modifier** — the `± X` on the ability card's `Attack` step.
3. **Persistent / situational bonuses** — anything from
   `statBlock.persistentBonuses` or active conditions.

Then attack-modifier deck draw applies on top per the standard attack
flow (handled elsewhere).

### Target count composition

Mirrors attack value:

1. **Base targets** — default `1`, or whatever the stat card's "multiple
   targets" attack effect specifies.
2. **Card modifier** — `± Target X` on the ability card.

The result is the number of foci to resolve (1 primary + N additional).

### Range

- Range omitted on the ability card ⇒ **melee** (effectively `range 1`,
  must be adjacent, no LOS rule beyond adjacency).
- Range present ⇒ **ranged**, subject to LOS at the moment of attack and
  to the disadvantage-when-adjacent rule from the movement section.
- The ability card's range *replaces* any range concept on the stat card;
  monster stat cards don't carry a "default range" — every attack's range
  comes from the card.

### Multi-attack ability cards

Some ability cards list more than one `Attack` step. Key rules:

- **All attacks on a single focus is permitted.** The engine should not
  force the monster to pick different focuses across the multiple attack
  steps; each step uses the focus determined at the start of the turn
  unless that focus has been killed/exhausted.
- **Re-focus on death/exhaustion mid-turn.** If the focus dies (HP ≤ 0)
  or is exhausted (character-side condition) and attacks remain, run
  `determineFocus` again *from the monster's current position* with the
  surviving enemies. The new focus may differ from the original, and may
  imply that the monster should have moved differently — but **the
  monster does not get to redo its movement**. The movement step is
  spent; attacks resolve from wherever the monster ended up.

### Engine implications

- **Suggested API:**

  ```ts
  type AttackResolution = {
    targets: { figureId: FigureId; damage: number; effects: Effect[] }[];
    refocusedDuring: boolean;  // true if focus died mid-turn
  };

  function resolveAttacks(
    monster: MonsterFigure,
    abilityCard: MonsterAbilityCard,
    initialFocus: FocusResult,
    board: BoardState,
  ): AttackResolution;
  ```

- **Ability card steps must preserve order.** The card lists abilities
  top-to-bottom and they resolve in that order. Multi-attack handling
  iterates through the `Attack` steps, with non-attack steps (e.g. heal,
  move-2) interleaved as written. Re-focus only fires between *attack*
  steps; an interleaved heal does not trigger a re-focus check.

- **Multi-target attacks consume one ability step, not N.** If the card
  has `Attack +0, Target +1` as a single step, that step resolves once
  against `1 + 1 = 2` foci. A separate `Attack +0` step on the same card
  would be a *second* ability step that re-resolves against the focus
  (or new focus if the prior one died).

- **"Cannot attack" reasons.** An attack step is *skipped* (not retried)
  when:
  - Monster has no valid focus and cannot acquire one.
  - Monster has the **disarm** condition.
  - Monster is at a position with no LOS / out of range to the focus
    (rare given focus accounts for this — usually only after a forced
    movement or focus death).

  Skipped attack steps don't refund movement or trigger ability-card
  changes.

- **Persistent bonuses can include attack effects** (per stat card
  field `H`). Those layer onto every attack the monster performs —
  encode them as decorators applied during `resolveAttacks` rather than
  baked into the card data. Same for conditions like `strengthen` /
  `muddle` granted to/by the monster.

- **The attack itself uses the standard attack pipeline** (modifier
  deck, advantage/disadvantage, pierce, shield, retaliate, etc.). This
  module is responsible for *target selection and attack value
  composition*; downstream attack resolution is shared with character
  attacks.
