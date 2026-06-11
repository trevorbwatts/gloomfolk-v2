import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addEventToDeck,
  checkEventBoxes,
  CITY_EVENT_CARDS,
  createEventDeck,
  drawTopEvent,
  eventDeckNeedsSeed,
  recordEventPurchase,
  removeEventFromDeck,
  resolveDrawnEvent,
  ROAD_EVENT_CARDS,
  STARTING_CITY_EVENT_IDS,
  STARTING_ROAD_EVENT_IDS,
  STORYBOOK_SECTIONS,
  type EventDeckState,
} from '../src/index.js';

/** Tiny deterministic RNG (mulberry32) so shuffle results are stable. */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IDS = ['e01', 'e02', 'e03', 'e04', 'e05', 'e06'];

test('createEventDeck shuffles: a permutation of the starting ids', () => {
  const state = createEventDeck(IDS, seededRng(1));
  assert.deepEqual([...state.deck].sort(), [...IDS].sort());
  assert.deepEqual(state.removed, []);
  // Different seeds give different orders (sanity that it shuffles at all).
  const other = createEventDeck(IDS, seededRng(2));
  assert.notDeepEqual(state.deck, other.deck);
});

test('draw pops the top; resolution routes to bottom or removed', () => {
  const state = createEventDeck(IDS, seededRng(3));
  const order = [...state.deck];
  const drawn = drawTopEvent(state);
  assert.equal(drawn, order[0]);

  // Return icon: to the bottom, rest of the order untouched (no shuffle).
  resolveDrawnEvent(state, drawn!, true);
  assert.deepEqual(state.deck, [...order.slice(1), drawn]);
  assert.deepEqual(state.removed, []);

  // No return icon: out of the game.
  const second = drawTopEvent(state)!;
  resolveDrawnEvent(state, second, false);
  assert.deepEqual(state.deck, [...order.slice(2), drawn]);
  assert.deepEqual(state.removed, [second]);
});

test('drawTopEvent on an empty deck returns null', () => {
  const state: EventDeckState = { deck: [], removed: [] };
  assert.equal(drawTopEvent(state), null);
});

test('add/remove instructions shuffle and move cards between piles', () => {
  const state = createEventDeck(IDS, seededRng(4));
  removeEventFromDeck(state, 'e03', seededRng(5));
  assert.equal(state.deck.length, IDS.length - 1);
  assert.ok(!state.deck.includes('e03'));
  assert.deepEqual(state.removed, ['e03']);

  addEventToDeck(state, 'e03', seededRng(6));
  assert.deepEqual([...state.deck].sort(), [...IDS].sort());
  assert.deepEqual(state.removed, []);

  // Removing a card that isn't in the deck is a no-op.
  const before = [...state.deck];
  removeEventFromDeck(state, 'e99', seededRng(7));
  assert.deepEqual(state.deck, before);
});

