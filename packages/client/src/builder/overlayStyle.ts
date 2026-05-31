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
  'difficult-terrain': { color: '#a07840', symbol: 'D', label: 'Difficult' },
  'hazardous-terrain': { color: '#c25040', symbol: 'H', label: 'Hazardous' },
  trap:                { color: '#7a1f2a', symbol: 'T', label: 'Trap' },
  obstacle:            { color: '#555555', symbol: '■', label: 'Obstacle' },
  objective:           { color: '#d9a441', symbol: '◯', label: 'Objective' },
  treasure:            { color: '#a87a30', symbol: '✦', label: 'Treasure' },
  coin:                { color: '#d9a441', symbol: '$', label: 'Coin' },
  door:                { color: '#6a4a2a', symbol: '▮', label: 'Door' },
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
  'starting-position',
];
