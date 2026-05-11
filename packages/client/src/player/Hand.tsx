import { useState } from 'react';
import type { Card, CardSelection, PrivatePlayerState } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { btn, theme } from '../theme.js';
import { CardView } from './CardView.js';

export function Hand({ you }: { you: PrivatePlayerState }) {
  const sock = useSocket();
  const { hand, selection, discard, lost, shortRestPending } = you;
  const [leading, setLeading] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);

  if (selection) {
    return <SubmittedView selection={selection} hand={hand} />;
  }

  const pendingLost = shortRestPending
    ? lost.find((c) => c.id === shortRestPending.lostCardId) ?? null
    : null;
  const canReroll = !!shortRestPending && shortRestPending.rerollableCardIds.length > 0;

  function tap(cardId: string) {
    if (leading === cardId) {
      setLeading(null);
      return;
    }
    if (second === cardId) {
      setSecond(null);
      return;
    }
    if (!leading) setLeading(cardId);
    else if (!second) setSecond(cardId);
    else setSecond(cardId);
  }

  const selectedCount = (leading ? 1 : 0) + (second ? 1 : 0);
  const canConfirm = leading && second && leading !== second;
  const canShortRest = discard.length >= 2;

  return (
    <div>
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
          style={btn.outline()}
          title="Skip this round to recover: choose a card to lose, heal 2, recover items"
          onClick={() => sock.send({ type: 'player_long_rest' })}
        >
          Long Rest
        </button>
      </div>

      {shortRestPending && pendingLost && (
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.accent}`,
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, color: theme.muted, textTransform: 'uppercase', letterSpacing: 1, fontFamily: theme.headingFont }}>
            Short rest
          </div>
          <div style={{ fontSize: 16, color: theme.text, margin: '4px 0 10px' }}>
            Lost: <strong style={{ color: theme.accent }}>{pendingLost.name}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...btn.outline(), opacity: canReroll ? 1 : 0.5, cursor: canReroll ? 'pointer' : 'not-allowed' }}
              disabled={!canReroll}
              title={canReroll ? 'Take 1 damage, lose a different random card instead (once per short rest)' : 'No other cards to swap to'}
              onClick={() => {
                if (!canReroll) return;
                sock.send({ type: 'player_short_rest_reroll' });
              }}
            >
              Suffer 1 to reroll
            </button>
            <button
              style={btn.ghost()}
              onClick={() => sock.send({ type: 'player_short_rest_accept' })}
            >
              Keep
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 13, color: theme.muted, marginTop: 0 }}>
        Tap a card to mark it <strong>leading</strong>, then another for <strong>second</strong>.
        The leading card sets your initiative.
      </p>

      {hand.length === 0 && <p style={{ color: theme.muted }}>No cards in hand.</p>}
      {[...hand].sort((a, b) => a.initiative - b.initiative).map((c) => {
        const marker = leading === c.id ? 'L' : second === c.id ? '2nd' : null;
        return (
          <CardView
            key={c.id}
            card={c}
            marker={marker}
            selected={marker !== null}
            onClick={() => tap(c.id)}
          />
        );
      })}

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
        <button
          onClick={() => {
            if (!canConfirm) return;
            sock.send({ type: 'player_select_cards', leadingId: leading!, secondId: second! });
          }}
          disabled={!canConfirm}
          style={{
            ...btn.primary(!canConfirm),
            width: '100%',
            fontSize: 16,
            padding: '14px 16px',
          }}
        >
          Confirm ({selectedCount}/2)
        </button>
      </div>
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
