import { useEffect, useState } from 'react';
import type { ModifierDrawResult, PrivatePlayerState } from '@gloomfolk/shared';
import { modifierLabel } from '@gloomfolk/shared';

/**
 * Shows the player's attack-modifier deck as a face-down stack with the count,
 * a small discard pile, and a reveal animation when new draws come in from
 * `lastModifierDraws`. Multi-target / AOE attacks reveal one card per target.
 */
export function ModifierDeckView({
  you,
  lastDraws,
}: {
  you: PrivatePlayerState;
  lastDraws: ModifierDrawResult[];
}) {
  const deckCount = you.modifierDeck.length;
  const discardCount = you.modifierDiscard.length;
  const topDiscard = you.modifierDiscard[you.modifierDiscard.length - 1] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: 8,
        marginBottom: 10,
        border: '1px solid #3a3a45',
        background: '#15151a',
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CardBack count={deckCount} />
        <span style={{ opacity: 0.7 }}>Deck · {deckCount}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {topDiscard ? (
          <CardFace label={modifierLabel(topDiscard.card)} muted />
        ) : (
          <CardEmpty />
        )}
        <span style={{ opacity: 0.7 }}>Discard · {discardCount}</span>
      </div>

      <RevealStrip draws={lastDraws} />

      {you.modifierNeedsReshuffle && (
        <div
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            background: '#4a2a15',
            border: '1px solid #a05a2a',
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          Reshuffle at end of turn
        </div>
      )}
    </div>
  );
}

function RevealStrip({ draws }: { draws: ModifierDrawResult[] }) {
  if (draws.length === 0) {
    return (
      <div style={{ opacity: 0.5, fontSize: 11, marginLeft: 8 }}>
        No draws yet this turn.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
      {draws.map((d) => (
        <RevealCard key={d.id} draw={d} />
      ))}
    </div>
  );
}

function RevealCard({ draw }: { draw: ModifierDrawResult }) {
  // Flip animation: render face-down, then flip to face-up after a tick.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 50);
    return () => clearTimeout(t);
  }, []);

  const label = modifierLabel(draw.card);
  const isCrit = draw.card.kind === 'crit';
  const isNull = draw.card.kind === 'null';
  const accent = isCrit ? '#d4a64a' : isNull ? '#a04a4a' : '#3a3a45';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div
        style={{
          width: 48,
          height: 64,
          perspective: 600,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transition: 'transform 350ms ease-out',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Back */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: '#1a2a3a',
              border: '1px solid #2e4a6b',
              borderRadius: 6,
            }}
          />
          {/* Face */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#23232a',
              border: `2px solid ${accent}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: label.length > 2 ? 13 : 18,
              color: isCrit ? '#f0c870' : isNull ? '#e8a0a0' : '#e8e8ea',
            }}
          >
            {label}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 10, opacity: 0.85 }}>
        {draw.targetName}
      </span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>
        {draw.baseAmount} → <strong>{draw.finalAmount}</strong>
        {draw.damageDealt !== draw.finalAmount && ` (${draw.damageDealt})`}
      </span>
    </div>
  );
}

function CardBack({ count }: { count: number }) {
  return (
    <div
      style={{
        width: 40,
        height: 56,
        background: count > 0 ? '#1a2a3a' : '#101015',
        border: `1px solid ${count > 0 ? '#2e4a6b' : '#2a2a30'}`,
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        opacity: count > 0 ? 1 : 0.4,
      }}
    >
      {count > 0 ? '🂠' : '—'}
    </div>
  );
}

function CardFace({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      style={{
        width: 40,
        height: 56,
        background: '#23232a',
        border: '1px solid #444',
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: label.length > 2 ? 11 : 16,
        opacity: muted ? 0.85 : 1,
      }}
    >
      {label}
    </div>
  );
}

function CardEmpty() {
  return (
    <div
      style={{
        width: 40,
        height: 56,
        background: '#101015',
        border: '1px dashed #2a2a30',
        borderRadius: 5,
        opacity: 0.4,
      }}
    />
  );
}
