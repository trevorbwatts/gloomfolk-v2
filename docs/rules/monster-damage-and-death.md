# Monster Damage and Death

> Transcribed from the Gloomhaven 2E rulebook.

When a monster suffers damage, place damage tokens on its stat sleeve in
the section corresponding to its standee number. **As soon as the total
amount of damage suffered by a monster is equal to or greater than its
maximum hit point value, it dies.**

When a monster dies, remove its standee from the map, clear all tokens
from its section of the stat sleeve, and **place a money token in the hex
where it died, even if it was summoned or spawned, unless it was a
scenario ally**. **Once all 25 money tokens have been placed, do not place
any more during the scenario.** **No attack effects can be applied to a
monster after it dies.** **If a monster dies while performing one of its
own abilities, it cannot perform any other abilities.**

## Kill Credit

Certain battle goals, personal quests, and abilities require characters to
track their kills. **Summons pass credit for their kills to their
summoner.**

- If a monster dies from damage caused by an **attack, retaliate bonus,
  or suffer damage ability**, the figure who caused the damage gets
  credit for the kill.
- If a monster dies from damage caused by a **negative hex due to forced
  movement**, the figure who **caused the forced movement** gets credit
  for the kill.
- If a monster dies from damage caused by **wound, another monster, or a
  negative hex due to voluntary movement**, **no kill credit is given**.
- **Objectives are destroyed, not killed**, and thus provide no kill
  credit.

## Implications for the schema

### Death trigger

```
figure.dies := figure.damageSuffered >= figure.maxHp
```

- **Damage tokens accumulate**, they don't reduce HP. Equivalent to an
  HP integer that decrements, but the rules-of-record framing is
  cumulative damage. Pick one representation (probably remaining HP)
  and stick with it.
- **`>=`, not `>`.** Exactly-max damage kills.
- **Death is checked immediately** after every damage application.
  Triggers death cleanup before any further effect resolves on that
  figure.

### Death cleanup, in order

```ts
function killMonster(figure: MonsterFigure, killer: FigureRef | null,
                    cause: DamageCause): void {
  removeStandee(figure);
  clearStatSleeveTokens(figure);              // clear conditions, damage
  if (figure.allegiance !== 'scenario-ally') {
    dropMoneyToken(figure.position);          // subject to 25-token cap
  }
  returnStandeeToPool(figure.type);
  awardKillCredit(killer, figure, cause);     // see kill-credit logic
  if (figure === currentlyActingFigure) {
    abortRemainingAbilities();                // "cannot perform any other abilities"
  }
}
```

### Money token cap

- **Hard cap: 25 tokens placed per scenario.** After the 25th, deaths
  drop nothing.
- **Cap is on placements, not on tokens-on-the-map.** Picking up a
  token mid-scenario does not free a placement slot. Track
  `scenario.moneyTokensPlaced` as a monotonic counter.
- **Scenario allies never drop money** regardless of cap state.

### Post-death effect immunity

> "No attack effects can be applied to a monster after it dies."

- A pierce / wound / curse / etc. queued as part of the killing attack
  **does not apply** if the target is dead by the time it would resolve.
- Practically: resolve damage first, check death, *then* attempt to
  apply effects. Effects on dead targets are silently dropped.
- This also covers retaliate-from-the-corpse: a dying monster's
  retaliate fires only if the retaliate trigger predates death.

### Self-interrupted abilities

> "If a monster dies while performing one of its own abilities, it
> cannot perform any other abilities."

- Edge case: a monster's own ability damages it (suffer-damage,
  consume-element side effects, etc.) and that damage is lethal. The
  remaining steps on the ability card are skipped.
- Already covered by the `currentlyActingFigure` check in cleanup —
  no separate machinery needed.

### Kill credit attribution

```ts
type DamageCause =
  | { kind: 'attack'; attacker: FigureRef }
  | { kind: 'retaliate'; figure: FigureRef }
  | { kind: 'suffer-damage-ability'; source: FigureRef }
  | { kind: 'forced-movement-into-negative-hex'; mover: FigureRef }
  | { kind: 'wound' }                           // no credit
  | { kind: 'monster-damage'; source: FigureRef } // no credit
  | { kind: 'voluntary-movement-into-negative-hex' }; // no credit

function killCreditFor(cause: DamageCause): FigureRef | null {
  switch (cause.kind) {
    case 'attack':
    case 'retaliate':
    case 'suffer-damage-ability':
      return resolveSummoner(cause.attacker ?? cause.figure ?? cause.source);
    case 'forced-movement-into-negative-hex':
      return resolveSummoner(cause.mover);
    default:
      return null;
  }
}

function resolveSummoner(figure: FigureRef): FigureRef {
  // Summons pass credit to their summoner; characters credit themselves.
  return figure.summonedBy ?? figure;
}
```

- **Summon credit chain.** A summon's summon (if any) walks the chain
  back to the original character. Encode `summonedBy` as a chain-pointer,
  not a one-hop reference, so multi-step resolution is trivial.
- **Monster-on-monster damage gives no credit**, even if a character
  somehow *caused* the monster to attack. The "no credit" branch is
  about the immediate damage source, not upstream causation.
- **Wound damage is uncredited** even though some character originally
  applied the wound. Damage cause at the moment of death is what
  matters.
- **Voluntary vs. forced movement** distinction: the figure that *moved
  the dying monster* decides credit assignment. A monster walking
  itself onto a trap is voluntary; a character pushing a monster onto
  a trap is forced.

### Objectives

```ts
type FigureKind = 'character' | 'monster' | 'objective';
```

- **Objectives use `destroy` semantics**, not `kill`. They take damage
  and are removed at 0 HP, but:
  - No money token drops.
  - No kill credit.
  - Battle goals / quests counting "kills" never tick from objective
    destruction.
- A separate event type (`figure-destroyed` vs. `figure-killed`) keeps
  downstream subscribers honest about which counters they update.

### Engine implications

- **Damage application returns a `DamageResult`** that includes whether
  the figure died, so the caller knows whether to halt subsequent
  effect application:

  ```ts
  type DamageResult = { died: boolean; finalDamage: number;
                        creditedTo: FigureRef | null };
  ```

- **Effect queue is order-sensitive:** damage step → death check →
  remaining-effect application. Effects are dropped if the target is
  dead at the moment they would apply. Don't precompute the full effect
  list — apply incrementally.

- **Money-token placement is a separate event** subscribed by the loot
  layer; the cap check belongs there, not in the death-cleanup logic.
  Death cleanup just emits "monster died at hex H, allegiance A"; the
  loot system decides whether to spawn a token.

- **Kill-credit events feed battle goals and quests.** Emit a single
  `KillCredited` event with `(killer, victim, cause)`; battle-goal
  evaluators subscribe and decide whether the kill matches their
  predicate (e.g. "kill 5 elites" filters on `victim.rank`).
