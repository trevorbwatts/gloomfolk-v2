import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CampaignSummary } from '@gloomfolk/shared';

const SAVE_DIR = path.resolve(process.cwd(), 'saves');

export interface CampaignSave {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scenarioId: string | null;
  players: Array<{
    playerId: string;
    name: string;
    characterId: string | null;
  }>;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(SAVE_DIR, { recursive: true });
}

function filePath(id: string): string {
  return path.join(SAVE_DIR, `${id}.json`);
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  await ensureDir();
  const files = await fs.readdir(SAVE_DIR);
  const out: CampaignSummary[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(SAVE_DIR, f), 'utf8');
      const data = JSON.parse(raw) as CampaignSave;
      out.push({
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        scenarioId: data.scenarioId,
        playerNames: data.players.map((p) => p.name),
      });
    } catch {
      // skip malformed files
    }
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export async function loadCampaign(id: string): Promise<CampaignSave | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(filePath(id), 'utf8');
    return JSON.parse(raw) as CampaignSave;
  } catch {
    return null;
  }
}

export async function saveCampaign(data: CampaignSave): Promise<void> {
  await ensureDir();
  data.updatedAt = Date.now();
  const tmp = filePath(data.id) + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, filePath(data.id));
}

export async function deleteCampaign(id: string): Promise<boolean> {
  await ensureDir();
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}

/** Returns the lowest unused single-digit slot ('1'..'9'). Throws if all 9 are taken. */
export async function newCampaignId(): Promise<string> {
  await ensureDir();
  const files = await fs.readdir(SAVE_DIR);
  const taken = new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  for (let i = 1; i <= 9; i++) {
    const id = String(i);
    if (!taken.has(id)) return id;
  }
  throw new Error('all 9 campaign slots taken');
}
