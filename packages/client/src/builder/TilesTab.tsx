import { useEffect, useMemo, useState } from 'react';
import { TILE_SHAPES, TILE_SIDES, tileShapeById, tileSideById } from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';
import { ShapePreview } from './ShapePreview.js';
import {
  clearTileImage,
  fileToTileImage,
  getTileImage,
  listTileImageIds,
  migrateLegacyTileImages,
  setTileImage,
} from './tileImages.js';

const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '280px 1fr',
  gap: 0,
  minHeight: 'calc(100vh - 120px)',
};

const sidebarStyle: React.CSSProperties = {
  borderRight: `1px solid ${theme.border}`,
  padding: '12px 8px',
  overflowY: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};

const contentStyle: React.CSSProperties = {
  padding: '20px 24px',
  overflowY: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};

const sideButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  marginBottom: 2,
  background: active ? theme.panelRaised : 'transparent',
  color: active ? theme.accent : theme.text,
  border: 'none',
  borderRadius: 3,
  fontFamily: theme.font,
  fontSize: 13,
  cursor: 'pointer',
});

const shapeHeadingStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '12px 8px 4px',
  fontFamily: theme.headingFont,
};

export function TilesTab() {
  const [selectedId, setSelectedId] = useState<string>(TILE_SIDES[0]?.id ?? '');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const selectedSide = useMemo(() => tileSideById(selectedId), [selectedId]);
  const selectedShape = useMemo(
    () => (selectedSide ? tileShapeById(selectedSide.shapeId) : undefined),
    [selectedSide],
  );

  const sidesByShape = useMemo(() => {
    const map = new Map<string, typeof TILE_SIDES>();
    for (const shape of TILE_SHAPES) map.set(shape.id, []);
    for (const side of TILE_SIDES) {
      const arr = map.get(side.shapeId);
      if (arr) arr.push(side);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.id.localeCompare(b.id));
    return map;
  }, []);

  // Which tiles have an image (for the sidebar dots). Refreshed after edits.
  function refreshImageIds() {
    listTileImageIds()
      .then(setImageIds)
      .catch((err) => console.warn('Could not list tile images:', err));
  }
  useEffect(() => {
    // Pull any images saved by the old localStorage store into IndexedDB, then
    // list what we have.
    migrateLegacyTileImages().finally(refreshImageIds);
  }, []);

  // Load the selected tile's image whenever the selection changes.
  useEffect(() => {
    let cancelled = false;
    setCurrentImage(null);
    if (!selectedSide) return;
    const id = selectedSide.id;
    getTileImage(id)
      .then((img) => {
        if (!cancelled) setCurrentImage(img);
      })
      .catch((err) => console.warn('Could not load tile image:', err));
    return () => {
      cancelled = true;
    };
  }, [selectedSide]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedSide) return;
    const id = selectedSide.id;
    setBusy(true);
    try {
      const dataUrl = await fileToTileImage(file);
      await setTileImage(id, dataUrl);
      // Only reflect it if the user is still on the same tile.
      if (selectedSide?.id === id) setCurrentImage(dataUrl);
      refreshImageIds();
    } catch (err) {
      console.error('Failed to save tile image:', err);
      alert(
        'Could not save that image. It may be corrupt, or storage may be full. ' +
          'Try a smaller image or remove some existing tile images.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!selectedSide) return;
    const id = selectedSide.id;
    try {
      await clearTileImage(id);
      if (selectedSide?.id === id) setCurrentImage(null);
      refreshImageIds();
    } catch (err) {
      console.error('Failed to remove tile image:', err);
      alert('Could not remove that image.');
    }
  }

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        {TILE_SHAPES.map((shape) => {
          const sides = sidesByShape.get(shape.id) ?? [];
          if (sides.length === 0) return null;
          return (
            <div key={shape.id}>
              <div style={shapeHeadingStyle}>
                {shape.id} · {shape.name} ({sides.length})
              </div>
              {sides.map((side) => (
                <button
                  key={side.id}
                  style={sideButtonStyle(side.id === selectedId)}
                  onClick={() => setSelectedId(side.id)}
                >
                  {side.id}
                  {imageIds.has(side.id) ? (
                    <span style={{ color: theme.good, marginLeft: 6 }}>●</span>
                  ) : null}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      <main style={contentStyle}>
        {!selectedSide || !selectedShape ? (
          <p style={{ color: theme.muted }}>Select a tile from the list.</p>
        ) : (
          <div>
            <h2
              style={{
                margin: '0 0 4px',
                fontFamily: theme.headingFont,
                color: theme.accent,
                fontWeight: 500,
                fontSize: 26,
                letterSpacing: 0.5,
              }}
            >
              {selectedSide.id}
            </h2>
            <div style={{ color: theme.muted, fontSize: 13, marginBottom: 16 }}>
              Shape: <strong style={{ color: theme.text }}>{selectedShape.name}</strong> ·{' '}
              {selectedShape.footprint.length} hexes ·{' '}
              {selectedSide.hasWalls ? 'walled' : 'open (no walls)'}
            </div>

            <p style={{ marginTop: 0, marginBottom: 16 }}>{selectedSide.artNotes}</p>
            <p style={{ color: theme.muted, fontSize: 12, marginTop: 0 }}>
              {selectedShape.description}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
                marginTop: 20,
                alignItems: 'start',
              }}
            >
              <div>
                <div
                  style={{
                    color: theme.muted,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  Catalogued shape
                </div>
                <ShapePreview footprint={selectedShape.footprint} />
              </div>

              <div>
                <div
                  style={{
                    color: theme.muted,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 6,
                  }}
                >
                  Background image
                </div>
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={selectedSide.id}
                    style={{
                      width: '100%',
                      maxWidth: 480,
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 480,
                      aspectRatio: '4 / 3',
                      borderRadius: 6,
                      border: `1px dashed ${theme.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.muted,
                      fontSize: 13,
                    }}
                  >
                    No image yet
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ ...btn.outline(), opacity: busy ? 0.6 : 1 }}>
                    {busy ? 'Saving…' : currentImage ? 'Replace image' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      disabled={busy}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {currentImage && !busy && (
                    <button style={btn.ghost()} onClick={handleClear}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
