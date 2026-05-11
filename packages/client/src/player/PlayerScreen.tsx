import React, { useEffect, useState } from 'react';
import {
  bruiser,
  silentKnife,
  defaultPoolForClass,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { getSavedSession, useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { theme } from '../theme.js';
import { CharacterSelect } from './CharacterSelect.js';
import { LoadoutBuilder } from './LoadoutBuilder.js';
import { Hand } from './Hand.js';
import { TurnPlay } from './TurnPlay.js';

const CLASS_BY_ID: Record<string, CharacterClass> = {
  [bruiser.id]: bruiser,
  [silentKnife.id]: silentKnife,
};

function phaseHeadline(phase: string | undefined, hasCharacter: boolean, isMyTurn: boolean): string {
  if (!hasCharacter) return 'Pick your character';
  switch (phase) {
    case 'lobby': return 'Waiting to begin…';
    case 'card_select': return 'Choose your cards';
    case 'turn_resolution': return isMyTurn ? 'Take your turn' : 'Turn in progress';
    case 'round_end': return 'Round complete';
    case 'victory': return 'Victory';
    case 'defeat': return 'Defeated';
    default: return '';
  }
}

function readCampaignFromHash(): string | null {
  const h = location.hash.replace(/^#/, '').trim();
  return h || null;
}

const shellStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  minHeight: '100vh',
  width: '100%',
  fontFamily: theme.font,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  fontSize: 18,
  padding: 8,
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
  boxSizing: 'border-box',
  marginTop: 4,
};

export function PlayerScreen() {
  const sock = useSocket();
  const role = useStore((s) => s.role);
  const playerId = useStore((s) => s.playerId);
  const gameState = useStore((s) => s.gameState);
  const you = useStore((s) => s.you);

  const [name, setName] = useState(() => {
    try { return localStorage.getItem('gf:name') ?? ''; } catch { return ''; }
  });
  const [campaignId, setCampaignId] = useState<string>(() => {
    return readCampaignFromHash() ?? (() => {
      try { return localStorage.getItem('gf:campaignId') ?? ''; } catch { return ''; }
    })();
  });

  const [editingLoadout, setEditingLoadout] = useState(false);
  const [loadoutByClassId, setLoadoutByClassId] = useState<
    Record<string, readonly string[]>
  >({});
  const [poolByClassId] = useState<Record<string, CharacterPool>>(() => ({
    [bruiser.id]: defaultPoolForClass(bruiser),
    [silentKnife.id]: defaultPoolForClass(silentKnife),
  }));

  useEffect(() => {
    const onHash = () => {
      const c = readCampaignFromHash();
      if (c) setCampaignId(c);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (role !== 'player') {
    const savedSession = getSavedSession();
    if (savedSession) {
      return (
        <div style={shellStyle}>
          <div style={{ padding: 24, maxWidth: 480 }}>
            <p style={{ color: theme.muted }}>Reconnecting…</p>
          </div>
        </div>
      );
    }
    return (
      <div style={shellStyle}>
        <div style={{ padding: 24, maxWidth: 480 }}>
          <h1
            style={{
              fontFamily: theme.headingFont,
              fontWeight: 500,
              letterSpacing: 1,
              color: theme.accent,
            }}
          >
            Join Gloomfolk
          </h1>
          <label style={{ display: 'block', marginBottom: 12, color: theme.muted, fontSize: 13 }}>
            Your name
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 16, color: theme.muted, fontSize: 13 }}>
            Campaign ID
            <input
              style={inputStyle}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="(from host's screen)"
            />
          </label>
          <button
            style={{
              fontSize: 16,
              padding: '10px 20px',
              background: theme.accent,
              color: '#0e1612',
              border: 'none',
              borderRadius: 3,
              fontFamily: theme.headingFont,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            disabled={!name.trim() || !campaignId.trim()}
            onClick={() => {
              try {
                localStorage.setItem('gf:name', name.trim());
                sessionStorage.setItem('gf:name', name.trim());
              } catch { /* noop */ }
              sock.send({
                type: 'player_join',
                campaignId: campaignId.trim(),
                name: name.trim(),
              });
            }}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  const me = gameState?.players.find((p) => p.playerId === playerId);
  const phase = gameState?.phase;
  const submittedCount = gameState?.players.filter((p) => p.submitted).length ?? 0;
  const totalReady = gameState?.players.filter((p) => p.characterId).length ?? 0;
  const cur = gameState?.turnOrder[gameState?.activeTurnIndex ?? -1];
  const isMyTurn = cur?.kind === 'player' && cur.playerId === playerId;

  const myCharInstance = me?.characterId
    ? gameState?.characters.find((c) => c.id === me.characterId)
    : null;
  const myClassId = myCharInstance?.classId ?? null;
  const myClass = myClassId ? CLASS_BY_ID[myClassId] : null;

  return (
    <div style={shellStyle}>
      <div style={{ padding: 16, maxWidth: 540, color: theme.text, boxSizing: 'border-box', overflow: 'hidden' }}>
        <p style={{ color: theme.muted, fontSize: 12, margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>
          {gameState?.campaignName}
          {me?.name && ` · ${me.name}${myCharInstance ? `, ${myCharInstance.name}` : ''}`}
        </p>
        {myCharInstance && (() => {
          const myUnit = gameState?.units.find(
            (u) => u.kind === 'player' && u.ownerPlayerId === playerId,
          );
          const held = myUnit?.moneyTokensHeld ?? 0;
          const gold = myCharInstance.gold ?? 0;
          if (held === 0 && gold === 0) return null;
          return (
            <p style={{ color: '#d9a441', fontSize: 12, margin: '4px 0 0', letterSpacing: 0.3 }}>
              {held > 0 && <>🪙 {held} token{held === 1 ? '' : 's'}</>}
              {held > 0 && gold > 0 && ' · '}
              {gold > 0 && <>{gold} gold</>}
            </p>
          );
        })()}
        <h1
          style={{
            marginTop: 6,
            marginBottom: 12,
            fontWeight: 500,
            fontSize: 28,
            fontFamily: theme.headingFont,
            color: theme.accent,
            letterSpacing: 0.5,
          }}
        >
          {phaseHeadline(phase, !!me?.characterId, isMyTurn)}
        </h1>
        {phase === 'card_select' && me?.characterId && submittedCount > 0 && submittedCount < totalReady && (
          <p style={{ color: theme.muted, fontSize: 13, marginTop: -8, marginBottom: 12 }}>
            Waiting on {totalReady - submittedCount} other {totalReady - submittedCount === 1 ? 'player' : 'players'}.
          </p>
        )}
        {!me?.characterId && playerId && gameState && (
          <CharacterSelect
            characters={gameState.characters}
            myPlayerId={playerId}
          />
        )}
        {myClassId && myClass && editingLoadout && (
          <LoadoutBuilder
            characterClass={myClass}
            pool={poolByClassId[myClassId]!}
            {...(loadoutByClassId[myClassId]
              ? { initialChosenIds: loadoutByClassId[myClassId] }
              : {})}
            onBack={() => setEditingLoadout(false)}
            onLockIn={(chosenCardIds) => {
              setLoadoutByClassId((prev) => ({
                ...prev,
                [myClassId]: chosenCardIds,
              }));
              setEditingLoadout(false);
            }}
          />
        )}
        {me?.characterId && !editingLoadout && phase === 'lobby' && (
          <div>
            <p style={{ color: theme.muted }}>Waiting for host to start the scenario…</p>
            <button
              onClick={() => setEditingLoadout(true)}
              style={{
                fontSize: 14,
                padding: '8px 14px',
                background: 'transparent',
                color: theme.accent,
                border: `1px solid ${theme.accent}`,
                borderRadius: 3,
                fontFamily: theme.headingFont,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Edit hand
            </button>
          </div>
        )}
        {me?.characterId && phase === 'card_select' && you && (
          <Hand you={you} />
        )}
        {me?.characterId && phase === 'turn_resolution' && gameState && (
          <TurnPlay gameState={gameState} myPlayerId={playerId!} you={you} />
        )}
        {me?.characterId && phase === 'round_end' && (
          <p style={{ color: theme.muted }}>Round complete. Waiting for host to start the next round…</p>
        )}
      </div>
    </div>
  );
}
