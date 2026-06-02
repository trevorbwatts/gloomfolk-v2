import { useEffect, useMemo, useState } from 'react';
import { TILE_SHAPES, TILE_SIDES, tileShapeById, tileSideById } from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';
import { ShapePreview } from './ShapePreview.js';
import { TileImagePlacer } from './TileImagePlacer.js';
import {
  clearTileImage,
  DEFAULT_TILE_IMAGE_TRANSFORM,
  fileToTileImage,
  getTileImageRecord,
  listTileImageIds,
  migrateLegacyTileImages,
  setTileImage,
  setTileImageTransform,
  type TileImageTransform,
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
  const [transform, setTransform] = useState<TileImageTransform>({
    ...DEFAULT_TILE_IMAGE_TRANSFORM,
  });
  // The placement as it currently lives in storage; lets us flag unsaved edits.
  const [savedTransform, setSavedTransform] = useState<TileImageTransform>({
    ...DEFAULT_TILE_IMAGE_TRANSFORM,
  });
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

  // Load the selected tile's image (and its placement) whenever the selection
  // changes.
  useEffect(() => {
    let cancelled = false;
    setCurrentImage(null);
    setTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
    setSavedTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
    if (!selectedSide) return;
    const id = selectedSide.id;
    getTileImageRecord(id)
      .then((rec) => {
        if (cancelled || !rec) return;
        setCurrentImage(rec.dataUrl);
        setTransform(rec.transform);
        setSavedTransform(rec.transform);
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
      // Only reflect it if the user is still on the same tile. A fresh upload
      // resets the placement to the cover-fit default.
      if (selectedSide?.id === id) {
        setCurrentImage(dataUrl);
        setTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
        setSavedTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
      }
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
      if (selectedSide?.id === id) {
        setCurrentImage(null);
        setTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
        setSavedTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM });
      }
      refreshImageIds();
    } catch (err) {
      console.error('Failed to remove tile image:', err);
      alert('Could not remove that image.');
    }
  }

  async function handleSavePlacement() {
    if (!selectedSide) return;
    const id = selectedSide.id;
    try {
      await setTileImageTransform(id, transform);
      if (selectedSide?.id === id) setSavedTransform(transform);
    } catch (err) {
      console.error('Failed to save image placement:', err);
      alert('Could not save the image placement.');
    }
  }

  const placementDirty =
    transform.offsetX !== savedTransform.offsetX ||
    transform.offsetY !== savedTransform.offsetY ||
    transform.scale !== savedTransform.scale ||
    transform.rotation !== savedTransform.rotation;

  // Shared look for the muted controls (Reset / Replace / Remove): same style and
  // a common min-width so they read as one uniform row.
  const mutedBtn: React.CSSProperties = {
    ...btn.ghost(),
    minWidth: 140,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  };

  // Width of the preview area — 70% larger than the original 480px.
  const previewMaxWidth = 816;

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
                margin: '0 0 16px',
                fontFamily: theme.headingFont,
                color: theme.accent,
                fontWeight: 500,
                fontSize: 26,
                letterSpacing: 0.5,
              }}
            >
              {selectedSide.id}
            </h2>

            <div style={{ maxWidth: previewMaxWidth }}>
              {currentImage ? (
                <TileImagePlacer
                  footprint={selectedShape.footprint}
                  href={currentImage}
                  transform={transform}
                  onChange={setTransform}
                  maxWidth={previewMaxWidth}
                />
              ) : (
                <ShapePreview
                  footprint={selectedShape.footprint}
                  maxWidth={previewMaxWidth}
                />
              )}
              {currentImage && (
                <p style={{ color: theme.muted, fontSize: 11, margin: '10px 0 0' }}>
                  Drag the image to position it under the hex grid; use the
                  sliders to scale and rotate. Save to keep this placement.
                </p>
              )}

              {/* Muted controls: add/replace, reset, remove. */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {currentImage && !busy && (
                  <button
                    style={mutedBtn}
                    onClick={() => setTransform({ ...DEFAULT_TILE_IMAGE_TRANSFORM })}
                  >
                    Reset to fit
                  </button>
                )}
                <label style={{ ...mutedBtn, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Saving…' : currentImage ? 'Replace image' : 'Add image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    disabled={busy}
                    style={{ display: 'none' }}
                  />
                </label>
                {currentImage && !busy && (
                  <button style={mutedBtn} onClick={handleClear}>
                    Remove
                  </button>
                )}
              </div>

              {/* Primary save action, left-aligned on its own row. */}
              {currentImage && !busy && (
                <div style={{ marginTop: 12 }}>
                  <button
                    style={btn.primary(!placementDirty)}
                    onClick={handleSavePlacement}
                    disabled={!placementDirty}
                  >
                    {placementDirty ? 'Save placement' : 'Placement saved'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
