import { useMemo, useState, type CSSProperties } from 'react';
import {
  eligibleLevelUpCards,
  experienceRequirementByLevel,
  perkMarksCommitted,
  type CharacterClass,
  type CharacterInstance,
  type CharacterLevel,
} from '@gloomfolk/shared';
import { CardView } from './CardView.js';
import { btn, theme } from '../theme.js';
import { BOTTOM_BAR_HEIGHT } from './BottomBar.js';

/**
 * Downtime level-up flow (docs/rules/level-up.md). Shown in the lobby when
 * the character's XP has met the next level's requirement — leveling is
 * mandatory, so this renders instead of the pick-cards/shop steps until the
 * player confirms. Choose one new ability card for the pool and one perk box
 * to mark, then confirm.
 *
 * With `optional` (the prosperity catch-up), the same flow is player-invoked
 * instead of forced: a Not-now button appears, and the copy explains that XP
 * jumps to the new level's requirement.
 */
export function LevelUpPanel({
  character,
  characterClass,
  optional = false,
  onCancel,
  onConfirm,
}: {
  character: CharacterInstance;
  characterClass: CharacterClass;
  optional?: boolean;
  onCancel?: () => void;
  onConfirm: (cardId: string, perkIndex: number) => void;
}) {
  const newLevel = character.level + 1;
  const oldHp = characterClass.hp[character.level as CharacterLevel];
  const newHp = characterClass.hp[newLevel as CharacterLevel];
  const newXp = experienceRequirementByLevel[newLevel as CharacterLevel];

  const cards = useMemo(
    () => eligibleLevelUpCards(characterClass, character.pool, newLevel),
    [characterClass, character.pool, newLevel],
  );

  const [chosenCardId, setChosenCardId] = useState<string | null>(null);
  const [chosenPerkIndex, setChosenPerkIndex] = useState<number | null>(null);
  const ready = chosenCardId !== null && chosenPerkIndex !== null;

  return (
    <div style={{ paddingTop: 12, paddingBottom: 80 + BOTTOM_BAR_HEIGHT }}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontFamily: theme.headingFont,
          color: theme.accent,
          fontWeight: 500,
          letterSpacing: 0.5,
        }}
      >
        Level Up! {character.level} → {newLevel}
      </h2>
      <p style={{ color: theme.muted, fontSize: 13, marginTop: 6 }}>
        {optional
          ? `Gloomhaven's prosperity lets ${character.name} reach level ` +
            `${newLevel} without the experience requirement — experience ` +
            `will be set to ${newXp}. Max hit points rise from ${oldHp} to ` +
            `${newHp}. Pick one new ability card for your pool and mark one ` +
            `perk.`
          : `${character.name} has enough experience to reach level ` +
            `${newLevel}. Max hit points rise from ${oldHp} to ${newHp}. ` +
            `Pick one new ability card for your pool and mark one perk.`}
      </p>

      <h3 style={sectionHeadingStyle}>1 · Add an ability card</h3>
      <p style={{ color: theme.muted, fontSize: 12, marginTop: 0 }}>
        The card joins your pool — your hand size stays {characterClass.handSize},
        but you have more cards to choose from when building a hand.
      </p>
      {cards.map((card) => (
        <CardView
          key={card.id}
          card={card}
          selected={chosenCardId === card.id}
          onClick={() =>
            setChosenCardId((prev) => (prev === card.id ? null : card.id))
          }
        />
      ))}
      {cards.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 13 }}>
          No new cards available at this level.
        </p>
      )}

      <h3 style={sectionHeadingStyle}>2 · Mark a perk</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {characterClass.perks.map((perk, i) => {
          const taken = perkMarksCommitted(character.perksUnlocked, i);
          const max = perk.slots.count;
          const linked = perk.slots.kind === 'linked';
          const full = taken >= max;
          const selected = chosenPerkIndex === i;
          return (
            <li key={perk.id}>
              <button
                disabled={full}
                onClick={() => setChosenPerkIndex(selected ? null : i)}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: '10px 8px',
                  width: '100%',
                  textAlign: 'left',
                  background: selected ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: selected
                    ? `1px solid ${theme.accent}`
                    : `1px solid transparent`,
                  borderBottom: selected
                    ? `1px solid ${theme.accent}`
                    : `1px solid ${theme.border}`,
                  borderRadius: 4,
                  cursor: full ? 'default' : 'pointer',
                  color: 'inherit',
                  font: 'inherit',
                }}
              >
                <span style={{ display: 'flex', gap: 4, paddingTop: 3, flexShrink: 0 }}>
                  {Array.from({ length: max }).map((_, b) => {
                    const checked = b < taken;
                    // Preview the new mark on the selected perk's next box.
                    const pending = selected && b === taken;
                    return (
                      <span
                        key={b}
                        style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          border: `1px solid ${
                            checked || pending ? theme.accent : theme.border
                          }`,
                          background: checked
                            ? theme.accent
                            : pending
                              ? 'rgba(255,255,255,0.25)'
                              : 'transparent',
                          borderRadius: linked ? '50%' : 2,
                        }}
                      />
                    );
                  })}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: full ? theme.muted : theme.text,
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  {perk.text}
                  {linked && max > 1 && (
                    <span style={{ color: theme.muted }}>
                      {' '}
                      (needs all {max} marks)
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          position: 'fixed',
          bottom: BOTTOM_BAR_HEIGHT,
          left: 0,
          right: 0,
          background: theme.bgSolid,
          padding: '8px 16px',
          borderTop: `1px solid ${theme.border}`,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {optional && onCancel && (
            <button
              onClick={onCancel}
              style={{
                ...btn.ghost(),
                fontSize: 15,
                padding: '10px 16px',
                flexShrink: 0,
              }}
            >
              Not now
            </button>
          )}
          <button
            onClick={() => {
              if (ready) onConfirm(chosenCardId, chosenPerkIndex);
            }}
            disabled={!ready}
            style={{
              ...btn.primary(!ready),
              flex: 1,
              fontSize: 15,
              padding: '10px 16px',
            }}
          >
            Confirm — reach level {newLevel}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: theme.muted,
  fontFamily: theme.headingFont,
  margin: '20px 0 4px',
};
