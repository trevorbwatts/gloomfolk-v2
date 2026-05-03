# Other Monster Abilities

> Transcribed from the Gloomhaven 2E rulebook. Covers everything on a
> monster ability card that isn't `Move` or `Attack`.

## Active Bonuses

Active bonuses from a **stat card** are active at all times, **even if the
monster is stunned**. Active bonuses from an **ability card** are only
active once the monster has taken its turn, but they remain active until
the end of the round, **even if the monster is later stunned**. Multiple
active bonuses, from either type of card, **stack with one another as a
single effect**.

## Heal Abilities

The monster heals itself or an ally within the specified range. It always
targets the monster within range that has the **greatest difference between
its current and maximum hit point values**.

## Loot Abilities

Monsters do not perform end-of-turn looting, but some monsters have loot
abilities. In such cases, the monster loots **all money tokens within the
specified range**, removing them from the map. These money tokens are
**not dropped by the monster when it dies**. Monsters are **unable to loot
treasure tiles**.

## Negative Targeted Abilities

The monster uses the **focus rules** to find the targets for these
abilities **as if they were attack abilities**, but this **does not affect
how it moves**.

## Positive Conditions

The monster applies the condition to itself or an ally within the
specified range. It always targets the monster at the **closest range that
does not already have the condition**. If there is a tie for closest range,
it targets the monster that **acts earliest in the initiative order**.

## Summon Abilities

Some monsters can summon other monsters onto the map. Monster summons
behave just like other monsters, acting according to the monster ability
cards of their set.

A monster summon must be placed in an **empty hex adjacent to its
summoner** and **as close to an enemy as possible**. If there is no
adjacent hex available, **or no standee of the corresponding monster
type**, the figure is not summoned. **Monster summons never take a turn
during the round in which they are summoned.** When a summoner is killed,
its monster summons **remain on the map**.

If a monster summon does not have a monster ability card drawn for its set
this round, **draw one to determine an initiative value solely for the
purpose of determining the focus of other figures' abilities**.

## Implications for the schema

### Active bonuses — two distinct lifetimes

Two sources, two activation rules, but they merge into one effect when
multiple are present:

```ts
type ActiveBonus = {
  source: 'stat-card' | 'ability-card';
  effect: BonusEffect;     // shield, retaliate, etc.
};
```

- **Stat-card source:** active from scenario start, ignores stun.
- **Ability-card source:** activates *after* the monster's turn resolves,
  expires at end-of-round, ignores stun once activated.
- **Stun does not suppress active bonuses, period** — once active, they
  stay active. Stun only suppresses the *acquisition* of an
  ability-card bonus by preventing the turn from happening… **except**
  the rules don't actually say that. Re-reading: "even if the monster is
  later stunned" implies the activation precondition is "the monster has
  taken its turn", and stun prevents taking a turn, so a monster stunned
  *before* its turn never activates the ability-card bonus. Worth
  confirming against the stun rules — flag as ambiguous.
- **Stacking:** multiple bonuses combine into a single effect (so e.g.
  `Shield 1 + Shield 1 = Shield 2`, applied as one shield instance, not
  two layered ones — matters for pierce interactions).

### Heal target selection

```
target = argmax over (allies + self within range) of (maxHp - currentHp)
```

- **Self is a valid target.** "The monster heals itself or an ally."
- **Tiebreak rule is not specified by this rule** for two figures with
  identical HP deficit. Likely defers to the general "party decides"
  ambiguity rule from the ability-card section. Engine should surface a
  prompt.
- **A heal of 0 effective value (no one is wounded) still counts as the
  ability resolving** — it just produces no change. Don't treat as a
  skipped step (no impact on subsequent steps either way).

### Loot ability

- **Range is from the monster's current hex** at the time the ability
  resolves (post-movement).
- Loots **all** money tokens in range, not just adjacent ones — distinct
  from character looting which is move-based.
- **Money tokens are consumed**, not banked on the monster — they vanish
  from the map and from the scenario's lootable pool. The party loses
  that gold.
- **Treasure tiles are immune to monster looting** — exclude them from
  the candidate set explicitly.

