# Character Turns and Character Ability Cards

> Transcribed from the Gloomhaven 2E rulebook.

## Character Turns

On a character's turn, unless performing a long rest (see p. 36), they will
perform the top action of one of their played ability cards and the bottom
action of the other. **They cannot perform two top actions or two bottom
actions.** They can perform either action first; which card was selected for
their initiative no longer matters.

Once played, ability cards can be placed around the sides of the character
mat as shown: **discarded** ability cards to the left, **lost** ability
cards to the right, and **active** ability cards above the mat. Cards in the
character's hand must be kept separate.

## Character Ability Cards

Character ability cards, which are all unique, determine which actions a
character can perform. A character ability card has the following features:

- **A — Card Name.**
- **B — Initiative Value.** Determines when the character acts during the
  round (see p. 17).
- **C — Level.** The level of the card. **Level X cards are considered
  level 1 for all purposes.**
- **D — Actions.** Each card has a top action and a bottom action. The
  abilities of an action are performed from top to bottom, with each
  ability separated by an ability line. After the action is performed, the
  card is placed in the character's active area, discard pile, or lost pile,
  depending on the card's icons. **A character may choose not to perform an
  action, in which case the card is discarded with no effect.**
- **E — Basic Action Icons.** An ability card can always be used for a basic
  `Attack 2` top action or `Move 2` bottom action. If a card is used this
  way, the card is discarded and **no other icons or abilities on the card
  are activated**.
- **F — Enhancement Marks.** Squares, circles, diamonds, and hexes next to
  some abilities. Their purpose will be revealed later in the campaign.

## Implications for the schema

- **Level `'X'` semantics confirmed.** Treated as level 1 for all purposes.
  Our `CardLevel` type already accommodates `'X'`. Engine resolves "this
  card counts as level 1" at deck-construction and prerequisite checks.

- **"Choose not to perform" path.** Even after committing two cards for
  initiative, a player can opt out of performing the action — the card
  goes to discard with no effect, no disposition fires. Engine workflow
  detail.

- **Basic actions are unchanged from 1E:** `Attack 2` (top) and `Move 2`
  (bottom), universal across all classes. Our `BASIC_ATTACK_2` and
  `BASIC_MOVE_2` constants in `basics.ts` match.

- **`NodeShape` should widen to all four enhancement-mark shapes.** Today
  we have `'diamond' | 'square'` based on the cards encoded so far. The
  rulebook confirms the full set is squares, circles, diamonds, and
  hexes. Closed enum, not speculation — extending now.

- **Card placement (discard left, lost right, active above)** is a UI rule.
  No schema impact.

- **Initiative is for round ordering only** — once your turn starts you can
  resolve top-then-bottom or bottom-then-top freely. Already what our model
  assumes.
