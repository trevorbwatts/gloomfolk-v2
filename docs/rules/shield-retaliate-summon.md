# Shield, Retaliate, and Summon

> Transcribed from the Gloomhaven 2E rulebook. These are three common active
> bonus abilities; see [active-bonuses.md](active-bonuses.md) for the
> active-bonus rules they sit on top of.

## Shield

**"Shield X"** is a positive ability that gives the acting figure a shield
bonus of X. This reduces the attack value of an incoming attack by X.

The shield bonus is only applied **after all attack bonuses or penalties and
modifiers have been applied**. Multiple shield bonuses stack with one another
as a single reduction in attack value. **A shield bonus does not apply to
sources of damage that are not attacks.** A shield ability always applies to
the acting figure.

## Retaliate

**"Retaliate X"** is a positive ability that gives the acting figure a
retaliate bonus of X. This deals X damage to any figure who attacks them,
if they are within the specified range **after all attack effects are
resolved (including push or pull)**. If no range is specified, the bonus is
only applied to **adjacent** attackers.

This bonus is triggered by each attack and occurs after the attack is
resolved. **A retaliate bonus is not an attack or targeted effect**;
therefore the damage cannot be reduced by a shield bonus. If a retaliating
figure is killed or exhausted by an attack, the retaliate bonus does not
occur.

Multiple retaliate bonuses stack with one another as a single source of
damage, but each retaliate bonus is only applied within its specified range.
A retaliate ability always applies to the acting figure.

## Summon

Summon is a positive ability that adds other allied figures to the map.
These figures, known as "summons," must be placed in different **empty hexes
adjacent to the summoner**. If there is no adjacent hex available, the
figure is not summoned.

A character summon is considered a **persistent bonus**, and their card is
placed in the summoner's active area. When the summon suffers damage, place
damage tokens on their card. When the summon has suffered damage equal to
its hit point value, the summon is removed from the map. The summoner may
voluntarily remove the summon from the map at any time except during another
ability. The card is then placed in the summoner's discard pile or lost
pile, depending on whether the action has a lost icon.

Each character summon has a corresponding standee, found in the summoner's
tuck box, that is used to represent them on the map, using a blue standee
base. **When a character becomes exhausted, all of their summons are removed
from the map.**

Character summons have stats for their hit point, attack, move, and range
values, along with any special traits listed on their ability cards. If a
summon's attack or move value is `"—"`, then they do not perform that
ability unless granted an ability with a base value.

A character summon's turn in the initiative order is **always directly before
their summoner** and is **separate from the summoner's turn**. Summons are
not controlled by their summoner, but instead obey automated monster rules,
performing `"Move +0, Attack +0"` (see p. 39). If a summon has a range stat
other than `"—"`, they perform `"Move +0, Attack +0, Range +0"` (see p. 39).
A summon uses their summoner's attack modifier deck when attacking. If a
character summon cannot find a focus, the summoner may choose for the summon
to move toward them instead.

A character can have multiple summons on the map at once. Each new summon's
card is placed to the right of the previous summon's card in the summoner's
active area. In such cases, the summons will act in that order (left to
right). If there are multiple copies of the same summon on the map at once,
the order in which they were summoned determines their acting order, which
can be tracked using their standee numbers.

**Summons never take a turn during the round in which they are summoned.**

## Implications for the schema

### Shield
- Already in schema as `{ type: 'shield', amount, node?, mandatory? }`.
- No target field needed — always applies to acting figure.
- Engine resolves stacking and post-modifier application.

### Retaliate
- Already in schema as `{ type: 'retaliate', amount, node?, mandatory? }`.
- **Currently missing a `range?` field.** Default per rule = adjacent only.
  Eye for an Eye's Retaliate 1 has no printed range → adjacent only ✓.
  When we encounter a retaliate with a printed range (e.g. "Retaliate 2,
  Range 3"), add `range?: number` to the variant.
- Engine notes: triggers per attack after resolution, isn't itself an attack
  (so no shield reduction on the retaliate damage), doesn't fire if
  retaliator dies/exhausts to the attack, multiple retaliates stack as a
  single damage source per range bucket.

### Summon (new ability + new data model)
- New `AbilityStep` variant when a Bruiser card has it:
  ```ts
  | { type: 'summon'; summonId: string; mandatory?: boolean }
  ```
- Plus a sibling `Summon` data model on the side, since summon stats live
  on a separate referenced card:
  ```ts
  interface Summon {
    id: string;
    name: string;
    hp: number;
    attack: number | '-';
    move: number | '-';
    range: number | '-';
    traits?: readonly string[]; // or a typed enum once we see them
  }
  ```
- Defer until a Bruiser card actually summons something.

### Active-bonus tie-in
- Shield and Retaliate, when printed on a half with `persistent-round` /
  `persistent-bonus` disposition, become the **active bonus content** for
  that half. The engine treats them as persistent state on the figure
  (shield bonus / retaliate bonus pools) for the duration the card is in
  the active area.
- Summon's "the card is placed in the summoner's active area" is
  effectively a persistent disposition specific to summon abilities. When
  we encode one, the host card half is `persistent-bonus` (with our
  current shorthand) and the engine creates a Summon entity tied to that
  card's lifetime.