### Negative targeted abilities

- Examples: applying conditions like `wound`, `poison`, `muddle` to
  enemies; forced movement; etc.
- **Target selection runs the focus algorithm**, but with the ability's
  range/parameters in place of the attack's. The result is *just*
  target(s) — movement is not adjusted to enable the ability.
- **Movement is determined by the attack ability on the card** (or by
  the focus's path if there's no attack). A negative targeted ability
  that the monster can't reach simply doesn't fire; the monster doesn't
  move farther to enable it.
- This means a card like `Move 2 / Apply Poison (Range 3)` may resolve
  the move-and-attack steps normally, then fail to apply poison if no
  enemy is within range 3 of the destination — and that's correct
  behavior, not a bug.

### Positive conditions

Mirror image of heal-target selection but with a different rule:

```
candidates = (allies + self within range) without the condition
target = argmin over candidates of (hexRange to self),
         tiebreak by earliest initiative
```

- **"Without the condition" filter is critical** — the rule explicitly
  prevents redundant application. A monster set already covered in
  `strengthen` can't have it stacked further.
- **Initiative tiebreak uses *this round's* initiative**, same as focus
  tiebreak.
- **Self can be a target**, and self's "range" is 0.

### Summon abilities

This is the gnarliest one. Multiple invariants:

1. **Adjacency to summoner** — destination must be one of the (≤ 6)
   neighboring hexes.
2. **Empty hex** — no figure, no obstacle, terrain that allows
   occupation.
3. **As close to an enemy as possible** — among valid adjacent hexes,
   pick the one minimizing `hexRange` to the nearest enemy. (Ties:
   rules don't specify — likely "party decides".)
4. **Standee availability** — if the monster set's standee pool is
   empty, the summon fails silently. Standee count is the cap from the
   stat card / scenario setup.
5. **No adjacent valid hex** ⇒ summon fails silently. Card resolution
   continues with subsequent abilities.
6. **Summons act like normal members of their set** — they share the
   set's ability deck and turn.
7. **Summons skip the round they're summoned in.** Track a `summonedThisRound`
   flag on the figure; the turn resolver skips it during the set's turn
   that round, then clears the flag at round end.
8. **Summoner death does not despawn summons.** Summons are independent
   figures once placed.
9. **Cross-set summon initiative draw:** if a monster summons a creature
   from a *different* monster set that has no ability card drawn this
   round (because the set had no figures on the map at the start of the
   round), **draw an ability card for that set now** — but **only to
   establish an initiative value**. The summon and any future members
   of that set don't take a turn this round; the initiative exists so
   that *other* figures' focus / positive-condition tiebreaks can
   reference it.

### Engine implications

- **Suggested ability-step taxonomy:**

  ```ts
  type AbilityStep =
    | { kind: 'move'; modifier: number }
    | { kind: 'attack'; modifier: number; range?: number;
        targetModifier?: number; effects?: Effect[] }
    | { kind: 'heal'; amount: number; range: number }
    | { kind: 'loot'; range: number }
    | { kind: 'negative-targeted'; effect: Effect; range: number }
    | { kind: 'positive-condition'; condition: Condition; range: number }
    | { kind: 'summon'; setId: MonsterSetId; rank: 'normal' | 'elite' }
    | { kind: 'active-bonus'; effect: BonusEffect };
  ```

- **`active-bonus` from an ability card needs a deferred-activation
  marker** so the round-end cleanup knows what to expire and the engine
  knows not to apply it before the monster's turn fires.

- **Summon resolution should return a `SummonResult`** so the turn log
  can show `summoned`, `failed-no-hex`, or `failed-no-standee`. Players
  often want to see *why* a summon didn't appear.

- **The `summonedThisRound` skip flag** is per-figure, not per-set — a
  set may contain pre-existing members (who do act) and freshly summoned
  members (who don't) in the same round.

- **Cross-set initiative draw is a board-level effect**, not local to
  the summoning monster. After resolving a summon that introduces a new
  set, push an initiative entry for that set into the round's order
  *without* enqueueing a turn for it. Other monsters' focus tiebreaks
  pick this up immediately.
