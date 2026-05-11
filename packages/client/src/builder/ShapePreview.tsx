import type { Hex } from '@gloomfolk/shared';
import { theme } from '../theme.js';

const SQRT3 = Math.sqrt(3);

function axialToPx(q: number, r: number, size: number) {
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

export interface ShapePreviewProps {
  footprint: Hex[];
  size?: number;
  fill?: string;
  stroke?: string;
  showCoords?: boolean;
}

export function ShapePreview({
  footprint,
  size = 28,
  fill = theme.panelRaised,
  stroke = theme.accent,
  showCoords = false,
}: ShapePreviewProps) {
  if (footprint.length === 0) {
    return <p style={{ color: theme.muted }}>(empty footprint)</p>;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of footprint) {
    const { x, y } = axialToPx(h.q, h.r, size);
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  const pad = 6;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{
        width: '100%',
        maxWidth: 480,
        background: theme.bgSolid,
        borderRadius: 6,
        border: `1px solid ${theme.border}`,
      }}
    >
      {footprint.map((h) => {
        const { x, y } = axialToPx(h.q, h.r, size);
        return (
          <g key={`${h.q},${h.r}`}>
            <polygon
              points={hexCorners(x, y, size)}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.5}
            />
            {showCoords && (
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize={size * 0.32}
                fill={theme.muted}
                style={{ pointerEvents: 'none' }}
              >
                {h.q},{h.r}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
