import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { HexBoard } from '../board/HexBoard.js';
import { TurnOrder } from './TurnOrder.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { btn, theme } from '../theme.js';
import type { Unit } from '@gloomfolk/shared';
import {
  bonusExperienceFor,
  goldConversionFor,
  hazardousTerrainDamageFor,
  trapDamageFor,
} from '@gloomfolk/shared';

const shellStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  minHeight: '100vh',
  width: '100%',
  fontFamily: theme.font,
};

const h1Style: React.CSSProperties = {
  marginTop: 0,
  fontFamily: theme.headingFont,
  fontWeight: 500,
  color: theme.accent,
  letterSpacing: 0.5,
};

const h2Style: React.CSSProperties = {
  fontFamily: theme.headingFont,
  fontWeight: 500,
  color: theme.accent,
  fontSize: 18,
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '8px 10px',
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
  marginRight: 8,
};

export function HostScreen() {
  const sock = useSocket();
  const campaigns = useStore((s) => s.campaigns);
  const gameState = useStore((s) => s.gameState);
  const campaignId = useStore((s) => s.campaignId);
  const clearCampaign = useStore((s) => s.clearCampaign);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    sock.send({ type: 'host_hello' });
  }, [sock]);

  if (!campaignId) {
    return (
      <div style={shellStyle}>
        <div style={{ padding: 24, maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
            <h1 style={h1Style}>Gloomfolk — Host</h1>
            <Link to="/builder" style={{ ...btn.outline(), textDecoration: 'none' }}>
              Scenario Builder
            </Link>
          </div>
          <h2 style={h2Style}>Load a campaign</h2>
          {campaigns.length === 0 ? (
            <p style={{ color: theme.muted }}>No campaigns yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  style={{
                    marginBottom: 8,
                    padding: '10px 12px',
                    background: theme.panel,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <button
                    onClick={() => sock.send({ type: 'host_load_campaign', campaignId: c.id })}
                    style={btn.primary(false)}
                  >
                    {c.name}
                  </button>
                  <span style={{ flex: 1, color: theme.muted, fontSize: 12 }}>
                    {c.characterNames.join(', ') || 'no heroes'} · updated{' '}
                    {new Date(c.updatedAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) {
                        sock.send({ type: 'host_delete_campaign', campaignId: c.id });
                      }
                    }}
                    style={{ ...btn.ghost(), fontSize: 12, padding: '6px 10px' }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h2 style={h2Style}>Or create a new one</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Campaign name"
              style={{ ...inputStyle, flex: 1, marginRight: 0 }}
            />
            <button
              onClick={() => {
                if (!newName.trim()) return;
                sock.send({ type: 'host_create_campaign', name: newName.trim() });
                setNewName('');
              }}
              style={btn.primary(!newName.trim())}
              disabled={!newName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  const joinUrl = `${location.origin}/p#${campaignId}`;
  const playersWithChars = gameState?.players.filter((p) => p.characterId) ?? [];
  const inLobby = gameState?.phase === 'lobby';
  const inTurnRes = gameState?.phase === 'turn_resolution';
  const inRoundEnd = gameState?.phase === 'round_end';

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
    <div style={shellStyle}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <button
            onClick={() => { clearCampaign(); sock.send({ type: 'host_leave_campaign' }); }}
            style={{ ...btn.ghost(), padding: '6px 10px' }}
          >
            ← Back
          </button>
          <h1 style={{ ...h1Style, margin: 0 }}>{gameState?.campaignName ?? 'Loading…'}</h1>
        </div>
        {inLobby && (
          <p style={{ color: theme.muted }}>
            Players join at:{' '}
            <code style={{ background: theme.panel, padding: '2px 8px', borderRadius: 3, color: theme.accent, border: `1px solid ${theme.border}` }}>
              {joinUrl}
            </code>
          </p>
        )}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <h2 style={h2Style}>Players</h2>
            {gameState && gameState.players.length === 0 && (
              <p style={{ color: theme.muted }}>Waiting for players…</p>
            )}
            <ul style={{ paddingLeft: 18, color: theme.text }}>
              {gameState?.players.map((p) => {
                const charInst = p.characterId
                  ? gameState?.characters.find((c) => c.id === p.characterId)
                  : null;
                const myUnit = charInst
                  ? gameState.units.find(
                      (u) => u.kind === 'player' && u.ownerPlayerId === p.playerId,
                    )
                  : null;
                const held = myUnit?.moneyTokensHeld ?? 0;
                const gold = charInst?.gold ?? 0;
                return (
                  <li key={p.playerId} style={{ marginBottom: 4 }}>
                    <strong>{charInst ? charInst.name : p.name}</strong>{' '}
                    <span style={{ color: theme.muted }}>
                      {p.connected ? '●' : '○'}
                      {!charInst && ' no character'}
                    </span>
                    {p.submitted && (
                      <span style={{ marginLeft: 6, color: theme.good }}>✓ ready</span>
                    )}
                    {charInst && (
                      <span style={{ marginLeft: 8, color: '#d9a441' }}>
                        {held > 0 && `🪙 ${held}`}
                        {held > 0 && gold > 0 && ' · '}
                        {gold > 0 && `${gold}g`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {inLobby && (
              <button
                disabled={playersWithChars.length === 0}
                onClick={() => sock.send({ type: 'host_start_scenario', scenarioId: 'level1' })}
                style={{ ...btn.primary(playersWithChars.length === 0), marginTop: 12 }}
              >
                Start Scenario: Level 1
              </button>
            )}
            {inTurnRes && (
              <>
                <h3 style={{ ...h2Style, fontSize: 14, marginBottom: 6, marginTop: 18 }}>Turn order</h3>
                <TurnOrder
                  order={gameState!.turnOrder}
                  activeIndex={gameState!.activeTurnIndex}
                  players={gameState!.players}
                />
                <button
                  onClick={() => sock.send({ type: 'end_turn' })}
                  style={{ ...btn.ghost(), marginTop: 8 }}
                >
                  End current turn
                </button>
              </>
            )}
            {inRoundEnd && (
              <button
                onClick={() => sock.send({ type: 'host_next_round' })}
                style={{ ...btn.primary(false), marginTop: 12 }}
              >
                Next round
              </button>
            )}
            <p style={{ marginTop: 24, fontSize: 12, color: theme.muted, letterSpacing: 0.5 }}>
              Phase: {gameState?.phase} · Round: {gameState?.round}
              {gameState?.scenarioName ? ` · ${gameState.scenarioName}` : ''}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 360 }}>
            {gameState && gameState.tiles.length > 0 ? (
              <>
                <HexBoard
                  tiles={gameState.tiles}
                  units={gameState.units}
                  moneyTokens={gameState.moneyTokens}
                  activeUnitIds={activeUnitIds}
                  unitAvatarUrl={(u: Unit) =>
                    u.kind === 'monster'
                      ? monsterAvatarUrl(u.defId)
                      : classAvatarUrl(u.defId)
                  }
                />
                <ScenarioLevelStrip level={gameState.scenarioLevel} />
                {gameState.events.length > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: theme.panel,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      fontSize: 13,
                      maxHeight: 180,
                      overflowY: 'auto',
                      color: theme.text,
                    }}
                  >
                    {gameState.events.slice(-8).map((ev) => (
                      <div key={ev.id} style={{ color: theme.muted }}>{ev.text}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: theme.muted }}>No board yet — start a scenario.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioLevelStrip({ level }: { level: number }) {
  const chipStyle: React.CSSProperties = {
    padding: '4px 10px',
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 999,
    fontSize: 12,
    color: theme.text,
    whiteSpace: 'nowrap',
  };
  const labelStyle: React.CSSProperties = {
    color: theme.muted,
    marginRight: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
  };
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
      title="Derived values for the current scenario level"
    >
      <span style={chipStyle}>
        <span style={labelStyle}>Scenario Lv</span>
        {level}
      </span>
      <span style={chipStyle}>
        <span style={labelStyle}>Monster Lv</span>
        {level}
      </span>
      <span style={chipStyle}>
        <span style={labelStyle}>Gold/Token</span>
        ×{goldConversionFor(level)}
      </span>
      <span style={chipStyle}>
        <span style={labelStyle}>Trap Dmg</span>
        {trapDamageFor(level)}
      </span>
      <span style={chipStyle}>
        <span style={labelStyle}>Hazard Dmg</span>
        {hazardousTerrainDamageFor(level)}
      </span>
      <span style={chipStyle}>
        <span style={labelStyle}>Bonus XP</span>
        {bonusExperienceFor(level)}
      </span>
    </div>
  );
}
