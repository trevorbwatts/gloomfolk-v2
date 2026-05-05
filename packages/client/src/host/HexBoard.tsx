import type { Tile, Unit } from '@gloomfolk/shared';

const HEX_SIZE = 40; // px from center to vertex
const SQRT3 = Math.sqrt(3);

interface Pt { x: number; y: number; }

// Pointy-top axial → pixel.
function axialToPx(q: number, r: number): Pt {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

function hexCorners(cx: number, cy: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const x = cx + HEX_SIZE * Math.cos(angle);
    const y = cy + HEX_SIZE * Math.sin(angle);
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

export function HexBoard({
  tiles,
  units,
  activeUnitIds = [],
}: {
  tiles: Tile[];
  units: Unit[];
  activeUnitIds?: string[];
}) {
  if (tiles.length === 0) {
    return <p style={{ opacity: 0.6 }}>No scenario loaded.</p>;
  }

  // Compute viewBox from tile bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const { x, y } = axialToPx(t.q, t.r);
    if (x - HEX_SIZE < minX) minX = x - HEX_SIZE;
    if (y - HEX_SIZE < minY) minY = y - HEX_SIZE;
    if (x + HEX_SIZE > maxX) maxX = x + HEX_SIZE;
    if (y + HEX_SIZE > maxY) maxY = y + HEX_SIZE;
  }
  const pad = 8;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{ width: '100%', maxWidth: 900, background: '#0e0e10', borderRadius: 8 }}
    >
      <g>
        {tiles.map((t) => {
          const { x, y } = axialToPx(t.q, t.r);
          return (
            <polygon
              key={`${t.q},${t.r}`}
              points={hexCorners(x, y)}
              fill={TILE_FILL[t.kind]}
              stroke="#444"
              strokeWidth={1}
            />
          );
        })}
      </g>
      <g>
        {units.map((u) => {
          const { x, y } = axialToPx(u.hex.q, u.hex.r);
          const isPlayer = u.kind === 'player';
          const fill = isPlayer ? '#3a7bd5' : '#c44';
          const initial = u.name.slice(0, 1).toUpperCase();
          const isActive = activeUnitIds.includes(u.id);
          return (
            <g key={u.id}>
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={HEX_SIZE * 0.85}
                  fill="none"
                  stroke="#ffd84d"
                  strokeWidth={3}
                />
              )}
              <circle cx={x} cy={y} r={HEX_SIZE * 0.62} fill={fill} stroke="#fff" strokeWidth={1.5} />
              <text
                x={x}
                y={y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={20}
                fontWeight={700}
                fill="#fff"
              >
                {initial}
              </text>
              <text
                x={x}
                y={y + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill="#fff"
              >
                {u.hp}/{u.hpMax}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
