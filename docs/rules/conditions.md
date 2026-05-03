# Conditions

> Transcribed from the Gloomhaven 2E rulebook.

A **condition ability** is a positive or negative targeted ability, depending
on the specified condition, and causes the target of the ability to gain that
condition.

When a monster gains a condition — except bless or curse — place the matching
token on its stat sleeve in the section corresponding to the number on its
standee. When a character gains a condition — except bless or curse — place
the matching token on their character mat. Once gained, a condition remains
until the requirements for its removal are met. **Neither positive nor
negative conditions can be removed voluntarily.**

A figure cannot have multiple instances of the same condition; however, if a
figure gains a condition they already have, the effect's duration **resets**.

If a figure gains a condition during their turn that is removed "at the end
of the figure's next turn," the condition goes into effect immediately and
applies until the end of their next turn. Conditions which are removed at
the end of a figure's turn are only removed **after all other end-of-turn
effects are resolved**.

A condition effect can also be added to other abilities as an added effect,
causing all targets of the ability to gain that condition after its main
effect is resolved. If the ability is an attack, the target gains the
condition even if the attack dealt no damage, but they do not gain the
condition if the attack killed or exhausted them, or if they are immune.
Only bless and curse may be added to abilities that already have the same
condition; abilities may not have more than one instance of any other
condition.

## Positive Conditions

- **Safeguard.** The next time the figure would gain one or more negative
  conditions, prevent one of the conditions, and safeguard is then removed.
  Players may choose which condition to prevent if there is more than one,
  including when safeguard is on a monster. Safeguard can prevent a figure
  from adding a curse card to their deck, but does not prevent a drawn
  curse card from taking effect.

- **Ward.** The next time the figure suffers damage from any source, they
  instead suffer half that amount of damage (rounded down), and ward is
  then removed.

- **Invisible.** The figure cannot be focused on or targeted by any enemy,
  though non-targeted abilities remain unaffected. The figure and their
  allies can still interact with each other. Invisible is removed at the
  end of the figure's next turn. Enemies treat figures with invisible as
  if they were not there; they can move through figures with invisible
  but still cannot end their movement in the same hex.

- **Strengthen.** The figure gains advantage on all of their attacks.
  Strengthen is removed at the end of the figure's next turn.

- **Bless.** The figure must shuffle a bless card into their attack modifier
  deck. If the figure does not use an attack modifier deck, bless has no
  effect. When a bless card is drawn, it acts as a `2x` modifier and is
  returned to the supply once resolved, instead of placed in the discard
  pile. There are 10 bless cards total, which can be added to any deck. If
  there are no bless cards available, bless has no effect.

## Negative Conditions

- **Wound.** The figure suffers 1 damage at the start of each of their turns.
  Wound is removed when the figure is healed.

- **Poison.** All attacks targeting the figure gain `+1 Attack`. Poison is
  removed when the figure is healed but, unlike wound, **poison prevents the
  heal from increasing the figure's current hit point value.**

- **Immobilize.** The figure cannot perform any move abilities. Immobilize is
  removed at the end of the figure's next turn.

- **Disarm.** The figure cannot perform any attack abilities. Disarm is
  removed at the end of the figure's next turn.

- **Stun.** The figure cannot perform any abilities or use or trigger any
  items, but bonuses previously gained are still active. Stun is removed at
  the end of the figure's next turn. At the start of the round, stunned
  characters still must select two cards to play (or declare a long rest),
  but the cards will be discarded with no effect if stun is not removed by
  some other means before the end of their turn. Long resting still occurs
  normally for stunned characters.

- **Muddle.** The figure gains disadvantage on all of their attacks. Muddle
  is removed at the end of the figure's next turn.

- **Curse.** The figure must shuffle a curse card into their attack modifier
  deck. If the figure does not use an attack modifier deck, curse has no
  effect. When a curse card is drawn, it acts as a `∅` modifier and is
  returned to the supply once resolved, instead of placed in the discard
  pile. There are 10 curse cards with the `*` icon, which can only be added
  to character and ally decks, and 10 curse cards with the `M` icon, which
  can only be added to the monster deck. If there are no applicable curse
  cards available, curse has no effect. Immunity to curse prevents a figure
  from adding a curse card to their deck, but does not prevent a drawn
  curse card from taking effect.

## Implications for the schema

- **New `AbilityStep` variant when needed:**
  ```ts
  | { type: 'apply-condition'; condition: Condition; mandatory?: boolean }
  ```
  with a growing `Condition` enum. Defer until a card needs it (Shield Bash's
  Stun will be the first when we encode it).

- **Full condition vocabulary:**
  - **Positive:** `safeguard`, `ward`, `invisible`, `strengthen`, `bless`.
  - **Negative:** `wound`, `poison`, `immobilize`, `disarm`, `stun`, `muddle`,
    `curse`.

  Probably worth splitting the type:
  ```ts
  type PositiveCondition = 'safeguard' | 'ward' | 'invisible' | 'strengthen' | 'bless';
  type NegativeCondition = 'wound' | 'poison' | 'immobilize' | 'disarm' | 'stun' | 'muddle' | 'curse';
  type Condition = PositiveCondition | NegativeCondition;
  ```
  The split lets the targeting/polarity rule (positive → allies/self,
  negative → enemies) be a type-level constraint at the boundary.

- **Conditions as added effects on attacks** — when an attack carries a
  condition, schema-wise this is a sibling step in the same ability:
  ```
  Ability { steps: [Attack 4, ApplyCondition Stun] }
  ```
  Per the [added-effects rule](added-effects.md), the condition is a *post-
  resolution* attack effect. The engine uses step type to know it applies
  after damage resolution, and to decide whether to apply it (skipped if
  attack killed/exhausted target, or target is immune).

- **Engine state for active conditions.** Each figure has a condition table:
  `Map<Condition, ConditionState>` where `ConditionState` carries duration
  / charge / "next time" trigger info. Not card data.

- **Bless / Curse** insert cards into the modifier deck rather than placing
  tokens. Different mechanism — the engine handles them through the
  modifier-deck data path, not the condition table.

- **Strengthen → advantage source. Muddle → disadvantage source.** Symmetric;
  the engine's adv/disadv tracker needs both flags per figure at attack time.

- **Invisible affects targeting/LoS-style checks.** Engine inspects target's
  Invisible state when validating attack targets (and similar negative
  targeted abilities).

- **Action gating from negative conditions.** Several conditions block whole
  ability categories:
  - **Immobilize** → cannot perform `move` abilities (any ability containing
    a `move` step? or only abilities that are pure-move? rulebook says "move
    abilities" — needs clarification when we engine-test).
  - **Disarm** → cannot perform `attack` abilities (same question).
  - **Stun** → cannot perform any abilities; cards still selected at round
    start but discarded with no effect (long rest still works).

  These gate at *ability execution* time. The engine checks the figure's
  condition state before resolving each ability. Doesn't affect schema —
  the data already says which steps are moves/attacks.

- **Wound and Poison ignore the "end of next turn" pattern** — they persist
  until the figure is healed. Engine's condition state needs both
  duration-based and removal-trigger-based clocks.

- **Poison's heal-without-HP-gain interaction** is engine logic on the
  `heal` step: while target is poisoned, the heal removes poison but does
  not raise current HP. Schema-side, no change.
