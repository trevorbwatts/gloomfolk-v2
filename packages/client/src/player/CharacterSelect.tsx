import { useEffect, useState } from 'react';
import { bruiser, silentKnife } from '@gloomfolk/shared';
import type { CharacterClass, CharacterInstance, LobbyPlayer } from '@gloomfolk/shared';
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

const h1Style: React.CSSProperties = {
  marginTop: 6,
  marginBottom: 12,
  fontFamily: theme.headingFont,
  fontWeight: 500,
  fontSize: 20,
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
  players,
  myPlayerId,
}: {
  characters: CharacterInstance[];
  players: LobbyPlayer[];
  myPlayerId: string;
}) {
  const sock = useSocket();
  const [step, setStep] = useState<'roster' | 'pick-class' | 'name'>('roster');
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');

  // A character is "available" if it's unclaimed, claimed by me, or claimed by
  // a player who isn't in the current room (they were in a previous session
  // and never rejoined — take over).
  const livePlayerIds = new Set(players.map((p) => p.playerId));
  const reclaimable = (c: CharacterInstance): boolean =>
    !!c.claimedByPlayerId
    && c.claimedByPlayerId !== myPlayerId
    && !livePlayerIds.has(c.claimedByPlayerId);
  const available = characters.filter(
    (c) => !c.claimedByPlayerId || c.claimedByPlayerId === myPlayerId || reclaimable(c),
  );

  // Each step (roster → pick-class → name) is its own screen; always start at
  // the top when moving forward or back between them.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // The roster is the root of the player flow. Clear any stale `gf` history
  // flag left over from a previous claim/loadout cycle so the header Back
  // button reliably leaves the campaign instead of popping a dead entry.
  useEffect(() => {
    if (step === 'roster') {
      try { history.replaceState(null, ''); } catch { /* noop */ }
    }
  }, [step]);

  useEffect(() => {
    if (step === 'roster') return;
    const onPop = () => {
      setStep((prev) => {
        if (prev === 'name') { setCharName(''); return 'pick-class'; }
        return 'roster';
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [step]);

  if (step === 'name' && pickedClassId) {
    const cls = CLASS_BY_ID[pickedClassId];
    return (
      <div>
        <h1 style={h1Style}>Name your {cls?.name ?? 'character'}</h1>
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
        <div style={{ marginTop: 12 }}>
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
        <h1 style={h1Style}>Choose a class</h1>
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
                history.pushState({ gf: 'name' }, '');
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
      </div>
    );
  }

  return (
    <div>
      <h1 style={h1Style}>Pick your Character</h1>
      {available.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {available.map((ch) => {
              const cls = CLASS_BY_ID[ch.classId];
              const isReclaim = reclaimable(ch);
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
                  <div style={{ fontSize: 13, color: theme.muted, textAlign: 'right' }}>
                    {isReclaim && (
                      <div style={{ color: theme.accent, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                        Returning?
                      </div>
                    )}
                    {ch.xp} XP
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {available.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>No characters yet</p>
      )}
      <button
        onClick={() => { history.pushState({ gf: 'pick-class' }, ''); setStep('pick-class'); }}
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
