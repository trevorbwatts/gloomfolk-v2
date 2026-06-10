import { useEffect, useRef, useState } from 'react';
import { type Hex, hexKey, tileShapeById, tileSideById } from '@gloomfolk/shared';
import { theme } from '../theme.js';
import { applyPlacement } from './sceneGeometry.js';
import type { Decoration, MonsterSpawn, Overlay, PlacedTile } from './scenarios.js';
import { decorationDef } from './decorationCatalog.js';
import { OVERLAY_STYLES } from './overlayStyle.js';
import { monsterEntry } from './monsterCatalog.js';
import { monsterAvatarUrl } from '../avatars.js';
import {
  getTileImageRecord,
  type TileImageRecord,
  type TileImageTransform,
} from './tileImages.js';

// Overlay kinds drawn as a bold coloured hex outline (rulebook-marker style),
// layered on top of everything, instead of a fill tint or a badge/symbol. The
// outline colour comes from OVERLAY_STYLES. Order = draw order when a hex
// carries more than one of these.
const OUTLINE_OVERLAY_KINDS = [
  'difficult-terrain',
  'hazardous-terrain',
  'obstacle',
  'objective',
  'trap',
  'pressure-plate',
] as const satisfies readonly Overlay['kind'][];
const OUTLINE_OVERLAY_KIND_SET = new Set<Overlay['kind']>(OUTLINE_OVERLAY_KINDS);

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

/**
 * Renders a tile's uploaded artwork as the background of its hex footprint.
 *
 * The image is drawn in the tile's *local* (unrotated) frame — covering the
 * footprint's bounding box and clipped to the footprint hexes — then the whole
 * group is rotated and translated into place with the same transform the hex
 * grid uses. This keeps the artwork glued to the hexes through rotation.
 */
