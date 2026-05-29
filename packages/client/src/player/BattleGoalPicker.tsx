import { getBattleGoal } from '@gloomfolk/shared';
import { theme } from '../theme.js';

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
      <p style={{ color: theme.muted, fontSize: 13, margin: '0 0 16px', lineHeight: 1.4 }}>
        Keep one in secret. You earn its checkmarks only if you complete the
        scenario.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {dealtGoalIds.map((id) => {
          const goal = getBattleGoal(id);
          if (!goal) return null;
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              style={{
                textAlign: 'left',
                background: theme.panel,
                border: `1px solid ${theme.border}`,
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
              <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.4 }}>
                {goal.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
