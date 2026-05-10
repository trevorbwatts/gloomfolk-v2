import { useEffect, useState } from 'react';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { HexBoard } from '../board/HexBoard.js';
import { TurnOrder } from './TurnOrder.js';

export function HostScreen() {
  const sock = useSocket();
  const campaigns = useStore((s) => s.campaigns);
  const gameState = useStore((s) => s.gameState);
  const campaignId = useStore((s) => s.campaignId);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    sock.send({ type: 'host_hello' });
  }, [sock]);

  if (!campaignId) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Gloomfolk — Host</h1>
        <h2>Load a campaign</h2>
        {campaigns.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No campaigns yet.</p>
        ) : (
          <ul>
            {campaigns.map((c) => (
              <li key={c.id} style={{ marginBottom: 8 }}>
                <button onClick={() => sock.send({ type: 'host_load_campaign', campaignId: c.id })}>
                  {c.name}
                </button>
                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>
                  {c.playerNames.join(', ') || 'no players'} · updated{' '}
                  {new Date(c.updatedAt).toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) {
                      sock.send({ type: 'host_delete_campaign', campaignId: c.id });
                    }
                  }}
                  style={{ marginLeft: 8, fontSize: 12 }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <h2>Or create a new one</h2>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Campaign name"
        />
        <button
          onClick={() => {
            if (!newName.trim()) return;
            sock.send({ type: 'host_create_campaign', name: newName.trim() });
            setNewName('');
          }}
        >
          Create
        </button>
      </div>
    );
  }

  const joinUrl = `${location.origin}/p#${campaignId}`;
  const playersWithChars = gameState?.players.filter((p) => p.characterId) ?? [];
  const inLobby = gameState?.phase === 'lobby';
  const inTurnRes = gameState?.phase === 'turn_resolution';
  const inRoundEnd = gameState?.phase === 'round_end';

  // Compute which unit ids are "active" right now for board highlight.
  const activeUnitIds: string[] = [];
  if (gameState && inTurnRes) {
    const cur = gameState.turnOrder[gameState.activeTurnIndex];
    if (cur?.kind === 'player') activeUnitIds.push(cur.unitId);
    if (cur?.kind === 'monster-group') {
      const setId = cur.setId;
      const setMatch: Record<string, string[]> = {
        archer: ['bandit-archer'],
        scout: ['bandit-scout'],
      };
      const defIds = setMatch[setId] ?? [];
      for (const u of gameState.units) {
        if (u.kind === 'monster' && defIds.includes(u.defId)) activeUnitIds.push(u.id);
      }
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eee', background: '#18181b', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>{gameState?.campaignName ?? 'Loading…'}</h1>
      <p style={{ opacity: 0.7 }}>
        Players join at: <code>{joinUrl}</code>
      </p>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <h2>Players</h2>
          {gameState && gameState.players.length === 0 && (
            <p style={{ opacity: 0.7 }}>Waiting for players…</p>
          )}
          <ul style={{ paddingLeft: 18 }}>
            {gameState?.players.map((p) => (
              <li key={p.playerId}>
                <strong>{p.name}</strong>{' '}
                <span style={{ opacity: 0.6 }}>
                  {p.connected ? '●' : '○'}{' '}
                  {p.characterId ?? 'no character'}
                </span>
                {p.submitted && (
                  <span style={{ marginLeft: 6, color: '#7ee08a' }}>✓ ready</span>
                )}
              </li>
            ))}
          </ul>
          {inLobby && (
            <button
              disabled={playersWithChars.length === 0}
              onClick={() => sock.send({ type: 'host_start_scenario', scenarioId: 'level1' })}
              style={{ marginTop: 12, padding: '8px 14px', fontSize: 14 }}
            >
              Start Scenario: Level 1
            </button>
          )}
          {inTurnRes && (
            <>
              <h3 style={{ marginBottom: 6, marginTop: 18 }}>Turn order</h3>
              <TurnOrder
                order={gameState!.turnOrder}
                activeIndex={gameState!.activeTurnIndex}
                players={gameState!.players}
              />
              <button
                onClick={() => sock.send({ type: 'end_turn' })}
                style={{ marginTop: 8, padding: '8px 14px', fontSize: 14 }}
              >
                End current turn
              </button>
            </>
          )}
          {inRoundEnd && (
            <button
              onClick={() => sock.send({ type: 'host_next_round' })}
              style={{ marginTop: 12, padding: '8px 14px', fontSize: 14 }}
            >
              Next round
            </button>
          )}
          <p style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
            Phase: {gameState?.phase} · Round: {gameState?.round}
            {gameState?.scenarioName ? ` · ${gameState.scenarioName}` : ''}
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 360 }}>
          {gameState && gameState.tiles.length > 0 ? (
            <>
              <HexBoard tiles={gameState.tiles} units={gameState.units} activeUnitIds={activeUnitIds} />
              {gameState.events.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, background: '#1c1c20', borderRadius: 6, fontSize: 13, maxHeight: 180, overflowY: 'auto' }}>
                  {gameState.events.slice(-8).map((ev) => (
                    <div key={ev.id} style={{ opacity: 0.85 }}>{ev.text}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ opacity: 0.6 }}>No board yet — start a scenario.</p>
          )}
        </div>
      </div>
    </div>
  );
}