test('event card data: unique ids, starting decks derived from cards', () => {
  const sectionIds = STORYBOOK_SECTIONS.map((s) => s.id);
  assert.equal(new Set(sectionIds).size, sectionIds.length);
  const decks = [
    { cards: ROAD_EVENT_CARDS, starting: STARTING_ROAD_EVENT_IDS },
    { cards: CITY_EVENT_CARDS, starting: STARTING_CITY_EVENT_IDS },
  ];
  const allCards = decks.flatMap((d) => d.cards);
  for (const { cards, starting } of decks) {
    const ids = cards.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    // Starting deck is events 1–20 (2E FAQ); later events join via
    // campaign instructions.
    assert.deepEqual(
      [...starting],
      ids.filter((id) => Number(id.split('-')[1]) <= 20),
    );
  }
  // Every card resolves somehow: options to choose, or a modifier-draw
  // game. A card with a flip-card effect must have a back to flip to.
  for (const card of allCards) {
    assert.ok(
      card.options.length > 0 || card.game,
      `${card.id} has no options and no game`,
    );
    if (card.game) {
      const bands = card.game.results.map((r) => r.draw);
      assert.equal(
        new Set(bands).size,
        bands.length,
        `${card.id} duplicate result bands`,
      );
      const flips = card.game.results.some((r) =>
        r.effects.some((e) => e.kind === 'flip-card'),
      );
      if (flips) assert.ok(card.flipped, `${card.id} flips but has no back`);
    }
    for (const opt of card.options) {
      assert.ok(opt.outcome.text.length > 0, `${card.id}${opt.id} outcome`);
      // An option with a requirement needs an "otherwise" branch to read
      // when the requirement fails.
      if (opt.requirement) {
        assert.ok(opt.otherwise, `${card.id}${opt.id} missing otherwise`);
      }
      // Shop wares need unique ids (purchases are tracked by ware id).
      for (const effect of [
        ...opt.outcome.effects,
        ...(opt.otherwise?.effects ?? []),
      ]) {
        if (effect.kind === 'shop') {
          const wareIds = effect.wares.map((w) => w.id);
          assert.equal(
            new Set(wareIds).size,
            wareIds.length,
            `${card.id}${opt.id} duplicate ware ids`,
          );
          for (const ware of effect.wares) {
            assert.ok(
              STORYBOOK_SECTIONS.some((s) => s.id === ware.readSection),
              `${card.id} ware ${ware.id} references missing section ${ware.readSection}`,
            );
          }
        }
      }
    }
    // Track milestones must point at boxes that exist on the card, and at
    // a storybook section that has been transcribed.
    if (card.track) {
      assert.ok(card.track.boxes > 0, `${card.id} empty track`);
      for (const m of card.track.milestones) {
        assert.ok(
          m.box >= 1 && m.box <= card.track.boxes,
          `${card.id} milestone box ${m.box} out of range`,
        );
        assert.ok(
          STORYBOOK_SECTIONS.some((s) => s.id === m.readSection),
          `${card.id} references missing section ${m.readSection}`,
        );
      }
    }
  }
});

test('checkEventBoxes accumulates, clamps, and reports newly checked boxes', () => {
  const state: EventDeckState = { deck: [], removed: [] };
  // First resolution of R-03: 1 auto + 2 blesses removed.
  assert.deepEqual(checkEventBoxes(state, 'R-03', 3, 8), [1, 2, 3]);
  assert.equal(state.checks?.['R-03'], 3);
  // Later resolution: counts continue from where they left off.
  assert.deepEqual(checkEventBoxes(state, 'R-03', 1, 8), [4]);
  // Overshooting clamps at the printed track length.
  assert.deepEqual(checkEventBoxes(state, 'R-03', 10, 8), [5, 6, 7, 8]);
  assert.equal(state.checks?.['R-03'], 8);
  // Full track: nothing more to check.
  assert.deepEqual(checkEventBoxes(state, 'R-03', 1, 8), []);
});

test('recordEventPurchase accumulates unique ware ids per card', () => {
  const state: EventDeckState = { deck: [], removed: [] };
  assert.deepEqual(recordEventPurchase(state, 'R-04', 'white-crystal'), [
    'white-crystal',
  ]);
  // Buying the same ware twice is impossible; recording it again is a no-op.
  assert.deepEqual(recordEventPurchase(state, 'R-04', 'white-crystal'), [
    'white-crystal',
  ]);
  assert.deepEqual(recordEventPurchase(state, 'R-04', 'rusted-gear'), [
    'white-crystal',
    'rusted-gear',
  ]);
  assert.deepEqual(state.purchases, {
    'R-04': ['white-crystal', 'rusted-gear'],
  });
});

test('eventDeckNeedsSeed: missing or pre-card decks reseed, played decks do not', () => {
  assert.equal(eventDeckNeedsSeed(undefined, IDS), true);
  // Seeded while the starting list was empty → reseed once cards exist.
  assert.equal(eventDeckNeedsSeed({ deck: [], removed: [] }, IDS), true);
  // ...but not while the starting list is still empty.
  assert.equal(eventDeckNeedsSeed({ deck: [], removed: [] }, []), false);
  // A deck in play (cards in the deck or resolved out of it) is never reseeded.
  assert.equal(eventDeckNeedsSeed({ deck: ['e01'], removed: [] }, IDS), false);
  assert.equal(eventDeckNeedsSeed({ deck: [], removed: ['e01'] }, IDS), false);
});
