import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSocket } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { HexBoard } from '../board/HexBoard.js';
import { ElementBoard } from '../board/ElementBoard.js';
import { useMoveAnim } from '../board/useMoveAnim.js';
import { TurnOrder } from './TurnOrder.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { btn, theme } from '../theme.js';
import type { CampaignSheet, CharacterInstance, ClientToServer, LobbyPlayer, ModifierCard, MonsterTurnAnim, PublicGameState, Unit } from '@gloomfolk/shared';
import {
  bonusExperienceFor,
  FIRST_SCENARIO_ID,
  goldConversionFor,
  hazardousTerrainDamageFor,
  MAX_SCENARIO_LEVEL,
  MIN_SCENARIO_LEVEL,
  modifierLabel,
  recommendedScenarioLevel,
  trapDamageFor,
} from '@gloomfolk/shared';
import { buildCustomScenario, isBuilderScenarioId, listPlayableScenarios } from './customScenario.js';
import { CampaignSheetPanel } from './CampaignSheetPanel.js';

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
          {campaigns.length > 0 && (
            <>
              <h2 style={h2Style}>Load a campaign</h2>
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
            </>
          )}
          <h2 style={h2Style}>{campaigns.length > 0 ? 'Or create a new one' : 'Create a campaign'}</h2>
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
  // The join link is the base URL up through `/p`; the campaign id is shown
  // separately as the "campaign code" players enter.
  const joinBaseUrl = `${joinOrigin}/p`;
  const playersWithChars = gameState?.players.filter((p) => p.characterId) ?? [];
  const playersReady = playersWithChars.filter((p) => {
    const ch = gameState?.characters.find((c) => c.id === p.characterId);
    return ch?.loadout != null && ch.shoppingDone;
  });
  const waitingOn = playersWithChars.length - playersReady.length;
  // Gloomhaven requires a party of at least two.
  const canStart = playersWithChars.length >= 2 && waitingOn === 0;
  const inLobby = gameState?.phase === 'lobby';
  const inTurnRes = gameState?.phase === 'turn_resolution';
  const inPlacement = gameState?.phase === 'placement';

  // Placement: highlight the open starting hexes and gate the Begin button on
  // every connected character-player being placed and ready.
  const startingKeys = inPlacement
    ? new Set(gameState!.startingPositions.map((h) => `${h.q},${h.r}`))
    : undefined;
  const placementParty = gameState?.players.filter((p) => p.characterId && p.connected) ?? [];
  const placedOwners = new Set(
    gameState?.units.filter((u) => u.kind === 'player').map((u) => u.ownerPlayerId) ?? [],
  );
  const canBegin =
    inPlacement &&
    placementParty.length > 0 &&
    placementParty.every((p) => p.placementReady && placedOwners.has(p.playerId));

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
    <div
      style={{
        ...shellStyle,
        // Pin the scenario view to the viewport so the header, level strip,
        // turn order and elements bar stay put; only the map scrolls.
        height: '100vh',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#000',
          borderBottom: `1px solid ${theme.border}`,
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => { clearCampaign(); sock.send({ type: 'host_leave_campaign' }); }}
          style={{ ...btn.ghost(), padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <ChevronLeft size={14} /> Back
        </button>
        <h1
          style={{
            ...h1Style,
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: 0,
          }}
        >
          {gameState?.campaignName ?? 'Loading…'}
        </h1>
        <div style={{ flex: 1 }} />
        {!inLobby && gameState && gameState.tiles.length > 0 && (
          <ScenarioLevelStrip level={gameState.scenarioLevel} />
        )}
      </div>
      {inLobby ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
          <WaitingRoom
            scenarioName={gameState?.scenarioName ?? null}
            joinBaseUrl={joinBaseUrl}
            campaignCode={campaignId}
            players={gameState?.players ?? []}
            characters={gameState?.characters ?? []}
            canStart={canStart}
            waitingOn={waitingOn}
            playersWithChars={playersWithChars.length}
            sheet={gameState?.sheet ?? null}
            send={(msg) => sock.send(msg)}
            onStart={(scenarioId, level) => {
              if (isBuilderScenarioId(scenarioId)) {
                // Compile the editor scenario + gather its art in the browser,
                // then ship it to the server to play.
                void buildCustomScenario(scenarioId).then((custom) => {
                  if (!custom) {
                    sock.send({ type: 'host_start_scenario', scenarioId, level });
                    return;
                  }
                  sock.send({ type: 'host_start_scenario', scenarioId, level, custom });
                });
                return;
              }
              sock.send({ type: 'host_start_scenario', scenarioId, level });
            }}
          />
        </div>
      ) : (
        <>
        {gameState && gameState.tiles.length > 0 && <TokenBar gameState={gameState} />}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            gap: 16,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ minWidth: 240, flexShrink: 0 }}>
            {gameState && (
              inPlacement ? (
                <PlacementPanel
                  round={gameState.round}
                  players={placementParty}
                  characters={gameState.characters}
                  placedOwners={placedOwners}
                  canBegin={canBegin}
                  onBegin={() => sock.send({ type: 'host_begin_scenario' })}
                />
              ) : (
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
              )
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {gameState && gameState.tiles.length > 0 ? (
              <>
                {gameState.monsterTurnAnim && (
                  <div style={{ flexShrink: 0 }}>
                    <MonsterTurnPanel
                      anim={gameState.monsterTurnAnim}
                      units={gameState.units}
                      onSkip={() => sock.send({ type: 'host_skip_monster_anim' })}
                    />
                  </div>
                )}
                {gameState.monsterTurnAnim && (
                  <MonsterModifierModal
                    anim={gameState.monsterTurnAnim}
                    units={gameState.units}
                  />
                )}
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
                  {/* Map viewport: fills all remaining space up to the Elements
                      bar. The board renders at a fixed hex size, starts centered
                      on the players, and scrolls/zooms inside this box. */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  >
                    <HexBoard
                      tiles={gameState.tiles}
                      units={gameState.units}
                      moneyTokens={gameState.moneyTokens}
                      doors={gameState.doors}
                      {...(gameState.tileArt ? { tileArt: gameState.tileArt } : {})}
                      {...(gameState.decorations ? { decorations: gameState.decorations } : {})}
                      activeUnitIds={activeUnitIds}
                      zoomable
                      {...(startingKeys ? { reachableKeys: startingKeys } : {})}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
                    <ElementBoard board={gameState.elementBoard} />
                    {gameState.scenarioObjective && (
                      <div
                        style={{
                          background: theme.panel,
                          border: `1px solid ${theme.border}`,
                          borderRadius: 6,
                          padding: 12,
                          minWidth: 260,
                          maxWidth: 260,
                          fontFamily: theme.font,
                          color: theme.text,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            color: theme.muted,
                            marginBottom: 10,
                            textAlign: 'center',
                          }}
                        >
                          Victory Condition
                        </div>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
                          {gameState.scenarioObjective}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: theme.muted }}>No board yet — start a scenario.</p>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/** One token chip in the {@link TokenBar}: a round avatar with a small corner
 *  badge, the figure's name, and a draining HP bar. Shared by players and
 *  enemies so both read identically. */
function TokenChip({
  avatarUrl,
  name,
  hp,
  hpMax,
  badge,
  badgeColor = '#1b1b1b',
  borderColor,
  hpColor,
}: {
  avatarUrl: string;
  name: string;
  hp: number;
  hpMax: number;
  badge?: string | number;
  badgeColor?: string;
  borderColor: string;
  hpColor: string;
}) {
  const frac = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
  const dead = hpMax > 0 && hp <= 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px 4px 4px',
        background: theme.panel,
        border: `1px solid ${borderColor}`,
        borderRadius: 20,
        flexShrink: 0,
        opacity: dead ? 0.4 : 1,
      }}
    >
      <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
        <img
          src={avatarUrl}
          alt=""
          style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
        {badge !== undefined && (
          <span
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              minWidth: 15,
              height: 15,
              padding: '0 3px',
              boxSizing: 'border-box',
              borderRadius: 8,
              background: badgeColor,
              border: '1px solid #fff',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: '13px',
              textAlign: 'center',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 56 }}>
        <span
          style={{
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: theme.muted }}>{name}</span>
          <strong style={{ color: theme.text }}>
            {Math.max(0, hp)}/{hpMax}
          </strong>
        </span>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${frac * 100}%`,
              background: hpColor,
              transition: 'width 0.45s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** A bar across the top of the scenario view listing every token on the board —
 *  the party first, then the enemies — each with its current HP, so the host can
 *  read the whole roster at a glance without hunting across the map. Enemies are
 *  sorted by name then standee number for a stable order; dead figures fade out. */
function TokenBar({ gameState }: { gameState: PublicGameState }) {
  const players = gameState.players
    .map((p) => {
      const unit = gameState.units.find(
        (u) => u.kind === 'player' && u.ownerPlayerId === p.playerId,
      );
      const charInst = p.characterId
        ? gameState.characters.find((c) => c.id === p.characterId)
        : null;
      return unit && charInst ? { p, unit, charInst } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const enemies = gameState.units
    .filter((u) => u.kind === 'monster')
    .sort((a, b) =>
      a.name === b.name
        ? (a.standeeNumber ?? 0) - (b.standeeNumber ?? 0)
        : a.name.localeCompare(b.name),
    );
  if (players.length === 0 && enemies.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '8px 24px',
        borderBottom: `1px solid ${theme.border}`,
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {players.map(({ p, unit, charInst }) => (
        <TokenChip
          key={p.playerId}
          avatarUrl={classAvatarUrl(charInst.classId)}
          name={charInst.name}
          hp={unit.hp}
          hpMax={unit.hpMax}
          badge={p.connected ? '✓' : '○'}
          badgeColor={p.connected ? theme.good : '#555'}
          borderColor={theme.border}
          hpColor="#3fbf57"
        />
      ))}
      {enemies.map((u) => (
        <TokenChip
          key={u.id}
          avatarUrl={monsterAvatarUrl(u.defId)}
          name={u.name}
          hp={u.hp}
          hpMax={u.hpMax}
          {...(u.standeeNumber !== undefined ? { badge: u.standeeNumber } : {})}
          borderColor={
            u.rank === 'elite' ? '#f0c850' : u.rank === 'named' ? '#e0564f' : theme.border
          }
          hpColor="#e23b3b"
        />
      ))}
    </div>
  );
}

/** Left-column box during the placement phase — shares the Round box's frame.
 *  Shows who's placed/ready and the Begin button (enabled once every connected
 *  character-player is ready). */
function PlacementPanel({
  round,
  players,
  characters,
  placedOwners,
  canBegin,
  onBegin,
}: {
  round: number;
  players: LobbyPlayer[];
  characters: CharacterInstance[];
  placedOwners: Set<string | undefined>;
  canBegin: boolean;
  onBegin: () => void;
}) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
        padding: 12,
        minWidth: 260,
        fontFamily: theme.font,
        color: theme.text,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: theme.muted,
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Round {round}
      </div>
      <div
        style={{
          fontFamily: theme.headingFont,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: theme.accent,
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Choosing starting positions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {players.length === 0 ? (
          <span style={{ color: theme.muted, fontSize: 13, textAlign: 'center' }}>
            Waiting for players…
          </span>
        ) : (
          players.map((p) => {
            const ch = p.characterId
              ? characters.find((c) => c.id === p.characterId) ?? null
              : null;
            const placed = placedOwners.has(p.playerId);
            const status = p.placementReady ? 'ready' : placed ? 'placed' : 'choosing…';
            const color = p.placementReady
              ? theme.good
              : placed
                ? theme.accent
                : theme.muted;
            return (
              <div
                key={p.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 14,
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: `1px solid ${theme.border}`,
                  background: '#1c1c20',
                }}
              >
                <span style={{ fontWeight: 600, color: theme.text }}>
                  {ch?.name ?? p.name}
                </span>
                <span style={{ color, fontSize: 12 }}>
                  {p.placementReady ? '✓ ' : ''}
                  {status}
                </span>
              </div>
            );
          })
        )}
      </div>
      <button
        disabled={!canBegin}
        onClick={onBegin}
        style={{ ...btn.primary(!canBegin), width: '100%', fontSize: 15, padding: '12px 16px' }}
      >
        Begin Scenario
      </button>
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
  joinBaseUrl,
  campaignCode,
  players,
  characters,
  canStart,
  waitingOn,
  playersWithChars,
  sheet,
  send,
  onStart,
}: {
  scenarioName: string | null;
  joinBaseUrl: string;
  campaignCode: string;
  players: LobbyPlayer[];
  characters: CharacterInstance[];
  canStart: boolean;
  waitingOn: number;
  playersWithChars: number;
  sheet: CampaignSheet | null;
  send: (msg: ClientToServer) => void;
  onStart: (scenarioId: string, level: number) => void;
}) {
  // Playable scenarios: built editor scenarios (source of truth) plus any
  // registry scenarios not superseded by a built one.
  const scenarios = listPlayableScenarios();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? FIRST_SCENARIO_ID);
  // Recommended scenario level from the levels of the characters claimed by
  // connected players (avg / 2, rounded up). Recomputes as players join, claim,
  // or level up. The host can override with the stepper below.
  const partyLevels = players
    .filter((p) => p.connected && p.characterId)
    .map((p) => characters.find((c) => c.id === p.characterId)?.level)
    .filter((l): l is number => typeof l === 'number');
  const recommended = recommendedScenarioLevel(partyLevels);
  const [override, setOverride] = useState<number | null>(null);
  const level = override ?? recommended;
  const setLevel = (next: number) =>
    setOverride(Math.max(MIN_SCENARIO_LEVEL, Math.min(MAX_SCENARIO_LEVEL, next)));
  const kicker: React.CSSProperties = {
    fontFamily: theme.headingFont,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.muted,
  };
  const boxStyle: React.CSSProperties = {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: 20,
    boxSizing: 'border-box',
  };
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Join info spans the full width above the two columns. The URL and the
          campaign code players type in are shown as separate fields. */}
      <div
        style={{
          ...boxStyle,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 24,
          padding: '18px 24px',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={kicker}>Players join at</div>
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
            {joinBaseUrl}
          </code>
        </div>
        <div
          style={{
            alignSelf: 'stretch',
            width: 1,
            background: theme.border,
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div style={kicker}>Campaign code</div>
          <code
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.accent,
              background: 'transparent',
            }}
          >
            {campaignCode}
          </code>
        </div>
      </div>

      {/* Two side-by-side boxes: the scenario (with its picker, level, and
          derived stats) on the left, and the players signing in on the right. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <div style={{ ...boxStyle, flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={kicker}>Scenario</div>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            style={{
              fontSize: 15,
              padding: '10px 36px 10px 12px',
              background: theme.bgSolid,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              fontFamily: theme.font,
              width: '100%',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23c9b27a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={kicker}>Scenario level</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => setLevel(level - 1)}
                disabled={level <= MIN_SCENARIO_LEVEL}
                style={{
                  ...btn.ghost(),
                  fontSize: 20,
                  padding: '2px 14px',
                  opacity: level <= MIN_SCENARIO_LEVEL ? 0.4 : 1,
                  cursor: level <= MIN_SCENARIO_LEVEL ? 'not-allowed' : 'pointer',
                }}
                aria-label="Lower scenario level"
              >
                −
              </button>
              <span
                style={{
                  fontFamily: theme.headingFont,
                  fontSize: 34,
                  color: theme.accent,
                  minWidth: 40,
                  textAlign: 'center',
                }}
              >
                {level}
              </span>
              <button
                onClick={() => setLevel(level + 1)}
                disabled={level >= MAX_SCENARIO_LEVEL}
                style={{
                  ...btn.ghost(),
                  fontSize: 20,
                  padding: '2px 14px',
                  opacity: level >= MAX_SCENARIO_LEVEL ? 0.4 : 1,
                  cursor: level >= MAX_SCENARIO_LEVEL ? 'not-allowed' : 'pointer',
                }}
                aria-label="Raise scenario level"
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <ScenarioLevelStrip level={level} showLevel={false} />
            </div>
          </div>
        </div>

        <div style={{ ...boxStyle, flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={kicker}>Players ({players.length})</div>
          {players.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                const ready = !!ch && ch.loadout != null && ch.shoppingDone;
                const status = !ch
                  ? 'Choosing character…'
                  : ch.loadout == null
                    ? 'Building loadout…'
                    : !ch.shoppingDone
                      ? 'Shopping…'
                      : 'Ready';
                const statusColor = ready ? theme.good : theme.muted;
                return (
                  <li
                    key={p.playerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: theme.bgSolid,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ color: ready ? theme.good : theme.muted, fontSize: 16 }}>
                      {ready ? '✓' : '○'}
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
      </div>

      {sheet && <CampaignSheetPanel sheet={sheet} send={send} />}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <button
          disabled={!canStart}
          onClick={() => onStart(scenarioId, level)}
          style={{ ...btn.primary(!canStart), fontSize: 16, padding: '12px 28px' }}
        >
          Start Scenario
        </button>
      </div>
    </div>
  );
}

function ScenarioLevelStrip({ level, showLevel = true }: { level: number; showLevel?: boolean }) {
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
      {showLevel && (
        <span style={chipStyle}>
          <span style={labelStyle}>Scenario Lv</span>
          {level}
        </span>
      )}
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
