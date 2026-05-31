import { useState } from 'react';
import { getBattleGoal } from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';

/**
 * Secret battle-goal pick shown at scenario start: three dealt goals, keep one.
 * Renders nothing once a goal is chosen.
 */
export function BattleGoalPicker({
  dealtGoalIds,
  onChoose,
}: {
  dealtGoalIds: readonly string[];
  onChoose: (goalId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  return (
    <div style={{ marginBottom: 24 }}>
      <h1
        style={{
          marginTop: 6,
          marginBottom: 4,
          fontWeight: 500,
          fontSize: 24,
          fontFamily: theme.headingFont,
          color: theme.accent,
          letterSpacing: 0.5,
        }}
      >
        Choose a battle goal
      </h1>
      <p
        style={{
          color: theme.muted,
          fontFamily: theme.font,
          fontSize: 13,
          margin: '0 0 16px',
          lineHeight: 1.4,
        }}
      >
        Keep one in secret. You earn its checkmarks only if you complete the
        scenario.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dealtGoalIds.map((id) => {
          const goal = getBattleGoal(id);
          if (!goal) return null;
          const isPending = pendingId === id;
          return (
            <button
              key={id}
              onClick={() => setPendingId(id)}
              style={{
                textAlign: 'left',
                background: isPending ? theme.panelRaised : theme.panel,
                border: `1px solid ${isPending ? theme.accent : theme.border}`,
                borderRadius: 6,
                padding: '14px 16px',
                cursor: 'pointer',
                color: theme.text,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.headingFont,
                    fontSize: 16,
                    color: theme.accent,
                    letterSpacing: 0.5,
                  }}
                >
                  {goal.title}
                </span>
                <span style={{ fontSize: 12, color: theme.muted }}>
                  {typeof goal.checkmarks === 'number'
                    ? `${goal.checkmarks} ✓`
                    : 'varies ✓'}
                </span>
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontFamily: theme.font,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {goal.description}
              </p>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={pendingId === null}
        onClick={() => {
          if (pendingId !== null) onChoose(pendingId);
        }}
        style={{
          ...btn.primary(pendingId === null),
          width: '100%',
          marginTop: 16,
          padding: '12px 18px',
          fontSize: 15,
        }}
      >
        {pendingId === null ? 'Select a battle goal' : 'Confirm battle goal'}
      </button>
    </div>
  );
}
