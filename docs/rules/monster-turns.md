# Monster Turns

> Transcribed from the Gloomhaven 2E rulebook.

On a monster's turn, it performs abilities based on the ability card drawn
for its monster set. These abilities are determined by a combination of its
stat card and the drawn ability card. Monster abilities are automated,
following specific guidelines, so that very few decisions about monster
behavior need to be made by the party.

## Monster Components

- **Monster Ability Deck** — the deck drawn from each round to determine
  what monsters of a given type do on their turn.
- **Monster Standees** — the figures placed on the map to represent
  individual monsters.
- **Normal Base** — white-edged base for normal monsters.
- **Elite Base** — gold-edged base for elite monsters.
- **Monster Initiative Order Token** — placed in the initiative track each
  round to show when the monster set acts.

## Monster Stat Cards

Each monster type has a double-sided **monster stat card**, which determines
its base stats at every level. To set the level for a monster type, its stat
card is inserted in a stat sleeve so that only the relevant stats are shown.
Most stat sleeves have a six-section side and a 10-section side. The side to
use for a monster type depends on whether that type has four to six standees
or 10 standees.

A monster stat card can have the following:

- **A — Monster Name.** The name of the monster type.
- **B — Monster Level.** This level, which matches the scenario level,
  indicates how to insert the stat card into the stat sleeve.
- **C — Monster Rank.** These subsections show stat blocks for normal
  monsters (left) and elite monsters (right) of this type.
- **D — Hit Point Value.** The total amount of damage that a monster of
  this type can suffer before it dies.
- **E — Movement Value.** The base amount of movement points that a monster
  of this type gains when performing a move ability.
- **F — Attack Value.** The base amount of damage that a monster of this
  type deals when performing an attack ability.
- **G — Persistent Bonuses.** Active bonuses that a monster of this type
  has for the entire scenario.
- **H — Attack Effects.** Effects that apply to all attack abilities
  performed by a monster of this type.
- **I — Condition Immunities.** Conditions that a monster of this type is
  prevented from gaining due to immunity.

## Implications for the schema

- **Monster type vs. monster instance.** A monster type (e.g. "Bandit
  Archer") owns one stat card and one ability deck shared across all
  standees of that type in the scenario. Individual standees track HP,
  position, conditions, and rank (normal/elite) but inherit base stats from
  the type at the scenario's level.

- **Stat blocks are indexed by `(level, rank)`.** Stat card encoding should
  be a `Record<MonsterLevel, { normal: StatBlock; elite: StatBlock }>` where
  `MonsterLevel` is `0..7` and `StatBlock` carries `hp`, `movement`,
  `attack`, `persistentBonuses[]`, `attackEffects[]`, `immunities[]`.

- **Persistent bonuses and attack effects are level-and-rank scoped.** Per
  the card layout, both can differ between normal and elite stat blocks at
  the same level — encode them inside the `StatBlock`, not on the monster
  type.

- **Condition immunities are type-wide, not per-rank.** The rulebook places
  them outside the rank subsections (icon I sits at card edges spanning
  both ranks). Lift `immunities` to the type level rather than duplicating
  per stat block. *(Confirm against more cards before locking in — a
  per-rank immunity would invalidate this.)*

- **Six- vs. ten-standee sleeve choice is component metadata.** It does not
  affect runtime behavior, but the type definition should record
  `standeeCount: 6 | 10` so scenario setup knows how many figures are
  available.

- **Ability deck is owned by the monster *set* in play, not the type
  definition.** A scenario may include multiple sets of the same type
  (rare, but possible per later rules) — each set draws independently. The
  deck's card list is type-static; the shuffled, drawn-from instance is
  per-set.

- **Initiative comes from the drawn ability card, not the stat card.**
  Stat cards have no initiative value. The monster set's turn position each
  round is determined by the top card of its ability deck after the round's
  draw.

## Monster Ability Cards

Each monster set has a deck of **eight monster ability cards**. After the
characters have selected and revealed their ability cards for the round, an
ability card is drawn for each monster set with at least one figure
currently on the map. This ability card determines when and how the
monsters in that set will act during the round.

A monster ability card can have the following:

- **A — Card Name.** A thematic name for the card.
- **B — Initiative Value.** Determines when the monsters in this set act
  during the round.
- **C — List of Abilities.** Indicates which abilities the monsters in this
  set perform on their turns, if possible, and in what order.
- **D — Shuffle Icon.** At the end of the round in which a card with the
  shuffle icon is drawn, the discard pile is shuffled back into the deck.
- **E — Set Name.** The name of the monster set is listed on the card back.

**The monsters in a set only perform the abilities listed on the ability
card drawn for the current round.** For example, if their ability card does
not list a move ability, they will not move. If their ability card does not
list an attack ability, they will not attack.

Sometimes the rules in this section might not fully clear up ambiguity
regarding how a monster should act. In such cases, **the party gets to
decide the ambiguous choices. This decision does not have to result in what
is best for the monster.**

> *Example: The Scout ability card "Rapid Bolts" has no move ability, so
> Vermling Scouts will not move this round. They will focus on the two
> closest enemies within Range 4 and perform Attack -1 against them.*

## Monster Acting Order

A monster set acts based on the initiative value on the ability card drawn
for the current round. During their position in the initiative order, all
monsters of the type act, **starting with the elite monsters in ascending
standee number order, then the normal monsters in ascending standee number
order**. Each monster completes its turn before the next monster acts.

> *Example: The #4 elite monster acts first, followed by the #2 normal
> monster, then the #5 normal monster.*

## Implications for the schema (cont.)

- **Ability deck size is fixed at 8.** Encode as a constant on the deck
  type rather than allowing arbitrary lengths — useful as an invariant
  check at scenario setup.

- **Ability card shape:** `{ id, setId, name, initiative: 1..99,
  abilities: AbilityStep[], shuffle: boolean }`. `abilities` is an
  *ordered* list — the engine resolves them top-to-bottom on each
  monster's turn, skipping any whose preconditions aren't met (e.g. no
  valid target for an attack).

- **Shuffle is end-of-round, not immediate.** When a shuffle card is drawn,
  set a `pendingShuffle` flag on the deck and flush it during the
  round-end step. The just-drawn card must land in the discard pile
  *before* the reshuffle so it gets folded back in.

- **Draw is conditional on "at least one figure on the map".** Sets that
  have been wiped out — or haven't spawned yet — skip their draw entirely.
  Engine should gate `drawAbilityCard(set)` on `set.figures.length > 0`.

- **Acting order key:** `(initiative, rank, standeeNumber)` where rank
  sorts elite-before-normal and standeeNumber ascends within rank. This is
  a stable, deterministic sort — no player choice required to break ties
  within a set.

- **Initiative ties between sets / characters** aren't covered on this
  page; defer to the initiative rules section. Just note that the
  monster-set initiative is a single integer pulled from the drawn card.

- **"Party decides ambiguous choices" is an engine escape hatch.** When
  the focus / movement / target-selection algorithm produces multiple
  equally-valid outcomes, the engine must surface a choice to the players
  rather than picking deterministically. Model as a `MonsterDecision`
  prompt in the turn resolution stream.
