import { useEffect, useState } from 'react';
import {
  bruiser,
  silentKnife,
  defaultPoolForClass,
  type CharacterClass,
  type CharacterPool,
} from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { ClassPick } from './ClassPick.js';
import { LoadoutBuilder } from './LoadoutBuilder.js';
import { Hand } from './Hand.js';
import { TurnPlay } from './TurnPlay.js';

const CLASS_BY_ID: Record<string, CharacterClass> = {
  [bruiser.id]: bruiser,
  [silentKnife.id]: silentKnife,
};

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

  // Pre-lock-in: which class the player is currently building a hand for.
  const [buildingClassId, setBuildingClassId] = useState<string | null>(null);
  // After lock-in: when true, re-show the loadout builder for the current
  // character so the player can revise their picks before scenario start.
  const [editingLoadout, setEditingLoadout] = useState(false);
  // Locally-remembered loadouts keyed by class id. Persists across edits and
  // class-switches during this session. Server wiring of loadouts is a later
  // stage; for now this is purely client-side state.
  const [loadoutByClassId, setLoadoutByClassId] = useState<
    Record<string, readonly string[]>
  >({});
  // Pool per class, level-1 default. Will be persisted server-side later when
  // level-up picks land.
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
            } catch { /* noop */ }
            const storedId = (() => {
              try { return localStorage.getItem('gf:playerId') ?? undefined; } catch { return undefined; }
            })();
            sock.send({
              type: 'player_join',
              campaignId: campaignId.trim(),
              name: name.trim(),
              ...(storedId ? { playerId: storedId } : {}),
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

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', maxWidth: 540, color: '#eee', background: '#18181b', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>{gameState?.campaignName}</h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: -8 }}>
        {me?.name} {me?.characterId ? `· ${me.characterId}` : ''} · phase: {phase}
        {phase === 'card_select' && ` · ${submittedCount}/${totalReady} ready`}
      </p>
      {!me?.characterId && !buildingClassId && (
        <ClassPick onPick={(classId) => setBuildingClassId(classId)} />
      )}
      {!me?.characterId && buildingClassId && CLASS_BY_ID[buildingClassId] && (
        <LoadoutBuilder
          characterClass={CLASS_BY_ID[buildingClassId]!}
          pool={poolByClassId[buildingClassId]!}
          {...(loadoutByClassId[buildingClassId]
            ? { initialChosenIds: loadoutByClassId[buildingClassId] }
            : {})}
          onBack={() => setBuildingClassId(null)}
          onLockIn={(chosenCardIds) => {
            setLoadoutByClassId((prev) => ({
              ...prev,
              [buildingClassId]: chosenCardIds,
            }));
            sock.send({
              type: 'player_pick_character',
              characterId: buildingClassId,
            });
            setBuildingClassId(null);
          }}
        />
      )}
      {me?.characterId && editingLoadout && CLASS_BY_ID[me.characterId] && (
        <LoadoutBuilder
          characterClass={CLASS_BY_ID[me.characterId]!}
          pool={poolByClassId[me.characterId]!}
          {...(loadoutByClassId[me.characterId]
            ? { initialChosenIds: loadoutByClassId[me.characterId] }
            : {})}
          onBack={() => setEditingLoadout(false)}
          onLockIn={(chosenCardIds) => {
            setLoadoutByClassId((prev) => ({
              ...prev,
              [me.characterId!]: chosenCardIds,
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
