# Battle Goals

> Transcribed from the Gloomhaven 2E rulebook.

Battle goals provide an additional challenge in a scenario for characters
to complete.

## Setup

- **At the start of every scenario**, each character receives **three
  battle goal cards in secret** and chooses **one to keep**, discarding
  the other two face down.
- Characters should **keep their battle goals secret** from one another
  until the scenario is over.

## Reward

If the scenario is completed and the character meets the criteria of the
chosen card, they gain the number of **checkmarks** specified at the
bottom of the card.

- For every set of **three checkmarks**, a character gains a **perk mark**
  (see p. 54).
- Maximum of **six extra perk marks** for **18 checkmarks**.
- If the scenario is **lost**, the character receives **nothing** from
  their battle goal — regardless of whether the goal was achieved.

## Battle goal card features

- **A — Thematic title.**
- **B — Details for how the goal can be achieved.**
- **C — Number of checkmarks** gained after achieving the goal while also
  completing the scenario.

Example card — *Executioner*: "Kill an undamaged enemy with a single
attack action." (1 checkmark)

## Implications for the schema (notes for later)

```ts
interface BattleGoal {
  id: number;             // reference number
  title: string;
  description: string;
  checkmarks: number;     // typically 1–2
}

interface CharacterBattleGoalState {
  characterId: string;
  scenarioId: string;
  chosenGoalId: number;   // secret to other players
  achieved?: boolean;     // resolved at scenario end
}

// Lifetime totals on the character:
interface CharacterProgress {
  battleGoalCheckmarks: number;     // accumulating count
  extraPerkMarksFromGoals: number;  // = min(6, floor(checkmarks / 3))
}
```

Engine concerns:
- **Secret deal at scenario start.** Each character is dealt 3, picks 1,
  discards 2 — server must keep the discards (and the kept choice)
  hidden from other players until scenario end.
- **Achievement check at scenario end.** Some goals are mechanical
  (kill counts, conditions applied, hex states) and could be verified
  automatically; others are interpretive. Treat as player-claimed with
  optional rule hooks for the easy ones.
- **Reward gating on scenario success.** Lost scenarios grant zero
  checkmarks. Tie reward grant to the same success path that awards
  bonus experience.
- **Perk-mark conversion.** Maintain running checkmark total per
  character; derive `min(6, floor(total / 3))` extra perk marks from
  battle goals (capped). This is *in addition to* perk marks earned
  through normal leveling.
