import { useState } from 'react';
import { bruiser, silentKnife } from '@gloomfolk/shared';
import type { CharacterClass, CharacterInstance } from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';

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
        <h2 style={{ marginTop: 0 }}>Name your {cls?.name ?? 'character'}</h2>
        <input
          autoFocus
          style={{
            display: 'block',
            width: '100%',
            fontSize: 18,
            padding: 8,
            background: '#1c1c20',
            color: '#eee',
            border: '1px solid #444',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          placeholder="e.g. Thorgrim"
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { setStep('pick-class'); setCharName(''); }}
            style={{
              fontSize: 14,
              padding: '8px 14px',
              background: 'transparent',
              color: '#eee',
              border: '1px solid #444',
              borderRadius: 4,
              cursor: 'pointer',
            }}
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
            style={{
              fontSize: 14,
              padding: '8px 14px',
              background: charName.trim() ? '#3b82f6' : '#333',
              color: '#eee',
              border: 'none',
              borderRadius: 4,
              cursor: charName.trim() ? 'pointer' : 'default',
            }}
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
        <h2 style={{ marginTop: 0 }}>Choose a class</h2>
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
              style={{
                textAlign: 'left',
                background: '#1c1c20',
                color: '#eee',
                border: '2px solid #444',
                borderRadius: 8,
                padding: 16,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600 }}>{cls.name}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, opacity: 0.85 }}>
                <span>HP {cls.hp[1]}</span>
                <span>Hand {cls.handSize}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
                {tagline}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={() => setStep('roster')}
          style={{
            marginTop: 12,
            fontSize: 14,
            padding: '8px 14px',
            background: 'transparent',
            color: '#eee',
            border: '1px solid #444',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Roster view (default)
  return (
    <div>
      {available.length > 0 && (
        <>
          <h2 style={{ marginTop: 0 }}>Choose a character</h2>
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
                    textAlign: 'left',
                    background: '#1c1c20',
                    color: '#eee',
                    border: '2px solid #444',
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{ch.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      {cls?.name ?? ch.classId} · Level {ch.level}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.5 }}>
                    {ch.xp} XP
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {available.length === 0 && (
        <h2 style={{ marginTop: 0 }}>No characters yet</h2>
      )}
      <button
        onClick={() => setStep('pick-class')}
        style={{
          marginTop: 16,
          width: '100%',
          fontSize: 16,
          padding: '12px 16px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Start a New Character
      </button>
    </div>
  );
}
