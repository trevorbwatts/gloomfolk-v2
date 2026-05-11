# Playing a Scenario

> Transcribed from the Gloomhaven 2E rulebook.

Once a scenario is set up, it can then be played. Each scenario is broken
up into a series of **rounds**, and each round consists of the following
steps:

1. **Card Selection**
2. **Ordering of Initiative**
3. **Character and Monster Turns**
4. **End of Round**

Before any of these steps occur, apply any **start-of-round effects** from
the scenario rules, such as spawning monsters. These effects can be
applied in any order, though **all spawning should happen at the same
time** (see p. 42).

## 1. Card Selection

After start-of-round effects are applied, each character **secretly
selects two ability cards** from their hand to play face down in front of
themselves. Of the two cards, one should be selected as the **initiative
card** — the initiative value at the center of that card determines the
character's position in the initiative order (see p. 17).

Alternatively, if a character has **at least two cards in their discard
pile**, they can instead **declare a long rest** at this time (see p. 36).
They will then perform their long rest on **initiative 99** as their
entire turn for the round and **will not play any cards**.

### Communication restrictions

Characters should **not show each other the cards in their hand** or give
specific information about any **numeric value or title** on these cards.
They are allowed to discuss strategy and make general statements about
their plans for the round.

**Allowed:**
- "I'm attacking this Vermling Priest near the end of the round."
- "I'm planning to move here and heal you pretty early, hopefully before
  the monsters attack."
- "Can you infuse earth on your turn? I will try to go after you."

**Not allowed:**
- "You'll need lower than 17 to go before me."
- "I'm going in the first quarter of the round."
- "I should be dealing 4 damage to the Vermling Scout."
- "I need you there for Flanking Strike."

## 2. Ordering of Initiative

After each character has selected two ability cards or declared a long
rest, **reveal the selected cards** for each character who will not be
long resting. Each character's chosen initiative card should be directly
on top of the other card, so that **only one initiative value is visible**.
All cards can now be **openly discussed**.

In addition, **reveal one monster ability card for each monster set** that
has at least one figure currently on the map. Note that several **monster
types** (e.g., Black Imps or Forest Imps) may belong to the same **monster
set** (e.g., Imps), in which case they all use the same monster ability
deck (e.g., the Imp deck).

Determine the initiative order by comparing the initiative values on all
revealed monster ability cards (located in the **upper left corner**) and
all characters' initiative cards. Arrange all monster types and characters
on the map from **lowest to highest** (earliest to latest) initiative.
**Any character long resting has an initiative of 99.**

### Resolving ties

- **Two characters tied:** compare the initiative values of those
  characters' **second played cards** to break the tie. If still tied, the
  party decides the order.
- **A character tied with a monster set:** the **character acts first**.
- **All other tied cases:** the party decides the order.

### Monster order

During their position in the initiative order, the **elites** of a monster
type take their turns in **ascending standee number order** (before any
normal monsters of that type). Then, the **normal monsters** of that type
take their turns in **ascending standee number order** (see p. 38).

### Character summons

Character summons take their turns during the **summoning character's
position** in the initiative order, but **immediately before** the
character. Multiple summons from the same character take their turns in
**the order they were summoned** (see p. 29).

### Scenario allies

Scenario allies — typically represented by numbered tokens — have their
initiative value specified in the special rules for the scenario. During
their position in the initiative order, scenario allies take their turns
in **ascending token or standee number order** (see p. 44).

### Example

In the rulebook example: Silent Knife (init 4) goes first, then Tinkerer
(16), then Bandit Scout (40), then Spellweaver (70).

## Implications for the schema (notes for later)

Round-loop state machine:

```ts
type RoundPhase =
  | 'start-of-round-effects'
  | 'card-selection'
  | 'initiative-ordering'
  | 'turns'
  | 'end-of-round';

interface RoundState {
  phase: RoundPhase;
  startOfRoundEffects: ScenarioEffect[];   // spawning, scripted triggers
  selections: Record<CharacterId, CharacterSelection>;
}

type CharacterSelection =
  | { kind: 'two-cards'; cards: [CardId, CardId]; initiativeCardIndex: 0 | 1 }
  | { kind: 'long-rest' };                  // requires ≥2 cards in discard
```

Engine concerns:
- **Card selection is secret.** Server holds the selection; reveal only
  during initiative ordering. Communication restrictions are social
  rules — we don't enforce in-game chat content, but we *do* enforce
  hidden hands on the client UI.
- **Long-rest precondition.** Check `discardPile.length >= 2` when a
  player chooses long rest. Long rest fixes initiative to 99 and
  bypasses card play.
- **All spawning happens simultaneously.** Resolve scenario start-of-
  round triggers in any order, but spawn-tile placement should be
  atomic so adjacency/focus calculations see all new figures at once.
- **"All spawning at the same time"** matters when multiple spawns
  trigger on the same round and one would affect another's placement —
  we should batch spawns into a single placement pass.

### Initiative ordering

Sorting key (low to high): `(initiative, isMonsterGroup, tieBreakInitiative)`
where:

- `initiative` is the revealed initiative number (long-resters use 99).
- For character-vs-monster ties: characters win — encode by giving each
  entry a secondary key where character = 0, monster-group = 1.
- For character-vs-character ties: `tieBreakInitiative` is the initiative
  on the player's **second** played card. If still tied, fall back to
  party-decided order (UI step).
- For monster-vs-monster ties at the same set's initiative: not possible
  within a single set; across sets, party-decided.

```ts
interface InitiativeEntry {
  kind: 'player' | 'monster-group' | 'summon' | 'scenario-ally';
  initiative: number;        // 99 for long rest
  tieBreak?: number;         // second-card initiative for players
  // sub-ordering inside a slot:
  summonerOrder?: number;    // summons act immediately before summoner
  standeeNumber?: number;    // ascending order for monsters/allies of same type
  isElite?: boolean;         // elites of a type go before normals at same slot
}
```

Within a monster group's turn:

1. Elites of that type, in ascending standee number.
2. Normals of that type, in ascending standee number.
3. (Other types in the same set still take their own monster-set slot;
   one ability card per set.)

Summons resolve **just before the summoning character's turn**. Multiple
summons from the same character act in summon order.

Scenario allies act on their scenario-defined initiative; among allies
tied, ascending token/standee number.

Engine concerns:
- **Reveal step.** Once all selections are in, broadcast revealed cards
  (selections become public). Long-resters have no card visible.
- **Monster ability-card draw.** For each monster set on the map, draw
  the top of its ability deck; that card's initiative drives the set's
  position. Monster sets with no figures on the map get **no** card
  this round.
- **Stable tie-break.** For character vs. character ties, use second-
  card initiative; if still tied, pause for a party-decided choice
  (UI prompt — pick the order among tied characters).
- **Long rest entries.** Treat as a player slot with `initiative = 99`
  and no `tieBreak` (long-resters tying with each other → party decides).
- **Summons not modeled yet.** Add `summonerUnitId` to a future
  `Summon` unit kind; the turn-order builder inserts the summon entry
  just before its summoner's entry.
