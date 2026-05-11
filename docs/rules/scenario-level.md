# Scenario Level

> Transcribed from the Gloomhaven 2E rulebook.

As characters grow in power, the scenario level also increases to ensure
the game remains challenging.

The following depend on the level of the scenario being played:

- Monster base stats
- Trap and hazardous terrain damage
- Gold received from money tokens (gold conversion)
- Bonus experience for completing a scenario

## Recommended level

At recommended difficulty, the scenario level equals the **average level
of the characters divided by 2 (rounded up)**.

Example: if all characters are level 2, the average level (2) divided by
2 is 1 — the scenario is still level 1. Only once a character reaches
level 3 would the scenario level potentially increase.

The recommended calculation only sets a default. **At the start of any
scenario, the scenario level can be set to any number from 0 to 7.**
Decreasing it helps a struggling party; increasing it keeps a strong
party challenged.

## Scenario level chart

| Scenario Level     | 0 | 1 | 2 | 3 | 4  | 5  | 6  | 7  |
|--------------------|---|---|---|---|----|----|----|----|
| Monster Level      | 0 | 1 | 2 | 3 | 4  | 5  | 6  | 7  |
| Gold Conversion    | 2 | 2 | 3 | 3 | 4  | 4  | 5  | 6  |
| Trap Damage        | 2 | 3 | 4 | 5 | 6  | 7  | 8  | 9  |
| Hazardous Terrain  | 1 | 2 | 2 | 2 | 3  | 3  | 3  | 4  |
| Bonus Experience   | 4 | 6 | 8 | 10| 12 | 14 | 16 | 18 |

Note: trap damage matches the **"2 + scenario level"** formula from
[overlay-tiles.md](overlay-tiles.md#traps). Hazardous terrain damage
matches **"1 + ⌈scenarioLevel / 3⌉"**.

## Implications for the schema (notes for later)

```ts
interface ScenarioLevelSettings {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

// Derived values — all functions of `level`:
const monsterLevel    = (l: number) => l;
const trapDamage      = (l: number) => 2 + l;
const hazardousDamage = (l: number) => 1 + Math.ceil(l / 3);
const bonusExperience = (l: number) => 4 + 2 * l;
const goldConversion  = (l: number) => /* table lookup: 2,2,3,3,4,4,5,6 */;

function recommendedLevel(characterLevels: number[]): number {
  const avg = characterLevels.reduce((a,b) => a+b, 0) / characterLevels.length;
  return Math.ceil(avg / 2);
}
```

Engine concerns:
- Compute and surface the **recommended level** at scenario start, but
  let the party override before play begins.
- All level-dependent values (trap damage, gold conversion, monster
  stats, etc.) should derive from a single `scenarioLevel` on the
  scenario state — no duplication.
