# Level Up

> Transcribed from the Gloomhaven 2E rulebook (p. 53–54).

If a character's experience total is **equal to or greater than** the
experience requirement of their next level, they **must** level up during
the Downtime step. Leveling up has an experience **requirement**, as shown
on the character sheet, but not an experience **cost**. A character's
experience total **does not reset** when they level up.

If a character's level is **lower than half the current prosperity level
(rounded up)**, they may level up during the Downtime step **without
meeting the experience requirement**, even multiple times, as long as
their level does not exceed half the current prosperity level (rounded
up). After they level up, **set their experience total to match the
experience requirement of their new level**. This method of leveling up is
**optional**, unlike leveling up through experience.

## When leveling up can happen

Leveling up can **only** be done during the City Phase. Characters cannot
level up during a scenario or even between scenarios if the party does not
return to Gloomhaven for a City Phase (e.g., when the party attempts a
linked scenario).

## Level-up procedure

When a character levels up, they **must** do the following:

- **Add Ability Card:** Add one new ability card to their pool. The card
  they choose must match their class and must be of a level **equal to or
  lower than their new level**. For example, when a character reaches
  level 2, they can add one of their two level 2 ability cards. Then, when
  they reach level 3, they can add one of their two level 3 ability cards
  **or** their other level 2 ability card. This does **not** increase
  their maximum hand size; it simply increases the pool of cards available
  to them at the start of a scenario.
- **Increase Hit Points:** Increase their maximum hit point value. On the
  level track at the bottom of their character mat, the number printed in
  red below their new level indicates their new maximum hit point value.
- **Gain Perk Mark:** Gain one new perk mark. The new perk mark is applied
  to the list on the right side of their character sheet by marking one
  corresponding box. Additional rules for gaining perks are outlined
  below.

## Perks

Perks allow characters to fine-tune their attack modifier decks by adding
and removing cards **permanently**. When a character gains a perk mark,
they choose a perk from the perk list on the right side of their character
sheet, mark the corresponding box, and resolve any change to their attack
modifier deck. The effects of a perk are resolved **as soon as the perk is
gained**, even when it is gained outside of the Downtime step.

The number of **unlinked boxes** shown next to a perk in the perk list
indicates the maximum number of times that the perk can be gained, with
each box requiring one perk mark. Some perks instead have multiple
**linked boxes**, and **all** of these boxes must be filled with perk
marks to gain the perk once.

The "ignore item -1 effects" perk only applies to the added -1 attack
modifier cards denoted in the lower left corner of some items (p. 33). The
"ignore scenario effects" perk only applies to effects labeled as scenario
effects in the scenario book. If a perk provides the character with any
other benefit unrelated to their attack modifier deck, they can keep the
relevant **perk reminder card** in their active area as a reminder.

### Gaining perk marks

Perk marks can be gained in **four ways**:

- **Leveling Up:** Each time a character levels up, they gain one perk
  mark.
- **Gaining Checkmarks:** Each time a character completes a set of
  **three checkmarks**, they gain one perk mark.
- **Creating Characters:** Each time a new character is created, they gain
  a number of perk marks equal to the number of characters previously
  retired by that player during the campaign.
- **Achieving Masteries:** Each time a character achieves a new mastery,
  they gain one perk mark.

Sometimes, a character will be instructed to **lose checkmarks**. However,
**perk marks cannot be lost**, so checkmarks can only be lost back to the
last complete set of three checkmarks. For example, if a character has
eight checkmarks, it is possible for them to lose up to two checkmarks,
but no more.

## Implications for the schema (notes for later)

- Character needs: `level`, `xp`, `maxHp` (derived from a per-class level
  track table), `pool` (unlocked ability card ids), `perkMarks` (earned
  vs. spent), marked perk boxes, `checkmarks`.
- Per-class data needs: XP requirement per level, HP per level (the red
  level-track numbers), two ability cards per level (2+), and a perk list
  where each perk has either N unlinked boxes (gain up to N times, one
  mark each) or N linked boxes (all N marks for one gain).
- Level-up validation: only in City Phase / Downtime; mandatory when
  `xp >= requirement(level + 1)`; optional prosperity catch-up while
  `level < ceil(prosperity / 2)`, which sets `xp = requirement(newLevel)`.
- Card choice validation: card's class matches, card's level
  `<= newLevel`, card not already in pool — "one of the two cards at each
  level" falls out of this naturally.
- Perk marks accrue from four sources; spending a mark marks a box and
  applies the attack-modifier-deck delta immediately (perks can be gained
  outside Downtime, e.g. a mid-campaign checkmark set).
- Checkmark loss clamps at the last multiple of three
  (`max(checkmarks - n, floor(perkMarksFromCheckmarks) * 3)`).
