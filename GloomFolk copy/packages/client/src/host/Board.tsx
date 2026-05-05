import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { Combat, HexMath, type Hex, type Unit } from '@gloomfolk/shared';
import { useStore } from '../store.js';
import { HEX_SIZE, computeBoardPixelBounds } from '../util/board.js';

const ANIM_PX_PER_SEC = 280;

type UnitView = {
  container: Container;
  token: Graphics;
  hpText: Text;
  archText: Text;
  orderBadge: Container;
  orderRing: Graphics;
  orderText: Text;
  targetRing: Graphics;
  archetype: string;
  kind: 'player' | 'enemy';
  queue: Array<{ x: number; y: number }>;
  lastTargetKey: string;
  lastHex: Hex;
};

function drawHex(g: Graphics, cx: number, cy: number, size: number) {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
  }
  g.poly(pts);
}

function computeMovePath(
  state: { width: number; height: number; obstacles: Hex[]; units: Record<string, Unit> },
  mover: Unit,
  from: Hex,
  to: Hex,
): Hex[] {
  if (HexMath.hexEq(from, to)) return [];
  const blocked = Combat.blockedFor(state as Parameters<typeof Combat.blockedFor>[0], mover);
  const budget = state.width * state.height;
  const reach = HexMath.bfsReachable(from, budget, blocked, {
    width: state.width,
    height: state.height,
  });
  const goal = reach.get(HexMath.hexKey(to));
  if (!goal) return [to];
  const full = HexMath.pathTo(reach, HexMath.hexKey(to));
  return full.slice(1);
}

function unitColor(kind: 'player' | 'enemy', archetype: string): number {
  if (kind === 'player') return archetype === 'bruiser' ? 0xd4a259 : 0x6a9c5a;
  return archetype === 'shooter' ? 0xa64c4c : 0xc2553e;
}

function makeUnitView(u: { id: string; kind: 'player' | 'enemy'; archetype: string; pos: Hex }): UnitView {
  const container = new Container();
  const token = new Graphics();
  container.addChild(token);

  const hpText = new Text({
    text: '',
    style: { fontFamily: 'Helvetica', fontSize: 16, fill: 0xffffff, fontWeight: '700' },
  });
  hpText.anchor.set(0.5);
  container.addChild(hpText);

  const archText = new Text({
    text: u.archetype,
    style: { fontFamily: 'Helvetica', fontSize: 10, fill: 0xf4ead5 },
  });
  archText.anchor.set(0.5, 0);
  archText.position.set(0, HEX_SIZE * 0.65);
  container.addChild(archText);

  const targetRing = new Graphics();
  container.addChild(targetRing);

  const orderBadge = new Container();
  orderBadge.position.set(HEX_SIZE * 0.55, -HEX_SIZE * 0.55);
  const orderRing = new Graphics();
  orderBadge.addChild(orderRing);
  const orderText = new Text({
    text: '',
    style: { fontFamily: 'Helvetica', fontSize: 11, fill: 0xf4ead5, fontWeight: '700' },
  });
  orderText.anchor.set(0.5);
  orderBadge.addChild(orderText);
  orderBadge.visible = false;
  container.addChild(orderBadge);

  return {
    container,
    token,
    hpText,
    archText,
    targetRing,
    orderBadge,
    orderRing,
    orderText,
    archetype: u.archetype,
    kind: u.kind,
    queue: [],
    lastTargetKey: '',
    lastHex: { q: u.pos.q, r: u.pos.r },
  };
}

