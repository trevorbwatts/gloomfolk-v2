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

const BOARD_PAD = 8;

interface Bounds {
  minX: number; minY: number; maxX: number; maxY: number;
  /** viewBox width/height (board extent + padding on both sides). */
  vbW: number; vbH: number;
  /** viewBox origin — top-left corner, i.e. minX/minY minus the padding. */
  originX: number; originY: number;
}

/** Pixel bounding box of the whole board (in axial→px space), padded. Shared by
 *  the render (viewBox) and the zoom/pan effects so they agree on coordinates. */
function computeBounds(tiles: Tile[], size: number): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tiles) {
    const { x, y } = axialToPx(t.q, t.r, size);
    if (x - size < minX) minX = x - size;
    if (y - size < minY) minY = y - size;
    if (x + size > maxX) maxX = x + size;
    if (y + size > maxY) maxY = y + size;
  }
  return {
    minX, minY, maxX, maxY,
    vbW: maxX - minX + BOARD_PAD * 2,
    vbH: maxY - minY + BOARD_PAD * 2,
    originX: minX - BOARD_PAD,
    originY: minY - BOARD_PAD,
  };
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.25;

const TILE_FILL: Record<Tile['kind'], string> = {
  floor: '#2a2a2e',
  wall: '#0a0a0c',
  difficult: '#3a2a1a',
  hazard: '#5a1a1a',
  trap: '#4a3410',
  door: '#3a3a2a',
  corridor: '#2f2f38',
  'pressure-plate': '#33303a',
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
  /** When set, the board renders at a fixed hex size inside a scrollable
   *  viewport with on-screen zoom (+/−) controls, and auto-centers on the
   *  player figures when a scenario loads — instead of shrinking to fit. */
  zoomable?: boolean;
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
  /** Multiple staged units (e.g. a Target N attack's chosen enemies). Each is
      drawn with the same selection ring as `selectedUnitId`, plus a small
      order badge; ids also present in `itemBoundUnitIds` get an item dot. */
  stagedUnitIds?: string[];
  /** Staged units that have an item attached to them (Target N item binding).
      Drawn with a small filled dot so the player sees which got an item. */
  itemBoundUnitIds?: string[];
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
  zoomable = false,
  activeUnitIds = [],
  reachableKeys,
  pathHexes,
  targetableUnitIds = [],
  selectedUnitId = null,
  stagedUnitIds = [],
  itemBoundUnitIds = [],
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
  // --- Zoom / pan (zoomable mode only) --------------------------------------
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Figma-style canvas transform (zoomable/display boards): `x`/`y` translate
  // the content in viewport pixels, `scale` zooms. Panning is free — you can
  // drag the board into empty space past its edges.
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const zoom = view.scale;
  // Signature of the board we last auto-centered on, so we re-center when a new
  // scenario loads (different tile extent) but not on every unit move.
  const centeredSigRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const lastEnteredKeyRef = useRef<string | null>(null);
  // Click-drag panning for a non-interactive (display-only) board — e.g. the
  // host screen, which has no hex tap/enter handlers to conflict with. Players
  // interact with hexes instead and pan via native touch scrolling.
  const isDisplayBoard = !onTapHex && !onTapUnit && !onHexEnter;
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const onPanDown = (e: React.PointerEvent) => {
    if (!isDisplayBoard) return;
    const sc = scrollerRef.current;
    if (!sc) return;
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
    try { sc.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPanMove = (e: React.PointerEvent) => {
    const start = panRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    setView((v) => ({ ...v, x: start.vx + dx, y: start.vy + dy }));
  };
  const onPanEnd = (e: React.PointerEvent) => {
    if (!panRef.current) return;
    panRef.current = null;
    setPanning(false);
    try { scrollerRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  // Zoom by `factor` about a viewport-relative pixel point, keeping whatever is
  // under that point fixed (cursor for wheel, center for the +/− buttons).
  const zoomAt = (factor: number, px: number, py: number) => {
    setView((v) => {
      const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale * factor));
      if (ns === v.scale) return v;
      const k = ns / v.scale;
      return { scale: ns, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };
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

  // Auto-center the viewport on the player figures the first time a scenario's
  // board appears (and again whenever its extent changes). Runs after layout so
  // the scroller has real dimensions.
  useEffect(() => {
    if (!zoomable) return;
    const scroller = scrollerRef.current;
    if (!scroller || tiles.length === 0) return;
    const b = computeBounds(tiles, size);
    const sig = `${tiles.length}:${b.minX.toFixed(0)}:${b.minY.toFixed(0)}:${b.maxX.toFixed(0)}:${b.maxY.toFixed(0)}`;
    if (centeredSigRef.current === sig) return;
    centeredSigRef.current = sig;

    const players = units.filter((u) => u.kind === 'player');
    let cx: number, cy: number;
    if (players.length > 0) {
      let sx = 0, sy = 0;
      for (const u of players) {
        const p = axialToPx(u.hex.q, u.hex.r, size);
        sx += p.x; sy += p.y;
      }
      cx = sx / players.length; cy = sy / players.length;
    } else {
      cx = (b.minX + b.maxX) / 2; cy = (b.minY + b.maxY) / 2;
    }
    // Center the content point (cx,cy) in the viewport at the current scale.
    setView((v) => ({
      scale: v.scale,
      x: scroller.clientWidth / 2 - (cx - b.originX) * v.scale,
      y: scroller.clientHeight / 2 - (cy - b.originY) * v.scale,
    }));
  }, [zoomable, tiles, units, size]);

  // Zoom buttons: zoom about the viewport center.
  const applyZoom = (factor: number) => {
    const sc = scrollerRef.current;
    zoomAt(factor, (sc?.clientWidth ?? 0) / 2, (sc?.clientHeight ?? 0) / 2);
  };

  // Wheel: pinch / ctrl+wheel zooms toward the cursor; a plain wheel pans
  // (Figma-style). Attached natively so we can preventDefault the page scroll.
  useEffect(() => {
    if (!zoomable || !isDisplayBoard) return;
    const sc = scrollerRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = sc.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), px, py);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, [zoomable, isDisplayBoard]);

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

  const { vbW, vbH, originX, originY } = computeBounds(tiles, size);

  // In zoomable mode the SVG renders at a fixed hex size (its viewBox extent ×
  // the zoom factor) and the surrounding viewport scrolls; otherwise it scales
  // to fill its column.
  const svgStyle: React.CSSProperties = zoomable
    ? {
        // Intrinsic size; the surrounding wrapper applies the pan/zoom transform.
        width: vbW,
        height: vbH,
        display: 'block',
        touchAction: 'none',
        userSelect: 'none',
      }
    : {
        width: '100%',
        // A non-finite cap (e.g. Infinity) means "fill the container" — leave
        // maxWidth unset so the board can span its whole column.
        ...(Number.isFinite(maxWidthPx) ? { maxWidth: maxWidthPx } : {}),
        background: '#0e0e10',
        borderRadius: 8,
        touchAction: onHexEnter ? 'none' : 'manipulation',
        userSelect: 'none',
      };

  const board = (
    <svg
      ref={svgRef}
      viewBox={`${originX} ${originY} ${vbW} ${vbH}`}
      style={svgStyle}
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
      {tiles.some((t) => t.kind === 'trap') && (
        <g style={{ pointerEvents: 'none' }}>
          {tiles
            .filter((t) => t.kind === 'trap')
            .map((t) => {
              const { x, y } = axialToPx(t.q, t.r, size);
              const r = size * 0.42;
              // Warning triangle: a trap to be sprung or destroyed.
              const pts = [
                `${x},${y - r}`,
                `${x - r * 0.92},${y + r * 0.7}`,
                `${x + r * 0.92},${y + r * 0.7}`,
              ].join(' ');
              return (
                <g key={`trap-${t.q},${t.r}`}>
                  <polygon
                    points={pts}
                    fill="#caa052"
                    stroke="#6b4a12"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  <text
                    x={x}
                    y={y + r * 0.42}
                    textAnchor="middle"
                    fontSize={size * 0.5}
                    fontWeight={800}
                    fill="#2a1d05"
                  >
                    !
                  </text>
                </g>
              );
            })}
        </g>
      )}
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
          const stagedOrder = stagedUnitIds.indexOf(u.id);
          const isStaged = stagedOrder >= 0;
          const isTargetable = targetableUnitIds.includes(u.id);
          const isSelected = selectedUnitId === u.id || isStaged;
          const isItemBound = itemBoundUnitIds.includes(u.id);
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
              <HpRing x={x} y={y} size={size} hp={u.hp} hpMax={u.hpMax} color={isPlayer ? '#3fbf57' : '#e23b3b'} />
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
                // Each condition is shown as a circular badge that echoes the
                // standee-number motif (dark fill, white outline) so it reads
                // clearly on top of the monster art.
                const badgeSize = Math.max(14, size * 0.42);
                const iconSize = badgeSize * 0.66;
                const gap = badgeSize * 0.18;
                const totalW = items.length * badgeSize + (items.length - 1) * gap;
                const rowY = y - size * 0.85 - badgeSize * 0.35;
                return (
                  <foreignObject
                    x={x - totalW / 2}
                    y={rowY}
                    width={totalW}
                    height={badgeSize}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap,
                        alignItems: 'center',
                        lineHeight: 0,
                      }}
                    >
                      {items.map((k, i) => (
                        <div
                          key={i}
                          style={{
                            width: badgeSize,
                            height: badgeSize,
                            borderRadius: '50%',
                            background: '#1b1b1b',
                            border: '1px solid #fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto',
                          }}
                        >
                          <GameIcon kind={k} size={iconSize} color="#ffd84d" />
                        </div>
                      ))}
                    </div>
                  </foreignObject>
                );
              })()}
              {isStaged && (
                <>
                  <circle
                    cx={x - size * 0.52}
                    cy={y - size * 0.52}
                    r={size * 0.34}
                    fill="#d9a441"
                    stroke="#0e1612"
                    strokeWidth={1}
                  />
                  <text
                    x={x - size * 0.52}
                    y={y - size * 0.52}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={size * 0.4}
                    fontWeight={700}
                    fill="#0e1612"
                  >
                    {stagedOrder + 1}
                  </text>
                  {isItemBound && (
                    <circle
                      cx={x - size * 0.52 + size * 0.28}
                      cy={y - size * 0.52 + size * 0.28}
                      r={size * 0.16}
                      fill="#7bb96b"
                      stroke="#0e1612"
                      strokeWidth={1}
                    />
                  )}
                </>
              )}
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

  if (!zoomable) return board;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={scrollerRef}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerCancel={onPanEnd}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#0e0e10',
          borderRadius: 8,
          touchAction: 'none',
          ...(isDisplayBoard ? { cursor: panning ? 'grabbing' : 'grab' } : {}),
        }}
      >
        <div
          style={{
            width: vbW,
            height: vbH,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {board}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <ZoomButton label="+" title="Zoom in" onClick={() => applyZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} />
        <ZoomButton label="−" title="Zoom out" onClick={() => applyZoom(1 / ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} />
      </div>
    </div>
  );
}

/** Square +/− control for the zoomable board viewport. */
function ZoomButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: '1px solid #555',
        background: 'rgba(20,20,24,0.9)',
        color: '#fff',
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      {label}
    </button>
  );
}

/** A clock-style HP gauge ringing a unit's token. A faint full circle marks the
 *  "spent" track; a bright red arc on top shows the HP still remaining, drawn
 *  from 12 o'clock and sweeping clockwise. As the unit takes damage the arc's
 *  trailing end recedes back toward 12 — it ticks down around the figure like a
 *  clock hand. The arc length is CSS-transitioned so each hit animates smoothly. */
function HpRing({ x, y, size, hp, hpMax, color = '#e23b3b' }: { x: number; y: number; size: number; hp: number; hpMax: number; color?: string }) {
  if (hpMax <= 0) return null;
  const r = size * 0.72;
  const C = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, hp / hpMax));
  const arc = frac * C;
  return (
    <g style={{ pointerEvents: 'none' }} transform={`rotate(-90 ${x} ${y})`}>
      {/* Spent track (full circle behind the arc). */}
      <circle cx={x} cy={y} r={r} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={size * 0.07} />
      {/* Remaining HP arc. */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.07}
        strokeLinecap={frac > 0 && frac < 1 ? 'round' : 'butt'}
        strokeDasharray={`${arc.toFixed(2)} ${(C - arc).toFixed(2)}`}
        style={{ transition: 'stroke-dasharray 0.45s ease' }}
      />
    </g>
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
