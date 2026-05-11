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
import { classAvatarUrl, onAvatarError } from '../avatars.js';
import { btn, theme } from '../theme.js';

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
  const counterColor = overBudget ? theme.bad : selectedCount === handSize ? theme.good : theme.text;

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
          style={{ ...btn.ghost(), padding: '6px 10px' }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>
          <img
            src={classAvatarUrl(characterClass.id)}
            onError={onAvatarError}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              objectFit: 'cover',
              background: theme.bgSolid,
            }}
          />
          {characterClass.name} — Build your hand
        </h2>
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

      <p style={{ color: theme.muted, fontSize: 13, marginTop: 0 }}>
        Tap any card to add or remove it from your hand. You can take {handSize}{' '}
        cards into the scenario.
      </p>

      {grouped.map(({ level, cards: levelCards }) => (
        <section key={String(level)} style={{ marginTop: 16 }}>
          <h3
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: theme.muted,
              fontFamily: theme.headingFont,
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
          background: theme.bgSolid,
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 16,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        {warning && (
          <p
            role="alert"
            style={{
              color: theme.bad,
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
            ...btn.primary(!lockable),
            width: '100%',
            fontSize: 16,
            padding: '14px 16px',
          }}
        >
          Lock in ({selectedCount}/{handSize})
        </button>
      </div>
    </div>
  );
}
