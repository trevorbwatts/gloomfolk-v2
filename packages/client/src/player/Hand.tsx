import { useState } from 'react';
import type { Card, CardSelection, PrivatePlayerState } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { CardView } from './CardView.js';

export function Hand({ you }: { you: PrivatePlayerState }) {
  const sock = useSocket();
  const { hand, selection } = you;
  const [leading, setLeading] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);

  // If server already has a selection, show submitted view
  if (selection) {
    return <SubmittedView selection={selection} hand={hand} />;
  }

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
    else {
      // both filled — replace second
      setSecond(cardId);
    }
  }

  const canConfirm = leading && second && leading !== second;

  return (
    <div>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Tap a card to mark it <strong>leading</strong>, then another for <strong>second</strong>.
        The leading card sets your initiative.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          disabled={!canConfirm}
          style={{ flex: 1, fontSize: 16, padding: '10px 14px' }}
          onClick={() => {
            if (!canConfirm) return;
            sock.send({ type: 'player_select_cards', leadingId: leading!, secondId: second! });
          }}
        >
          Confirm
        </button>
        <button
          style={{ fontSize: 14, padding: '10px 14px' }}
          onClick={() => sock.send({ type: 'player_long_rest' })}
        >
          Long Rest
        </button>
      </div>
      {hand.length === 0 && <p style={{ opacity: 0.6 }}>No cards in hand.</p>}
      {hand.map((c) => {
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
        <p>You are taking a <strong>Long Rest</strong> this round.</p>
        <button onClick={() => sock.send({ type: 'player_unsubmit' })} style={{ fontSize: 14, padding: '8px 14px' }}>
          Change my mind
        </button>
      </div>
    );
  }
  const leading = hand.find((c) => c.id === selection.leadingId);
  const second = hand.find((c) => c.id === selection.secondId);
  return (
    <div>
      <p>Locked in. Waiting for other players…</p>
      <button
        onClick={() => sock.send({ type: 'player_unsubmit' })}
        style={{ fontSize: 14, padding: '8px 14px', marginBottom: 12 }}
      >
        Change my mind
      </button>
      {leading && <CardView card={leading} marker="L" selected />}
      {second && <CardView card={second} marker="2nd" selected />}
    </div>
  );
}
