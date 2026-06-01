import { useEffect, useRef, useState } from 'react';
import type { DoorView, Hex, MoneyToken, MonsterTurnAnim, Tile, Unit } from '@gloomfolk/shared';
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
  /** Visible, unopened doors — drawn as a door icon + numbered token on their
   *  hex. An `openable` door also gets a pulsing highlight. */
  doors?: DoorView[];
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
  doors = [],
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

  // --- Monster-attack cinematic ---------------------------------------------
  // The server streams the enemy turn as phases (focus → move → modifier-draw →
  // damage). We bump a nonce each time a fresh hit resolves so the one-shot
  // impact visuals (flash, damage pop, lunge, shake) remount and replay.
  const mAnim = monsterTurnAnim ?? null;
  const mDraw = mAnim?.modifierDraw ?? null;
  const isImpact = mAnim?.phase === 'damage' && !!mDraw && mDraw.damageDealt !== null;
  const hitSig = isImpact
    ? `${mAnim!.activeMonsterId}|${mDraw!.targetUnitId}|${mDraw!.finalAmount}|${mDraw!.damageDealt}`
    : null;
  const hitSigRef = useRef<string | null>(null);
  const [hitNonce, setHitNonce] = useState(0);
  useEffect(() => {
    if (hitSig && hitSig !== hitSigRef.current) {
      hitSigRef.current = hitSig;
      setHitNonce((n) => n + 1);
    } else if (!hitSig) {
      hitSigRef.current = null;
    }
  }, [hitSig]);
  // Screen shake on a landed hit — the reflow trick replays the CSS animation
  // without React clobbering it (animation isn't part of the style prop).
  useEffect(() => {
    if (hitNonce === 0) return;
    if ((mDraw?.damageDealt ?? 0) <= 0) return; // misses/full blocks don't shake
    const el = svgRef.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.getBoundingClientRect();
    el.style.animation = 'hexImpactShake 0.4s ease-in-out';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitNonce]);

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

  // One-shot transform animation for a unit's token during an impact: the
  // attacker lunges toward its target and back; the struck target jitters.
  // Returns an <animateTransform> to drop inside the token's <g> (keyed by the
  // hit nonce so it replays each hit).
  const renderTokenFx = (u: Unit): React.ReactNode => {
    if (!isImpact || !mAnim || !mDraw) return null;
    if (u.id === mAnim.activeMonsterId) {
      const target = units.find((x) => x.id === mDraw.targetUnitId);
      if (!target) return null;
      const a = unitRenderPos(u);
      const b = unitRenderPos(target);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const lx = ((dx / len) * size * 0.5).toFixed(1);
      const ly = ((dy / len) * size * 0.5).toFixed(1);
      return (
        <animateTransform
          key={`lunge-${hitNonce}`}
          attributeName="transform"
          type="translate"
          dur="0.32s"
          repeatCount="1"
          keyTimes="0;0.45;1"
          values={`0 0; ${lx} ${ly}; 0 0`}
          calcMode="spline"
          keySplines="0.3 0 0.2 1; 0.4 0 0.2 1"
        />
      );
    }
    if (u.id === mDraw.targetUnitId && (mDraw.damageDealt ?? 0) > 0) {
      return (
        <animateTransform
          key={`shake-${hitNonce}`}
          attributeName="transform"
          type="translate"
          dur="0.4s"
          repeatCount="1"
          values="0 0; -2.5 1.5; 2.5 -1.5; -1.5 1; 1 -0.5; 0 0"
        />
      );
    }
    return null;
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
        // A non-finite cap (e.g. Infinity) means "fill the container" — leave
        // maxWidth unset so the board can span its whole column.
        ...(Number.isFinite(maxWidthPx) ? { maxWidth: maxWidthPx } : {}),
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
      {doors.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          {doors.map((d) => {
            const { x, y } = axialToPx(d.hex.q, d.hex.r, size);
            const dw = size * 0.5;
            const dh = size * 0.84;
            const top = y - dh / 2;
            return (
              <g key={`door-${d.id}`}>
                {d.openable && (
                  <circle cx={x} cy={y} r={size * 0.82} fill="none" stroke="#a4d96c" strokeWidth={3}>
                    <animate attributeName="opacity" values="0.25;1;0.25" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Door slab */}
                <rect
                  x={x - dw / 2}
                  y={top}
                  width={dw}
                  height={dh}
                  rx={dw * 0.16}
                  fill="#5b4427"
                  stroke="#caa86a"
                  strokeWidth={2}
                />
                {/* Inset panel + knob */}
                <rect
                  x={x - dw / 2 + dw * 0.16}
                  y={top + dh * 0.1}
                  width={dw * 0.68}
                  height={dh * 0.8}
                  rx={dw * 0.1}
                  fill="none"
                  stroke="#caa86a"
                  strokeWidth={1}
                  opacity={0.55}
                />
                <circle cx={x + dw * 0.24} cy={y} r={size * 0.05} fill="#caa86a" />
                {/* Numbered token (corner badge, matching the standee number) */}
                <circle
                  cx={x + size * 0.46}
                  cy={y - size * 0.46}
                  r={size * 0.3}
                  fill="#1b1b1b"
                  stroke="#caa86a"
                  strokeWidth={1.5}
                />
                <text
                  x={x + size * 0.46}
                  y={y - size * 0.46}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={size * 0.34}
                  fontWeight={700}
                  fill="#fff"
                >
                  {d.number}
                </text>
              </g>
            );
          })}
        </g>
      )}
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
        <style>{
          '@keyframes hexImpactShake{0%,100%{transform:translate(0,0)}' +
          '15%{transform:translate(-3px,2px)}30%{transform:translate(3px,-2px)}' +
          '45%{transform:translate(-2px,2px)}60%{transform:translate(2px,-1px)}' +
          '80%{transform:translate(-1px,1px)}}'
        }</style>
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
              return <Reticle x={tPos.x} y={tPos.y} size={size} />;
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
              {renderTokenFx(u)}
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
              <circle
                cx={x}
                cy={y}
                r={size * 0.62}
                fill={fill}
                stroke={
                  u.rank === 'elite' ? '#f0c850' : u.rank === 'named' ? '#e0564f' : '#fff'
                }
                strokeWidth={u.rank === 'elite' || u.rank === 'named' ? 3 : 1.5}
              />
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
              {u.kind === 'monster' && u.standeeNumber !== undefined && (
                <>
                  <circle cx={x + size * 0.52} cy={y - size * 0.52} r={size * 0.34} fill="#1b1b1b" stroke="#fff" strokeWidth={1} />
                  <text x={x + size * 0.52} y={y - size * 0.52} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.4} fontWeight={700} fill="#fff">
                    {u.standeeNumber}
                  </text>
                </>
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
      {isImpact && mDraw && (() => {
        const t = units.find((u) => u.id === mDraw.targetUnitId);
        if (!t) return null;
        const { x, y } = unitRenderPos(t);
        return (
          <AttackImpactFx
            key={hitNonce}
            x={x}
            y={y}
            size={size}
            dealt={mDraw.damageDealt ?? 0}
            blocked={Math.max(0, mDraw.finalAmount - (mDraw.damageDealt ?? 0))}
          />
        );
      })()}
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

/** Animated targeting reticle that "locks onto" the figure an enemy is about to
 *  attack: a slowly rotating dashed ring with crosshair ticks plus a pulsing
 *  inner ring. Replaces the old static gold ring. */
function Reticle({ x, y, size }: { x: number; y: number; size: number }) {
  const r = size * 0.95;
  const tick = size * 0.24;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${x} ${y}`}
          to={`360 ${x} ${y}`}
          dur="6s"
          repeatCount="indefinite"
        />
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#ffd84d"
          strokeWidth={2.5}
          strokeDasharray={`${(r * 0.5).toFixed(1)} ${(r * 0.32).toFixed(1)}`}
          opacity={0.9}
        />
        {[0, 90, 180, 270].map((a) => {
          const rad = (a * Math.PI) / 180;
          const ox = Math.cos(rad);
          const oy = Math.sin(rad);
          return (
            <line
              key={a}
              x1={x + ox * (r - tick)}
              y1={y + oy * (r - tick)}
              x2={x + ox * (r + tick * 0.35)}
              y2={y + oy * (r + tick * 0.35)}
              stroke="#ffd84d"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <circle cx={x} cy={y} r={size * 0.7} fill="none" stroke="#ffd84d" strokeWidth={1.5}>
        <animate attributeName="r" values={`${size * 0.6};${size * 0.82};${size * 0.6}`} dur="1.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.3s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** One-shot impact burst when an enemy attack lands: a shock ring, a red flash,
 *  a slash, and a floating damage number (with a "blocked" note when shield
 *  soaked part of it, or "Miss"/"Blocked" when nothing got through). Mounted
 *  fresh per hit (keyed by the hit nonce) so its SMIL animations replay. */
function AttackImpactFx({
  x,
  y,
  size,
  dealt,
  blocked,
}: {
  x: number;
  y: number;
  size: number;
  dealt: number;
  blocked: number;
}) {
  const label = dealt > 0 ? `−${dealt}` : blocked > 0 ? 'Blocked' : 'Miss';
  const labelColor = dealt > 0 ? '#ff5252' : blocked > 0 ? '#74c2d6' : '#cfcfcf';
  const struck = dealt > 0 || blocked > 0;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {struck && (
        <>
          <circle cx={x} cy={y} r={size * 0.35} fill="none" stroke="#ff5252" strokeWidth={5}>
            <animate attributeName="r" values={`${size * 0.3};${size * 1.5}`} dur="0.4s" fill="freeze" />
            <animate attributeName="opacity" values="0.9;0" dur="0.4s" fill="freeze" />
            <animate attributeName="stroke-width" values="5;0.5" dur="0.4s" fill="freeze" />
          </circle>
          {dealt > 0 && (
            <circle cx={x} cy={y} r={size * 0.7} fill="#ff5252">
              <animate attributeName="opacity" values="0.5;0" dur="0.3s" fill="freeze" />
            </circle>
          )}
          <line
            x1={x - size * 0.7}
            y1={y - size * 0.7}
            x2={x + size * 0.7}
            y2={y + size * 0.7}
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
          >
            <animate attributeName="opacity" values="1;0" dur="0.35s" fill="freeze" />
          </line>
        </>
      )}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`0 0; 0 ${(-size * 1.1).toFixed(1)}`}
          dur="0.9s"
          fill="freeze"
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.2 0.6 0.2 1"
        />
        <text
          x={x}
          y={y - size * 0.85}
          textAnchor="middle"
          fontSize={size * 0.9}
          fontWeight={800}
          fill={labelColor}
          stroke="#000"
          strokeWidth={1}
          paintOrder="stroke"
        >
          {label}
          <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.6;1" dur="0.9s" fill="freeze" />
        </text>
        {dealt > 0 && blocked > 0 && (
          <text
            x={x}
            y={y - size * 0.2}
            textAnchor="middle"
            fontSize={size * 0.42}
            fontWeight={700}
            fill="#74c2d6"
            stroke="#000"
            strokeWidth={0.8}
            paintOrder="stroke"
          >
            {`⛨ ${blocked} blocked`}
            <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.6;1" dur="0.9s" fill="freeze" />
          </text>
        )}
      </g>
    </g>
  );
}
