import type { Element, ElementBoardState } from '@gloomfolk/shared';
import { Flame, Snowflake, Wind, Stone, SunMedium, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../theme.js';

/**
 * Six-element board, three columns (inert / waning / strong, left → right).
 * Read-only on the host; players see the same component but with an
 * `availableForConsume` highlight on whichever elements they can opt to
 * consume this turn.
 */
export function ElementBoard({
  board,
  availableForConsume,
  consumedThisTurn,
}: {
  board: ElementBoardState;
  /** When set, elements present in this set get a glow indicating the
   *  player can opt to consume them on the current attack action. */
  availableForConsume?: ReadonlySet<Element>;
  /** Elements already consumed during the current turn. Greyed in place
   *  of glow. */
  consumedThisTurn?: ReadonlySet<Element>;
}) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
        padding: 12,
        minWidth: 260,
        fontFamily: theme.font,
        color: theme.text,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: theme.muted,
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Elements
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        <ColumnHeader>Inert</ColumnHeader>
        <ColumnHeader>Waning</ColumnHeader>
        <ColumnHeader>Strong</ColumnHeader>
        {ELEMENTS.map((e) => (
          <ElementRow
            key={e}
            element={e}
            column={board[e]}
            available={availableForConsume?.has(e) ?? false}
            consumed={consumedThisTurn?.has(e) ?? false}
          />
        ))}
      </div>
    </div>
  );
}

function ElementRow({
  element,
  column,
  available,
  consumed,
}: {
  element: Element;
  column: 'strong' | 'waning' | 'inert';
  available: boolean;
  consumed: boolean;
}) {
  const meta = ELEMENT_META[element];
  return (
    <>
      <Cell
        cellColumn="inert"
        activeColumn={column}
        meta={meta}
        available={false}
        consumed={false}
      />
      <Cell
        cellColumn="waning"
        activeColumn={column}
        meta={meta}
        available={available}
        consumed={consumed}
      />
      <Cell
        cellColumn="strong"
        activeColumn={column}
        meta={meta}
        available={available}
        consumed={consumed}
      />
    </>
  );
}

/** Icon glow strength per column: inert = none, waning = subtle, strong =
 *  pronounced. Tunes both the blur radius and the second-pass haze. */
const GLOW_BY_COLUMN: Record<'inert' | 'waning' | 'strong', string | null> = {
  inert: null,
  waning: '0 0 6px',
  strong: '0 0 10px',
};

function Cell({
  cellColumn,
  activeColumn,
  meta,
  available,
  consumed,
}: {
  cellColumn: 'inert' | 'waning' | 'strong';
  activeColumn: 'inert' | 'waning' | 'strong';
  meta: ElementMeta;
  available: boolean;
  consumed: boolean;
}) {
  const active = cellColumn === activeColumn;
  const consumeGlow = active && available && !consumed;
  const dim = cellColumn === 'inert';
  const Icon = meta.icon;
  const baseGlow = GLOW_BY_COLUMN[cellColumn];
  // Strong gets a doubled drop-shadow for extra haze; waning is the single
  // subtle glow we had before; inert renders the icon flat.
  const iconFilter =
    consumed || !baseGlow
      ? 'none'
      : cellColumn === 'strong'
        ? `drop-shadow(${baseGlow} ${meta.color}) drop-shadow(0 0 18px ${meta.color})`
        : `drop-shadow(${baseGlow} ${meta.color})`;
  return (
    <div
      title={active ? meta.label : ''}
      style={{
        height: 56,
        background: dim ? '#0a100c' : theme.bgSolid,
        border: `1px solid ${theme.border}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'all 0.2s ease',
        ...(consumeGlow
          ? {
              boxShadow: `0 0 0 2px ${theme.accent}, 0 0 14px ${theme.accent}`,
              borderColor: theme.accent,
            }
          : {}),
      }}
    >
      {active && (
        <Icon
          size={32}
          strokeWidth={1.75}
          color={meta.color}
          style={{
            opacity: consumed ? 0.35 : 1,
            filter: iconFilter,
            transition: 'all 0.2s ease',
          }}
        />
      )}
    </div>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: theme.muted,
        textAlign: 'center',
        paddingBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

const ELEMENTS: readonly Element[] = ['fire', 'ice', 'air', 'earth', 'light', 'dark'];

interface ElementMeta {
  label: string;
  color: string;
  icon: LucideIcon;
}

const ELEMENT_META: Record<Element, ElementMeta> = {
  fire: { label: 'Fire', color: '#d96a4a', icon: Flame },
  ice: { label: 'Ice', color: '#74c2d6', icon: Snowflake },
  air: { label: 'Air', color: '#e7e2cf', icon: Wind },
  earth: { label: 'Earth', color: '#8a6f3b', icon: Stone },
  light: { label: 'Light', color: '#f0d774', icon: SunMedium },
  dark: { label: 'Dark', color: '#8b6cb0', icon: Moon },
};
