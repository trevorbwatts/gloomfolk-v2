/**
 * IndexedDB-backed store for uploaded tile background images.
 *
 * Images are stored as compressed data URLs keyed by tile side id (e.g. "G04-C").
 * We use IndexedDB rather than localStorage because tile scans are large: the
 * full set of tiles is several megabytes, which blows past localStorage's ~5 MB
 * whole-origin budget. IndexedDB has a far larger quota and is built for blobs.
 *
 * On upload images are downscaled and re-encoded (see `fileToTileImage`) so each
 * one stays small, which keeps storage and rendering fast.
 *
 * This is still a single-machine prototype store. Move to proper object storage
 * when the scenario editor is shared across devices.
 */

const DB_NAME = 'gf-tile-images';
const STORE = 'images';
const DB_VERSION = 1;

/**
 * How a tile's artwork sits inside its hex footprint. The grid is fixed; this
 * positions the *image* underneath it (the crop-frame model).
 *
 * Offsets are stored as a fraction of the footprint's bounding box so they stay
 * correct at any render size. At the identity transform (all zeros, scale 1) the
 * whole image is fit inside the footprint's bounding box; the hex grid then
 * clips it. Scale up / pan to crop into the part you want.
 */
export interface TileImageTransform {
  /** Horizontal offset, as a fraction of the footprint bounding-box width. */
  offsetX: number;
  /** Vertical offset, as a fraction of the footprint bounding-box height. */
  offsetY: number;
  /** Scale multiplier relative to the fit-whole-image baseline (1 = whole image
      fit inside the footprint box). */
  scale: number;
  /** Rotation in degrees, applied around the footprint centre. */
  rotation: number;
}

export const DEFAULT_TILE_IMAGE_TRANSFORM: TileImageTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
};

export interface TileImageRecord {
  dataUrl: string;
  transform: TileImageTransform;
}

/** Coerce whatever is in the store into a record. Legacy entries are bare data
    URL strings; wrap them with the identity transform. */
function normalizeRecord(value: unknown): TileImageRecord | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return { dataUrl: value, transform: { ...DEFAULT_TILE_IMAGE_TRANSFORM } };
  }
  if (typeof value === 'object' && 'dataUrl' in value) {
    const r = value as { dataUrl: string; transform?: Partial<TileImageTransform> };
    return {
      dataUrl: r.dataUrl,
      transform: { ...DEFAULT_TILE_IMAGE_TRANSFORM, ...r.transform },
    };
  }
  return null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
      }),
  );
}

/** Full record (image + how it's positioned) for a tile side. */
export function getTileImageRecord(sideId: string): Promise<TileImageRecord | null> {
  return tx<unknown>('readonly', (store) => store.get(sideId)).then(normalizeRecord);
}

/** Just the image data URL — convenience for callers that don't need the
    transform. */
export function getTileImage(sideId: string): Promise<string | null> {
  return getTileImageRecord(sideId).then((r) => r?.dataUrl ?? null);
}

/** Save a (new) image. Uploading resets the placement to the cover-fit default. */
export function setTileImage(sideId: string, dataUrl: string): Promise<void> {
  const record: TileImageRecord = {
    dataUrl,
    transform: { ...DEFAULT_TILE_IMAGE_TRANSFORM },
  };
  return tx('readwrite', (store) => store.put(record, sideId)).then(() => undefined);
}

/** Update just the placement transform, keeping the existing image. No-op if the
    tile has no image stored. */
export function setTileImageTransform(
  sideId: string,
  transform: TileImageTransform,
): Promise<void> {
  return getTileImageRecord(sideId).then((rec) => {
    if (!rec) return;
    const next: TileImageRecord = { dataUrl: rec.dataUrl, transform };
    return tx('readwrite', (store) => store.put(next, sideId)).then(() => undefined);
  });
}

export function clearTileImage(sideId: string): Promise<void> {
  return tx('readwrite', (store) => store.delete(sideId)).then(() => undefined);
}

/** Ids of every tile side that currently has an image stored. Used to flag
    tiles in the sidebar without loading each image. */
export function listTileImageIds(): Promise<Set<string>> {
  return tx<IDBValidKey[]>('readonly', (store) => store.getAllKeys()).then(
    (keys) => new Set(keys.map((k) => String(k))),
  );
}

/**
 * One-time best-effort migration of images saved by the old localStorage store
 * (prefix `gf.tileImage.`) into IndexedDB. Small images that fit the old quota
 * are preserved; entries are removed from localStorage once copied. Safe to call
 * repeatedly — it no-ops once localStorage has nothing left to move.
 */
export async function migrateLegacyTileImages(): Promise<void> {
  const PREFIX = 'gf.tileImage.';
  try {
    if (typeof localStorage === 'undefined') return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      const dataUrl = localStorage.getItem(k);
      if (dataUrl) await setTileImage(k.slice(PREFIX.length), dataUrl);
      localStorage.removeItem(k);
    }
  } catch (err) {
    console.warn('Tile image migration skipped:', err);
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode that image.'));
    img.src = src;
  });
}

/**
 * Read an uploaded file and return a compressed data URL suitable for storage:
 * downscaled so the longest edge is at most `maxDim`, re-encoded as WebP (which
 * keeps transparency and compresses well). Falls back to the raw data URL if the
 * browser can't run the canvas step.
 */
export async function fileToTileImage(
  file: File,
  maxDim = 2048,
  quality = 0.85,
): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  try {
    const img = await loadImage(raw);
    let { width, height } = img;
    const longest = Math.max(width, height);
    if (longest > maxDim) {
      const scale = maxDim / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL('image/webp', quality);
    // toDataURL returns a tiny "data:," on failure, or PNG if webp unsupported.
    return out && out.length > 'data:image/webp'.length ? out : raw;
  } catch {
    return raw;
  }
}
