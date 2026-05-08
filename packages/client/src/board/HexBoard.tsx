import type { Hex, Tile, Unit } from '@gloomfolk/shared';

const SQRT3 = Math.sqrt(3);

interface Pt { x: number; y: number; }

function axialToPx(q: number, r: number, size: number): Pt {
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

const TILE_FILL: Record<Tile['kind'], string> = {
  floor: '#2a2a2e',
  wall: '#0a0a0c',
  difficult: '#3a2a1a',
  hazard: '#5a1a1a',
  door: '#3a3a2a',
};

export interface HexBoardProps {
  tiles: Tile[];
  units: Unit[];
  size?: number;
  maxWidthPx?: number;
  activeUnitIds?: string[];
  /** Hex keys ("q,r") to highlight as movable. */
  reachableKeys?: Set<string>;
  /** Unit ids to highlight as targetable (e.g. enemies in attack range). */
  targetableUnitIds?: string[];
  onTapHex?: ((h: Hex) => void) | undefined;
  onTapUnit?: ((u: Unit) => void) | undefined;
}

export function HexBoard({
  tiles,
  units,
  size = 40,
  maxWidthPx = 900,
  activeUnitIds = [],
  reachableKeys,
  targetableUnitIds = [],
  onTapHex,
  onTapUnit,
}: HexBoardProps) {
  if (tiles.length === 0) {
    return <p style={{ opacity: 0.6 }}>No scenario loaded.</p>;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const { x, y } = axialToPx(t.q, t.r, size);
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  const pad = 8;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{ width: '100%', maxWidth: maxWidthPx, background: '#0e0e10', borderRadius: 8, touchAction: 'manipulation' }}
    >
      <g>
        {tiles.map((t) => {
          const { x, y } = axialToPx(t.q, t.r, size);
          const k = `${t.q},${t.r}`;
          const reachable = reachableKeys?.has(k);
          const tappable = onTapHex && t.kind !== 'wall';
          return (
            <polygon
              key={k}
              points={hexCorners(x, y, size)}
              fill={reachable ? '#1f3a55' : TILE_FILL[t.kind]}
              stroke={reachable ? '#5fa8e6' : '#444'}
              strokeWidth={reachable ? 2 : 1}
              style={{ cursor: tappable ? 'pointer' : 'default' }}
              onClick={tappable ? () => onTapHex!({ q: t.q, r: t.r }) : undefined}
            />
          );
        })}
      </g>
      <g>
        {units.map((u) => {
          const { x, y } = axialToPx(u.hex.q, u.hex.r, size);
          const isPlayer = u.kind === 'player';
          const fill = isPlayer ? '#3a7bd5' : '#c44';
          const initial = u.name.slice(0, 1).toUpperCase();
          const isActive = activeUnitIds.includes(u.id);
          const isTargetable = targetableUnitIds.includes(u.id);
          const handler = onTapUnit ? () => onTapUnit(u) : undefined;
          return (
            <g
              key={u.id}
              style={{ cursor: handler ? 'pointer' : 'default' }}
              onClick={handler}
            >
              {isActive && (
                <circle cx={x} cy={y} r={size * 0.85} fill="none" stroke="#ffd84d" strokeWidth={3} />
              )}
              {isTargetable && (
                <circle cx={x} cy={y} r={size * 0.78} fill="none" stroke="#ff6b6b" strokeWidth={3} strokeDasharray="4 3" />
              )}
              <circle cx={x} cy={y} r={size * 0.62} fill={fill} stroke="#fff" strokeWidth={1.5} />
              <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.5} fontWeight={700} fill="#fff">
                {initial}
              </text>
              <text x={x} y={y + size * 0.35} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.28} fill="#fff">
                {u.hp}/{u.hpMax}{u.shield > 0 ? ` ⛨${u.shield}` : ''}
              </text>
              {u.conditions.length > 0 && (
                <text
                  x={x}
                  y={y - size * 0.6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={size * 0.24}
                  fill="#ffd84d"
                >
                  {u.conditions.map((c) => c.kind.slice(0, 3)).join(' ')}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
