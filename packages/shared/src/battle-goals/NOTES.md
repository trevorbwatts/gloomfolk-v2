# Battle Goals — implementation notes

Status: **card definitions complete (58 cards), engine wiring not started.**

The cards in `goals.ts` are pure trackers (`init` / `reduce` / `isAchieved`)
that fold a global stream of `BattleGoalEvent`s. Nothing emits those events
yet — that's the wiring phase. This file captures decisions made while writing
the trackers so they aren't lost before wiring, plus the contract the engine
must honor when it starts emitting events.

See `docs/rules/battle-goals.md` for the rulebook text.

---

## How the model works (quick orientation)

- **One global event stream.** Every tracker sees every event. A tracker tells
  its own actions from allies'/enemies' by comparing the event's actor id to
  `ctx.ownerCharacterId` (the reduce context). So the engine does **not** need
  to route events per-character — it broadcasts.
- **`isAchieved` runs at scenario end**, and only matters if the scenario was
  **won** (a lost scenario grants zero checkmarks, per the rules). It receives
  a `BattleGoalEvaluationContext` with cross-character / scenario-wide data for
  comparative goals.
- **Checkmarks may be a function** of the eval context (Recluse scales with
  party size). Resolve with `resolveCheckmarks(goal, ctx)`.

---

## Event-emission contract (engine must honor these)

Ordering and semantics the trackers rely on:

1. **`round_start` fires before any figure acts** that round; trackers reset
   per-round accumulators on it. `round` is assumed **1-indexed** (first round
   is 1) — Prepper depends on this.
2. **`turn_start` fires at the start of every figure's turn** (`characterId`
   null for non-character turns). Resetting per-turn accumulators on every
   `turn_start` bounds them to one turn, since only one figure is active at a
   time.
3. **A character's `rest` event fires before that rest's own `card_lost`.**
   Daredevil counts cards lost *before* the first rest, and must not count the
   card the first rest itself loses.
4. **`damage_suffered` means HP was actually lost** (not negated). Negated
   damage emits `damage_negated` instead. The two are mutually exclusive for a
   given hit.
5. **`enemy_killed` is the rich kill record.** It must carry, computed at the
   moment of death: `killerCharacterId` (null for trap/hazard/condition kills),
   `targetNegativeConditions`, `byAttack`, `overkill`, `targetWasUndamaged`,
   `attackAdvantage`, `targetRank`, `targetDefId`, `droppedLootTokenId`,
   `elementsStrongOrWaning`, `targetAdjacentToKiller`,
   `killerAdjacentToOtherEnemy`, `targetHadTakenTurn`.
6. **Positional snapshots are engine-computed**, since trackers have no map:
   `round_end_position` (door hex, adjacent enemy count) and
   `turn_end_position` (adjacent character count, adjacent to
   wall/obstacle/objective). Emitted only for characters present on the board
   (exhausted = no snapshot).
7. **`scenario_end_piles` fires once per character at scenario end** (before
   `isAchieved` runs) with final hand/discard counts.
8. **Loot tokens have identity** (`tokenIds` on `loot_collected`,
   `droppedLootTokenId` on `enemy_killed`) so Mugger can link a looted token to
   the enemy that dropped it. `loot_collected.source` distinguishes mandatory
   end-of-turn looting from a Loot ability.

---

## Per-card interpretive assumptions (flagged with the user)

These are judgment calls where the card text was ambiguous. Easy to flip — each
lives in one tracker.

- **Accountant / Sleeper / Promoter / Pauper / Scrambler / Straggler /
  Conservator / Pedestrian / Diehard / Peacemonger / Plebeian / Prohibitionist
  / Duelist / Miser / Specialist / Vanguard / Wallflower / Dawdler** — all
  "never" goals are **vacuously satisfied** if the triggering thing never
  happens (e.g. never resting satisfies Accountant).

- **Acrobat / Wastrel** — "lose a card to negate" counts **either** card-loss
  method (1 from hand or 2 from discard), but **not** active-ability negation.

- **Ascetic / Egoist** — comparative loot is **strict** (ties don't qualify).
  Solo play is vacuously achieved.

- **Assistant** — the ally's attack must precede the kill **in the same round**;
  any owner-credited kill counts (not only an attack). Owner's own earlier
  attacks don't satisfy the "ally" part.

- **Bully** — curse can't count toward "two negative conditions" (it lives in
  the modifier deck, not on the figure).

- **Closer / Opener** — Closer can't latch (a later death supersedes); Opener
  latches on the first death.

- **Masochist** — must be **alive** at ≤3 HP; an exhausted character (HP 0 or
  card-exhausted) does **not** qualify even though HP ≤ 3.

