# Campaign Sheet

> Transcribed from the Gloomhaven 2E rulebook.

The party has a single campaign sheet that tracks a variety of information
related to the campaign. The pad contains multiple sheets, in case they are
needed for any reason, but only one campaign can be in progress at any
given time.

The campaign sheet has the following:

## A — Party Name

A space to write the name you choose for your party.

## B — Faction Reputation Tracks

There are three factions vying for control over Gloomhaven: the
**Demons**, the **Merchant's Guild**, and the **Military**. You start with
**zero reputation** with each of these factions, and your actions can
increase or decrease your reputation with them.

- Initially, the **maximum** reputation value you can have with any of the
  factions is **12**. Any additional reputation gains above that value are
  lost.
- Similarly, you cannot have less than **−10** reputation with any
  faction. Further decreases are ignored.
- There is a **section number** associated with reputation level **9, 16,
  and 20** with each faction. The first time you reach each of these
  reputation levels, mark the box and read the corresponding section
  immediately.

For more information on these factions and their leaders, see Appendix H
on p. 70.

## C — Additional Reputation Sections

When you have reached **6 or 12 reputation** with a faction **and** have
completed the specified scenario(s), mark the box and read the specified
section immediately.

## D — Inspiration Value

This marks the party's current inspiration. When the party receives
**"±X inspiration,"** adjust this value accordingly. When the party
completes a scenario, they gain inspiration equal to **4 minus the number
of characters**. Characters can spend **12 inspiration** when retiring to
complete an additional personal quest (see p. 55).

## E — Prosperity Track

This marks Gloomhaven's current prosperity. The prosperity level
determines the **maximum starting level for new characters** (see p. 56)
and the **items available for purchase**.

- When the party receives **"+X prosperity,"** mark the next X boxes.
- Each time a **numbered box** is marked, the prosperity level increases
  and new items are added to the available supply (see p. 52 and
  [item-supplies.md](item-supplies.md)).
- If a **section number** is also in the box, immediately read it.
- When the party receives **"−X prosperity,"** erase the previous X boxes,
  but **never erase a numbered box or further**.

## F — Imbuement Track

Ignore this track until the game instructs you to use it.

## G — Temple of the Great Oak Track

Every time any character donates **10 gold** to the Great Oak (see p. 56),
mark the next box on the track. Every **fifth box** you mark, Gloomhaven
gains **1 prosperity**.

## H — Retirement Table

This serves as an ongoing record of retired characters. When a character
retires (see p. 55), record their information in this table. The number of
characters a player has retired during the campaign determines how many
**bonus perk marks** are gained by newly created characters (see p. 56).

## I — Classes Unlocked

This serves as a record of which classes you have unlocked in the campaign
(see [unlocking-new-classes.md](unlocking-new-classes.md)). Each time you
unlock a new character class, mark the box next to their class icon.

## Section-number reminder

Whenever you reach a value with a section number on the **reputation**,
**prosperity**, or **imbuement** tracks for the first time, read that
section. Additionally, when your **first character retires**, read the
section in the retirement table.

## Implications for the schema (notes for later)

This is the campaign-level state container the engine doesn't have yet.
`CampaignSave` would grow something like:

```ts
interface CampaignSheet {
  partyName: string;
  reputation: { demons: number; merchantsGuild: number; military: number };
  // Which one-time section-number boxes have been read (rep 9/16/20 per
  // faction, additional rep sections, prosperity boxes, retirement).
  sectionsRead: string[];
  inspiration: number;
  prosperityBoxesMarked: number;   // prosperity *level* derives from this
  greatOakBoxesMarked: number;     // every 5th box → +1 prosperity
  imbuementBoxesMarked: number;    // ignore until instructed
  retiredCharacters: { playerId: string; name: string; classId: string;
    level: number; perks: number; masteries: number }[];
  classesUnlocked: string[];
}
```

Engine concerns:
- Reputation clamping: [−10, 12] initially; the cap apparently rises later
  (the printed track goes to 20 with a lock at 13) — model the cap as
  campaign state, not a constant.
- Prosperity level powers two existing hooks: the optional catch-up
  level-up in [level-up.md](level-up.md) (deferred in
  `characters/level-up.ts` until this exists) and shop stock by item
  number ([item-supplies.md](item-supplies.md)).
- Retirement count per player feeds the perk-mark bonus already noted in
  `perkMarksEarned` (characters/level-up.ts).
- Scenario completion: `+max(0, 4 − characterCount)` inspiration.
- Section-number triggers are first-time-only — track read sections.
