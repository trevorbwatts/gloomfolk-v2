import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TILE_SHAPES, TILE_SIDES, type Hex, hexKey } from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';
import { SceneCanvas } from './SceneCanvas.js';
import { HEX_DIRECTIONS } from './sceneGeometry.js';
import {
  type Decoration,
  type MonsterRankAtCount,
  type MonsterSpawn,
  type Overlay,
  type OverlayKind,
  type PlacedTile,
  type ScenarioData,
  type SpawnBehavior,
  newDecorationId,
  newMonsterSpawnId,
  newOverlayId,
  newPlacedTileId,
} from './scenarios.js';
import { DECORATION_CATALOG, decorationDef } from './decorationCatalog.js';
import {
  OVERLAY_KINDS,
  OVERLAY_STYLES,
  TOKEN_LETTER_KINDS,
  TOKEN_NUMBER_KINDS,
} from './overlayStyle.js';
import { MONSTER_CATALOG, monsterEntry } from './monsterCatalog.js';
import { monsterAvatarUrl, onAvatarError } from '../avatars.js';

interface Props {
  data: ScenarioData;
  onChange: (next: ScenarioData) => void;
  victoryDraft: string;
  onVictoryDraftChange: (next: string) => void;
}

const sectionLabel: React.CSSProperties = {
  color: theme.muted,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  fontFamily: theme.headingFont,
};

const panelStyle: React.CSSProperties = {
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  padding: 12,
};

/** Which toolbar dropdown is currently open (only one at a time). */
type MenuId = null | 'tile' | 'letters' | 'numbers' | 'monster' | 'decoration';

const menuHeadingStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '8px 6px 2px',
  fontFamily: theme.headingFont,
};

const menuItemStyle = (active = false): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  background: active ? theme.panel : 'transparent',
  color: active ? theme.accent : theme.text,
  border: 'none',
  borderRadius: 3,
  fontSize: 13,
  fontFamily: theme.font,
  cursor: 'pointer',
});

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  padding: '8px 16px',
  borderBottom: `1px solid ${theme.border}`,
  background: theme.panel,
  flexShrink: 0,
};

const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 4,
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: theme.border,
  margin: '0 2px',
};

const sideOptions = TILE_SIDES.slice().sort((a, b) => a.id.localeCompare(b.id));

