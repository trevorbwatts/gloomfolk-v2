# Campaign Overview

> Transcribed from the Gloomhaven 2E rulebook. Covers the campaign-level
> tracking surfaces: the scenario flowchart and the map board. The
> campaign sheet has its own doc ([campaign-sheet.md](campaign-sheet.md)).

The campaign represents the entire scope of the game, played across many
Scenario Phases and City Phases. The collective group of characters you
play is referred to as **"the party."** New characters will join the party
and old characters will leave the party, but it is **always the same
party** throughout the campaign.

Over the course of the campaign, you will adventure through a multitude of
scenarios, encounter a variety of events, level up, purchase gear, retire
your characters, create new ones, and improve the city of Gloomhaven.
There is an eventual ending to the campaign narrative, but you are welcome
to **continue past that point**, replaying scenarios and exploring further
to unlock content you have not yet discovered.

For a summary of noteworthy people and organizations in Gloomhaven, see
Appendix H on p. 70.

Campaign information is tracked mainly by the following:

- **Scenario Flowchart:** a more detailed overview of unlocked scenarios.
- **Map Board:** a visual representation of which scenarios have been
  unlocked.
- **Character Sheets:** track each character's progression and supply.
- **Campaign Sheet:** tracks all of the other campaign variables
  ([campaign-sheet.md](campaign-sheet.md)).

## Scenario Flowchart

The scenario flowchart shows **how the scenarios are connected to each
other**. When a scenario is unlocked, open and tear off the corresponding
window of the flowchart. On the back of the window will be a sticker,
which should be affixed to the map board at the specified coordinates.

The revealed section of the flowchart will have information about the
scenario, including its **name, number, coordinates, and geographic
location**. See the icon key on the back of the flowchart for more
details.

The **colored bar** beneath the name of each scenario indicates which
**scenario chain** it is part of, and between the various windows on the
flowchart are **arrows** that show how the scenarios are connected to each
other. These make it easier to track your path through the campaign.

During the campaign, some unlocked scenarios might become **locked out**,
which means they are **no longer available**. When this happens, affix a
red lockout sticker to the corresponding section of the flowchart.

A flowchart window carries: **① number, ② name, ③ coordinates,
④ scenario chain color, ⑤ force-linked scenario, ⑥ requirements,
⑦ lockout sticker section, ⑧ connecting arrows.**

## Map Board

The map board tracks which scenarios are **available** in and around
Gloomhaven.

### Scenario Stickers

When a scenario is unlocked, retrieve its sticker from the corresponding
window of the scenario flowchart and affix it to the map board at the
specified coordinates, matching up the artwork. When a scenario is
**completed**, mark the **checkbox** on its sticker.

### Global Achievements

Occasionally, you will earn a **global achievement**. To track these, find
the corresponding sticker on the sticker sheet and affix it to the top of
the map board in the matching space.

> *Example: The global achievement Peace Through Bloodshed is earned, so
> its sticker is added to the matching space at the top of the map board.*

## Implications for the schema (notes for later)

The stickers/windows are physical mechanics, but they encode digital
campaign state:

- **Per-scenario campaign status:** `locked` (window unopened) →
  `unlocked` (sticker on the board) → optionally `completed` (checkbox)
  or `locked-out` (red sticker; no longer playable). Today the host's
  scenario picker lists every playable scenario — campaign mode would
  filter to unlocked-and-not-locked-out, and completion gets marked at
  scenario victory.
- **Scenario metadata** mirrors the flowchart window: number, name,
  map coordinates, chain (the colored bar), force-linked scenario
  (already referenced by the City Phase skip rules in
  [city-phase.md](city-phase.md)), unlock requirements, and connections
  (the arrows — i.e., which scenarios unlock which).
- **Global achievements** are a campaign-sheet-adjacent list
  (`globalAchievements: string[]`); road/city event requirements can
  check "achievement stickers" ([road-events.md](road-events.md)), so
  they need stable ids.
- "Same party throughout" matches our model: characters are
  campaign-owned instances; the campaign itself is the party.
