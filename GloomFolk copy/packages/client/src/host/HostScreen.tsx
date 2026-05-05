import { useEffect } from 'react';
import { useStore } from '../store.js';
import { useSocket } from '../net/useSocket.js';
import { Board } from './Board.js';

export function HostScreen() {
  const { send } = useSocket();
  const conn = useStore((s) => s.conn);
  const role = useStore((s) => s.role);
  const state = useStore((s) => s.state);

  useEffect(() => {
    if (conn === 'connected' && role !== 'host') {
      send({ type: 'host_create' });
    }
  }, [conn, role, send]);

  if (!state || role !== 'host') {
    return (
      <div className="lobby">
        <h1>GloomFolk</h1>
        <p>{conn === 'connected' ? 'Joining…' : 'Connecting…'}</p>
      </div>
    );
  }

  const players = Object.values(state.players);
  const allPicked = players.length >= 1 && players.every((p) => state.units[p.unitId]);

  return (
    <div className="host">
      <div className="host-header">
        <h1>GLOOMFOLK</h1>
        <div style={{ color: 'var(--muted)' }}>
          {state.phase === 'lobby'
            ? `${players.length}/2 players`
            : `Round ${state.round} • ${state.phase}`}
        </div>
      </div>

      <div className="host-board">
        <Board />
        {state.phase === 'victory' && <div className="host-overlay victory">VICTORY</div>}
        {state.phase === 'defeat' && <div className="host-overlay defeat">DEFEAT</div>}
        {state.phase === 'lobby' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 600 }}>Waiting for players</div>
            <div style={{ color: 'var(--muted)', maxWidth: 480, textAlign: 'center' }}>
              Open <code style={{ color: 'var(--accent)' }}>/p</code> on each phone
              to join. Pick a character, then start the scenario.
            </div>
            <button
              className="primary"
              disabled={!allPicked || players.length < 1}
              onClick={() => send({ type: 'start_scenario' })}
            >
              Start Scenario
            </button>
          </div>
        )}
      </div>

      <div className="host-status">
        {players.map((p) => {
          const unit = state.units[p.unitId];
          const isActive =
            state.phase === 'turn_resolution' &&
            state.turnOrder[state.activeTurn] === p.unitId;
          return (
            <div
              key={p.socketId}
              className={`host-player${isActive ? ' active' : ''}${unit?.exhausted ? ' exhausted' : ''}`}
            >
              <strong>{p.name}</strong>
              <span style={{ color: 'var(--muted)' }}>{p.characterId}</span>
              {unit && (
                <>
                  <div className="hp-bar">
                    <div style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
                  </div>
                  <span>{unit.hp}/{unit.maxHp}</span>
                </>
              )}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {role === 'host' ? '[host view]' : ''}
          </span>
          <button
            onClick={() => {
              const inProgress = state.phase !== 'lobby';
              if (inProgress && !confirm('Reset the current game?')) return;
              send({ type: 'reset_room' });
            }}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
