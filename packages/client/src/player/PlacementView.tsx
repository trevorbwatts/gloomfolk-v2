import { useMemo } from 'react';
import type { Hex, PublicGameState, Unit } from '@gloomfolk/shared';
import { hexEqual, hexKey } from '@gloomfolk/shared';
import { HexBoard } from '../board/HexBoard.js';
import { classAvatarUrl, monsterAvatarUrl } from '../avatars.js';
import { useSocket } from '../net/useSocket.js';
import { btn, theme } from '../theme.js';
import { BOTTOM_BAR_HEIGHT } from './BottomBar.js';

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

  return (
    <div style={{ paddingBottom: 80 }}>
      <HexBoard
        tiles={gameState.tiles}
        units={gameState.units}
        moneyTokens={gameState.moneyTokens}
        doors={gameState.doors}
        {...(gameState.tileArt ? { tileArt: gameState.tileArt } : {})}
        {...(gameState.decorations ? { decorations: gameState.decorations } : {})}
        reachableKeys={openKeys}
        {...(myUnit ? { selectedHexKey: hexKey(myUnit.hex) } : {})}
        {...(myReady ? {} : { onTapHex })}
        unitAvatarUrl={unitAvatarUrl}
      />
      <div
        style={{
          position: 'fixed',
          bottom: BOTTOM_BAR_HEIGHT,
          left: 0,
          right: 0,
          background: theme.bgSolid,
          padding: '8px 16px',
          borderTop: `1px solid ${theme.border}`,
          zIndex: 40,
        }}
      >
        {myReady ? (
          <button
            onClick={() => sock.send({ type: 'player_set_placement_ready', ready: false })}
            style={{ ...btn.outline(), width: '100%', fontSize: 15, padding: '10px 16px' }}
          >
            Change position
          </button>
        ) : (
          <button
            disabled={!placed}
            onClick={() => sock.send({ type: 'player_set_placement_ready', ready: true })}
            style={{ ...btn.primary(!placed), width: '100%', fontSize: 15, padding: '10px 16px' }}
          >
            ✓ Ready
          </button>
        )}
      </div>
    </div>
  );
}
