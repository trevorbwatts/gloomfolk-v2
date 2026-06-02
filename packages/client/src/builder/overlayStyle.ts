import {
  TOKEN_LETTERS,
  TOKEN_NUMBERS,
  type OverlayKind,
  type TokenLetter,
  type TokenNumber,
} from './scenarios.js';

export interface OverlayStyle {
  color: string;
  /** Text glyph used when no icon is provided. */
  symbol: string;
  label: string;
  /** Optional Lucide-style icon: SVG path 'd' attributes on a 24x24 viewBox,
      stroked (no fill), drawn instead of `symbol` when present. */
  iconPaths?: string[];
}

/** lucide-react `ArrowDownToLine`. */
const ARROW_DOWN_TO_LINE: string[] = [
  'M12 17V3',
  'm6 11 6 6 6-6',
  'M19 21H5',
];

/** lucide-react `DoorClosed`. */
const DOOR_CLOSED: string[] = [
  'M10 12h.01',
  'M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14',
  'M2 20h20',
];

/** lucide-react `Gem`. */
const GEM: string[] = [
  'M10.5 3 8 9l4 13 4-13-2.5-6',
  'M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z',
  'M2 9h20',
];

/** lucide-react `MapPinCheckInside`. */
const MAP_PIN_CHECK_INSIDE: string[] = [
  'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
  'm9 10 2 2 4-4',
];

/** lucide-react `Mountain`. */
const MOUNTAIN: string[] = ['m8 3 4 8 5-5 5 15H2L8 3z'];

/** lucide-react `MoveHorizontal` — a passage connecting two rooms. */
const MOVE_HORIZONTAL: string[] = [
  'm18 8 4 4-4 4',
  'M6 8 2 12l4 4',
  'M2 12h20',
];

/** lucide-react `Disc2` — a plate with a centred sensor. */
const DISC2: string[] = [
  'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20',
  'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
];

/** lucide-react `Cuboid` (the cube-shaped icon). */
const CUBOID: string[] = [
  'M10 22v-8',
  'M2.336 8.89 10 14l11.715-7.029',
  'M22 14a2 2 0 0 1-.971 1.715l-10 6a2 2 0 0 1-2.138-.05l-6-4A2 2 0 0 1 2 16v-6a2 2 0 0 1 .971-1.715l10-6a2 2 0 0 1 2.138.05l6 4A2 2 0 0 1 22 8z',
];

/** Lettered tokens share one colour; numbered tokens share another. */
const TOKEN_LETTER_COLOR = '#4a6fa5';
const TOKEN_NUMBER_COLOR = '#6a8a3a';

/** Overlay kinds for the lettered (A–J) map tokens. */
export const TOKEN_LETTER_KINDS: `token-${TokenLetter}`[] = TOKEN_LETTERS.map(
  (l) => `token-${l}` as const,
);
/** Overlay kinds for the numbered (1–9) map tokens. */
export const TOKEN_NUMBER_KINDS: `token-${TokenNumber}`[] = TOKEN_NUMBERS.map(
  (n) => `token-${n}` as const,
);
/** All map-token overlay kinds, letters then numbers. */
export const TOKEN_KINDS = [...TOKEN_LETTER_KINDS, ...TOKEN_NUMBER_KINDS];

type TokenKind = `token-${TokenLetter}` | `token-${TokenNumber}`;
const TOKEN_STYLES = {} as Record<TokenKind, OverlayStyle>;
for (const l of TOKEN_LETTERS) {
  TOKEN_STYLES[`token-${l}`] = { color: TOKEN_LETTER_COLOR, symbol: l, label: l };
}
for (const n of TOKEN_NUMBERS) {
  TOKEN_STYLES[`token-${n}`] = { color: TOKEN_NUMBER_COLOR, symbol: n, label: n };
}

export const OVERLAY_STYLES: Record<OverlayKind, OverlayStyle> = {
  'difficult-terrain': { color: '#9b3fd4', symbol: 'D', label: 'Difficult' },
  'hazardous-terrain': { color: '#e8902e', symbol: 'H', label: 'Hazardous' },
  trap:                { color: '#e23b3b', symbol: 'T', label: 'Trap', iconPaths: MOUNTAIN },
  obstacle:            { color: '#3fb84d', symbol: '■', label: 'Obstacle', iconPaths: CUBOID },
  objective:           { color: '#d9a441', symbol: '◯', label: 'Objective', iconPaths: MAP_PIN_CHECK_INSIDE },
  treasure:            { color: '#a87a30', symbol: '✦', label: 'Treasure', iconPaths: GEM },
  coin:                { color: '#d9a441', symbol: '$', label: 'Coin' },
  door:                { color: '#6a4a2a', symbol: '▮', label: 'Door', iconPaths: DOOR_CLOSED },
  corridor:            { color: '#5a6a7a', symbol: '=', label: 'Corridor', iconPaths: MOVE_HORIZONTAL },
  'pressure-plate':    { color: '#9a9a9a', symbol: '◉', label: 'Pressure Plate', iconPaths: DISC2 },
  'starting-position': {
    color: '#5a8ab8',
    symbol: '↧',
    label: 'Start',
    iconPaths: ARROW_DOWN_TO_LINE,
  },
  ...TOKEN_STYLES,
};

/** Terrain/feature overlays shown in the main overlay picker (tokens excluded;
    they have their own compact picker). */
export const OVERLAY_KINDS: OverlayKind[] = [
  'difficult-terrain',
  'hazardous-terrain',
  'trap',
  'obstacle',
  'objective',
  'treasure',
  'coin',
  'door',
  'corridor',
  'pressure-plate',
  'starting-position',
];
