import { useEffect, useState } from 'react';
import type { ModifierDrawResult, PrivatePlayerState } from '@gloomfolk/shared';
import { modifierLabel } from '@gloomfolk/shared';
import { theme } from '../theme.js';

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
        border: `1px solid ${theme.border}`,
        background: theme.panel,
        borderRadius: 6,
        fontSize: 12,
        fontFamily: theme.font,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CardBack count={deckCount} />
        <span style={{ color: theme.muted }}>Deck · {deckCount}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {topDiscard ? (
          <CardFace label={modifierLabel(topDiscard.card)} muted />
        ) : (
          <CardEmpty />
        )}
        <span style={{ color: theme.muted }}>Discard · {discardCount}</span>
      </div>

      <RevealStrip draws={lastDraws} />

      {you.modifierNeedsReshuffle && (
        <div
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            background: 'rgba(217, 164, 65, 0.12)',
            border: `1px solid ${theme.accent}`,
            color: theme.accent,
            borderRadius: 4,
            fontSize: 11,
            letterSpacing: 0.5,
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
      <div style={{ color: theme.muted, fontSize: 11, marginLeft: 8, opacity: 0.7 }}>
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
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 50);
    return () => clearTimeout(t);
  }, []);

  const label = modifierLabel(draw.card);
  const isCrit = draw.card.kind === 'crit';
  const isNull = draw.card.kind === 'null';
  const accent = isCrit ? theme.accent : isNull ? theme.bad : theme.border;

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
              background: theme.panelRaised,
              border: `1px solid ${theme.border}`,
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
              background: theme.panelRaised,
              border: `2px solid ${accent}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: label.length > 2 ? 13 : 18,
              fontFamily: theme.headingFont,
              color: isCrit ? theme.accent : isNull ? theme.bad : theme.text,
            }}
          >
            {label}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 10, color: theme.muted }}>
        {draw.targetName}
      </span>
      <span style={{ fontSize: 10, color: theme.muted }}>
        {draw.baseAmount} → <strong style={{ color: theme.text }}>{draw.finalAmount}</strong>
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
        background: count > 0 ? theme.panelRaised : theme.bgSolid,
        border: `1px solid ${theme.border}`,
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: theme.muted,
        opacity: count > 0 ? 1 : 0.5,
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
        background: theme.panelRaised,
        border: `1px solid ${theme.border}`,
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: label.length > 2 ? 11 : 16,
        fontFamily: theme.headingFont,
        color: theme.text,
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
        background: theme.bgSolid,
        border: `1px dashed ${theme.border}`,
        borderRadius: 5,
        opacity: 0.5,
      }}
    />
  );
}
