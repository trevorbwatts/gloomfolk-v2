import type { OverlayKind } from './scenarios.js';

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
};

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
