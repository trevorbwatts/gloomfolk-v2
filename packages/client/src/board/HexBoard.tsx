import { useEffect, useRef, useState } from 'react';
import type { Hex, MoneyToken, MonsterTurnAnim, Tile, Unit } from '@gloomfolk/shared';
import { GameIcon } from '../icons.js';

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
  /** Money tokens dropped on the map, awaiting pickup. */
  moneyTokens?: MoneyToken[];
  size?: number;
  maxWidthPx?: number;
  activeUnitIds?: string[];
  /** Hex keys ("q,r") to highlight as movable. */
  reachableKeys?: Set<string>;
  /** Ordered preview path (excluding the starting hex). Rendered with a path
      color and numbered step labels. */
  pathHexes?: Hex[] | undefined;
  /** Unit ids to highlight as targetable (e.g. enemies in attack range). */
  targetableUnitIds?: string[];
  /** A unit currently chosen (staged) by the player; rendered with a strong
      selection ring distinct from the dashed targetable ring. */
  selectedUnitId?: string | null;
  /** A hex currently chosen (staged) by the player (e.g. AOE anchor). */
  selectedHexKey?: string | null;
  /** Hex keys ("q,r") covered by the staged AOE pattern. Rendered with a
      distinct red-tinted fill so the player sees which hexes will be hit. */
  aoeHexKeys?: Set<string> | undefined;
  onTapHex?: ((h: Hex) => void) | undefined;
  onTapUnit?: ((u: Unit) => void) | undefined;
  /** Fired when a pointer (mouse with button down, or touch) crosses into a
      hex. Used by the move-preview UI to extend the path as the user drags. */
  onHexEnter?: ((h: Hex) => void) | undefined;
  /** Optional avatar URL per unit. If returned, rendered clipped to a circle
      over the unit's colored disc; the disc still shows if the image fails. */
  unitAvatarUrl?: ((u: Unit) => string | undefined) | undefined;
  /** While set, the named unit's token is rendered at an interpolated point
      along `steps` (steps[0] is the starting hex, steps[last] is the
      destination) rather than at its current `hex`. Fires `onMoveAnimDone`
      when the animation finishes. */
  moveAnim?: { unitId: string; steps: Hex[] } | null | undefined;
  onMoveAnimDone?: (() => void) | undefined;
  /** Active monster group turn — spotlights the acting monster, glows the
   *  target, and draws an arrow between them. Null when no monster turn is
   *  in progress. */
  monsterTurnAnim?: MonsterTurnAnim | null | undefined;
}

const MOVE_STEP_MS = 140;

