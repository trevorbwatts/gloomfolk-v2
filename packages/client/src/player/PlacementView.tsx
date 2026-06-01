import { useMemo } from 'react';
import type { Hex, PublicGameState, Unit } from '@gloomfolk/shared';
import { hexEqual, hexKey } from '@gloomfolk/shared';
import { HexBoard } from '../board/HexBoard.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { useSocket } from '../net/useSocket.js';
import { btn, theme } from '../theme.js';

const unitAvatarUrl = (u: Unit) =>
  u.kind === 'monster' ? monsterAvatarUrl(u.defId) : classAvatarUrl(u.defId);

/**
 * Placement phase (player view): the party picks where to stand before round 1.
 * Each player taps an open starting hex to drop their figure, can re-tap a
 * different open hex to move it, then taps Ready to lock in. The host begins the
 * scenario once everyone is ready.
 */
export function PlacementView({
  gameState,
  myPlayerId,
}: {
  gameState: PublicGameState;
  myPlayerId: string;
}) {
  const sock = useSocket();

  const myReady =
    gameState.players.find((p) => p.playerId === myPlayerId)?.placementReady ?? false;
  const myUnit = useMemo(
    () =>
      gameState.units.find(
        (u) => u.kind === 'player' && u.ownerPlayerId === myPlayerId,
      ) ?? null,
    [gameState.units, myPlayerId],
  );
  const placed = !!myUnit;

  // Open starting hexes: an offered start with no figure standing on it.
  const occupied = useMemo(
    () => new Set(gameState.units.map((u) => hexKey(u.hex))),
    [gameState.units],
  );
  const openKeys = useMemo(() => {
    const s = new Set<string>();
    for (const h of gameState.startingPositions) {
      if (!occupied.has(hexKey(h))) s.add(hexKey(h));
    }
    // Keep my own hex highlighted as a valid pick too (I can stay or move).
    if (myUnit) s.add(hexKey(myUnit.hex));
    return s;
  }, [gameState.startingPositions, occupied, myUnit]);

  const onTapHex = (h: Hex) => {
    if (myReady) return;
    const isStart = gameState.startingPositions.some((s) => hexEqual(s, h));
    if (!isStart) return;
    const occupant = gameState.units.find((u) => hexEqual(u.hex, h));
    if (occupant && occupant.ownerPlayerId !== myPlayerId) return;
    sock.send({ type: 'player_place', hex: h });
  };

  // Party progress for the status line.
  const party = gameState.players.filter((p) => p.characterId && p.connected);
  const readyCount = party.filter((p) => p.placementReady).length;
  const waiting = party.length - readyCount;

  return (
    <div>
      <p style={{ color: theme.muted, fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 }}>
        {myReady
          ? waiting > 0
            ? `Locked in. Waiting on ${waiting} more ${waiting === 1 ? 'player' : 'players'}…`
            : 'Locked in. Waiting for the host to begin…'
          : placed
            ? 'Tap a glowing hex to move, or lock in when you’re happy.'
            : 'Tap a glowing hex to choose where your hero starts.'}
      </p>
      <HexBoard
        tiles={gameState.tiles}
        units={gameState.units}
        moneyTokens={gameState.moneyTokens}
        doors={gameState.doors}
        reachableKeys={openKeys}
        {...(myUnit ? { selectedHexKey: hexKey(myUnit.hex) } : {})}
        {...(myReady ? {} : { onTapHex })}
        unitAvatarUrl={unitAvatarUrl}
      />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
        {myReady ? (
          <button
            onClick={() => sock.send({ type: 'player_set_placement_ready', ready: false })}
            style={{ ...btn.outline(), fontSize: 15, padding: '12px 24px' }}
          >
            Change position
          </button>
        ) : (
          <button
            disabled={!placed}
            onClick={() => sock.send({ type: 'player_set_placement_ready', ready: true })}
            style={{ ...btn.primary(!placed), fontSize: 16, padding: '14px 28px' }}
          >
            ✓ Ready
          </button>
        )}
      </div>
    </div>
  );
}