function TileBackground({
  placed,
  footprint,
  size,
  href,
  transform,
}: {
  placed: PlacedTile;
  footprint: readonly Hex[];
  size: number;
  href: string;
  transform: TileImageTransform;
}) {
  if (footprint.length === 0) return null;
  // Local pixel geometry of the unrotated footprint.
  const polygons: string[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of footprint) {
    const { x, y } = axialToPx(h.q, h.r, size);
    polygons.push(hexCorners(x, y, size));
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  const W = maxX - minX;
  const H = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const origin = axialToPx(placed.origin.q, placed.origin.r, size);
  const clipId = `tile-clip-${placed.id}`;
  // The user-set placement, mirroring TileImagePlacer: pan by a fraction of the
  // footprint box, then scale/rotate about its centre. At the identity transform
  // the whole image is fit inside the footprint box (then clipped to the hexes).
  const imageTransform =
    `translate(${cx + transform.offsetX * W} ${cy + transform.offsetY * H}) ` +
    `rotate(${transform.rotation}) scale(${transform.scale})`;
  return (
    <g
      transform={`translate(${origin.x} ${origin.y}) rotate(${60 * placed.rotation})`}
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <clipPath id={clipId}>
          {polygons.map((pts, i) => (
            <polygon key={i} points={pts} />
          ))}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={imageTransform}>
          <image
            href={href}
            x={-W / 2}
            y={-H / 2}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      </g>
    </g>
  );
}

/**
 * Renders a decorative prop's artwork over its hex footprint.
 *
 * Like `TileBackground` the image is drawn in the prop's local (unrotated)
 * frame — fit to the footprint's bounding box — then the whole group is rotated
 * and translated into place with the same transform the hex grid uses, so the
 * art stays glued to the hexes through rotation. Unlike tile art it is *not*
 * clipped to the hexagons: the PNG's transparency defines the prop's silhouette
 * (a log overhangs its hexes naturally). A faint selection ring is drawn around
 * the footprint box when selected.
 */
function DecorationImage({
  decoration,
  footprint,
  size,
  href,
  scale = 1,
  selected,
}: {
  decoration: Decoration;
  footprint: readonly Hex[];
  size: number;
  href: string;
  scale?: number;
  selected: boolean;
}) {
  if (footprint.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of footprint) {
    const { x, y } = axialToPx(h.q, h.r, size);
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  const W = (maxX - minX) * scale;
  const H = (maxY - minY) * scale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const origin = axialToPx(decoration.origin.q, decoration.origin.r, size);
  return (
    <g
      transform={`translate(${origin.x} ${origin.y}) rotate(${60 * decoration.rotation})`}
      style={{ pointerEvents: 'none' }}
    >
      {selected && (
        <rect
          x={cx - W / 2}
          y={cy - H / 2}
          width={W}
          height={H}
          fill="none"
          stroke="#fff"
          strokeWidth={1}
          strokeDasharray="4 3"
          rx={4}
        />
      )}
      <image
        href={href}
        x={cx - W / 2}
        y={cy - H / 2}
        width={W}
        height={H}
        preserveAspectRatio="xMidYMid meet"
        filter="url(#scene-decoration-shadow)"
      />
    </g>
  );
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
  // Badge overlays render as small symbols stacked horizontally at the bottom
  // of the hex. The "outline" kinds (terrain, obstacles, objectives, traps,
  // pressure plates) are instead shown as a coloured hex outline drawn by the
  // canvas, so they're excluded here.
  const nonTerrain = overlays.filter((o) => !OUTLINE_OVERLAY_KIND_SET.has(o.kind));
  return (
    <g style={{ pointerEvents: 'none' }}>
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
  decorations: Decoration[];
  monsterSpawns: MonsterSpawn[];
  selectedTileId: string | null;
  selectedDecorationId: string | null;
  selectedHexKeys: Set<string>;
  onHexClick: (hex: Hex, shift: boolean) => void;
  onHexContextMenu: (hex: Hex, clientX: number, clientY: number) => void;
  onEmptyClick: () => void;
  size?: number;
}

export function SceneCanvas({
  placedTiles,
  overlays,
  decorations,
  monsterSpawns,
  selectedTileId,
  selectedDecorationId,
  selectedHexKeys,
  onHexClick,
  onHexContextMenu,
  onEmptyClick,
  size = 24,
}: SceneCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Uploaded background art (with placement) for the tile sides in play, loaded
  // from IndexedDB.
  const [tileImages, setTileImages] = useState<Record<string, TileImageRecord>>({});
  const sideKey = Array.from(new Set(placedTiles.map((p) => p.tileSideId)))
    .sort()
    .join(',');
  useEffect(() => {
    let cancelled = false;
    const ids = sideKey ? sideKey.split(',') : [];
    Promise.all(
      ids.map(async (id) => [id, await getTileImageRecord(id)] as const),
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, TileImageRecord> = {};
        for (const [id, rec] of entries) if (rec) next[id] = rec;
        setTileImages(next);
      })
      .catch(() => {
        /* image load is best-effort; tiles fall back to flat colour */
      });
    return () => {
      cancelled = true;
    };
  }, [sideKey]);

  // Tile hexes (and lookup by key).
  const tilesWithHexes = placedTiles.map((p) => {
    const side = tileSideById(p.tileSideId);
    const shape = side ? tileShapeById(side.shapeId) : undefined;
    const footprint = shape?.footprint ?? [];
    const hexes: Hex[] = shape ? applyPlacement(shape.footprint, p) : [];
    return { placed: p, hexes, footprint };
  });
  const tileHexKeys = new Set<string>();
  for (const { hexes } of tilesWithHexes) {
    for (const h of hexes) tileHexKeys.add(hexKey(h));
  }

  // Decoration props: resolve each to its (unrotated) footprint plus the
  // absolute hexes it covers once placed/rotated. Used for bounds and rendering.
  const decorationsWithHexes = decorations.map((d) => {
    const def = decorationDef(d.decorationId);
    const footprint = def?.hexes ?? [];
    const hexes: Hex[] = def ? applyPlacement(def.hexes, d) : [];
    return { decoration: d, def, footprint, hexes };
  });

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

  // Hexes carrying each "outline" overlay kind, drawn as a bold coloured hex
  // outline layered on top of everything (see OUTLINE_OVERLAY_KINDS).
  const outlineHexKeysByKind = new Map<Overlay['kind'], Set<string>>();
  for (const kind of OUTLINE_OVERLAY_KINDS) outlineHexKeysByKind.set(kind, new Set());
  for (const o of overlays) {
    const set = outlineHexKeysByKind.get(o.kind);
    if (set) for (const h of o.hexes) set.add(hexKey(h));
  }

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
  // Keep decoration footprints inside the viewBox even when they overhang the
  // map or sit in empty space.
  for (const { hexes } of decorationsWithHexes) allHexesForBounds.push(...hexes);
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
      {/* Soft drop-shadow shared by all decoration props, to ease the hard edge
          where the artwork meets the floor. Blur/offset scale with hex size so
          it reads the same at any zoom. */}
      <defs>
        <filter id="scene-decoration-shadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow
            dx={0}
            dy={size * 0.03}
            stdDeviation={size * 0.07}
            floodColor="#000"
            floodOpacity={0.5}
          />
        </filter>
      </defs>
      {/* Tile hexes */}
      {tilesWithHexes.map(({ placed, hexes, footprint }) => {
        const isTileSelected = placed.id === selectedTileId;
        const fill = tileColor(placed.tileSideId);
        const art = tileImages[placed.tileSideId];
        return (
          <g key={placed.id}>
            {art && (
              <TileBackground
                placed={placed}
                footprint={footprint}
                size={size}
                href={art.dataUrl}
                transform={art.transform}
              />
            )}
            {hexes.map((h) => {
              const key = hexKey(h);
              const isHexSelected = selectedHexKeys.has(key);
              const { x, y } = axialToPx(h.q, h.r, size);
              const stroke = isHexSelected
                ? '#fff'
                : isTileSelected
                ? theme.accent
                : theme.border;
              const strokeWidth = isHexSelected ? 2 : isTileSelected ? 2 : 1;
              // Overlay markers are drawn as hex outlines (later pass), so the
              // fill just shows the tile art (transparent) or its flat colour.
              // Monster/badge contents are also a later pass, so they layer
              // above decoration props.
              const hexFill = fill;
              const hexFillOpacity = art ? 0 : 1;
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
                    style={{ pointerEvents: 'all' }}
                  />
                </g>
              );
            })}
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
        const stroke = isHexSelected ? '#fff' : theme.border;
        const strokeWidth = isHexSelected ? 2 : 1;
        const hexFill =
          hexOverlays.length > 0 || monster ? theme.panelRaised : 'transparent';
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
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={
                hexOverlays.length === 0 && !monster ? '3 3' : undefined
              }
            />
          </g>
        );
      })}

      {/* Overlay markers: a bold hex outline in the marker's colour. Drawn over
          the grid so each reads as a full, unbroken hexagon on top of tile art
          and neighbouring borders. Skipped for selected hexes so the selection
          ring stays visible. */}
      {OUTLINE_OVERLAY_KINDS.flatMap((kind) => {
        const color = OVERLAY_STYLES[kind].color;
        return [...(outlineHexKeysByKind.get(kind) ?? [])].map((key) => {
          if (selectedHexKeys.has(key)) return null;
          const [q, r] = key.split(',').map(Number) as [number, number];
          const { x, y } = axialToPx(q, r, size);
          return (
            <polygon
              key={`${kind}-${key}`}
              points={hexCorners(x, y, size)}
              fill="none"
              stroke={color}
              strokeWidth={2.25}
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
          );
        });
      })}

      {/* Decoration props (logs, scenery): transparent artwork laid over the
          grid and the outline markers, but below the monster/badge contents
          below, so tokens stay on top. Purely visual. */}
      {decorationsWithHexes.map(({ decoration, def, footprint }) =>
        def ? (
          <DecorationImage
            key={decoration.id}
            decoration={decoration}
            footprint={footprint}
            size={size}
            href={def.image}
            scale={def.scale ?? 1}
            selected={decoration.id === selectedDecorationId}
          />
        ) : null,
      )}

      {/* Monster avatars + non-terrain overlay badges, drawn last so they sit
          on top of decoration props (a monster standing on a log reads over
          it). Pulled out of the per-hex groups into one pass for layering. */}
      {[...new Set<string>([...overlaysByHex.keys(), ...monsterByHex.keys()])].map(
        (key) => {
          const [q, r] = key.split(',').map(Number) as [number, number];
          const { x, y } = axialToPx(q, r, size);
          return (
            <HexContents
              key={`contents-${key}`}
              cx={x}
              cy={y}
              size={size}
              overlays={overlaysByHex.get(key) ?? []}
              monster={monsterByHex.get(key)}
            />
          );
        },
      )}
    </svg>
  );
}
