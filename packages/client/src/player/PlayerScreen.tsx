import { useEffect, useState } from 'react';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { Hand } from './Hand.js';

function readCampaignFromHash(): string | null {
  const h = location.hash.replace(/^#/, '').trim();
  return h || null;
}

export function PlayerScreen() {
  const sock = useSocket();
  const role = useStore((s) => s.role);
  const playerId = useStore((s) => s.playerId);
  const gameState = useStore((s) => s.gameState);

  const [name, setName] = useState(() => {
    try { return localStorage.getItem('gf:name') ?? ''; } catch { return ''; }
  });
  const [campaignId, setCampaignId] = useState<string>(() => {
    return readCampaignFromHash() ?? (() => {
      try { return localStorage.getItem('gf:campaignId') ?? ''; } catch { return ''; }
    })();
  });

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
  const you = useStore((s) => s.you);
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
      {!me?.characterId && (
        <div>
          <h2>Pick a character</h2>
          <button
            style={{ fontSize: 18, padding: '8px 16px', marginRight: 8 }}
            onClick={() => sock.send({ type: 'player_pick_character', characterId: 'bruiser' })}
          >
            Bruiser
          </button>
          <button
            style={{ fontSize: 18, padding: '8px 16px' }}
            onClick={() => sock.send({ type: 'player_pick_character', characterId: 'silent-knife' })}
          >
            Silent Knife
          </button>
        </div>
      )}
      {me?.characterId && phase === 'lobby' && (
        <p style={{ opacity: 0.7 }}>Waiting for host to start the scenario…</p>
      )}
      {me?.characterId && phase === 'card_select' && you && (
        <Hand you={you} />
      )}
      {me?.characterId && phase === 'turn_resolution' && gameState && (
        <TurnView gameState={gameState} myPlayerId={playerId!} />
      )}
      {me?.characterId && phase === 'round_end' && (
        <p style={{ opacity: 0.7 }}>Round complete. Waiting for host to start the next round…</p>
      )}
    </div>
  );
}

function TurnView({
  gameState,
  myPlayerId,
}: {
  gameState: NonNullable<ReturnType<typeof useStore.getState>['gameState']>;
  myPlayerId: string;
}) {
  const sock = useSocket();
  const cur = gameState.turnOrder[gameState.activeTurnIndex];
  const myEntry = gameState.turnOrder.find((e) => e.kind === 'player' && e.playerId === myPlayerId);
  const isMyTurn = cur?.kind === 'player' && cur.playerId === myPlayerId;
  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Round {gameState.round}</h2>
      <p style={{ marginTop: 0, opacity: 0.7 }}>
        {isMyTurn
          ? "It's your turn."
          : cur
            ? cur.kind === 'player'
              ? `Waiting on ${gameState.players.find((p) => p.playerId === cur.playerId)?.name ?? 'player'}…`
              : `${cur.abilityCardName} — monster turn`
            : '—'}
      </p>
      {myEntry?.kind === 'player' && (
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          Your initiative: <strong>{myEntry.initiative}</strong>
          {myEntry.done ? ' · turn complete' : ''}
        </p>
      )}
      {isMyTurn && (
        <button
          onClick={() => sock.send({ type: 'end_turn' })}
          style={{ fontSize: 16, padding: '10px 16px', marginTop: 8 }}
        >
          End my turn
        </button>
      )}
    </div>
  );
}
