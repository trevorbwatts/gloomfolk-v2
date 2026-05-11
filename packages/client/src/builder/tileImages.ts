/**
 * Local-storage backed store for uploaded tile background images.
 * Stored as data URLs keyed by tile side id (e.g. "G04-C").
 *
 * This is a prototype storage layer — fine for one user reviewing tiles on
 * their own machine. Move to proper file/object storage when the scenario
 * editor is shared across devices.
 */

const PREFIX = 'gf.tileImage.';

export function getTileImage(sideId: string): string | null {
  try {
    return localStorage.getItem(PREFIX + sideId);
  } catch {
    return null;
  }
}

export function setTileImage(sideId: string, dataUrl: string): void {
  try {
    localStorage.setItem(PREFIX + sideId, dataUrl);
  } catch (err) {
    console.warn('Failed to save tile image (likely localStorage quota):', err);
  }
}

export function clearTileImage(sideId: string): void {
  try {
    localStorage.removeItem(PREFIX + sideId);
  } catch {
    // ignore
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
