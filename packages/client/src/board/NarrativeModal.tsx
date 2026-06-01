import type { NarrativeEntry } from '@gloomfolk/shared';
import { theme } from '../theme.js';

/**
 * Full-screen story-text modal shown to every player when the scenario fires
 * narrative (the intro, a door's section text, victory/defeat). Dismissing it
 * tells the server to advance the narrative queue.
 */
export function NarrativeModal({
  entry,
  onDismiss,
}: {
  entry: NarrativeEntry;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: theme.panel,
          border: `1px solid ${theme.accent}`,
          borderRadius: 8,
          padding: '28px 28px 24px',
          maxWidth: 560,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        }}
      >
        <h2
          style={{
            margin: '0 0 16px',
            fontFamily: theme.headingFont,
            fontWeight: 500,
            fontSize: 24,
            letterSpacing: 0.5,
            color: theme.accent,
          }}
        >
          {entry.title}
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 16,
            lineHeight: 1.6,
            color: theme.text,
            whiteSpace: 'pre-wrap',
          }}
        >
          {entry.body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              fontSize: 15,
              padding: '10px 24px',
              background: theme.accent,
              color: '#0e1612',
              border: 'none',
              borderRadius: 3,
              fontFamily: theme.headingFont,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
