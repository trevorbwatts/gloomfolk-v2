import type { CSSProperties } from 'react';
import type { CampaignSheet, ClientToServer } from '@gloomfolk/shared';
import {
  catchUpLevelCap,
  FACTIONS,
  MAX_PROSPERITY_BOXES,
  PROSPERITY_LEVEL_THRESHOLDS,
  prosperityLevel,
  REPUTATION_MIN,
  GREAT_OAK_BOXES_PER_PROSPERITY,
} from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';

/**
 * The campaign sheet (docs/rules/campaign-sheet.md) as a host lobby panel:
 * faction reputation, inspiration, and the prosperity track with host-side
 * adjustment controls, plus a read-only view of the Great Oak track —
 * donations come from the characters themselves (the players' shop screen),
 * the sheet just records them. Imbuement, retirements, and classes-unlocked
 * have state but no controls yet — their flows aren't built.
 */
export function CampaignSheetPanel({
  sheet,
  send,
}: {
  sheet: CampaignSheet;
  send: (msg: ClientToServer) => void;
}) {
  const prosperity = prosperityLevel(sheet.prosperityBoxesMarked);
  const nextThreshold = PROSPERITY_LEVEL_THRESHOLDS.find(
    (t) => t > sheet.prosperityBoxesMarked,
  );
  const oakProgress = sheet.greatOakBoxesMarked % GREAT_OAK_BOXES_PER_PROSPERITY;

  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: 20,
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
      }}
    >
      <section style={{ flex: 2, minWidth: 280 }}>
        <div style={kicker}>Faction reputation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {FACTIONS.map((f) => {
            const value = sheet.reputation[f.id];
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{f.name}</span>
                <Stepper
                  value={value}
                  min={REPUTATION_MIN}
                  max={sheet.reputationCap}
                  onAdjust={(delta) =>
                    send({ type: 'host_adjust_reputation', faction: f.id, delta })
                  }
                />
              </div>
            );
          })}
        </div>
        <p style={hint}>
          Clamped to {REPUTATION_MIN}…{sheet.reputationCap}. Section numbers at
          9, 16, and 20 — read them the first time a faction gets there.
        </p>
      </section>

      <section style={{ flex: 1, minWidth: 170 }}>
        <div style={kicker}>Inspiration</div>
        <div style={{ marginTop: 10 }}>
          <Stepper
            value={sheet.inspiration}
            min={0}
            onAdjust={(delta) => send({ type: 'host_adjust_inspiration', delta })}
          />
        </div>
        <p style={hint}>
          +{'{'}4 − party size{'}'} is added automatically on each scenario
          victory. Spend 12 on retirement for an extra personal quest.
        </p>
      </section>

      <section style={{ flex: 1.5, minWidth: 230 }}>
        <div style={kicker}>Prosperity — level {prosperity}</div>
        <div style={{ marginTop: 10 }}>
          <Stepper
            value={sheet.prosperityBoxesMarked}
            min={0}
            max={MAX_PROSPERITY_BOXES}
            label="boxes"
            onAdjust={(delta) => send({ type: 'host_adjust_prosperity', delta })}
          />
        </div>
        <p style={hint}>
          {nextThreshold !== undefined
            ? `Level ${prosperity + 1} at ${nextThreshold} boxes.`
            : 'Track complete.'}{' '}
          Characters below level {catchUpLevelCap(prosperity)} may level up for
          free at downtime.
        </p>
      </section>

      <section style={{ flex: 1, minWidth: 200 }}>
        <div style={kicker}>Great Oak</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <span style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: GREAT_OAK_BOXES_PER_PROSPERITY }).map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: `1px solid ${i < oakProgress ? theme.accent : theme.border}`,
                  background: i < oakProgress ? theme.accent : 'transparent',
                  borderRadius: 2,
                }}
              />
            ))}
          </span>
          <span style={{ fontFamily: theme.headingFont, fontSize: 20, color: theme.accent }}>
            {sheet.greatOakBoxesMarked}
          </span>
        </div>
        <p style={hint}>
          Characters donate from their own gold (in their shop). Every fifth
          box grants +1 prosperity.
        </p>
      </section>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  label,
  onAdjust,
}: {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  onAdjust: (delta: number) => void;
}) {
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;
  const stepBtn = (disabled: boolean): CSSProperties => ({
    ...btn.ghost(),
    fontSize: 16,
    padding: '2px 12px',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => onAdjust(-1)} disabled={atMin} style={stepBtn(atMin)} aria-label="decrease">
        −
      </button>
      <span
        style={{
          fontFamily: theme.headingFont,
          fontSize: 20,
          color: theme.accent,
          minWidth: 34,
          textAlign: 'center',
        }}
      >
        {value}
        {label ? <span style={{ fontSize: 11, color: theme.muted }}> {label}</span> : null}
      </span>
      <button onClick={() => onAdjust(1)} disabled={atMax} style={stepBtn(atMax)} aria-label="increase">
        +
      </button>
    </div>
  );
}

const kicker: CSSProperties = {
  fontFamily: theme.headingFont,
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: theme.muted,
};

const hint: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: 12,
  lineHeight: 1.45,
  color: theme.muted,
};
