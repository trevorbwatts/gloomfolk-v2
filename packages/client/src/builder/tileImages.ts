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

export function getTileImage(sideId: string): Promise<string | null> {
  return tx<string | undefined>('readonly', (store) => store.get(sideId)).then(
    (v) => v ?? null,
  );
}

export function setTileImage(sideId: string, dataUrl: string): Promise<void> {
  return tx('readwrite', (store) => store.put(dataUrl, sideId)).then(() => undefined);
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