export function Board() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const tilesLayerRef = useRef<Container | null>(null);
  const overlayLayerRef = useRef<Container | null>(null);
  const unitsLayerRef = useRef<Container | null>(null);
  const unitsRef = useRef<Map<string, UnitView>>(new Map());
  const [ready, setReady] = useState(false);

  const state = useStore((s) => s.state);
  const paths = useStore((s) => s.paths);
  const cursors = useStore((s) => s.cursors);
  const pendingMoves = useStore((s) => s.pendingMoves);
  const targetHints = useStore((s) => s.targetHints);

  // Bootstrap Pixi once.
  useEffect(() => {
    let disposed = false;
    let initDone = false;
    const app = new Application();
    appRef.current = app;

    (async () => {
      const el = containerRef.current;
      await app.init({
        background: 0x0e0a07,
        width: el?.clientWidth ?? 800,
        height: el?.clientHeight ?? 600,
        antialias: true,
      });
      initDone = true;
      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }
      app.canvas.style.display = 'block';
      containerRef.current?.appendChild(app.canvas);
      const tiles = new Container();
      const overlay = new Container();
      const units = new Container();
      app.stage.addChild(tiles);
      app.stage.addChild(overlay);
      app.stage.addChild(units);
      tilesLayerRef.current = tiles;
      overlayLayerRef.current = overlay;
      unitsLayerRef.current = units;
      setReady(true);

      // Animation ticker — interpolates each unit's container toward queued waypoints.
      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000;
        const step = ANIM_PX_PER_SEC * dt;
        for (const view of unitsRef.current.values()) {
          if (view.queue.length === 0) continue;
          const target = view.queue[0]!;
          const cx = view.container.x;
          const cy = view.container.y;
          const dx = target.x - cx;
          const dy = target.y - cy;
          const dist = Math.hypot(dx, dy);
          if (dist <= step || dist < 0.5) {
            view.container.position.set(target.x, target.y);
            view.queue.shift();
          } else {
            view.container.position.set(cx + (dx / dist) * step, cy + (dy / dist) * step);
          }
        }
      });
    })();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !appRef.current || !initDone) return;
      const { width, height } = entry.contentRect;
      appRef.current.renderer.resize(width, height);
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      disposed = true;
      observer.disconnect();
      if (initDone) app.destroy(true, { children: true });
      appRef.current = null;
      tilesLayerRef.current = null;
      overlayLayerRef.current = null;
      unitsLayerRef.current = null;
      unitsRef.current.clear();
      setReady(false);
    };
  }, []);

  // Center the board and redraw tiles when the scenario changes.
  useEffect(() => {
    const tiles = tilesLayerRef.current;
    const overlay = overlayLayerRef.current;
    const units = unitsLayerRef.current;
    const app = appRef.current;
    if (!tiles || !overlay || !units || !app || !state) return;
    tiles.removeChildren();

    const bounds = computeBoardPixelBounds(state);
    const offsetX = (app.renderer.width - bounds.width) / 2 - bounds.minX;
    const offsetY = (app.renderer.height - bounds.height) / 2 - bounds.minY;
    tiles.position.set(offsetX, offsetY);
    overlay.position.set(offsetX, offsetY);
    units.position.set(offsetX, offsetY);

    for (let r = 0; r < state.height; r++) {
      for (let q = -Math.floor(r / 2); q < state.width - Math.floor(r / 2); q++) {
        const { x, y } = HexMath.hexToPixel({ q, r }, HEX_SIZE);
        const tile = new Graphics();
        const isObstacle = state.obstacles.some((o) => o.q === q && o.r === r);
        drawHex(tile, x, y, HEX_SIZE - 1.5);
        tile.fill({ color: isObstacle ? 0x3a2618 : 0x1f1812, alpha: 1 });
        tile.stroke({ color: 0x463528, width: 1 });
        tiles.addChild(tile);
      }
    }
  }, [ready, state?.scenarioId, state?.width, state?.height]);

  // Reconcile units with the current state — create/update views, queue animations.
  useEffect(() => {
    const layer = unitsLayerRef.current;
    if (!layer || !state) return;

    const activeUnitId =
      state.phase === 'turn_resolution' ? state.turnOrder[state.activeTurn] : undefined;

    const seen = new Set<string>();

    // Map unit -> player-id with a pending move, if any.
    const overrideForUnit = new Map<string, { hex: Hex; pid: string }>();
    for (const [pid, hex] of Object.entries(pendingMoves)) {
      if (!hex) continue;
      const p = state.players[pid];
      if (p) overrideForUnit.set(p.unitId, { hex, pid });
    }

    const targetedUnitIds = new Set<string>();
    for (const uid of Object.values(targetHints)) {
      if (uid) targetedUnitIds.add(uid);
    }

    for (const u of Object.values(state.units)) {
      if (u.exhausted) {
        const v = unitsRef.current.get(u.id);
        if (v) {
          layer.removeChild(v.container);
          unitsRef.current.delete(u.id);
        }
        continue;
      }
      seen.add(u.id);

      let view = unitsRef.current.get(u.id);
      if (!view) {
        view = makeUnitView(u);
        layer.addChild(view.container);
        unitsRef.current.set(u.id, view);
        const start = HexMath.hexToPixel(u.pos, HEX_SIZE);
        view.container.position.set(start.x, start.y);
        view.lastTargetKey = `${u.pos.q},${u.pos.r}`;
      }

      // Determine animation target: pending-move override or logical pos.
      const override = overrideForUnit.get(u.id);
      const targetHex: Hex = override ? override.hex : u.pos;
      const targetKey = override
        ? `pending:${override.hex.q},${override.hex.r}`
        : `pos:${u.pos.q},${u.pos.r}`;

      if (view.lastTargetKey !== targetKey) {
        view.lastTargetKey = targetKey;
        view.queue = [];
        // For player pending-moves, follow the path hex-by-hex if available.
        if (override) {
          const path = paths[override.pid];
          if (path && path.length > 1) {
            for (let i = 1; i < path.length; i++) {
              const p = HexMath.hexToPixel(path[i]!, HEX_SIZE);
              view.queue.push({ x: p.x, y: p.y });
            }
          } else {
            const p = HexMath.hexToPixel(targetHex, HEX_SIZE);
            view.queue.push({ x: p.x, y: p.y });
          }
          view.lastHex = { q: override.hex.q, r: override.hex.r };
        } else {
          // Non-override (e.g. enemy) — walk hex-by-hex from prior animated
          // position to current pos so movement traces the board, not a line.
          const hexPath = computeMovePath(state, u, view.lastHex, targetHex);
          for (const hex of hexPath) {
            const p = HexMath.hexToPixel(hex, HEX_SIZE);
            view.queue.push({ x: p.x, y: p.y });
          }
          view.lastHex = { q: targetHex.q, r: targetHex.r };
        }
      }

      // Token fill + active-unit border.
      view.token.clear();
      view.token.circle(0, 0, HEX_SIZE * 0.6);
      view.token.fill({ color: unitColor(u.kind, u.archetype) });
      const isActive = u.id === activeUnitId;
      view.token.stroke({
        color: isActive ? 0xffffff : 0x000000,
        width: isActive ? 4 : 2,
      });

      // Targeting ring.
      view.targetRing.clear();
      if (targetedUnitIds.has(u.id)) {
        view.targetRing.circle(0, 0, HEX_SIZE * 0.85);
        view.targetRing.stroke({ color: 0xff5050, width: 3, alpha: 0.85 });
      }

      // HP and label.
      view.hpText.text = `${u.hp}`;
      if (view.archText.text !== u.archetype) view.archText.text = u.archetype;

      // Turn-order badge — show for enemies during turn resolution.
      const orderIdx = state.turnOrder.indexOf(u.id);
      if (u.kind === 'enemy' && orderIdx >= 0 && state.phase === 'turn_resolution') {
        view.orderBadge.visible = true;
        view.orderText.text = `${orderIdx + 1}`;
        view.orderRing.clear();
        view.orderRing.circle(0, 0, 11);
        view.orderRing.fill({ color: 0x2a1c10, alpha: 0.95 });
        view.orderRing.stroke({
          color: isActive ? 0xffffff : 0xa64c4c,
          width: isActive ? 2 : 1.5,
        });
      } else {
        view.orderBadge.visible = false;
      }
    }

    // Drop views for units no longer in state.
    for (const [id, view] of unitsRef.current) {
      if (!seen.has(id)) {
        layer.removeChild(view.container);
        unitsRef.current.delete(id);
      }
    }
  }, [ready, state, pendingMoves, paths, targetHints]);

  // Path overlay (thin connectors + dots) and live cursors.
  useEffect(() => {
    const layer = overlayLayerRef.current;
    if (!layer || !state) return;
    layer.removeChildren();

    for (const [pid, path] of Object.entries(paths)) {
      if (!path || path.length === 0) continue;
      // If this player has a pending move, the unit is animating along the
      // path itself — suppress the overlay so the board reads cleanly.
      if (pendingMoves[pid]) continue;

      // Highlight each hex on the path.
      for (let i = 0; i < path.length; i++) {
        const hex = path[i]!;
        const { x, y } = HexMath.hexToPixel(hex, HEX_SIZE);
        const isStart = i === 0;
        const isEnd = i === path.length - 1;
        const fill = new Graphics();
        drawHex(fill, x, y, HEX_SIZE - 1.5);
        fill.fill({
          color: 0xd4a259,
          alpha: isEnd ? 0.32 : isStart ? 0.12 : 0.2,
        });
        fill.stroke({
          color: 0xd4a259,
          width: isEnd ? 2 : 1.5,
          alpha: isEnd ? 0.95 : 0.6,
        });
        layer.addChild(fill);
      }

      // Connector segments.
      for (let i = 1; i < path.length; i++) {
        const a = HexMath.hexToPixel(path[i - 1]!, HEX_SIZE);
        const b = HexMath.hexToPixel(path[i]!, HEX_SIZE);
        const seg = new Graphics();
        seg.moveTo(a.x, a.y);
        seg.lineTo(b.x, b.y);
        seg.stroke({ color: 0xd4a259, width: 2, alpha: 0.85 });
        layer.addChild(seg);
      }
      // Dot at each hex center, with step number.
      for (let i = 0; i < path.length; i++) {
        const hex = path[i]!;
        const { x, y } = HexMath.hexToPixel(hex, HEX_SIZE);
        const isStart = i === 0;
        const isEnd = i === path.length - 1;
        const dot = new Graphics();
        dot.circle(x, y, isEnd ? 6 : 4);
        dot.fill({ color: 0xd4a259, alpha: isStart ? 0.5 : 0.95 });
        if (isEnd) dot.stroke({ color: 0xf4ead5, width: 2 });
        layer.addChild(dot);
        if (i > 0) {
          const lbl = new Text({
            text: `${i}`,
            style: {
              fontFamily: 'Helvetica',
              fontSize: 11,
              fill: 0xf4ead5,
              fontWeight: '700',
            },
          });
          lbl.anchor.set(0.5);
          lbl.position.set(x, y - HEX_SIZE * 0.45);
          layer.addChild(lbl);
        }
      }
    }

    for (const [, px] of Object.entries(cursors)) {
      if (!px) continue;
      const dot = new Graphics();
      dot.circle(px.x, px.y, 10);
      dot.fill({ color: 0xfff4d6, alpha: 0.95 });
      dot.stroke({ color: 0x2a1c10, width: 2 });
      const halo = new Graphics();
      halo.circle(px.x, px.y, 18);
      halo.stroke({ color: 0xd4a259, width: 2, alpha: 0.7 });
      layer.addChild(halo);
      layer.addChild(dot);
    }

  }, [ready, paths, cursors, state, pendingMoves]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
