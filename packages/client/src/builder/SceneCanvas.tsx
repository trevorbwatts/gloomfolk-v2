import { useRef } from 'react';
import { type Hex, hexKey, tileShapeById, tileSideById } from '@gloomfolk/shared';
import { theme } from '../theme.js';
import { applyPlacement } from './sceneGeometry.js';
import type { MonsterSpawn, Overlay, PlacedTile } from './scenarios.js';
import { OVERLAY_STYLES } from './overlayStyle.js';
import { monsterEntry } from './monsterCatalog.js';
import { monsterAvatarUrl } from '../avatars.js';

const SQRT3 = Math.sqrt(3);

function axialToPx(q: number, r: number, size: number) {
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

/** Inverse of axialToPx for pointy-top hexes, with cube rounding. */
function pixelToAxial(x: number, y: number, size: number): Hex {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
  const rf = ((2 / 3) * y) / size;
  // Cube round
  const xc = qf;
  const zc = rf;
  const yc = -xc - zc;
  let rx = Math.round(xc);
  let ry = Math.round(yc);
  let rz = Math.round(zc);
  const dx = Math.abs(rx - xc);
  const dy = Math.abs(ry - yc);
  const dz = Math.abs(rz - zc);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
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

function HexContents({
  cx,
  cy,
  size,
  overlays,
  monster,
}: {
  cx: number;
  cy: number;
  size: number;
  overlays: Overlay[];
  monster: MonsterSpawn | undefined;
}) {
  // Non-terrain overlays render as small symbols stacked horizontally at the
  // bottom of the hex. Terrain tints the hex itself (handled by the caller).
  const nonTerrain = overlays.filter(
    (o) => o.kind !== 'difficult-terrain' && o.kind !== 'hazardous-terrain',
  );
  const terrain = overlays.find(
    (o) => o.kind === 'difficult-terrain' || o.kind === 'hazardous-terrain',
  );
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Terrain symbol in the upper portion of the hex when terrain is set. */}
      {terrain && (
        <text
          x={cx}
          y={cy - size * 0.25}
          textAnchor="middle"
          fontSize={size * 0.45}
          fontWeight={700}
          fill="#fff"
          stroke="#000"
          strokeWidth={0.5}
          paintOrder="stroke"
        >
          {OVERLAY_STYLES[terrain.kind].symbol}
        </text>
      )}
      {/* Monster marker in the center: avatar image clipped to a circle. */}
      {monster && (() => {
        const entry = monsterEntry(monster.monsterType);
        const r = size * 0.42;
        const clipId = `monster-clip-${monster.id}`;
        return (
          <g>
            <defs>
              <clipPath id={clipId}>
                <circle cx={cx} cy={cy} r={r} />
              </clipPath>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="#1a1a1c" />
            <image
              href={monsterAvatarUrl(monster.monsterType)}
              x={cx - r}
              y={cy - r}
              width={r * 2}
              height={r * 2}
              clipPath={`url(#${clipId})`}
              preserveAspectRatio="xMidYMid slice"
            >
              <title>{entry?.name ?? monster.monsterType}</title>
            </image>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#c44" strokeWidth={1.5} />
          </g>
        );
      })()}
      {/* Non-terrain overlays as small badges along the bottom. */}
      {nonTerrain.length > 0 && (() => {
        const badgeSize = size * 0.34;
        const gap = 2;
        const totalW = nonTerrain.length * badgeSize + (nonTerrain.length - 1) * gap;
        const startX = cx - totalW / 2;
        const yTop = cy + size * 0.35 - badgeSize / 2;
        return nonTerrain.map((o, i) => {
          const s = OVERLAY_STYLES[o.kind];
          const x = startX + i * (badgeSize + gap);
          return (
            <g key={o.id}>
              <rect
                x={x}
                y={yTop}
                width={badgeSize}
                height={badgeSize}
                fill={s.color}
                stroke="#000"
                strokeWidth={0.5}
                rx={2}
              />
              {s.iconPaths ? (
                <svg
                  x={x + badgeSize * 0.15}
                  y={yTop + badgeSize * 0.15}
                  width={badgeSize * 0.7}
                  height={badgeSize * 0.7}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {s.iconPaths.map((d, idx) => (
                    <path key={idx} d={d} />
                  ))}
                </svg>
              ) : (
                <text
                  x={x + badgeSize / 2}
                  y={yTop + badgeSize * 0.78}
                  textAnchor="middle"
                  fontSize={badgeSize * 0.78}
                  fontWeight={700}
                  fill="#fff"
                >
                  {s.symbol}
                </text>
              )}
            </g>
          );
        });
      })()}
    </g>
  );
}

function tileColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 28%, 24%)`;
}

export interface SceneCanvasProps {
  placedTiles: PlacedTile[];
  overlays: Overlay[];
  monsterSpawns: MonsterSpawn[];
  selectedTileId: string | null;
  selectedHexKeys: Set<string>;
  onHexClick: (hex: Hex, shift: boolean) => void;
  onHexContextMenu: (hex: Hex, clientX: number, clientY: number) => void;
  onEmptyClick: () => void;
  size?: number;
}

export function SceneCanvas({
  placedTiles,
  overlays,
  monsterSpawns,
  selectedTileId,
  selectedHexKeys,
  onHexClick,
  onHexContextMenu,
  onEmptyClick,
  size = 24,
}: SceneCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Tile hexes (and lookup by key).
  const tilesWithHexes = placedTiles.map((p) => {
    const side = tileSideById(p.tileSideId);
    const shape = side ? tileShapeById(side.shapeId) : undefined;
    const hexes: Hex[] = shape ? applyPlacement(shape.footprint, p) : [];
    return { placed: p, hexes };
  });
  const tileHexKeys = new Set<string>();
  for (const { hexes } of tilesWithHexes) {
    for (const h of hexes) tileHexKeys.add(hexKey(h));
  }

  // Multiple overlays per hex allowed; collect them in order.
  const overlaysByHex = new Map<string, Overlay[]>();
  for (const o of overlays) {
    for (const h of o.hexes) {
      const k = hexKey(h);
      const arr = overlaysByHex.get(k);
      if (arr) arr.push(o);
      else overlaysByHex.set(k, [o]);
    }
  }
  const monsterByHex = new Map<string, MonsterSpawn>();
  for (const m of monsterSpawns) monsterByHex.set(hexKey(m.hex), m);

  // Off-tile hexes we still need to render: overlay hexes + selected hexes.
  const extraHexes: Hex[] = [];
  const extraSeen = new Set<string>();
  function pushExtra(h: Hex) {
    const k = hexKey(h);
    if (tileHexKeys.has(k) || extraSeen.has(k)) return;
    extraSeen.add(k);
    extraHexes.push(h);
  }
  for (const o of overlays) for (const h of o.hexes) pushExtra(h);
  for (const m of monsterSpawns) pushExtra(m.hex);
  for (const k of selectedHexKeys) {
    if (tileHexKeys.has(k) || extraSeen.has(k)) continue;
    const [q, r] = k.split(',').map(Number) as [number, number];
    pushExtra({ q, r });
  }

  // Bounds across all rendered hexes (tile + extras).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const allHexesForBounds: Hex[] = [];
  for (const { hexes } of tilesWithHexes) allHexesForBounds.push(...hexes);
  allHexesForBounds.push(...extraHexes);
  for (const h of allHexesForBounds) {
    const { x, y } = axialToPx(h.q, h.r, size);
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  if (!isFinite(minX)) {
    minX = -size * 4; minY = -size * 4; maxX = size * 4; maxY = size * 4;
  }
  const pad = 12;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  // Convert a DOM click into the SVG's user coordinate space, then into a hex.
  function hexAtClick(e: React.MouseEvent): Hex | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return pixelToAxial(local.x, local.y, size);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{
        width: '100%',
        maxWidth: '100%',
        background: theme.bgSolid,
        borderRadius: 6,
        border: `1px solid ${theme.border}`,
        minHeight: 320,
        cursor: 'pointer',
      }}
      onClick={(e) => {
        // Click anywhere: figure out the hex under the cursor.
        if (e.target !== e.currentTarget) return; // per-hex handlers took it
        const h = hexAtClick(e);
        if (!h) {
          onEmptyClick();
          return;
        }
        // If the computed hex isn't part of anything, still treat it as a
        // hex click so the user can place door overlays in gaps.
        onHexClick(h, e.shiftKey);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const h = hexAtClick(e);
        if (h) onHexContextMenu(h, e.clientX, e.clientY);
      }}
    >
      {/* Tile hexes */}
      {tilesWithHexes.map(({ placed, hexes }) => {
        const isTileSelected = placed.id === selectedTileId;
        const fill = tileColor(placed.tileSideId);
        return (
          <g key={placed.id}>
            {hexes.map((h) => {
              const key = hexKey(h);
              const hexOverlays = overlaysByHex.get(key) ?? [];
              const monster = monsterByHex.get(key);
              const isHexSelected = selectedHexKeys.has(key);
              const { x, y } = axialToPx(h.q, h.r, size);
              const stroke = isHexSelected
                ? theme.accent
                : isTileSelected
                ? theme.accent
                : theme.border;
              const strokeWidth = isHexSelected ? 3 : isTileSelected ? 2 : 1;
              // Tint the hex if a terrain overlay is present; otherwise tile color.
              const terrain = hexOverlays.find(
                (o) => o.kind === 'difficult-terrain' || o.kind === 'hazardous-terrain',
              );
              const hexFill = terrain ? OVERLAY_STYLES[terrain.kind].color : fill;
              const hexFillOpacity = terrain ? 0.85 : 1;
              return (
                <g
                  key={key}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHexClick(h, e.shiftKey);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHexContextMenu(h, e.clientX, e.clientY);
                  }}
                >
                  <polygon
                    points={hexCorners(x, y, size)}
                    fill={hexFill}
                    fillOpacity={hexFillOpacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                  <HexContents
                    cx={x}
                    cy={y}
                    size={size}
                    overlays={hexOverlays}
                    monster={monster}
                  />
                </g>
              );
            })}
            {(() => {
              const { x, y } = axialToPx(placed.origin.q, placed.origin.r, size);
              return (
                <text
                  x={x}
                  y={y + size * 1.05}
                  textAnchor="middle"
                  fontSize={size * 0.32}
                  fill={isTileSelected ? theme.accent : theme.muted}
                  style={{ pointerEvents: 'none' }}
                >
                  {placed.tileSideId}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Off-tile hexes (overlay hexes in gaps, monster spawns off-tile, selected empties) */}
      {extraHexes.map((h) => {
        const key = hexKey(h);
        const hexOverlays = overlaysByHex.get(key) ?? [];
        const monster = monsterByHex.get(key);
        const isHexSelected = selectedHexKeys.has(key);
        const { x, y } = axialToPx(h.q, h.r, size);
        const stroke = isHexSelected ? theme.accent : theme.border;
        const strokeWidth = isHexSelected ? 3 : 1;
        const terrain = hexOverlays.find(
          (o) => o.kind === 'difficult-terrain' || o.kind === 'hazardous-terrain',
        );
        const hexFill = terrain
          ? OVERLAY_STYLES[terrain.kind].color
          : hexOverlays.length > 0 || monster
          ? theme.panelRaised
          : 'transparent';
        return (
          <g
            key={`extra-${key}`}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onHexClick(h, e.shiftKey);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHexContextMenu(h, e.clientX, e.clientY);
            }}
          >
            <polygon
              points={hexCorners(x, y, size)}
              fill={hexFill}
              fillOpacity={terrain ? 0.85 : 1}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={
                hexOverlays.length === 0 && !monster ? '3 3' : undefined
              }
            />
            <HexContents
              cx={x}
              cy={y}
              size={size}
              overlays={hexOverlays}
              monster={monster}
            />
          </g>
        );
      })}
    </svg>
  );
}
