# Conditional Triggers

> Transcribed from the Gloomhaven 2E rulebook.

Some abilities or effects can only occur if something else happens first.
These conditional effects are structured as **"Apply effect A to apply effect
B."** Effect A must be applied for effect B to be applied. If effect A is
applied, the acting figure can choose whether or not to apply effect B.

## Implications for the schema (notes for later)

- **Element riders are already this pattern.** Our `AttackElementRider`
  (`{ consume, attackBonus?, pierce?, gainExp? }`) implements "Apply effect A
  (consume the element) to apply effect B (the bundled bonuses)." The rule
  confirms B is optional even after A is applied — i.e., the player can pay
  the element and still choose not to apply some/all of the bonuses. This
  matches the Added Effects rule (conditional effects are skippable
  independent of paying the cost).

- **Deferred EXP triggers** (e.g. Eye for an Eye's "Gain 1 EXP the next time
  you retaliate this round") are *also* conditional triggers — A = "you
  retaliate this round," B = "gain 1 EXP." Modeled today as
  `{ type: 'gain-exp', trigger: { kind: 'on-next-retaliate-this-round' } }`.

- **General "do X to do Y" patterns** beyond elements and EXP will arrive
  eventually (e.g. a card with "If you attacked this turn, you may move 2"
  or similar). When they do, we'll likely add a `ConditionalEffect` wrapper
  ability step:
  ```ts
  | { type: 'when', cause: ConditionalCause, effects: AbilityStep[] }
  ```
  Premature to add until we encode a card that needs it.
