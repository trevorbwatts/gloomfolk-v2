import { useRef } from 'react';
import type { Hex } from '@gloomfolk/shared';
import { theme } from '../theme.js';
import {
  DEFAULT_TILE_IMAGE_TRANSFORM,
  type TileImageTransform,
} from './tileImages.js';

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

/** Pixel geometry of a footprint at a given hex size: per-hex corner polygons
    and the overall bounding box. */
function footprintGeometry(footprint: readonly Hex[], size: number) {
  const polygons: string[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of footprint) {
    const { x, y } = axialToPx(h.q, h.r, size);
    polygons.push(hexCorners(x, y, size));
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  return { polygons, minX, minY, maxX, maxY };
}

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
};

const sliderLabelStyle: React.CSSProperties = {
  width: 64,
  color: theme.muted,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontFamily: theme.headingFont,
  flexShrink: 0,
};

const numberInputStyle: React.CSSProperties = {
  width: 64,
  background: theme.bgSolid,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 12,
  fontFamily: theme.font,
  flexShrink: 0,
};

interface Props {
  footprint: readonly Hex[];
  href: string;
  transform: TileImageTransform;
  onChange: (next: TileImageTransform) => void;
  size?: number;
}

/**
 * Crop-frame editor for a tile's background art: the hex grid is fixed and the
 * image is moved/scaled/rotated underneath it. Drag the image to pan; use the
 * sliders for precise scale and rotation. The rendered transform mirrors exactly
 * what {@link TileBackground} draws on the scenario map, so this is a true live
 * preview.
 */
export function TileImagePlacer({
  footprint,
  href,
  transform,
  onChange,
  size = 40,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    userPerPx: number;
  } | null>(null);

  const { polygons, minX, minY, maxX, maxY } = footprintGeometry(footprint, size);
  const W = maxX - minX;
  const H = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = 8;
  const vbW = W + pad * 2;
  const vbH = H + pad * 2;

  function patch(p: Partial<TileImageTransform>) {
    onChange({ ...transform, ...p });
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: transform.offsetX,
      startOffsetY: transform.offsetY,
      // SVG user units per screen pixel (viewBox is scaled to fit the element).
      userPerPx: vbW / rect.width,
    };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const dxUser = (e.clientX - d.startClientX) * d.userPerPx;
    const dyUser = (e.clientY - d.startClientY) * d.userPerPx;
    patch({
      offsetX: d.startOffsetX + dxUser / W,
      offsetY: d.startOffsetY + dyUser / H,
    });
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const imageTransform =
    `translate(${cx + transform.offsetX * W} ${cy + transform.offsetY * H}) ` +
    `rotate(${transform.rotation}) scale(${transform.scale})`;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: '100%',
          maxWidth: 480,
          background: theme.bgSolid,
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          display: 'block',
          touchAction: 'none',
          cursor: drag.current ? 'grabbing' : 'grab',
        }}
      >
        {/* The art, transformed exactly as it will render on the map. Drawn
            centred at the origin so scale/rotate pivot on the footprint centre. */}
        <g transform={imageTransform} style={{ pointerEvents: 'none' }}>
          <image
            href={href}
            x={-W / 2}
            y={-H / 2}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
        {/* Dim everything outside the footprint so the playable hexes stand out.
            An even-odd fill of (full rect) minus (footprint hexes). */}
        <path
          d={
            `M${minX - pad} ${minY - pad} h${vbW} v${vbH} h${-vbW} Z ` +
            polygons.map((pts) => `M${pts.replace(/ /g, ' L')} Z`).join(' ')
          }
          fillRule="evenodd"
          fill="#000"
          fillOpacity={0.45}
          style={{ pointerEvents: 'none' }}
        />
        {/* Fixed hex grid on top. */}
        {polygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke={theme.accent}
            strokeWidth={1.5}
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </svg>

      <div style={sliderRowStyle}>
        <span style={sliderLabelStyle}>Scale</span>
        <input
          type="range"
          min={0.2}
          max={4}
          step={0.01}
          value={transform.scale}
          onChange={(e) => patch({ scale: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={0.2}
          max={4}
          step={0.05}
          value={Number(transform.scale.toFixed(2))}
          onChange={(e) => patch({ scale: Number(e.target.value) })}
          style={numberInputStyle}
        />
      </div>

      <div style={sliderRowStyle}>
        <span style={sliderLabelStyle}>Rotation</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={transform.rotation}
          onChange={(e) => patch({ rotation: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={-180}
          max={180}
          step={1}
          value={Math.round(transform.rotation)}
          onChange={(e) => patch({ rotation: Number(e.target.value) })}
          style={numberInputStyle}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => onChange({ ...DEFAULT_TILE_IMAGE_TRANSFORM })}
          style={{
            background: 'transparent',
            color: theme.muted,
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            padding: '4px 10px',
            fontSize: 12,
            fontFamily: theme.font,
            cursor: 'pointer',
          }}
        >
          Reset to fit
        </button>
      </div>
    </div>
  );
}