export function ScenarioEditor({ data, onChange, victoryDraft, onVictoryDraftChange }: Props) {
  const placed = data.placedTiles ?? [];
  const overlays = data.overlays ?? [];
  const decorations = data.decorations ?? [];
  const monsterSpawns = data.monsterSpawns ?? [];
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [selectedHexKeys, setSelectedHexKeys] = useState<Set<string>>(new Set());
  const [monsterQuery, setMonsterQuery] = useState('');
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const closeMenu = () => setOpenMenu(null);
  const toggleMenu = (id: MenuId) => setOpenMenu((prev) => (prev === id ? null : id));

  const selectedTile: PlacedTile | undefined = useMemo(
    () => placed.find((p) => p.id === selectedTileId),
    [placed, selectedTileId],
  );

  const selectedDecoration: Decoration | undefined = useMemo(
    () => decorations.find((d) => d.id === selectedDecorationId),
    [decorations, selectedDecorationId],
  );

  /** Overlays whose hex set exactly matches the current selection. With
      multiple overlays allowed per hex, there can be several (one per kind). */
  const matchedOverlays: Overlay[] = useMemo(() => {
    if (selectedHexKeys.size === 0) return [];
    return overlays.filter((o) => {
      if (o.hexes.length !== selectedHexKeys.size) return false;
      return o.hexes.every((h) => selectedHexKeys.has(hexKey(h)));
    });
  }, [overlays, selectedHexKeys]);

  /** The single hex eligible for monster placement (one-hex selection, no
      existing monster on it). */
  const monsterTargetHex: Hex | null = useMemo(() => {
    if (selectedHexKeys.size !== 1) return null;
    const [k] = Array.from(selectedHexKeys);
    if (!k) return null;
    const [q, r] = k.split(',').map(Number) as [number, number];
    return { q, r };
  }, [selectedHexKeys]);

  const monsterTargetOccupied = useMemo(() => {
    if (!monsterTargetHex) return false;
    const k = hexKey(monsterTargetHex);
    return monsterSpawns.some((m) => hexKey(m.hex) === k);
  }, [monsterTargetHex, monsterSpawns]);

  const filteredMonsters = useMemo(() => {
    const q = monsterQuery.trim().toLowerCase();
    if (!q) return MONSTER_CATALOG;
    return MONSTER_CATALOG.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.short.toLowerCase().includes(q),
    );
  }, [monsterQuery]);

  function updateTiles(next: PlacedTile[]) {
    onChange({ ...data, placedTiles: next });
  }
  function updateOverlays(next: Overlay[]) {
    onChange({ ...data, overlays: next });
  }
  function updateDecorations(next: Decoration[]) {
    onChange({ ...data, decorations: next });
  }
  function updateMonsters(next: MonsterSpawn[]) {
    onChange({ ...data, monsterSpawns: next });
  }

  function handleAddTile(tileSideId: string) {
    if (!tileSideId) return;
    const newTile: PlacedTile = {
      id: newPlacedTileId(),
      tileSideId,
      origin: { q: 0, r: 0 },
      rotation: 0,
    };
    updateTiles([...placed, newTile]);
    setSelectedTileId(newTile.id);
    closeMenu();
  }
  function patchSelectedTile(patch: Partial<PlacedTile>) {
    if (!selectedTile) return;
    updateTiles(placed.map((p) => (p.id === selectedTile.id ? { ...p, ...patch } : p)));
  }
  function moveTile(deltaQ: number, deltaR: number) {
    if (!selectedTile) return;
    patchSelectedTile({
      origin: { q: selectedTile.origin.q + deltaQ, r: selectedTile.origin.r + deltaR },
    });
  }
  function rotateTile(step: 1 | -1) {
    if (!selectedTile) return;
    patchSelectedTile({ rotation: ((selectedTile.rotation + step) % 6 + 6) % 6 });
  }
  function removeTileById(id: string) {
    updateTiles(placed.filter((p) => p.id !== id));
    if (selectedTileId === id) setSelectedTileId(null);
  }
  function removeTile() {
    if (!selectedTile) return;
    removeTileById(selectedTile.id);
  }

  function handleAddDecoration(decorationId: string) {
    if (!decorationDef(decorationId)) return;
    // Drop it on the currently selected hex (the first, if several are
    // selected); fall back to the map origin when nothing is selected.
    const [firstKey] = Array.from(selectedHexKeys);
    const origin = firstKey
      ? (() => {
          const [q, r] = firstKey.split(',').map(Number) as [number, number];
          return { q, r };
        })()
      : { q: 0, r: 0 };
    const newDeco: Decoration = {
      id: newDecorationId(),
      decorationId,
      origin,
      rotation: 0,
    };
    updateDecorations([...decorations, newDeco]);
    setSelectedDecorationId(newDeco.id);
    closeMenu();
  }
  function patchSelectedDecoration(patch: Partial<Decoration>) {
    if (!selectedDecoration) return;
    updateDecorations(
      decorations.map((d) =>
        d.id === selectedDecoration.id ? { ...d, ...patch } : d,
      ),
    );
  }
  function moveDecoration(deltaQ: number, deltaR: number) {
    if (!selectedDecoration) return;
    patchSelectedDecoration({
      origin: {
        q: selectedDecoration.origin.q + deltaQ,
        r: selectedDecoration.origin.r + deltaR,
      },
    });
  }
  function rotateDecoration(step: 1 | -1) {
    if (!selectedDecoration) return;
    patchSelectedDecoration({
      rotation: ((selectedDecoration.rotation + step) % 6 + 6) % 6,
    });
  }
  function removeDecorationById(id: string) {
    updateDecorations(decorations.filter((d) => d.id !== id));
    if (selectedDecorationId === id) setSelectedDecorationId(null);
  }
  function removeDecoration() {
    if (!selectedDecoration) return;
    removeDecorationById(selectedDecoration.id);
  }

  function handleHexClick(h: Hex, shift: boolean) {
    const k = hexKey(h);
    // Clicking a hex moves focus to the hex/overlay tools, so drop any tile or
    // scenery selection (and its inspector panel) — lets the user click off a
    // just-placed object.
    setSelectedTileId(null);
    setSelectedDecorationId(null);
    const overlay = overlays.find((o) => o.hexes.some((oh) => hexKey(oh) === k));
    if (shift) {
      const next = new Set(selectedHexKeys);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      setSelectedHexKeys(next);
    } else if (overlay) {
      setSelectedHexKeys(new Set(overlay.hexes.map(hexKey)));
    } else {
      setSelectedHexKeys(new Set([k]));
    }
  }

  function handleEmptyClick() {
    setSelectedHexKeys(new Set());
    setSelectedTileId(null);
    setSelectedDecorationId(null);
  }

  /** Toggle an overlay of `kind` covering the current selection.
      If an overlay of this kind already exists on the exact selection, remove
      it. Otherwise create a new overlay covering the selection. */
  function toggleOverlayKind(kind: OverlayKind) {
    if (selectedHexKeys.size === 0) return;
    const existing = matchedOverlays.find((o) => o.kind === kind);
    if (existing) {
      updateOverlays(overlays.filter((o) => o.id !== existing.id));
    } else {
      const hexes: Hex[] = [];
      for (const key of selectedHexKeys) {
        const [q, r] = key.split(',').map(Number) as [number, number];
        hexes.push({ q, r });
      }
      updateOverlays([...overlays, { id: newOverlayId(), kind, hexes }]);
    }
  }

  /** Kinds of single-hex tokens present on any currently selected hex — used to
      highlight the token buttons. */
  const tokenKindsOnSelection = useMemo(() => {
    const set = new Set<OverlayKind>();
    for (const o of overlays) {
      if (o.hexes.length !== 1) continue;
      const first = o.hexes[0];
      if (first && selectedHexKeys.has(hexKey(first))) set.add(o.kind);
    }
    return set;
  }, [overlays, selectedHexKeys]);

  /** Map tokens are always single-hex and may be stamped many times across the
      map (e.g. several "A" plates). Clicking a token button toggles that token
      on every selected hex: if all selected hexes already carry it, remove them;
      otherwise add it to the hexes that still lack it. */
  function toggleTokenKind(kind: OverlayKind) {
    const keys = Array.from(selectedHexKeys);
    if (keys.length === 0) return;
    const hasToken = (k: string) =>
      overlays.some(
        (o) =>
          o.kind === kind &&
          o.hexes.length === 1 &&
          o.hexes[0] !== undefined &&
          hexKey(o.hexes[0]) === k,
      );
    const withToken = keys.filter(hasToken);
    if (withToken.length === keys.length) {
      const remove = new Set(withToken);
      updateOverlays(
        overlays.filter(
          (o) =>
            !(
              o.kind === kind &&
              o.hexes.length === 1 &&
              o.hexes[0] !== undefined &&
              remove.has(hexKey(o.hexes[0]))
            ),
        ),
      );
    } else {
      const additions: Overlay[] = keys
        .filter((k) => !hasToken(k))
        .map((k, i) => {
          const [q, r] = k.split(',').map(Number) as [number, number];
          return { id: `${newOverlayId()}-${i}`, kind, hexes: [{ q, r }] };
        });
      updateOverlays([...overlays, ...additions]);
    }
  }

  function addMonsterAtSelection(monsterType: string) {
    if (!monsterTargetHex || monsterTargetOccupied) return;
    const newMon: MonsterSpawn = {
      id: newMonsterSpawnId(),
      hex: monsterTargetHex,
      monsterType,
      ranks: { 2: 'normal', 3: 'normal', 4: 'normal' },
    };
    updateMonsters([...monsterSpawns, newMon]);
    closeMenu();
  }

  function updateMonsterRanks(id: string, ranks: MonsterSpawn['ranks']) {
    updateMonsters(monsterSpawns.map((m) => (m.id === id ? { ...m, ranks } : m)));
  }

  function updateMonsterBehavior(id: string, behavior: SpawnBehavior) {
    updateMonsters(
      monsterSpawns.map((m) => {
        if (m.id !== id) return m;
        const next: MonsterSpawn = { ...m };
        if (behavior === 'normal') delete next.behavior;
        else next.behavior = behavior;
        return next;
      }),
    );
  }

  /** Monsters on hexes currently selected — used by the inspector panel. */
  const selectedMonsters: MonsterSpawn[] = useMemo(
    () => monsterSpawns.filter((m) => selectedHexKeys.has(hexKey(m.hex))),
    [monsterSpawns, selectedHexKeys],
  );

  const noSelection = selectedHexKeys.size === 0;
  const monsterDisabled = !monsterTargetHex || monsterTargetOccupied;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Toolbar (Google-Docs style, grouped left→right) ─────────────── */}
      <div style={toolbarStyle}>
        {/* Overlays group */}
        <div style={groupStyle}>
          {OVERLAY_KINDS.map((kind) => {
            const s = OVERLAY_STYLES[kind];
            const isCurrent = matchedOverlays.some((o) => o.kind === kind);
            return (
              <button
                key={kind}
                onClick={() => toggleOverlayKind(kind)}
                disabled={noSelection}
                title={noSelection ? `${s.label} — select a hex first` : s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px',
                  background: isCurrent ? s.color : 'transparent',
                  color: isCurrent ? '#fff' : theme.text,
                  border: `1px solid ${isCurrent ? s.color : theme.border}`,
                  borderRadius: 3,
                  fontSize: 11,
                  fontFamily: theme.headingFont,
                  letterSpacing: 0.5,
                  cursor: noSelection ? 'not-allowed' : 'pointer',
                  opacity: noSelection ? 0.4 : 1,
                }}
              >
                {s.iconPaths ? (
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {s.iconPaths.map((d, idx) => (
                      <path key={idx} d={d} />
                    ))}
                  </svg>
                ) : (
                  <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                )}
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={dividerStyle} />

        {/* Tokens group */}
        <div style={groupStyle}>
          <ToolbarMenu
            label="Letters"
            open={openMenu === 'letters'}
            disabled={noSelection}
            onToggle={() => toggleMenu('letters')}
            onClose={closeMenu}
          >
            <TokenList
              kinds={TOKEN_LETTER_KINDS}
              active={tokenKindsOnSelection}
              onPick={toggleTokenKind}
            />
          </ToolbarMenu>
          <ToolbarMenu
            label="Numbers"
            open={openMenu === 'numbers'}
            disabled={noSelection}
            onToggle={() => toggleMenu('numbers')}
            onClose={closeMenu}
          >
            <TokenList
              kinds={TOKEN_NUMBER_KINDS}
              active={tokenKindsOnSelection}
              onPick={toggleTokenKind}
            />
          </ToolbarMenu>
        </div>

        <div style={dividerStyle} />

        {/* Monster group */}
        <ToolbarMenu
          label="+ Monster"
          open={openMenu === 'monster'}
          onToggle={() => toggleMenu('monster')}
          onClose={closeMenu}
          align="right"
          width={280}
        >
          <input
            value={monsterQuery}
            onChange={(e) => setMonsterQuery(e.target.value)}
            placeholder="Search monsters…"
            autoFocus
            style={{
              width: '100%',
              fontSize: 13,
              padding: '6px 8px',
              background: theme.bgSolid,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              fontFamily: theme.font,
              boxSizing: 'border-box',
              marginBottom: 6,
            }}
          />
          {!monsterTargetHex ? (
            <p style={{ color: theme.muted, fontSize: 11, margin: '4px 0' }}>
              Select a single hex to add a monster.
            </p>
          ) : monsterTargetOccupied ? (
            <p style={{ color: theme.muted, fontSize: 11, margin: '4px 0' }}>
              This hex already has a monster.
            </p>
          ) : null}
          <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
            {filteredMonsters.length === 0 ? (
              <p style={{ color: theme.muted, fontSize: 12, margin: '6px 0 0' }}>
                No matches.
              </p>
            ) : (
              filteredMonsters.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addMonsterAtSelection(m.id)}
                  disabled={monsterDisabled}
                  title={monsterDisabled ? 'Select an empty hex first' : `Add ${m.name}`}
                  style={{
                    ...menuItemStyle(),
                    cursor: monsterDisabled ? 'not-allowed' : 'pointer',
                    opacity: monsterDisabled ? 0.45 : 1,
                  }}
                >
                  <img
                    src={monsterAvatarUrl(m.id)}
                    alt={m.name}
                    onError={onAvatarError}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      objectFit: 'cover',
                      background: '#1a1a1c',
                      border: '1.5px solid #c44',
                      flexShrink: 0,
                    }}
                  />
                  {m.name}
                </button>
              ))
            )}
          </div>
        </ToolbarMenu>

        <div style={dividerStyle} />

        {/* Decoration (scenery) group */}
        <ToolbarMenu
          label="+ Scenery"
          open={openMenu === 'decoration'}
          onToggle={() => toggleMenu('decoration')}
          onClose={closeMenu}
          align="right"
          width={220}
        >
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {DECORATION_CATALOG.map((d) => (
              <button
                key={d.id}
                onClick={() => handleAddDecoration(d.id)}
                title={`Add ${d.name}`}
                style={menuItemStyle()}
              >
                <img
                  src={d.image}
                  alt={d.name}
                  style={{
                    width: 28,
                    height: 18,
                    objectFit: 'contain',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, textAlign: 'left' }}>{d.name}</span>
                <span style={{ color: theme.muted, fontSize: 10 }}>{d.footprint}</span>
              </button>
            ))}
          </div>
        </ToolbarMenu>
      </div>

      {/* ── Canvas (center) + Properties (right) ────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
        }}
      >
        {/* Canvas */}
        <div style={{ padding: '16px 20px', overflow: 'auto' }}>
          <SceneCanvas
            placedTiles={placed}
            overlays={overlays}
            decorations={decorations}
            monsterSpawns={monsterSpawns}
            selectedTileId={selectedTileId}
            selectedDecorationId={selectedDecorationId}
            selectedHexKeys={selectedHexKeys}
            onHexClick={handleHexClick}
            onHexContextMenu={() => {}}
            onEmptyClick={handleEmptyClick}
          />
          <p style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
            Click a hex to select; shift-click to add/remove. Apply overlays,
            tokens, and monsters from the toolbar above. Multiple overlays can
            stack on the same hex.
          </p>
        </div>

        {/* Properties panel */}
        <aside
          style={{
            borderLeft: `1px solid ${theme.border}`,
            padding: 12,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {selectedMonsters.length > 0 && (
            <div style={panelStyle}>
              <div style={sectionLabel}>
                Monsters in selection ({selectedMonsters.length})
              </div>
              {selectedMonsters.map((m) => (
                <MonsterRow
                  key={m.id}
                  monster={m}
                  onRanksChange={(ranks) => updateMonsterRanks(m.id, ranks)}
                  onBehaviorChange={(b) => updateMonsterBehavior(m.id, b)}
                  onRemove={() =>
                    updateMonsters(monsterSpawns.filter((x) => x.id !== m.id))
                  }
                />
              ))}
            </div>
          )}

          <div style={panelStyle}>
            <div style={sectionLabel}>Placed tiles ({placed.length})</div>
            {placed.length === 0 ? (
              <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>
                None yet. Add one with “+ Add tile”.
              </p>
            ) : (
              placed.map((p) => (
                <div
                  key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
                >
                  <button
                    onClick={() => setSelectedTileId(p.id)}
                    style={{
                      flex: 1,
                      display: 'block',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: p.id === selectedTileId ? theme.panelRaised : 'transparent',
                      color: p.id === selectedTileId ? theme.accent : theme.text,
                      border: 'none',
                      borderRadius: 3,
                      fontFamily: theme.font,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {p.tileSideId}
                    <span style={{ color: theme.muted, fontSize: 11, marginLeft: 8 }}>
                      ({p.origin.q},{p.origin.r}) · rot {p.rotation}
                    </span>
                  </button>
                  <button
                    onClick={() => removeTileById(p.id)}
                    title="Remove tile"
                    aria-label={`Remove tile ${p.tileSideId}`}
                    style={{ ...btn.ghost(), fontSize: 14, padding: '4px 8px', flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
            <div style={{ marginTop: 8 }}>
              <ToolbarMenu
                label="+ Add tile"
                open={openMenu === 'tile'}
                onToggle={() => toggleMenu('tile')}
                onClose={closeMenu}
                align="left"
                fullWidth
              >
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {TILE_SHAPES.map((shape) => {
                    const sides = sideOptions.filter((s) => s.shapeId === shape.id);
                    if (sides.length === 0) return null;
                    return (
                      <div key={shape.id}>
                        <div style={menuHeadingStyle}>
                          {shape.id} · {shape.name}
                        </div>
                        {sides.map((side) => (
                          <button
                            key={side.id}
                            style={menuItemStyle()}
                            onClick={() => handleAddTile(side.id)}
                          >
                            {side.id}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </ToolbarMenu>
            </div>
          </div>

          {decorations.length > 0 && (
            <div style={panelStyle}>
              <div style={sectionLabel}>Scenery ({decorations.length})</div>
              {decorations.map((d) => {
                const def = decorationDef(d.decorationId);
                return (
                  <div
                    key={d.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
                  >
                    <button
                      onClick={() => setSelectedDecorationId(d.id)}
                      style={{
                        flex: 1,
                        display: 'block',
                        textAlign: 'left',
                        padding: '6px 10px',
                        background:
                          d.id === selectedDecorationId ? theme.panelRaised : 'transparent',
                        color: d.id === selectedDecorationId ? theme.accent : theme.text,
                        border: 'none',
                        borderRadius: 3,
                        fontFamily: theme.font,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {def?.name ?? d.decorationId}
                      <span style={{ color: theme.muted, fontSize: 11, marginLeft: 8 }}>
                        ({d.origin.q},{d.origin.r}) · rot {d.rotation}
                      </span>
                    </button>
                    <button
                      onClick={() => removeDecorationById(d.id)}
                      title="Remove scenery"
                      aria-label={`Remove ${def?.name ?? d.decorationId}`}
                      style={{ ...btn.ghost(), fontSize: 14, padding: '4px 8px', flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedTile && (
            <div style={panelStyle}>
              <div style={sectionLabel}>Selected tile: {selectedTile.tileSideId}</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
                <MoveControls onMove={moveTile} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button style={btn.ghost()} onClick={() => rotateTile(-1)}>
                    ⟲ Rotate
                  </button>
                  <button style={btn.ghost()} onClick={() => rotateTile(1)}>
                    Rotate ⟳
                  </button>
                </div>
              </div>
              <div style={{ color: theme.muted, fontSize: 11, marginTop: 8 }}>
                Origin: ({selectedTile.origin.q}, {selectedTile.origin.r}) · Rotation:{' '}
                {selectedTile.rotation} (× 60°)
              </div>
              <div style={{ marginTop: 10 }}>
                <button style={{ ...btn.ghost(), fontSize: 12 }} onClick={removeTile}>
                  Remove tile
                </button>
              </div>
            </div>
          )}

          {selectedDecoration && (
            <div style={panelStyle}>
              <div style={sectionLabel}>
                Selected scenery:{' '}
                {decorationDef(selectedDecoration.decorationId)?.name ??
                  selectedDecoration.decorationId}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
                <MoveControls onMove={moveDecoration} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button style={btn.ghost()} onClick={() => rotateDecoration(-1)}>
                    ⟲ Rotate
                  </button>
                  <button style={btn.ghost()} onClick={() => rotateDecoration(1)}>
                    Rotate ⟳
                  </button>
                </div>
              </div>
              <div style={{ color: theme.muted, fontSize: 11, marginTop: 8 }}>
                Origin: ({selectedDecoration.origin.q}, {selectedDecoration.origin.r}) ·
                Rotation: {selectedDecoration.rotation} (× 60°)
              </div>
              <div style={{ marginTop: 10 }}>
                <button style={{ ...btn.ghost(), fontSize: 12 }} onClick={removeDecoration}>
                  Remove scenery
                </button>
              </div>
            </div>
          )}

          <VictoryCondition
            value={victoryDraft}
            saved={data.victoryCondition ?? data.specialRules ?? ''}
            onChange={onVictoryDraftChange}
            onSave={() => onChange({ ...data, victoryCondition: victoryDraft })}
          />
        </aside>
      </div>
    </div>
  );
}

/** Toolbar dropdown: a gold outline button that opens a custom popover. Matches
    the Monster control's look so every toolbar menu is styled identically (no
    native <select> chrome). Closes on outside click or Escape; only one menu is
    open at a time, coordinated by the parent's `openMenu` state. */
function ToolbarMenu({
  label,
  open,
  onToggle,
  onClose,
  disabled = false,
  align = 'left',
  width,
  fullWidth = false,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  disabled?: boolean;
  align?: 'left' | 'right';
  width?: number;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: 'relative', width: fullWidth ? '100%' : undefined }}>
      <button
        disabled={disabled}
        onClick={onToggle}
        style={{
          ...btn.outline(),
          padding: '6px 12px',
          display: fullWidth ? 'flex' : 'inline-flex',
          width: fullWidth ? '100%' : undefined,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {label}
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            marginTop: 4,
            width: fullWidth ? '100%' : (width ?? 'max-content'),
            minWidth: 140,
            maxWidth: fullWidth ? undefined : 320,
            background: theme.panelRaised,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            padding: 8,
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** List of single-hex map tokens inside a ToolbarMenu. Picking one toggles that
    token on the current hex selection; a ✓ marks tokens already present. */
function TokenList({
  kinds,
  active,
  onPick,
}: {
  kinds: OverlayKind[];
  active: Set<OverlayKind>;
  onPick: (kind: OverlayKind) => void;
}) {
  return (
    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
      {kinds.map((kind) => {
        const s = OVERLAY_STYLES[kind];
        const isActive = active.has(kind);
        return (
          <button key={kind} style={menuItemStyle(isActive)} onClick={() => onPick(kind)}>
            <span
              style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? s.color : 'transparent',
                color: isActive ? '#fff' : theme.text,
                border: `1px solid ${isActive ? s.color : theme.border}`,
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: theme.headingFont,
                flexShrink: 0,
              }}
            >
              {s.symbol}
            </span>
            <span style={{ flex: 1 }}>Token {s.symbol}</span>
            {isActive && <span style={{ color: theme.accent }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function VictoryCondition({
  value,
  saved,
  onChange,
  onSave,
}: {
  value: string;
  saved: string;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const dirty = value !== saved;
  return (
    <div style={panelStyle}>
      <div style={sectionLabel}>Victory condition</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe how players win this scenario. Shown to players as the Objective from the start."
        style={{
          width: '100%',
          minHeight: 80,
          background: theme.bgSolid,
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: 3,
          padding: 8,
          fontSize: 13,
          fontFamily: theme.font,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        {dirty && (
          <button
            style={{ ...btn.ghost(), fontSize: 12, padding: '4px 10px' }}
            onClick={() => onChange(saved)}
          >
            Revert
          </button>
        )}
        <button
          style={{ ...btn.outline(), fontSize: 12, padding: '4px 12px' }}
          onClick={onSave}
          disabled={!dirty}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function MonsterRow({
  monster,
  onRanksChange,
  onBehaviorChange,
  onRemove,
}: {
  monster: MonsterSpawn;
  onRanksChange: (ranks: MonsterSpawn['ranks']) => void;
  onBehaviorChange: (behavior: SpawnBehavior) => void;
  onRemove: () => void;
}) {
  const entry = monsterEntry(monster.monsterType);
  const behavior: SpawnBehavior = monster.behavior ?? 'normal';
  function rankCycle(current: MonsterRankAtCount): MonsterRankAtCount {
    if (current === 'none') return 'normal';
    if (current === 'normal') return 'elite';
    return 'none';
  }
  function rankPill(count: 2 | 3 | 4) {
    const r = monster.ranks[count];
    const colors: Record<MonsterRankAtCount, { bg: string; fg: string; label: string }> = {
      none:   { bg: theme.panel,       fg: theme.muted, label: '—' },
      normal: { bg: '#3a4a30',         fg: '#e7e2cf',   label: 'N' },
      elite:  { bg: '#7a3a2a',         fg: '#ffe2b0',   label: 'E' },
    };
    const c = colors[r];
    return (
      <button
        key={count}
        onClick={() =>
          onRanksChange({ ...monster.ranks, [count]: rankCycle(r) })
        }
        style={{
          width: 44,
          padding: '3px 0',
          background: c.bg,
          color: c.fg,
          border: `1px solid ${theme.border}`,
          borderRadius: 3,
          fontFamily: theme.headingFont,
          fontSize: 11,
          cursor: 'pointer',
        }}
        title={`${count}P → ${r} (click to cycle)`}
      >
        {count}P {c.label}
      </button>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 0',
        borderTop: `1px solid ${theme.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src={monsterAvatarUrl(monster.monsterType)}
          alt={entry?.name ?? monster.monsterType}
          onError={onAvatarError}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            objectFit: 'cover',
            border: '1.5px solid #c44',
            background: '#1a1a1c',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
          {entry?.name ?? monster.monsterType}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {rankPill(2)}
        {rankPill(3)}
        {rankPill(4)}
        <button
          onClick={onRemove}
          style={{ ...btn.ghost(), fontSize: 11, padding: '4px 8px', marginLeft: 'auto' }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: theme.muted, fontSize: 10, marginRight: 2 }}>AI</span>
        {(['normal', 'dummy', 'scripted'] as const).map((b) => (
          <button
            key={b}
            onClick={() => onBehaviorChange(b)}
            title={
              b === 'normal'
                ? 'Acts on its ability deck as usual'
                : b === 'dummy'
                  ? 'Never acts (training dummy)'
                  : 'Runs a fixed scripted action (defined in the scenario rules)'
            }
            style={{
              flex: 1,
              padding: '3px 0',
              background: behavior === b ? theme.accent : theme.panel,
              color: behavior === b ? '#1a1a1c' : theme.muted,
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              fontFamily: theme.headingFont,
              fontSize: 10,
              textTransform: 'capitalize',
              cursor: 'pointer',
            }}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lucide arrow matching each of the six pointy-top hex directions. */
const DIRECTION_ICON: Record<string, LucideIcon> = {
  NW: ArrowUpLeft,
  NE: ArrowUpRight,
  W: ArrowLeft,
  E: ArrowRight,
  SW: ArrowDownLeft,
  SE: ArrowDownRight,
};

function MoveControls({ onMove }: { onMove: (q: number, r: number) => void }) {
  const moveBtn = (label: string, q: number, r: number): React.ReactElement => {
    const Icon = DIRECTION_ICON[label];
    return (
      <button
        key={label}
        onClick={() => onMove(q, r)}
        style={{
          ...btn.ghost(),
          padding: '4px 6px',
          minWidth: 38,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={`Move ${label}`}
        aria-label={`Move ${label}`}
      >
        {Icon ? <Icon size={16} strokeWidth={1.75} /> : label}
      </button>
    );
  };
  const find = (label: string) => {
    const d = HEX_DIRECTIONS.find((h) => h.label === label);
    if (!d) return moveBtn(label, 0, 0);
    return moveBtn(label, d.delta.q, d.delta.r);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {find('NW')}
        {find('NE')}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {find('W')}
        {find('E')}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {find('SW')}
        {find('SE')}
      </div>
    </div>
  );
}
