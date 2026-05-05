import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { useSocket } from '../net/useSocket.js';
import { CHARACTERS } from '@gloomfolk/shared';
import { Hand } from './Hand.js';
import { TurnPlay } from './TurnPlay.js';

export function PlayerScreen() {
  const { send } = useSocket();
  const [name, setName] = useState(() => localStorage.getItem('gf:name') ?? '');
  const conn = useStore((s) => s.conn);
  const role = useStore((s) => s.role);
  const playerId = useStore((s) => s.playerId);
  const state = useStore((s) => s.state);
  const errorMsg = useStore((s) => s.errorMsg);

  // Auto-rejoin if we already have a name + stored playerId from a previous session.
  useEffect(() => {
    if (conn !== 'connected' || role) return;
    const stored = localStorage.getItem('gf:playerId') ?? undefined;
    const storedName = localStorage.getItem('gf:name');
    if (stored && storedName) {
      send({ type: 'join', name: storedName, playerId: stored });
    }
  }, [conn, role, send]);

  if (!role) {
    return (
      <div className="lobby">
        <h1>GloomFolk</h1>
        <div className="lobby-form">
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="primary"
            disabled={!name || conn !== 'connected'}
            onClick={() => {
              localStorage.setItem('gf:name', name);
              const stored = localStorage.getItem('gf:playerId') ?? undefined;
              send({ type: 'join', name, playerId: stored });
            }}
          >
            {conn === 'connected' ? 'Join' : 'Connecting…'}
          </button>
          {errorMsg && <div style={{ color: 'var(--danger)' }}>{errorMsg}</div>}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="lobby">
        <h1>GloomFolk</h1>
        <p>Joining…</p>
      </div>
    );
  }

  // Lobby — pick character.
  if (state.phase === 'lobby') {
    const me = playerId ? state.players[playerId] : undefined;
    const myCharacter = me?.characterId;
    const taken = new Set(
      Object.values(state.players)
        .filter((p) => p.socketId !== playerId)
        .map((p) => p.characterId),
    );
    return (
      <div className="player">
        <div className="player-header">
          <span className="player-name">{me?.name ?? 'You'}</span>
        </div>
        <div className="player-body">
          <h3 style={{ color: 'var(--accent)', textAlign: 'center' }}>Choose a character</h3>
          <div className="character-list">
            {Object.values(CHARACTERS).map((c) => {
              const isMine = myCharacter === c.id;
              const isTaken = taken.has(c.id);
              return (
                <button
                  key={c.id}
                  className={`character${isMine ? ' selected' : ''}`}
                  disabled={isTaken && !isMine}
                  onClick={() => send({ type: 'pick_character', characterId: c.id })}
                >
                  <h3>
                    {c.name} {isMine && '✓'}
                  </h3>
                  <p>{c.blurb}</p>
                  <p style={{ marginTop: 6 }}>HP {c.maxHp}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div className="player-footer">
          <span style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
            Host starts the scenario when everyone is ready.
          </span>
        </div>
      </div>
    );
  }

  if (state.phase === 'victory' || state.phase === 'defeat') {
    return (
      <div className="player">
        <div className="player-header">
          <span className="player-name">{state.phase === 'victory' ? 'Victory!' : 'Defeat'}</span>
        </div>
        <div className="player-body">
          <div className="log">
            {state.log.slice(-20).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player">
      <PlayerHeader />
      <div className="player-body">
        {state.phase === 'card_select' && <Hand />}
        {state.phase === 'turn_resolution' && <TurnPlay />}
        {state.phase === 'round_end' && (
          <div className="banner">Resolving round…</div>
        )}
        <div className="log">
          {state.log.slice(-20).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {errorMsg && <div className="banner" style={{ color: 'var(--danger)' }}>{errorMsg}</div>}
      </div>
    </div>
  );
}

function PlayerHeader() {
  const state = useStore((s) => s.state);
  const playerId = useStore((s) => s.playerId);
  if (!state || !playerId) return null;
  const player = state.players[playerId];
  if (!player) return null;
  const unit = state.units[player.unitId];
  return (
    <div className="player-header">
      <span className="player-name">
        {player.name} <span style={{ color: 'var(--muted)' }}>({player.characterId})</span>
      </span>
      <span className="player-hp">
        HP {unit?.hp ?? 0}/{unit?.maxHp ?? 0} • Round {state.round}
      </span>
    </div>
  );
}
