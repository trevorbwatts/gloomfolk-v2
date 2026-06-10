# Unlocking New Classes

> Transcribed from the Gloomhaven 2E rulebook.

New classes are unlocked through **personal quests**. There are **12 new
classes** that can be unlocked. Each new class has two corresponding
sealed tuck boxes, labeled with a class icon. (Note: One locked class has
two small tuck boxes because it uses two miniatures.)

When a class is unlocked, you are free to open its tuck boxes and inspect
the contents, including the higher-level ability cards. That class is now
**available when a player creates a new character** (see p. 56).

Unlocked classes are recorded on the campaign sheet's **Classes Unlocked**
section (see [campaign-sheet.md](campaign-sheet.md)).

## Implications for the schema (notes for later)

- `classesUnlocked: string[]` on the campaign sheet; character creation
  offers starting classes plus unlocked ones.
- Personal quests (the unlock trigger) aren't modeled yet — when they
  are, completing one resolves an unlock instruction that appends here.
- In our digital model "sealed tuck boxes" just means: don't show a locked
  class's cards/mats anywhere until unlocked.
