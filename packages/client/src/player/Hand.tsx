import { useEffect, useState } from 'react';
import type { Card, CardSelection, PrivatePlayerState } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { btn, theme } from '../theme.js';
import { CardView } from './CardView.js';
import { BOTTOM_BAR_HEIGHT } from './BottomBar.js';

export function Hand({ you }: { you: PrivatePlayerState }) {
  const sock = useSocket();
  const { hand, selection, discard, lost, active, shortRestPending } = you;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [leadingId, setLeadingId] = useState<string | null>(null);

  if (selection) {
    return <SubmittedView selection={selection} hand={hand} />;
  }

  const pendingLost = shortRestPending
    ? lost.find((c) => c.id === shortRestPending.lostCardId) ?? null
    : null;
  const canReroll = !!shortRestPending && shortRestPending.rerollableCardIds.length > 0;

  function tap(cardId: string) {
    setSelectedIds((current) => {
      if (current.includes(cardId)) {
        if (leadingId === cardId) setLeadingId(null);
        return current.filter((id) => id !== cardId);
      }
      if (current.length >= 2) return current;
      return [...current, cardId];
    });
  }

  const selectedCards = selectedIds
    .map((id) => hand.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  const bothSelected = selectedCards.length === 2;
  const canConfirm = bothSelected && leadingId !== null;
  const canShortRest = discard.length >= 2;
  // Long rest's ≥2 gate also counts active-area cards without lost icons —
  // per docs/rules/resting.md "Active-area cards and resting".
  const effectiveDiscardCount =
    discard.length +
    active.filter((c) => c.top.disposition !== 'lost' && c.bottom.disposition !== 'lost').length;
  const canLongRest = effectiveDiscardCount >= 2;
  const secondId = bothSelected ? selectedIds.find((id) => id !== leadingId) ?? null : null;

  // Default leading to the quicker (lower-initiative) card once both are
  // picked. The player can still tap the other chip to override.
  useEffect(() => {
    if (!bothSelected) {
      if (leadingId !== null) setLeadingId(null);
      return;
    }
    if (leadingId && selectedIds.includes(leadingId)) return;
    const quicker = selectedCards.reduce((a, b) => (a.initiative <= b.initiative ? a : b));
    setLeadingId(quicker.id);
  }, [bothSelected, leadingId, selectedIds, selectedCards]);

  return (
    <div style={{ paddingBottom: 88 + BOTTOM_BAR_HEIGHT }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          style={{ ...btn.outline(), opacity: canShortRest && !shortRestPending ? 1 : 0.5, cursor: canShortRest && !shortRestPending ? 'pointer' : 'not-allowed' }}
          disabled={!canShortRest || !!shortRestPending}
          title={canShortRest ? 'Lose 1 random card from discard, return the rest to your hand' : 'Need 2+ cards in discard'}
          onClick={() => {
            if (!canShortRest || shortRestPending) return;
            sock.send({ type: 'player_short_rest' });
          }}
        >
          Short Rest
        </button>
        <button
          style={{ ...btn.outline(), opacity: canLongRest ? 1 : 0.5, cursor: canLongRest ? 'pointer' : 'not-allowed' }}
          disabled={!canLongRest}
          title={canLongRest ? 'Skip this round to recover: choose a card to lose, heal 2, recover items' : 'Need 2+ cards in discard (or active area)'}
          onClick={() => {
            if (!canLongRest) return;
            sock.send({ type: 'player_long_rest' });
          }}
        >
          Long Rest
        </button>
      </div>

      {shortRestPending && pendingLost && (
        <ShortRestModal card={pendingLost} canReroll={canReroll} />
      )}

      <p style={{ fontSize: 13, color: theme.muted, marginTop: 0 }}>
        Tap two cards to play this round, then choose which one sets your <strong>initiative</strong>.
      </p>

      {hand.length === 0 && <p style={{ color: theme.muted }}>No cards in hand.</p>}
      {[...hand].sort((a, b) => a.initiative - b.initiative).map((c) => {
        const isSelected = selectedIds.includes(c.id);
        const marker = leadingId === c.id
          ? 'L'
          : bothSelected && secondId === c.id
            ? '2nd'
            : null;
        return (
          <CardView
            key={c.id}
            card={c}
            marker={marker}
            selected={isSelected}
            onClick={() => tap(c.id)}
          />
        );
      })}

      <div
        style={{
          position: 'fixed',
          bottom: BOTTOM_BAR_HEIGHT,
          left: 0,
          right: 0,
          background: theme.bgSolid,
          padding: '8px 12px',
          borderTop: `1px solid ${theme.border}`,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {bothSelected ? (
          <>
            <span
              style={{
                fontSize: 10,
                color: theme.muted,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                fontFamily: theme.headingFont,
              }}
            >
              Initiative
            </span>
            {selectedCards
              .slice()
              .sort((a, b) => a.initiative - b.initiative)
              .map((c) => {
                const isLeading = leadingId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setLeadingId(c.id)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 16,
                      fontFamily: theme.headingFont,
                      fontWeight: 600,
                      background: isLeading ? theme.accent : 'transparent',
                      color: isLeading ? '#0e1612' : theme.text,
                      border: `1px solid ${isLeading ? theme.accent : theme.border}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      minWidth: 44,
                    }}
                  >
                    {String(c.initiative).padStart(2, '0')}
                  </button>
                );
              })}
          </>
        ) : (
          <span style={{ fontSize: 13, color: theme.muted }}>
            {selectedIds.length === 0 ? 'Select 2 cards' : 'Select 1 more card'}
          </span>
        )}
        <span
          aria-hidden
          style={{
            marginLeft: 'auto',
            width: 1,
            alignSelf: 'stretch',
            background: theme.border,
          }}
        />
        <button
          onClick={() => {
            if (!canConfirm) return;
            sock.send({ type: 'player_select_cards', leadingId: leadingId!, secondId: secondId! });
          }}
          disabled={!canConfirm}
          style={{
            ...btn.primary(!canConfirm),
            width: 160,
            flexShrink: 0,
            fontSize: 15,
            padding: '10px 18px',
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/** Short rest resolution shown as a centered modal over a dimming overlay.
 *  The lost card is server-chosen, so the player only confirms or pays 1
 *  damage to reroll — there's nothing to dismiss, hence no backdrop close. */
function ShortRestModal({ card, canReroll }: { card: Card; canReroll: boolean }) {
  const sock = useSocket();
  return (
    <div
      role="dialog"
      aria-label="Short rest"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: 20,
      }}
    >
      <div
        style={{
          background: theme.panel,
          border: `1px solid ${theme.accent}`,
          borderRadius: 8,
          padding: 20,
          maxWidth: 360,
          width: '100%',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontFamily: theme.headingFont,
          }}
        >
          Short rest — losing
        </div>
        <div style={{ margin: '8px 0 14px' }}>
          <CardView card={card} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={btn.outline()}
            onClick={() => sock.send({ type: 'player_short_rest_accept' })}
          >
            Confirm
          </button>
          <button
            style={{ ...btn.ghost(), opacity: canReroll ? 1 : 0.5, cursor: canReroll ? 'pointer' : 'not-allowed' }}
            disabled={!canReroll}
            title={canReroll ? 'Take 1 damage, lose a different random card instead (once per short rest)' : 'No other cards to swap to'}
            onClick={() => {
              if (!canReroll) return;
              sock.send({ type: 'player_short_rest_reroll' });
            }}
          >
            Suffer 1 damage to reroll
          </button>
        </div>
      </div>
    </div>
  );
}

type CardTab = 'hand' | 'discard' | 'lost';

export function CardsOverview({ you }: { you: PrivatePlayerState }) {
  const [tab, setTab] = useState<CardTab>('hand');
  const groups: { id: CardTab; label: string; cards: Card[] }[] = [
    { id: 'hand', label: 'Hand', cards: [...you.hand].sort((a, b) => a.initiative - b.initiative) },
    { id: 'discard', label: 'Discard', cards: [...you.discard].sort((a, b) => a.initiative - b.initiative) },
    { id: 'lost', label: 'Lost', cards: [...you.lost].sort((a, b) => a.initiative - b.initiative) },
  ];
  const active = groups.find((g) => g.id === tab) ?? groups[0]!;
  return (
    <div style={{ marginTop: 16 }}>
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: `1px solid ${theme.border}`,
          marginBottom: 12,
        }}
      >
        {groups.map((g) => {
          const isActive = g.id === active.id;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(g.id)}
              style={{
                background: 'transparent',
                color: isActive ? theme.accent : theme.muted,
                border: 'none',
                borderBottom: `2px solid ${isActive ? theme.accent : 'transparent'}`,
                padding: '8px 12px',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                fontFamily: theme.headingFont,
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {g.label} ({g.cards.length})
            </button>
          );
        })}
      </div>
      {active.cards.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: 13, margin: '4px 0' }}>—</p>
      ) : (
        active.cards.map((c) => <CardView key={c.id} card={c} />)
      )}
    </div>
  );
}

function SubmittedView({
  selection,
  hand,
}: {
  selection: CardSelection;
  hand: Card[];
}) {
  const sock = useSocket();
  if (selection.kind === 'long_rest') {
    return (
      <div>
        <p style={{ color: theme.text }}>You are taking a <strong>Long Rest</strong> this round.</p>
        <button onClick={() => sock.send({ type: 'player_unsubmit' })} style={btn.ghost()}>
          Change my mind
        </button>
      </div>
    );
  }
  const leading = hand.find((c) => c.id === selection.leadingId);
  const second = hand.find((c) => c.id === selection.secondId);
  return (
    <div>
      <p style={{ color: theme.text }}>Locked in. Waiting for other players…</p>
      <button
        onClick={() => sock.send({ type: 'player_unsubmit' })}
        style={{ ...btn.ghost(), marginBottom: 12 }}
      >
        Change my mind
      </button>
      {leading && <CardView card={leading} marker="L" selected />}
      {second && <CardView card={second} marker="2nd" selected />}
    </div>
  );
}
