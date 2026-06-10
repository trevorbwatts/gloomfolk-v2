/**
 * Campaign sheet data model (docs/rules/campaign-sheet.md).
 *
 * One sheet per campaign: faction reputation, inspiration, prosperity, the
 * Great Oak and imbuement tracks, retired characters, and unlocked classes.
 * Lives on the campaign save and is broadcast in PublicGameState so every
 * screen can show it; the host adjusts it via host_* messages.
 */

export type FactionId = 'demons' | 'merchants-guild' | 'military';

export const FACTIONS: readonly { id: FactionId; name: string }[] = [
  { id: 'demons', name: 'Demons' },
  { id: 'merchants-guild', name: "Merchant's Guild" },
  { id: 'military', name: 'Military' },
];

/** One row in the campaign sheet's retirement table. */
export interface RetiredCharacterRecord {
  playerId: string;
  playerName: string;
  characterName: string;
  classId: string;
  level: number;
  perkMarks: number;
  masteries: number;
}

export interface CampaignSheet {
  reputation: Record<FactionId, number>;
  /** Current reputation ceiling. Starts at 12; the printed track locks the
   *  13–20 range until the campaign raises it, so it's state, not a constant. */
  reputationCap: number;
  inspiration: number;
  /** "+X prosperity" boxes marked so far. The level-1 box is pre-marked at
   *  campaign start and not counted here (0 boxes = prosperity 1). */
  prosperityBoxesMarked: number;
  greatOakBoxesMarked: number;
  /** Rulebook: ignore this track until the game instructs you to use it. */
  imbuementBoxesMarked: number;
  retiredCharacters: RetiredCharacterRecord[];
  classesUnlocked: string[];
}

export const REPUTATION_MIN = -10;
export const INITIAL_REPUTATION_CAP = 12;
export const MAX_PROSPERITY_LEVEL = 9;

export function defaultCampaignSheet(): CampaignSheet {
  return {
    reputation: { demons: 0, 'merchants-guild': 0, military: 0 },
    reputationCap: INITIAL_REPUTATION_CAP,
    inspiration: 0,
    prosperityBoxesMarked: 0,
    greatOakBoxesMarked: 0,
    imbuementBoxesMarked: 0,
    retiredCharacters: [],
    classesUnlocked: [],
  };
}

/** Clamp a reputation value to [−10, cap]; gains/losses beyond are ignored. */
export function clampReputation(
  value: number,
  cap: number = INITIAL_REPUTATION_CAP,
): number {
  return Math.max(REPUTATION_MIN, Math.min(cap, value));
}

/**
 * Cumulative "+X prosperity" boxes at which each numbered box (= prosperity
 * level) is reached. Index 0 → level 2, index 7 → level 9.
 *
 * ⚠ Read off the printed campaign sheet's track — the box counts between
 * numbered boxes are hard to make out on the scan, so verify against the
 * physical sheet before trusting exact level boundaries.
 */
export const PROSPERITY_LEVEL_THRESHOLDS: readonly number[] = [
  4, 10, 16, 21, 27, 34, 42, 51,
];

/** Total boxes on the prosperity track (everything up to the level-9 box). */
export const MAX_PROSPERITY_BOXES =
  PROSPERITY_LEVEL_THRESHOLDS[PROSPERITY_LEVEL_THRESHOLDS.length - 1]!;

/** Prosperity level (1–9) for a number of marked boxes. */
export function prosperityLevel(boxesMarked: number): number {
  let level = 1;
  for (const threshold of PROSPERITY_LEVEL_THRESHOLDS) {
    if (boxesMarked >= threshold) level++;
    else break;
  }
  return level;
}

/**
 * The lowest the box count may drop to via "−X prosperity": numbered boxes
 * (and everything before them) are never erased, so the floor is the
 * threshold of the current level.
 */
export function prosperityBoxesFloor(boxesMarked: number): number {
  const level = prosperityLevel(boxesMarked);
  return level <= 1 ? 0 : PROSPERITY_LEVEL_THRESHOLDS[level - 2]!;
}

/** Every fifth Great Oak donation box grants Gloomhaven 1 prosperity. */
export const GREAT_OAK_BOXES_PER_PROSPERITY = 5;

/** A Great Oak donation costs the donating character 10 gold. */
export const GREAT_OAK_DONATION_GOLD = 10;

/**
 * Highest level the optional prosperity catch-up level-up may reach: half
 * the current prosperity level, rounded up (docs/rules/level-up.md).
 */
export function catchUpLevelCap(prosperity: number): number {
  return Math.ceil(prosperity / 2);
}

/** Inspiration gained when the party completes a scenario: 4 − party size. */
export function scenarioCompletionInspiration(characterCount: number): number {
  return Math.max(0, 4 - characterCount);
}

/** Backfill a (possibly missing or partial) saved sheet to a full one. */
export function normalizeCampaignSheet(
  sheet: Partial<CampaignSheet> | undefined,
): CampaignSheet {
  const base = defaultCampaignSheet();
  if (!sheet) return base;
  return {
    reputation: { ...base.reputation, ...(sheet.reputation ?? {}) },
    reputationCap:
      typeof sheet.reputationCap === 'number'
        ? sheet.reputationCap
        : base.reputationCap,
    inspiration:
      typeof sheet.inspiration === 'number' ? sheet.inspiration : 0,
    prosperityBoxesMarked:
      typeof sheet.prosperityBoxesMarked === 'number'
        ? sheet.prosperityBoxesMarked
        : 0,
    greatOakBoxesMarked:
      typeof sheet.greatOakBoxesMarked === 'number'
        ? sheet.greatOakBoxesMarked
        : 0,
    imbuementBoxesMarked:
      typeof sheet.imbuementBoxesMarked === 'number'
        ? sheet.imbuementBoxesMarked
        : 0,
    retiredCharacters: Array.isArray(sheet.retiredCharacters)
      ? sheet.retiredCharacters
      : [],
    classesUnlocked: Array.isArray(sheet.classesUnlocked)
      ? sheet.classesUnlocked
      : [],
  };
}
