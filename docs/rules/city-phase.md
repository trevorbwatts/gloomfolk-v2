# City Phase

> Transcribed from the Gloomhaven 2E rulebook.

After each Scenario Phase, the party must return to Gloomhaven and perform
a City Phase **except in the following situations**:

- If the scenario was lost, the party may replay the scenario immediately
  (see p. 45).
- Some scenarios are **force-linked**, in which case the party must play
  the indicated linked scenario immediately (see p. 46).

The City Phase involves spending time in Gloomhaven to resolve events,
acquiring new items and abilities, and retiring. Each City Phase consists
of **two distinct steps**:

1. **City Event**
2. **Downtime**

## 1. City Event

When you return to Gloomhaven, resolve a city event by drawing the top
card of the **city event deck** and resolving it. City events are resolved
**exactly like road events** (see [road-events.md](road-events.md)).

## 2. Downtime

After the City Event step, characters may perform downtime activities
**in any order they would like**:

- **Level Up** (p. 53–54)
- **Retire a Character** (p. 55)
- **Create a Character** (p. 56)
- **Purchase Enhancements** (p. 56)
- **Donate to the Great Oak** (p. 56)
- **Purchase and Sell Items** (p. 57)

### Level Up

If a character's experience total is **equal to or greater than** the
experience requirement of their next level, they **must** level up during
the Downtime step. Leveling up has an experience **requirement**, as shown
on the character sheet, but not an experience **cost**. A character's
experience total **does not reset** when they level up.

#### Prosperity catch-up leveling

If a character's level is **lower than half the current prosperity level
(rounded up)**, they may level up during the Downtime step **without
meeting the experience requirement**, even multiple times, as long as
their level does not exceed half the current prosperity level (rounded
up). After they level up this way, **set their experience total to match
the experience requirement of the new level**. This method of leveling up
is **optional**, unlike leveling up through experience.

The full Level Up procedure (add ability card, increase hit points, gain
perk mark) and the Perks rules are in [level-up.md](level-up.md).

> The detailed rules for the other downtime activities (Retire, Create a
> Character, Purchase Enhancements, Donate to the Great Oak, Purchase and
> Sell Items, p. 55–57) are on later pages — not transcribed yet.

## Implications for the schema (notes for later)

Defer until campaign flow is built, alongside
[road-events.md](road-events.md). Rough shape:

- Campaign loop: Scenario Phase → City Phase, skipped when replaying a
  lost scenario or following a force-linked scenario. Note the City Phase
  skip conditions are a **subset** of the road-event skip conditions —
  they're separate checks.
- City events reuse the entire road-event model and resolution engine;
  the only difference is which deck they're drawn from. One `EventCard`
  model with `deck: 'road' | 'city'` should cover both.
- Downtime is an unordered menu of activities per character, not a fixed
  sequence.
- Level-up engine rules:
  - **Mandatory** when `xp >= requirement(level + 1)`; XP is a threshold,
    not spent; never reset on a normal level-up.
  - **Optional catch-up**: while `level < ceil(prosperity / 2)`, allow
    repeated level-ups up to that cap; each catch-up level-up sets
    `xp = requirement(newLevel)`.
