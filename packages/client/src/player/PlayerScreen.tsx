import { useEffect, useState } from 'react';
import {
  bruiser,
  silentKnife,
  defaultPoolForClass,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { getSavedSession, useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
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
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 480 }}>
          <p style={{ opacity: 0.6 }}>Reconnecting…</p>
        </div>
      );
    }
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 480 }}>
        <h1>Join Gloomfolk</h1>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Your name
          <input
            style={{ display: 'block', width: '100%', fontSize: 18, padding: 8 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Campaign ID
          <input
            style={{ display: 'block', width: '100%', fontSize: 18, padding: 8 }}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="(from host's screen)"
          />
        </label>
        <button
          style={{ fontSize: 18, padding: '8px 16px' }}
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
    <div style={{ padding: 16, fontFamily: 'system-ui', maxWidth: 540, color: '#eee', background: '#18181b', minHeight: '100vh', boxSizing: 'border-box', overflow: 'hidden' }}>
      <p style={{ opacity: 0.55, fontSize: 12, margin: 0, letterSpacing: 0.3 }}>
        {gameState?.campaignName}
        {me?.name && ` · ${me.name}${myCharInstance ? `, ${myCharInstance.name}` : ''}`}
      </p>
      <h1 style={{ marginTop: 4, marginBottom: 12, fontWeight: 500, fontSize: 24 }}>
        {phaseHeadline(phase, !!me?.characterId, isMyTurn)}
      </h1>
      {phase === 'card_select' && me?.characterId && submittedCount > 0 && submittedCount < totalReady && (
        <p style={{ opacity: 0.6, fontSize: 13, marginTop: -8, marginBottom: 12 }}>
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
          <p style={{ opacity: 0.7 }}>Waiting for host to start the scenario…</p>
          <button
            onClick={() => setEditingLoadout(true)}
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
        <p style={{ opacity: 0.7 }}>Round complete. Waiting for host to start the next round…</p>
      )}
    </div>
  );
}
