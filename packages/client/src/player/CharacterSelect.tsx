import { useState } from 'react';
import { bruiser, silentKnife } from '@gloomfolk/shared';
import type { CharacterClass, CharacterInstance } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { classAvatarUrl, onAvatarError } from '../avatars.js';
import { btn, theme } from '../theme.js';

const CLASSES: readonly { class: CharacterClass; tagline: string }[] = [
  {
    class: bruiser,
    tagline: 'Tanky front-liner who pushes, pulls, and holds the line.',
  },
  {
    class: silentKnife,
    tagline: 'Nimble striker who flanks, hides, and pockets gold.',
  },
];

const CLASS_BY_ID: Record<string, CharacterClass> = {
  [bruiser.id]: bruiser,
  [silentKnife.id]: silentKnife,
};

const h2Style: React.CSSProperties = {
  marginTop: 0,
  fontFamily: theme.headingFont,
  fontWeight: 500,
  color: theme.accent,
  letterSpacing: 0.5,
};

const cardButtonStyle: React.CSSProperties = {
  textAlign: 'left',
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  padding: 16,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  fontFamily: theme.font,
};

export function CharacterSelect({
  characters,
  myPlayerId,
}: {
  characters: CharacterInstance[];
  myPlayerId: string;
}) {
  const sock = useSocket();
  const [step, setStep] = useState<'roster' | 'pick-class' | 'name'>('roster');
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');

  const available = characters.filter(
    (c) => !c.claimedByPlayerId || c.claimedByPlayerId === myPlayerId,
  );

  if (step === 'name' && pickedClassId) {
    const cls = CLASS_BY_ID[pickedClassId];
    return (
      <div>
        <h2 style={h2Style}>Name your {cls?.name ?? 'character'}</h2>
        <input
          autoFocus
          style={{
            display: 'block',
            width: '100%',
            fontSize: 18,
            padding: 8,
            background: theme.panel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            boxSizing: 'border-box',
            fontFamily: theme.font,
          }}
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          placeholder="e.g. Thorgrim"
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { setStep('pick-class'); setCharName(''); }}
            style={btn.ghost()}
          >
            Back
          </button>
          <button
            disabled={!charName.trim()}
            onClick={() => {
              sock.send({
                type: 'player_create_character',
                classId: pickedClassId,
                name: charName.trim(),
              });
            }}
            style={btn.primary(!charName.trim())}
          >
            Create
          </button>
        </div>
      </div>
    );
  }

  if (step === 'pick-class') {
    return (
      <div>
        <h2 style={h2Style}>Choose a class</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            marginTop: 16,
          }}
        >
          {CLASSES.map(({ class: cls, tagline }) => (
            <button
              key={cls.id}
              onClick={() => {
                setPickedClassId(cls.id);
                setStep('name');
              }}
              style={cardButtonStyle}
            >
              <img
                src={classAvatarUrl(cls.id)}
                onError={onAvatarError}
                alt=""
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  borderRadius: 6,
                  background: theme.bgSolid,
                }}
              />
              <div style={{ fontSize: 20, fontWeight: 600, fontFamily: theme.headingFont, color: theme.accent }}>
                {cls.name}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: theme.muted }}>
                <span>HP {cls.hp[1]}</span>
                <span>Hand {cls.handSize}</span>
              </div>
              <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.4 }}>
                {tagline}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={() => setStep('roster')}
          style={{ ...btn.ghost(), marginTop: 12 }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      {available.length > 0 && (
        <>
          <h2 style={h2Style}>Choose a character</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {available.map((ch) => {
              const cls = CLASS_BY_ID[ch.classId];
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    sock.send({
                      type: 'player_claim_character',
                      characterInstanceId: ch.id,
                    });
                  }}
                  style={{
                    ...cardButtonStyle,
                    flexDirection: 'row',
                    padding: 14,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={classAvatarUrl(ch.classId)}
                      onError={onAvatarError}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        background: theme.bgSolid,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, fontFamily: theme.headingFont, color: theme.text }}>
                        {ch.name}
                      </div>
                      <div style={{ fontSize: 13, color: theme.muted }}>
                        {cls?.name ?? ch.classId} · Level {ch.level}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: theme.muted }}>
                    {ch.xp} XP
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {available.length === 0 && (
        <h2 style={h2Style}>No characters yet</h2>
      )}
      <button
        onClick={() => setStep('pick-class')}
        style={{
          ...btn.primary(false),
          marginTop: 16,
          width: '100%',
          fontSize: 16,
          padding: '14px 16px',
        }}
      >
        Start a New Character
      </button>
    </div>
  );
}