export function HexBoard({
  tiles,
  units,
  moneyTokens = [],
  size = 40,
  maxWidthPx = 900,
  activeUnitIds = [],
  reachableKeys,
  pathHexes,
  targetableUnitIds = [],
  selectedUnitId = null,
  selectedHexKey = null,
  aoeHexKeys,
  onTapHex,
  onTapUnit,
  onHexEnter,
  unitAvatarUrl,
  moveAnim,
  onMoveAnimDone,
  monsterTurnAnim,
}: HexBoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastEnteredKeyRef = useRef<string | null>(null);
  // Progress through `moveAnim.steps` as a float in [0, steps.length - 1].
  // Null when no animation is running.
  const [animProgress, setAnimProgress] = useState<number | null>(null);
  // Callback identity changes on every parent render; keep it in a ref so the
  // animation effect only restarts when `moveAnim` itself changes.
  const onDoneRef = useRef(onMoveAnimDone);
  useEffect(() => {
    onDoneRef.current = onMoveAnimDone;
  }, [onMoveAnimDone]);

  useEffect(() => {
    if (!moveAnim || moveAnim.steps.length < 2) {
      setAnimProgress(null);
      return;
    }
    const segCount = moveAnim.steps.length - 1;
    const totalMs = segCount * MOVE_STEP_MS;
    const startedAt = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= totalMs) {
        setAnimProgress(null);
        onDoneRef.current?.();
        return;
      }
      setAnimProgress((elapsed / totalMs) * segCount);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [moveAnim]);

  // Pixel position to render `unit` at — interpolated along moveAnim if it
  // applies to this unit, otherwise its true hex.
  const unitRenderPos = (u: Unit): Pt => {
    if (
      moveAnim &&
      moveAnim.unitId === u.id &&
      animProgress !== null &&
      moveAnim.steps.length >= 2
    ) {
      const steps = moveAnim.steps;
      // Clamp into [0, steps.length - 2]. Without the floor it's already in
      // range from the rAF math, but a stale animProgress carried over from
      // a prior moveAnim (different steps.length) could land out of bounds.
      const rawIdx = Math.floor(animProgress);
      const segIdx = Math.max(0, Math.min(rawIdx, steps.length - 2));
      const a = steps[segIdx];
      const b = steps[segIdx + 1];
      if (a && b) {
        const t = Math.max(0, Math.min(1, animProgress - segIdx));
        const pa = axialToPx(a.q, a.r, size);
        const pb = axialToPx(b.q, b.r, size);
        return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
      }
    }
    return axialToPx(u.hex.q, u.hex.r, size);
  };

  useEffect(() => {
    if (!onHexEnter) return;
    const stop = () => {
      isDraggingRef.current = false;
      lastEnteredKeyRef.current = null;
    };
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [onHexEnter]);

  const hitTestHex = (clientX: number, clientY: number): Hex | null => {
    const el = document.elementFromPoint(clientX, clientY) as Element | null;
    if (!el) return null;
    const q = el.getAttribute('data-hex-q');
    const r = el.getAttribute('data-hex-r');
    if (q == null || r == null) return null;
    return { q: Number(q), r: Number(r) };
  };

  const fireEnter = (h: Hex) => {
    const k = `${h.q},${h.r}`;
    if (lastEnteredKeyRef.current === k) return;
    lastEnteredKeyRef.current = k;
    onHexEnter?.(h);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!onHexEnter) return;
    const t = e.touches[0];
    if (!t) return;
    const h = hitTestHex(t.clientX, t.clientY);
    if (!h) return;
    isDraggingRef.current = true;
    lastEnteredKeyRef.current = null;
    fireEnter(h);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!onHexEnter || !isDraggingRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    // Prevent the page from scrolling while the user traces a path.
    e.preventDefault();
    const h = hitTestHex(t.clientX, t.clientY);
    if (h) fireEnter(h);
  };

  if (tiles.length === 0) {
    return <p style={{ opacity: 0.6 }}>No scenario loaded.</p>;
  }

  const pathIndexByKey = new Map<string, number>();
  if (pathHexes) {
    pathHexes.forEach((h, i) => pathIndexByKey.set(`${h.q},${h.r}`, i + 1));
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
      ref={svgRef}
      viewBox={`${minX - pad} ${minY - pad} ${vbW} ${vbH}`}
      style={{
        width: '100%',
        maxWidth: maxWidthPx,
        background: '#0e0e10',
        borderRadius: 8,
        touchAction: onHexEnter ? 'none' : 'manipulation',
        userSelect: 'none',
      }}
      onTouchStart={onHexEnter ? handleTouchStart : undefined}
      onTouchMove={onHexEnter ? handleTouchMove : undefined}
    >
      <g>
        {tiles.map((t) => {
          const { x, y } = axialToPx(t.q, t.r, size);
          const k = `${t.q},${t.r}`;
          const reachable = reachableKeys?.has(k);
          const onPath = pathIndexByKey.has(k);
          const isSelectedHex = selectedHexKey === k;
          const isAoeAnchor = isSelectedHex && aoeHexKeys?.has(k);
          const isAoeHit = !isSelectedHex && aoeHexKeys?.has(k);
          const tappable = (onTapHex || onHexEnter) && t.kind !== 'wall';
          const fill = isAoeAnchor
            ? '#7a2030'
            : isAoeHit
              ? '#5a1a2a'
              : isSelectedHex
                ? '#5a3f1a'
                : onPath
                  ? '#3b5d2a'
                  : reachable
                    ? '#1f3a55'
                    : TILE_FILL[t.kind];
          const stroke = isAoeAnchor
            ? '#ffb347'
            : isAoeHit
              ? '#e25555'
              : isSelectedHex
                ? '#d9a441'
                : onPath
                  ? '#a4d96c'
                  : reachable
                    ? '#5fa8e6'
                    : '#444';
          const strokeWidth = isAoeAnchor ? 3 : isAoeHit ? 2 : isSelectedHex ? 3 : onPath ? 2 : reachable ? 2 : 1;
          return (
            <polygon
              key={k}
              points={hexCorners(x, y, size)}
              data-hex-q={t.q}
              data-hex-r={t.r}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={{ cursor: tappable ? 'pointer' : 'default' }}
              onClick={tappable && onTapHex ? () => onTapHex({ q: t.q, r: t.r }) : undefined}
              onMouseDown={
                onHexEnter && tappable
                  ? () => {
                      isDraggingRef.current = true;
                      lastEnteredKeyRef.current = null;
                      fireEnter({ q: t.q, r: t.r });
                    }
                  : undefined
              }
              onMouseEnter={
                onHexEnter && tappable
                  ? () => {
                      if (isDraggingRef.current) fireEnter({ q: t.q, r: t.r });
                    }
                  : undefined
              }
            />
          );
        })}
      </g>
      {pathHexes && pathHexes.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          {pathHexes.map((h, i) => {
            const { x, y } = axialToPx(h.q, h.r, size);
            return (
              <text
                key={`path-${h.q},${h.r}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size * 0.45}
                fontWeight={700}
                fill="#e7f3d4"
                stroke="#1a1a1a"
                strokeWidth={0.8}
                paintOrder="stroke"
              >
                {i + 1}
              </text>
            );
          })}
        </g>
      )}
      <g>
        {(() => {
          // Group tokens by hex so stacked drops render as a single coin
          // with a count badge rather than overlapping discs.
          const groups = new Map<string, { hex: Hex; count: number }>();
          for (const t of moneyTokens) {
            const k = `${t.hex.q},${t.hex.r}`;
            const g = groups.get(k);
            if (g) g.count += 1;
            else groups.set(k, { hex: t.hex, count: 1 });
          }
          return [...groups.values()].map(({ hex, count }) => {
            const { x, y } = axialToPx(hex.q, hex.r, size);
            const k = `${hex.q},${hex.r}`;
            return (
              <g key={`money-${k}`} style={{ pointerEvents: 'none' }}>
                <circle cx={x} cy={y} r={size * 0.28} fill="#d9a441" stroke="#7a5a1a" strokeWidth={1.5} />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={size * 0.28}
                  fontWeight={800}
                  fill="#3a2a0a"
                >
                  {count > 1 ? `×${count}` : '$'}
                </text>
              </g>
            );
          });
        })()}
      </g>
      <defs>
        {units.map((u) => {
          const { x, y } = unitRenderPos(u);
          return (
            <clipPath key={u.id} id={`avatar-clip-${u.id}`}>
              <circle cx={x} cy={y} r={size * 0.6} />
            </clipPath>
          );
        })}
        <marker
          id="monster-arrow-head"
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={5}
          markerHeight={5}
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#ff6b6b" />
        </marker>
      </defs>
      {(() => {
        // Spotlight rings for the active monster turn. Rendered BEFORE the
        // units so the token sits on top of the ring (the ring frames the
        // figure rather than covering it). The arrow is drawn AFTER the
        // units block.
        if (!monsterTurnAnim || !monsterTurnAnim.activeMonsterId) return null;
        const m = units.find((u) => u.id === monsterTurnAnim.activeMonsterId);
        if (!m) return null;
        const mPos = unitRenderPos(m);
        const t = monsterTurnAnim.targetUnitId
          ? units.find((u) => u.id === monsterTurnAnim.targetUnitId) ?? null
          : null;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <circle
              cx={mPos.x}
              cy={mPos.y}
              r={size * 0.95}
              fill="none"
              stroke="#ff6b6b"
              strokeWidth={3.5}
              opacity={0.85}
            >
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="r" values={`${size * 0.85};${size * 1.05};${size * 0.85}`} dur="1.2s" repeatCount="indefinite" />
            </circle>
            {t && (() => {
              const tPos = unitRenderPos(t);
              return (
                <circle
                  cx={tPos.x}
                  cy={tPos.y}
                  r={size * 0.95}
                  fill="none"
                  stroke="#ffd84d"
                  strokeWidth={3.5}
                  opacity={0.85}
                >
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
                </circle>
              );
            })()}
          </g>
        );
      })()}
      <g>
        {units.map((u) => {
          const { x, y } = unitRenderPos(u);
          const isPlayer = u.kind === 'player';
          const fill = isPlayer ? '#3a7bd5' : '#c44';
          const initial = u.name.slice(0, 1).toUpperCase();
          const isActive = activeUnitIds.includes(u.id);
          const isTargetable = targetableUnitIds.includes(u.id);
          const isSelected = selectedUnitId === u.id;
          const handler = onTapUnit ? () => onTapUnit(u) : undefined;
          const avatar = unitAvatarUrl?.(u);
          const r = size * 0.6;
          return (
            <g
              key={u.id}
              style={{ cursor: handler ? 'pointer' : 'default' }}
              onClick={handler}
            >
              {isActive && (
                <circle cx={x} cy={y} r={size * 0.85} fill="none" stroke="#ffd84d" strokeWidth={3} />
              )}
              {isTargetable && !isSelected && (
                <circle cx={x} cy={y} r={size * 0.78} fill="none" stroke="#ff6b6b" strokeWidth={3} strokeDasharray="4 3" />
              )}
              {isSelected && (
                <>
                  <circle cx={x} cy={y} r={size * 0.92} fill="none" stroke="#d9a441" strokeWidth={3} opacity={0.5} />
                  <circle cx={x} cy={y} r={size * 0.78} fill="none" stroke="#d9a441" strokeWidth={3.5} />
                </>
              )}
              <circle cx={x} cy={y} r={size * 0.62} fill={fill} stroke="#fff" strokeWidth={1.5} />
              {avatar ? (
                <image
                  href={avatar}
                  x={x - r}
                  y={y - r}
                  width={r * 2}
                  height={r * 2}
                  clipPath={`url(#avatar-clip-${u.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.5} fontWeight={700} fill="#fff">
                  {initial}
                </text>
              )}
              {(u.kind !== 'player' || u.shield > 0) && (
                <text x={x} y={y + size * 0.35} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.28} fill="#fff" stroke="#000" strokeWidth={0.6} paintOrder="stroke">
                  {u.kind === 'player'
                    ? `⛨${u.shield}`
                    : `${u.hp}/${u.hpMax}${u.shield > 0 ? ` ⛨${u.shield}` : ''}`}
                </text>
              )}
              {(u.conditions.length > 0 || u.invisible) && (() => {
                const items = [
                  ...u.conditions.map((c) => c.kind),
                  ...(u.invisible ? (['invisible'] as const) : []),
                ];
                const iconSize = Math.max(10, size * 0.32);
                const gap = 2;
                const totalW = items.length * iconSize + (items.length - 1) * gap;
                const rowY = y - size * 0.85;
                return (
                  <foreignObject
                    x={x - totalW / 2}
                    y={rowY}
                    width={totalW}
                    height={iconSize}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap,
                        alignItems: 'center',
                        color: '#ffd84d',
                        lineHeight: 0,
                      }}
                    >
                      {items.map((k, i) => (
                        <GameIcon key={i} kind={k} size={iconSize} color="#ffd84d" />
                      ))}
                    </div>
                  </foreignObject>
                );
              })()}
            </g>
          );
        })}
      </g>
      {(() => {
        // Arrow from active monster to its current target. Drawn last so it
        // sits on top of unit tokens. Skipped during the move-anim segment
        // where the monster is mid-slide (the path animation already
        // communicates direction).
        if (!monsterTurnAnim || !monsterTurnAnim.activeMonsterId || !monsterTurnAnim.targetUnitId)
          return null;
        const m = units.find((u) => u.id === monsterTurnAnim.activeMonsterId);
        const t = units.find((u) => u.id === monsterTurnAnim.targetUnitId);
        if (!m || !t) return null;
        const mPos = unitRenderPos(m);
        const tPos = unitRenderPos(t);
        const dx = tPos.x - mPos.x;
        const dy = tPos.y - mPos.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.5) return null;
        // Pull the endpoints inside the token rings so the arrow doesn't
        // overlap the unit discs.
        const inset = size * 0.85;
        const fromX = mPos.x + (dx / len) * inset;
        const fromY = mPos.y + (dy / len) * inset;
        const toX = tPos.x - (dx / len) * inset;
        const toY = tPos.y - (dy / len) * inset;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke="#ff6b6b"
              strokeWidth={3}
              strokeLinecap="round"
              markerEnd="url(#monster-arrow-head)"
              opacity={0.9}
            />
          </g>
        );
      })()}
    </svg>
  );
}
