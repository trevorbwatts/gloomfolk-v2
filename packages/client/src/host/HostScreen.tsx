import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { HexBoard } from '../board/HexBoard.js';
import { ElementBoard } from '../board/ElementBoard.js';
import { useMoveAnim } from '../board/useMoveAnim.js';
import { TurnOrder } from './TurnOrder.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { btn, theme } from '../theme.js';
import type { CharacterInstance, LobbyPlayer, ModifierCard, MonsterTurnAnim, Unit } from '@gloomfolk/shared';
import {
  bonusExperienceFor,
  goldConversionFor,
  hazardousTerrainDamageFor,
  modifierLabel,
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
  const { moveAnim, onMoveAnimDone } = useMoveAnim(gameState?.lastMove);
  const campaignId = useStore((s) => s.campaignId);
  const lanHost = useStore((s) => s.lanHost);
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

  // Phones join over the LAN, not on this machine — so prefer the server's LAN
  // IP (from `hello`) over location.origin, which is usually localhost on the
  // host. Keep the current protocol/port and just swap the hostname.
  const joinPort = location.port ? `:${location.port}` : '';
  const joinOrigin = lanHost
    ? `${location.protocol}//${lanHost}${joinPort}`
    : location.origin;
  const joinUrl = `${joinOrigin}/p#${campaignId}`;
  const playersWithChars = gameState?.players.filter((p) => p.characterId) ?? [];
  const playersReady = playersWithChars.filter((p) => {
    const ch = gameState?.characters.find((c) => c.id === p.characterId);
    return ch?.loadout != null;
  });
  const waitingOn = playersWithChars.length - playersReady.length;
  const canStart = playersWithChars.length > 0 && waitingOn === 0;
  const inLobby = gameState?.phase === 'lobby';
  const inTurnRes = gameState?.phase === 'turn_resolution';

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
      <div
        style={{
          background: '#000',
          borderBottom: `1px solid ${theme.border}`,
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => { clearCampaign(); sock.send({ type: 'host_leave_campaign' }); }}
          style={{ ...btn.ghost(), padding: '4px 8px', fontSize: 12 }}
        >
          ← Back
        </button>
        <h1
          style={{
            ...h1Style,
            margin: 0,
            fontSize: 18,
            fontVariant: 'small-caps',
            letterSpacing: 1,
          }}
        >
          {gameState?.campaignName ?? 'Loading…'}
        </h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          {!inLobby && gameState?.players.map((p) => {
            const charInst = p.characterId
              ? gameState.characters.find((c) => c.id === p.characterId)
              : null;
            const unit = gameState.units.find(
              (u) => u.kind === 'player' && u.ownerPlayerId === p.playerId,
            );
            const displayName = charInst?.name ?? p.name;
            return (
              <div
                key={p.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 4,
                  fontSize: 13,
                  color: theme.text,
                }}
              >
                <span style={{ color: p.connected ? theme.good : theme.muted }}>
                  {p.connected ? '✓' : '○'}
                </span>
                <strong style={{ fontWeight: 600 }}>{displayName}</strong>
                {unit && (
                  <span style={{ color: theme.muted }}>
                    {unit.hp}/{unit.hpMax} HP
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
      </div>
      {gameState && gameState.tiles.length > 0 && !inLobby && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 24px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <ScenarioLevelStrip level={gameState.scenarioLevel} />
        </div>
      )}
      <div style={{ padding: 24 }}>
        {inLobby ? (
          <WaitingRoom
            scenarioName={gameState?.scenarioName ?? null}
            joinUrl={joinUrl}
            players={gameState?.players ?? []}
            characters={gameState?.characters ?? []}
            canStart={canStart}
            waitingOn={waitingOn}
            playersWithChars={playersWithChars.length}
            onStart={() => sock.send({ type: 'host_start_scenario', scenarioId: 'level1' })}
          />
        ) : (
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 240 }}>
              {gameState && (
                <>
                  <TurnOrder
                    order={gameState.turnOrder}
                    activeIndex={gameState.activeTurnIndex}
                    players={gameState.players}
                    characters={gameState.characters}
                    units={gameState.units}
                    scenarioLevel={gameState.scenarioLevel}
                    round={gameState.round}
                  />
                  {inTurnRes && (
                    <button
                      onClick={() => sock.send({ type: 'end_turn' })}
                      style={{ ...btn.ghost(), marginTop: 8 }}
                    >
                      End current turn
                    </button>
                  )}
                </>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 360 }}>
              {gameState && gameState.tiles.length > 0 ? (
                <>
                  {gameState.monsterTurnAnim && (
                    <MonsterTurnPanel
                      anim={gameState.monsterTurnAnim}
                      units={gameState.units}
                      onSkip={() => sock.send({ type: 'host_skip_monster_anim' })}
                    />
                  )}
                  {gameState.monsterTurnAnim && (
                    <MonsterModifierModal
                      anim={gameState.monsterTurnAnim}
                      units={gameState.units}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <HexBoard
                        tiles={gameState.tiles}
                        units={gameState.units}
                        moneyTokens={gameState.moneyTokens}
                        activeUnitIds={activeUnitIds}
                        pathHexes={gameState.pendingForcedMove?.path}
                        unitAvatarUrl={(u: Unit) =>
                          u.kind === 'monster'
                            ? monsterAvatarUrl(u.defId)
                            : classAvatarUrl(u.defId)
                        }
                        moveAnim={moveAnim}
                        onMoveAnimDone={onMoveAnimDone}
                        monsterTurnAnim={gameState.monsterTurnAnim}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <ElementBoard board={gameState.elementBoard} />
                    </div>
                  </div>
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
        )}
      </div>
    </div>
  );
}

function MonsterTurnPanel({
  anim,
  units,
  onSkip,
}: {
  anim: MonsterTurnAnim;
  units: Unit[];
  onSkip: () => void;
}) {
  const active = units.find((u) => u.id === anim.activeMonsterId) ?? null;
  const target = anim.targetUnitId
    ? units.find((u) => u.id === anim.targetUnitId) ?? null
    : null;
  const phaseLabel = (() => {
    switch (anim.phase) {
      case 'focus':
        return target ? `Choosing target: ${target.name}` : 'Choosing target…';
      case 'move':
        return target ? `Moving toward ${target.name}` : 'Moving…';
      case 'modifier-draw':
        return 'Drawing attack modifier…';
      case 'damage':
        return target ? `Attacking ${target.name}` : 'Resolving attack';
      case 'idle':
        return '…';
    }
  })();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        background: theme.panel,
        border: `1px solid ${theme.accent}`,
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: theme.accent,
          }}
        >
          Monster turn · {anim.abilityCardName}
        </div>
        <div style={{ fontSize: 14, marginTop: 2 }}>
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>
            {active?.name ?? '—'}
          </span>
          <span style={{ color: theme.muted, margin: '0 6px' }}>→</span>
          <span style={{ color: target ? '#ffd84d' : theme.muted }}>
            {target ? target.name : 'no target'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{phaseLabel}</div>
      </div>
      <button onClick={onSkip} style={{ ...btn.outline(), fontSize: 12, padding: '6px 12px' }}>
        Skip ▶▶
      </button>
    </div>
  );
}

/** Big centered overlay that reveals the active monster's attack-modifier pull.
 *  Shown on the Host screen while a monster's attack draw is live (the player
 *  screens no longer show the pull). Non-interactive — clicks pass through so
 *  the host can still hit Skip / the board behind it. The card flips in on each
 *  fresh draw via a remount key. */
function MonsterModifierModal({ anim, units }: { anim: MonsterTurnAnim; units: Unit[] }) {
  const draw = anim.modifierDraw;
  if (!draw) return null;
  // Only the "roll" beat. Once damage lands the modal clears so the board's
  // impact cinematic (lunge, flash, floating damage) is visible behind it.
  if (anim.phase !== 'modifier-draw') return null;
  const active = units.find((u) => u.id === anim.activeMonsterId) ?? null;
  const target = units.find((u) => u.id === draw.targetUnitId) ?? null;
  // Remount the flip card whenever the live draw changes so it re-animates.
  const flipKey = `${anim.setId}|${anim.activeMonsterId}|${draw.targetUnitId}|${modifierLabel(draw.card)}`;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: theme.panel,
          border: `1px solid ${theme.accent}`,
          borderRadius: 12,
          padding: '28px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          minWidth: 320,
        }}
      >
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 14,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.accent,
            textAlign: 'center',
          }}
        >
          {anim.abilityCardName}
        </div>
        <div style={{ fontSize: 22, textAlign: 'center' }}>
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>{active?.name ?? '—'}</span>
          <span style={{ color: theme.muted, margin: '0 10px' }}>→</span>
          <span style={{ color: target ? '#ffd84d' : theme.muted }}>
            {target ? target.name : 'no target'}
          </span>
        </div>
        {draw.advantageDraw && (
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: 14,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: draw.advantageDraw.mode === 'advantage' ? theme.good : theme.bad,
            }}
          >
            {draw.advantageDraw.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 20 }}>
          {draw.advantageDraw ? (
            draw.advantageDraw.cards.map((c, i) => (
              <BigModCard
                key={`${flipKey}|${i}`}
                card={c}
                chosen={i === draw.advantageDraw!.usedIndex}
                faded={i !== draw.advantageDraw!.usedIndex}
              />
            ))
          ) : (
            <BigModCard key={flipKey} card={draw.card} />
          )}
        </div>
        <div style={{ fontSize: 22, color: theme.muted, fontFamily: theme.headingFont }}>
          {draw.baseAmount} → <strong style={{ color: theme.text }}>{draw.finalAmount}</strong>
        </div>
        {draw.damageDealt !== null && (
          <div style={{ fontSize: 16, color: theme.bad, fontFamily: theme.headingFont }}>
            −{draw.damageDealt} damage
          </div>
        )}
      </div>
    </div>
  );
}