- **Optimist** — only **owner-caused** condition removals count (a heal or a
  remove-condition ability); automatic end-of-turn expiry does not. Each
  condition removed counts once (so one heal clearing wound+poison = 2).

- **Promoter** — "ally" = a friendly character **other than self**; self-target
  doesn't count. Each rest is a checkpoint; the segment *after* the last rest
  is not checked.

- **Hunter / Recluse** — "four players" keyed off **character count**
  (`allCharacterIds.length`), which equals player count in this game.

- **Duelist** — read **literally**: once adjacent to an enemy, *any* voluntary
  exit of that hex violates (even moving to another enemy-adjacent hex). Only
  forced movement is exempt.

- **Miser** — the card states **no** forced-movement exception, so any room
  exit while loot remains violates (the event carries a `forced` flag if we
  decide to exempt it later).

- **Slowpoke** — only the owner's **own (non-forced)** movement counts toward
  the 2-hex cap; being pushed/pulled doesn't.

- **Sadist** — card text arrived as "Kill **have** or more enemies" (typo);
  assumed **five**. **Unconfirmed — verify the number.**

- **Streamliner / Zealot** — "hand and discard pile" excludes active and lost
  piles.

---

## Open questions / loose ends

- **Sadist threshold** is a guess (5). Confirm.
- **`item_used.isPotion`** now mirrors the `Item.isPotion` tag added to
  `items/types.ts`; the three potions are tagged. New potions must set it.
- **Context field naming wart:** the reduce context uses `ownerCharacterId`
  while `BattleGoalEvaluationContext` uses `characterId`. Harmless but
  inconsistent; align in a cleanup pass.
- **"Basic action" detection** (Specialist) relies on the engine flagging when
  a card is used for its basic `Attack 2` / `Move 2` (the `ability_performed.
  basic` flag). `BASIC_ATTACK_2` / `BASIC_MOVE_2` constants live in
  `cards/basics.ts`.

---

## Wiring status (as of the integration pass)

**Built and live:**
- Deal-3-keep-1 secret flow: `Room.battleGoalHands`, dealt in `startScenario`,
  surfaced via `PrivatePlayerState.battleGoal`, chosen via
  `player_choose_battle_goal`. Picker UI in `client/.../BattleGoalPicker.tsx`;
  chosen goal + results shown in `ScenarioPanel`.
- Per-scenario event log (`Room.battleGoalLog`) folded at scenario end by
  `evaluateBattleGoals`; checkmarks gated on victory and added to
  `CharacterInstance.battleGoalCheckmarks`; results revealed publicly via
  `PublicGameState.battleGoalResults`.

**Events emitted (server/room.ts):** round_start, turn_start, rest (short+long),
card_lost, enemy_killed (full rich record), attack, targeted_by_enemy_attack,
damage_suffered, hp_changed, character_exhausted (HP cause), loot_collected
(end-of-turn), experience_gained, initiative_chosen, ability_performed
(lost/basic), condition_removed (via heal), condition_applied (player→enemy),
character_moved, exited_enemy_adjacent_hex, entered_occupied_hex, door_opened,
round_end_position, turn_end_position, scenario_end_piles.

**Known emission gaps / partial (cards affected):**
- `targetRank` is always `'normal'` — Unit carries no rank yet → **Hunter**
  can't trigger (needs elite kills); **Plebeian** trivially passes.
- `ability_performed.targetedAlly` always false → **Promoter** can't trigger.
- `damage_negated` is not emitted (card-loss-to-negate-damage isn't wired in
  the engine) → **Acrobat**, **Wastrel** can't trigger.
- No room model → `exited_room_with_loot` never fires → **Miser** can't trigger.
- Obstacles/objectives aren't distinct tiles → `turn_end_position`
  adjacency only detects walls → **Wallflower** under-counts.
- `loot_collected` only emitted for end-of-turn auto-loot, not Loot abilities
  → **Pickpocket** can't trigger; **Mugger**/**Cleaner** only count auto-loot.
- `condition_removed` only from heals (wound/poison), not remove-condition
  abilities → **Optimist** partially covered.
- `character_exhausted` only emitted for HP cause, not card-exhaustion →
  **Weakling** partial.
- Pass-through movement events (`entered_occupied_hex`) only fire when the
  client supplies an explicit path → **Pedestrian** partial.
- `door_opened` has no open/closed state, so re-entering a door re-emits
  (harmless for Overachiever's same-turn check).

These gaps are all additive: each is one more emission or one more Unit/tile
field, with the tracker already in place.
