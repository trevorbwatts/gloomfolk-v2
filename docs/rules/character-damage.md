# Character Damage

> Transcribed from the Gloomhaven 2E rulebook.

When a character would suffer any amount of damage **(after ward is
applied)**, they must either reduce their red hit point dial by that amount
or **negate the damage**. Damage can be negated in two ways:

- **A — Ability or Effect.** The character may use an active ability or
  effect which negates damage.
- **B — Card Loss.** The character may lose **one card of their choice from
  their hand**, or **two cards of their choice from their discard pile**, to
  negate the damage.

Constraints:

- If they have not yet taken their turn, the cards they selected during the
  Card Selection step are not in their hand or discard pile and **therefore
  cannot be lost to negate damage**.
- **Cards in the active area cannot be lost to negate damage.**

**Even if the damage is negated, effects or conditions from the source of
damage are still applied.**

## Implications for the schema

- **No schema changes.** Negation is entirely engine state:
  - Per-character: hand pile, discard pile, active-area pile, and
    *committed-but-not-yet-played* pile (cards selected for the round's
    initiative).
  - The negation workflow checks pile membership before allowing card loss.

- **"Selected cards aren't in hand or discard"** confirms a fourth pile
  concept the engine needs: cards chosen for this round's actions but not
  yet resolved. Today our schema doesn't model state at all (just data) —
  but the engine will need:
  ```
  PlayerState {
    hand:      Card[]
    selected:  [Card, Card] | null    // committed for this round
    active:    ActiveCard[]            // cards in active area with state
    discard:   Card[]
    lost:      Card[]
  }
  ```

- **Ward is applied first**, then negation. So the workflow for incoming
  damage is:
  1. Compute base damage.
  2. Apply ward (halve, rounded down) — ward is consumed.
  3. Player chooses: take damage on dial OR negate (active ability /
     1-card-from-hand / 2-cards-from-discard).
  4. Source's effects/conditions apply regardless of whether step 3
     negated the damage.

- **"Source effects still apply on negation"** is an important engine
  invariant: negation reduces only the *damage*, not the *consequences*.
  Poison from an attack that hits but is negated still poisons. Push from
  an attack that hits but is negated still pushes. Stun from a stun-trap
  that's negated still stuns.
