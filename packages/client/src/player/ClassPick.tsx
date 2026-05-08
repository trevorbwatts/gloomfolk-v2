import { bruiser, silentKnife } from '@gloomfolk/shared';
import type { CharacterClass } from '@gloomfolk/shared';

const CLASSES: readonly { class: CharacterClass; tagline: string }[] = [
  {
    class: bruiser,
    tagline: 'Tanky front-liner who pushes, pulls, and holds the line.',
  },
  {
    class: silentKnife,
    tagline: 'Nimble striker who flanks, hides, and pockets gold.',
  },
];

export function ClassPick({
  onPick,
}: {
  onPick: (classId: string) => void;
}) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Pick a character</h2>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: -8 }}>
        Tap a class to start building your hand. You can come back and pick a
        different class until you lock in.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginTop: 16,
        }}
      >
        {CLASSES.map(({ class: cls, tagline }) => (
          <button
            key={cls.id}
            onClick={() => onPick(cls.id)}
            style={{
              textAlign: 'left',
              background: '#1c1c20',
              color: '#eee',
              border: '2px solid #444',
              borderRadius: 8,
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600 }}>{cls.name}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, opacity: 0.85 }}>
              <span>HP {cls.hp[1]}</span>
              <span>Hand {cls.handSize}</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
              {tagline}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
