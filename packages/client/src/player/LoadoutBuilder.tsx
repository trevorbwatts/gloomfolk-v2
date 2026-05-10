import { useMemo, useState } from 'react';
import {
  cardsInPool,
  defaultLoadout,
  type Card,
  type CardLevel,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { CardView } from './CardView.js';

/**
 * The order of level groups shown in the picker. Level 1 first (the default
 * picks), then X (the swap-ins), then 2..9 (post-level-up additions).
 */
const LEVEL_GROUP_ORDER: readonly CardLevel[] = [1, 'X', 2, 3, 4, 5, 6, 7, 8, 9];

function levelLabel(level: CardLevel): string {
  return level === 'X' ? 'Level X' : `Level ${level}`;
}

export function LoadoutBuilder({
  characterClass,
  pool,
  initialChosenIds,
  onBack,
  onLockIn,
}: {
  characterClass: CharacterClass;
  pool: CharacterPool;
  initialChosenIds?: readonly string[];
  onBack: () => void;
  onLockIn: (chosenCardIds: readonly string[]) => void;
}) {
  const handSize = characterClass.handSize;

  const initial = useMemo(
    () =>
      new Set<string>(initialChosenIds ?? defaultLoadout(characterClass, pool)),
    // We only want to initialize once per (class, pool, initialChosenIds) tuple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [characterClass, pool, initialChosenIds],
  );
  const [chosen, setChosen] = useState<Set<string>>(initial);

  const cards = useMemo(() => cardsInPool(characterClass, pool), [characterClass, pool]);

  const grouped = useMemo(() => {
    const byLevel = new Map<CardLevel, Card[]>();
    for (const lvl of LEVEL_GROUP_ORDER) byLevel.set(lvl, []);
    for (const card of cards) {
      byLevel.get(card.level)?.push(card);
    }
    return LEVEL_GROUP_ORDER.map((level) => ({
      level,
      cards: (byLevel.get(level) ?? []).slice().sort((a, b) => a.initiative - b.initiative),
    })).filter((g) => g.cards.length > 0);
  }, [cards]);

  const selectedCount = chosen.size;
  const overBudget = selectedCount > handSize;
  const lockable = selectedCount === handSize;
  const counterColor = overBudget ? '#ff5d5d' : selectedCount === handSize ? '#7bd57b' : '#eee';

  const [warning, setWarning] = useState<string | null>(null);

  function toggle(cardId: string) {
    setWarning(null);
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function tryLockIn() {
    if (lockable) {
      onLockIn(Array.from(chosen));
      return;
    }
    if (overBudget) {
      setWarning(
        `You have ${selectedCount} cards selected. Tap cards to deselect until you have ${handSize}.`,
      );
    } else {
      setWarning(
        `You have ${selectedCount} cards selected. Tap ${handSize - selectedCount} more to lock in.`,
      );
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            color: '#eee',
            border: '1px solid #444',
            borderRadius: 4,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>{characterClass.name} — Build your hand</h2>
        <div
          aria-live="polite"
          style={{
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: 600,
            color: counterColor,
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {selectedCount}/{handSize}
        </div>
      </div>

      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 0 }}>
        Tap any card to add or remove it from your hand. You can take {handSize}{' '}
        cards into the scenario.
      </p>

      {grouped.map(({ level, cards: levelCards }) => (
        <section key={String(level)} style={{ marginTop: 16 }}>
          <h3
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 1,
              opacity: 0.6,
              margin: '0 0 4px',
            }}
          >
            {levelLabel(level)}
          </h3>
          {levelCards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              selected={chosen.has(card.id)}
              onClick={() => toggle(card.id)}
            />
          ))}
        </section>
      ))}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#18181b',
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 16,
          borderTop: '1px solid #2a2a2e',
        }}
      >
        {warning && (
          <p
            role="alert"
            style={{
              color: '#ff5d5d',
              fontSize: 13,
              margin: '0 0 8px',
            }}
          >
            {warning}
          </p>
        )}
        <button
          onClick={tryLockIn}
          disabled={!lockable}
          style={{
            width: '100%',
            fontSize: 16,
            fontWeight: 600,
            padding: '12px 16px',
            border: 'none',
            borderRadius: 6,
            background: lockable ? '#3a7bd5' : '#2a2a2e',
            color: lockable ? '#fff' : '#777',
            cursor: lockable ? 'pointer' : 'not-allowed',
          }}
        >
          Lock in ({selectedCount}/{handSize})
        </button>
      </div>
    </div>
  );
}
