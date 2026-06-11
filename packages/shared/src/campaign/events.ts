/**
 * Road / city event deck state (docs/rules/road-events.md,
 * docs/rules/city-phase.md).
 *
 * The deck's order is persistent campaign state — NOT reshuffled between
 * draws. Per the rulebook, shuffles happen at exactly two moments: when the
 * deck is first assembled (campaign start), and after an event is added to
 * or removed from the deck by a campaign instruction. A resolved card with
 * the return icon goes to the BOTTOM of the deck (deliberately unshuffled,
 * so everything above it comes up first); other resolved cards are removed
 * from the game but kept aside, since campaign instructions can re-add them
 * by reference number.
 *
 * Events are tracked here by id only; card content lives in
 * road-event-cards.ts and STARTING_ROAD_EVENT_IDS is derived from it, so a
 * card is in the starting deck as soon as it's transcribed. Note that
 * `eventDeckNeedsSeed` only reseeds never-played decks — campaigns that
 * already drew from a partial deck won't pick up later-transcribed cards
 * automatically.
 */

import { CITY_EVENT_CARDS } from './city-event-cards.js';
import { ROAD_EVENT_CARDS } from './road-event-cards.js';

/** Starting decks are events 1–20 (2E FAQ); higher-numbered cards enter
 *  play later via campaign instructions ("add event R-71 to the road
 *  deck"). */
function startingIds(cards: readonly { id: string }[]): readonly string[] {
  return cards
    .map((card) => card.id)
    .filter((id) => Number(id.split('-')[1]) <= 20);
}

export interface EventDeckState {
  /** Ordered card ids; index 0 is the top of the deck. */
  deck: string[];
  /** Cards resolved out of the deck ("removed from the game without
   *  destroying it"). Campaign instructions may re-add them later. */
  removed: string[];
  /** Boxes checked so far on cards with a printed checkbox track (e.g.
   *  R-03), keyed by card id. Such cards return to the deck between draws,
   *  so the count accumulates across multiple resolutions. Absent for
   *  saves made before tracked cards existed. */
  checks?: Record<string, number>;
  /** Ware ids purchased so far from cards with a printed shop (e.g. R-04),
   *  keyed by card id. Accumulates across draws like `checks`. */
  purchases?: Record<string, string[]>;
}

/** Ids of the events in the road event deck at campaign start. */
export const STARTING_ROAD_EVENT_IDS: readonly string[] =
  startingIds(ROAD_EVENT_CARDS);

/** Ids of the events in the city event deck at campaign start. */
export const STARTING_CITY_EVENT_IDS: readonly string[] =
  startingIds(CITY_EVENT_CARDS);

/** Uniform-random source, injectable for deterministic tests. */
export type Rng = () => number;

function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Assemble and shuffle an event deck (campaign start). */
export function createEventDeck(
  startingIds: readonly string[],
  rng: Rng = Math.random,
): EventDeckState {
  return { deck: shuffled(startingIds, rng), removed: [] };
}

/**
 * Whether a saved deck should be (re)seeded from the starting list: it's
 * missing entirely, or it's empty on both sides — which can only mean it
 * was seeded before the event cards existed, since play always leaves
 * cards somewhere (in the deck via bottom-returns, or in `removed`).
 */
export function eventDeckNeedsSeed(
  state: EventDeckState | undefined,
  startingIds: readonly string[],
): boolean {
  if (!state || !Array.isArray(state.deck) || !Array.isArray(state.removed)) {
    return true;
  }
  return (
    startingIds.length > 0 && state.deck.length === 0 && state.removed.length === 0
  );
}

/** Draw the top card. Null when the deck is empty. The caller resolves the
 *  event and then routes the card via `resolveDrawnEvent`. */
export function drawTopEvent(state: EventDeckState): string | null {
  return state.deck.shift() ?? null;
}

/** File a resolved (already-drawn) card: bottom of the deck when the
 *  outcome shows the return icon, otherwise out of the game. No shuffle —
 *  the rulebook shuffles only on add/remove instructions. */
export function resolveDrawnEvent(
  state: EventDeckState,
  id: string,
  returnToDeck: boolean,
): void {
  if (returnToDeck) state.deck.push(id);
  else state.removed.push(id);
}

/** Check `count` boxes on a tracked card, clamped to the card's printed
 *  track length. Returns the box numbers newly checked (e.g. [3, 4]) so
 *  the caller can fire any milestones tied to them ("when you check the
 *  third box, read 17.3"). */
export function checkEventBoxes(
  state: EventDeckState,
  id: string,
  count: number,
  maxBoxes: number,
): number[] {
  const before = state.checks?.[id] ?? 0;
  const after = Math.min(maxBoxes, before + count);
  if (after <= before) return [];
  (state.checks ??= {})[id] = after;
  const newly: number[] = [];
  for (let box = before + 1; box <= after; box++) newly.push(box);
  return newly;
}

/** Record the purchase of a shop ware on a card (e.g. R-04). Returns the
 *  updated list of purchased ware ids for that card, so the caller can
 *  tell when every ware is gone ("when all boxes are checked, remove this
 *  event from the road deck"). */
export function recordEventPurchase(
  state: EventDeckState,
  id: string,
  wareId: string,
): readonly string[] {
  const purchases = (state.purchases ??= {});
  const list = (purchases[id] ??= []);
  if (!list.includes(wareId)) list.push(wareId);
  return list;
}

/** Campaign instruction: add an event to the deck (typically from
 *  `removed`, but brand-new ids work too), then shuffle the deck. */
export function addEventToDeck(
  state: EventDeckState,
  id: string,
  rng: Rng = Math.random,
): void {
  state.removed = state.removed.filter((x) => x !== id);
  if (!state.deck.includes(id)) state.deck.push(id);
  state.deck = shuffled(state.deck, rng);
}

/** Campaign instruction: remove an event from the deck (to `removed`),
 *  then shuffle the deck. */
export function removeEventFromDeck(
  state: EventDeckState,
  id: string,
  rng: Rng = Math.random,
): void {
  if (!state.deck.includes(id)) return;
  state.deck = shuffled(
    state.deck.filter((x) => x !== id),
    rng,
  );
  if (!state.removed.includes(id)) state.removed.push(id);
}
