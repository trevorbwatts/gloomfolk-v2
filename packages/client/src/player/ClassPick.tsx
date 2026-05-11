import { bruiser, silentKnife } from '@gloomfolk/shared';
import type { CharacterClass } from '@gloomfolk/shared';
import { classAvatarUrl, onAvatarError } from '../avatars.js';
import { theme } from '../theme.js';

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
      <h2 style={{ marginTop: 0, fontFamily: theme.headingFont, color: theme.accent, fontWeight: 500 }}>
        Pick a character
      </h2>
      <p style={{ color: theme.muted, fontSize: 13, marginTop: -8 }}>
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
              background: theme.panel,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontFamily: theme.font,
            }}
          >
            <img
              src={classAvatarUrl(cls.id)}
              onError={onAvatarError}
              alt=""
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                borderRadius: 6,
                background: theme.bgSolid,
              }}
            />
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: theme.headingFont, color: theme.accent }}>{cls.name}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: theme.muted }}>
              <span>HP {cls.hp[1]}</span>
              <span>Hand {cls.handSize}</span>
            </div>
            <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.4 }}>
              {tagline}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