/** Large attack-modifier card that flips face-up on mount, for the host modal.
 *  `chosen` rings the used card of an Advantage/Disadvantage pair; `faded` dims
 *  the discarded one. */
function BigModCard({
  card,
  chosen,
  faded = false,
}: {
  card: ModifierCard;
  chosen?: boolean;
  faded?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 80);
    return () => clearTimeout(t);
  }, []);
  const label = modifierLabel(card);
  const isCrit = card.kind === 'crit';
  const isNull = card.kind === 'null';
  const accent = chosen ? theme.good : isCrit ? theme.accent : isNull ? theme.bad : theme.border;
  const width = 150;
  const height = 200;
  return (
    <div style={{ position: 'relative', width, height, perspective: 1000, opacity: faded ? 0.4 : 1 }}>
      {chosen && (
        <span
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            zIndex: 2,
            width: 28,
            height: 28,
            borderRadius: 14,
            background: theme.good,
            color: '#0e1612',
            fontSize: 18,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✓
        </span>
      )}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 450ms ease-out',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background: theme.panelRaised,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: theme.panelRaised,
            border: `3px solid ${accent}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: label.length > 2 ? 44 : 64,
            fontFamily: theme.headingFont,
            color: isCrit ? theme.accent : isNull ? theme.bad : theme.text,
            filter: faded ? 'grayscale(1)' : 'none',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function WaitingRoom({
  scenarioName,
  joinUrl,
  players,
  characters,
  canStart,
  waitingOn,
  playersWithChars,
  onStart,
}: {
  scenarioName: string | null;
  joinUrl: string;
  players: LobbyPlayer[];
  characters: CharacterInstance[];
  canStart: boolean;
  waitingOn: number;
  playersWithChars: number;
  onStart: () => void;
}) {
  const hint = playersWithChars === 0
    ? 'Waiting for at least one player to pick a character.'
    : waitingOn > 0
      ? `Waiting on ${waitingOn} ${waitingOn === 1 ? 'player' : 'players'} to lock in their hand.`
      : 'Everyone is ready.';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.muted,
          }}
        >
          Next scenario
        </div>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 28,
            color: theme.accent,
            marginTop: 4,
            letterSpacing: 0.5,
          }}
        >
          {scenarioName ?? 'Level 1'}
        </div>
      </div>

      <div
        style={{
          padding: '20px 24px',
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.muted,
          }}
        >
          Players join at
        </div>
        <code
          style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 20,
            color: theme.accent,
            background: 'transparent',
            wordBreak: 'break-all',
          }}
        >
          {joinUrl}
        </code>
      </div>

      <div>
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.muted,
            marginBottom: 8,
          }}
        >
          Players ({players.length})
        </div>
        {players.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: `1px dashed ${theme.border}`,
              borderRadius: 6,
              color: theme.muted,
              textAlign: 'center',
              fontSize: 14,
            }}
          >
            No one's signed in yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map((p) => {
              const ch = p.characterId ? characters.find((c) => c.id === p.characterId) ?? null : null;
              const status = !ch
                ? 'Choosing character…'
                : ch.loadout == null
                  ? 'Building loadout…'
                  : 'Ready';
              const statusColor = !ch ? theme.muted : ch.loadout == null ? theme.muted : theme.good;
              return (
                <li
                  key={p.playerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: theme.panel,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                  }}
                >
                  <span style={{ color: p.connected ? theme.good : theme.muted, fontSize: 16 }}>
                    {p.connected ? '✓' : '○'}
                  </span>
                  {ch && (
                    <img
                      src={classAvatarUrl(ch.classId)}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: theme.text }}>
                      {ch?.name ?? p.name}
                    </div>
                    {ch && (
                      <div style={{ fontSize: 12, color: theme.muted }}>
                        {p.name}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: statusColor }}>{status}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <button
          disabled={!canStart}
          onClick={onStart}
          style={{ ...btn.primary(!canStart), fontSize: 16, padding: '12px 28px' }}
        >
          Start Scenario
        </button>
        <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>{hint}</p>
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
        <span style={labelStyle}>Gold</span>
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
