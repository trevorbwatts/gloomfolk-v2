import { useEffect, useMemo, useState } from 'react';
import { TILE_SHAPES, TILE_SIDES, type Hex, hexKey } from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';
import { SceneCanvas } from './SceneCanvas.js';
import { HEX_DIRECTIONS } from './sceneGeometry.js';
import {
  type MonsterRankAtCount,
  type MonsterSpawn,
  type Overlay,
  type OverlayKind,
  type PlacedTile,
  type ScenarioData,
  newMonsterSpawnId,
  newOverlayId,
  newPlacedTileId,
} from './scenarios.js';
import { OVERLAY_KINDS, OVERLAY_STYLES } from './overlayStyle.js';
import { MONSTER_CATALOG, monsterEntry } from './monsterCatalog.js';
import { monsterAvatarUrl, onAvatarError } from '../avatars.js';

interface Props {
  data: ScenarioData;
  onChange: (next: ScenarioData) => void;
  rulesDraft: string;
  onRulesDraftChange: (next: string) => void;
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

const selectStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 8px',
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
};

const sideOptions = TILE_SIDES.slice().sort((a, b) => a.id.localeCompare(b.id));

export function ScenarioEditor({ data, onChange, rulesDraft, onRulesDraftChange }: Props) {
  const placed = data.placedTiles ?? [];
  const overlays = data.overlays ?? [];
  const monsterSpawns = data.monsterSpawns ?? [];
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedHexKeys, setSelectedHexKeys] = useState<Set<string>>(new Set());
  const [pickerSideId, setPickerSideId] = useState<string>(
    sideOptions[0]?.id ?? '',
  );
  const [monsterQuery, setMonsterQuery] = useState('');

  const selectedTile: PlacedTile | undefined = useMemo(
    () => placed.find((p) => p.id === selectedTileId),
    [placed, selectedTileId],
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
  function updateMonsters(next: MonsterSpawn[]) {
    onChange({ ...data, monsterSpawns: next });
  }

  function handleAddTile() {
    if (!pickerSideId) return;
    const newTile: PlacedTile = {
      id: newPlacedTileId(),
      tileSideId: pickerSideId,
      origin: { q: 0, r: 0 },
      rotation: 0,
    };
    updateTiles([...placed, newTile]);
    setSelectedTileId(newTile.id);
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
  function removeTile() {
    if (!selectedTile) return;
    updateTiles(placed.filter((p) => p.id !== selectedTile.id));
    setSelectedTileId(null);
  }

  function handleHexClick(h: Hex, shift: boolean) {
    const k = hexKey(h);
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

  function addMonsterAtSelection(monsterType: string) {
    if (!monsterTargetHex || monsterTargetOccupied) return;
    const newMon: MonsterSpawn = {
      id: newMonsterSpawnId(),
      hex: monsterTargetHex,
      monsterType,
      ranks: { 2: 'normal', 3: 'normal', 4: 'normal' },
    };
    updateMonsters([...monsterSpawns, newMon]);
  }

  function updateMonsterRanks(id: string, ranks: MonsterSpawn['ranks']) {
    updateMonsters(monsterSpawns.map((m) => (m.id === id ? { ...m, ranks } : m)));
  }

  /** Monsters on hexes currently selected — used by the inspector panel. */
  const selectedMonsters: MonsterSpawn[] = useMemo(
    () => monsterSpawns.filter((m) => selectedHexKeys.has(hexKey(m.hex))),
    [monsterSpawns, selectedHexKeys],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SpecialRules value={rulesDraft} onChange={onRulesDraftChange} />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
      {/* Left: tile management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={panelStyle}>
          <div style={sectionLabel}>Add tile</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={pickerSideId}
              onChange={(e) => setPickerSideId(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
            >
              {TILE_SHAPES.map((shape) => {
                const sides = sideOptions.filter((s) => s.shapeId === shape.id);
                if (sides.length === 0) return null;
                return (
                  <optgroup key={shape.id} label={`${shape.id} · ${shape.name}`}>
                    {sides.map((side) => (
                      <option key={side.id} value={side.id}>
                        {side.id}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <button style={btn.outline()} onClick={handleAddTile}>
              Add
            </button>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={sectionLabel}>Placed tiles ({placed.length})</div>
          {placed.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>
              None yet. Add one above.
            </p>
          ) : (
            placed.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedTileId(p.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  marginBottom: 2,
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
            ))
          )}
        </div>

        {selectedHexKeys.size > 0 && (
          <div style={panelStyle}>
            <div style={sectionLabel}>
              Overlays · {selectedHexKeys.size} hex{selectedHexKeys.size > 1 ? 'es' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {OVERLAY_KINDS.map((kind) => {
                const s = OVERLAY_STYLES[kind];
                const isCurrent = matchedOverlays.some((o) => o.kind === kind);
                return (
                  <button
                    key={kind}
                    onClick={() => toggleOverlayKind(kind)}
                    title={s.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      background: isCurrent ? s.color : 'transparent',
                      color: isCurrent ? '#fff' : theme.text,
                      border: `1px solid ${isCurrent ? s.color : theme.border}`,
                      borderRadius: 3,
                      fontSize: 11,
                      fontFamily: theme.headingFont,
                      letterSpacing: 0.5,
                      cursor: 'pointer',
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
          </div>
        )}

        <div style={panelStyle}>
          <div style={sectionLabel}>Add monster</div>
          <input
            value={monsterQuery}
            onChange={(e) => setMonsterQuery(e.target.value)}
            placeholder="Search monsters…"
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
            <p style={{ color: theme.muted, fontSize: 11, margin: '4px 0 0' }}>
              Select a single hex to add a monster.
            </p>
          ) : monsterTargetOccupied ? (
            <p style={{ color: theme.muted, fontSize: 11, margin: '4px 0 0' }}>
              This hex already has a monster.
            </p>
          ) : null}
          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
            {filteredMonsters.length === 0 ? (
              <p style={{ color: theme.muted, fontSize: 12, margin: '6px 0 0' }}>
                No matches.
              </p>
            ) : (
              filteredMonsters.map((m) => {
                const disabled = !monsterTargetHex || monsterTargetOccupied;
                return (
                  <button
                    key={m.id}
                    onClick={() => addMonsterAtSelection(m.id)}
                    disabled={disabled}
                    title={disabled ? 'Select an empty hex first' : `Add ${m.name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      padding: '5px 8px',
                      background: 'transparent',
                      color: theme.text,
                      border: 'none',
                      borderRadius: 3,
                      fontSize: 13,
                      fontFamily: theme.font,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        marginRight: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#1a1a1c',
                        color: '#fff',
                        border: '1.5px solid #c44',
                        borderRadius: 9,
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {m.short}
                    </span>
                    {m.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

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
                onRemove={() =>
                  updateMonsters(monsterSpawns.filter((x) => x.id !== m.id))
                }
              />
            ))}
          </div>
        )}

        {selectedTile && (
          <div style={panelStyle}>
            <div style={sectionLabel}>Selected tile: {selectedTile.tileSideId}</div>
            <MoveControls onMove={moveTile} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button style={btn.ghost()} onClick={() => rotateTile(-1)}>
                ⟲ Rotate
              </button>
              <button style={btn.ghost()} onClick={() => rotateTile(1)}>
                Rotate ⟳
              </button>
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
      </div>

      {/* Right: canvas */}
      <div>
        <div style={sectionLabel}>Canvas</div>
        <SceneCanvas
          placedTiles={placed}
          overlays={overlays}
          monsterSpawns={monsterSpawns}
          selectedTileId={selectedTileId}
          selectedHexKeys={selectedHexKeys}
          onHexClick={handleHexClick}
          onHexContextMenu={() => {}}
          onEmptyClick={handleEmptyClick}
        />
        <p style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
          Click a hex to select; shift-click to add/remove. Pick overlay kinds
          and monsters in the left panel. Multiple overlays can stack on the
          same hex.
        </p>
      </div>
      </div>
    </div>
  );
}

function SpecialRules({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div style={panelStyle}>
      <div style={sectionLabel}>Special rules</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the scenario book's special rules here. The host will read them out."
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
    </div>
  );
}

function MonsterRow({
  monster,
  onRanksChange,
  onRemove,
}: {
  monster: MonsterSpawn;
  onRanksChange: (ranks: MonsterSpawn['ranks']) => void;
  onRemove: () => void;
}) {
  const entry = monsterEntry(monster.monsterType);
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
    </div>
  );
}

function MoveControls({ onMove }: { onMove: (q: number, r: number) => void }) {
  const moveBtn = (label: string, q: number, r: number): React.ReactElement => (
    <button
      key={label}
      onClick={() => onMove(q, r)}
      style={{ ...btn.ghost(), fontSize: 11, padding: '4px 6px', minWidth: 38 }}
      title={`Move ${label}`}
    >
      {label}
    </button>
  );
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
