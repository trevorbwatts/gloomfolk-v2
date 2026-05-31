import { type CSSProperties, type ReactNode, useState } from 'react';
import type {
  CharacterClass,
  CharacterInstance,
  Item,
  ModifierCard,
  ModifierCardInstance,
  MonsterStatCard,
  PrivatePlayerState,
  PublicGameState,
  Unit,
} from '@gloomfolk/shared';
import {
  ALL_ITEMS,
  banditArcher,
  banditScout,
  getBattleGoal,
  getScenario,
  modifierLabel,
} from '@gloomfolk/shared';
import { btn, theme } from '../theme.js';
import { clearSession } from '../net/useSocket.js';
import { useStore } from '../store.js';
import { CardsOverview } from './Hand.js';
import { GameIcon, type IconKey } from '../icons.js';

export const BOTTOM_BAR_HEIGHT = 52;
export const PLAYER_HEADER_HEIGHT = 41;

export type TabId = 'play' | 'scenario' | 'character';
type CharacterTabId = 'sheet' | 'items' | 'cards' | 'modifiers';

const MONSTER_DEFS: Record<string, MonsterStatCard | undefined> = {
  'bandit-archer': banditArcher,
  'bandit-scout': banditScout,
};

export function BottomBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'play', label: 'Play', icon: <PlayIcon /> },
    { id: 'scenario', label: 'Scenario', icon: <ScenarioIcon /> },
    { id: 'character', label: 'Character', icon: <CharacterIcon /> },
  ];

  return (
    <nav
      aria-label="Player menu"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: BOTTOM_BAR_HEIGHT,
        background: theme.bgSolid,
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        zIndex: 60,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(t.id)}
            title={t.label}
            style={{
              flex: 1,
              background: isActive ? theme.panelRaised : 'transparent',
              color: isActive ? theme.accent : theme.muted,
              border: 'none',
              borderTop: `2px solid ${isActive ? theme.accent : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {t.icon}
          </button>
        );
      })}
    </nav>
  );
}

export function PlayerHeader({
  character,
  unit,
  title,
  gold,
}: {
  character: CharacterInstance | null;
  unit?: Unit | null;
  title?: string;
  /** When set, show the character's gold on the right of the bar (used during
   *  the pre-scenario shopping step). */
  gold?: number;
}) {
  const showStats = !title && !!character;
  return (
    <header
      style={{
        // Sticky behavior lives on a wrapper in PlayerScreen so the ActiveArea
        // can pin directly below this header as one cohesive top region.
        background: theme.bgSolid,
        padding: '0 16px 12px',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: theme.headingFont,
          color: theme.accent,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 0.5,
        }}
      >
        {title ?? character?.name ?? ''}
      </h1>
      {showStats && unit && <UnitStatusStrip unit={unit} />}
      {gold != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 18, fontFamily: theme.headingFont, color: '#d9a441', fontWeight: 600 }}>
            {gold}
          </span>
          <span style={{ fontSize: 12, color: '#d9a441', fontWeight: 600 }}>G</span>
        </div>
      )}
    </header>
  );
}

function UnitStatusStrip({ unit }: { unit: Unit }) {
  const conditionCounts = new Map<IconKey, number>();
  for (const c of unit.conditions) {
    conditionCounts.set(c.kind, (conditionCounts.get(c.kind) ?? 0) + 1);
  }
  const lowHp = unit.hp / Math.max(1, unit.hpMax) <= 0.34;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          color: lowHp ? theme.bad : theme.text,
          fontFamily: theme.headingFont,
          letterSpacing: 0.5,
        }}
      >
        HP {unit.hp}/{unit.hpMax}
      </span>
      {unit.shield > 0 && (
        <StatusChip>
          <GameIcon kind="shield" size={14} />
          <span>{unit.shield}</span>
        </StatusChip>
      )}
      {unit.retaliate.map((band) => (
        <StatusChip key={band.range}>
          <GameIcon kind="retaliate" size={14} />
          <span>
            {band.amount}
            {band.range > 1 && (
              <span style={{ color: theme.muted }}> r{band.range}</span>
            )}
          </span>
        </StatusChip>
      ))}
      {unit.invisible && (
        <StatusChip>
          <GameIcon kind="invisible" size={14} />
        </StatusChip>
      )}
      {[...conditionCounts.entries()].map(([kind, count]) => (
        <StatusChip key={kind}>
          <GameIcon kind={kind} size={14} />
          {count > 1 && <span>{count}</span>}
        </StatusChip>
      ))}
    </div>
  );
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: theme.text,
      }}
    >
      {children}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p style={{ color: theme.muted, fontSize: 13, textAlign: 'center', margin: '24px 0' }}>
      {text}
    </p>
  );
}

function ModifiersPanel({ you }: { you: PrivatePlayerState }) {
  const deckGroups = groupByLabel(you.modifierDeck);
  const discardGroups = groupByLabel(you.modifierDiscard);
  return (
    <div>
      <SectionTitle>In deck · {you.modifierDeck.length}</SectionTitle>
      {deckGroups.length === 0 ? (
        <EmptyHint text="Deck is empty — reshuffle pending." />
      ) : (
        <ModifierGrid groups={deckGroups} />
      )}
      <div style={{ height: 16 }} />
      <SectionTitle>Discarded · {you.modifierDiscard.length}</SectionTitle>
      {discardGroups.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: 13, margin: '4px 0' }}>—</p>
      ) : (
        <ModifierGrid groups={discardGroups} muted />
      )}
      {you.modifierNeedsReshuffle && (
        <p
          style={{
            marginTop: 16,
            padding: '8px 10px',
            color: theme.accent,
            background: 'rgba(217, 164, 65, 0.10)',
            border: `1px solid ${theme.accent}`,
            borderRadius: 4,
            fontSize: 12,
            letterSpacing: 0.5,
          }}
        >
          Deck reshuffles at end of turn.
        </p>
      )}
    </div>
  );
}

export function CharacterPanel({
  you,
  character,
  characterClass,
}: {
  you: PrivatePlayerState | null;
  character: CharacterInstance | null;
  characterClass: CharacterClass | null;
}) {
  const [sub, setSub] = useState<CharacterTabId>('sheet');
  const subTabs: { id: CharacterTabId; label: string }[] = [
    { id: 'sheet', label: 'Sheet' },
    { id: 'items', label: 'Items' },
    { id: 'cards', label: 'Cards' },
    { id: 'modifiers', label: 'Mod' },
  ];

  return (
    <div>
      <div
        style={{
          position: 'sticky',
          top: PLAYER_HEADER_HEIGHT,
          zIndex: 40,
          background: theme.bgSolid,
          marginTop: -16,
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <div
          role="tablist"
          aria-label="Character sections"
          style={{
            display: 'flex',
            gap: 2,
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: 2,
          }}
        >
          {subTabs.map((t) => {
            const isActive = sub === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSub(t.id)}
                style={{
                  flex: 1,
                  background: isActive ? theme.panelRaised : 'transparent',
                  color: isActive ? theme.accent : theme.muted,
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 4px',
                  fontFamily: theme.headingFont,
                  fontSize: 12,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {sub === 'sheet' &&
        (character && characterClass ? (
          <SheetPanel character={character} characterClass={characterClass} />
        ) : (
          <EmptyHint text="No character yet." />
        ))}
      {sub === 'items' &&
        (character ? (
          <ItemsPanel character={character} />
        ) : (
          <EmptyHint text="No character yet." />
        ))}
      {sub === 'cards' &&
        (you ? <CardsOverview you={you} /> : <EmptyHint text="No hand yet." />)}
      {sub === 'modifiers' &&
        (you ? (
          <ModifiersPanel you={you} />
        ) : (
          <EmptyHint text="No modifier deck yet." />
        ))}
    </div>
  );
}

function SheetPanel({
  character,
  characterClass,
}: {
  character: CharacterInstance;
  characterClass: CharacterClass;
}) {
  const level = Math.max(1, Math.min(9, character.level)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  const maxHp = characterClass.hp[level];
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <div>
      <div style={cardStyle()}>
        <div
          style={{
            fontFamily: theme.headingFont,
            color: theme.accent,
            fontSize: 20,
            letterSpacing: 0.5,
            marginBottom: 2,
          }}
        >
          {character.name}
        </div>
        <div style={{ color: theme.muted, fontSize: 12, letterSpacing: 0.5 }}>
          {characterClass.name}
        </div>
      </div>

      <div style={{ height: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatTile label="Level" value={String(character.level)} />
        <StatTile label="Max HP" value={String(maxHp)} />
        <StatTile label="XP" value={String(character.xp)} />
        <StatTile label="Gold" value={String(character.gold)} accent="#d9a441" />
      </div>

      <div style={{ height: 32 }} />
      <SectionTitle>Perks</SectionTitle>
      <PerksList character={character} characterClass={characterClass} />
      <BattleGoalCheckmarks count={character.battleGoalCheckmarks} />

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${theme.border}` }}>
        {confirmLeave ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: theme.text, fontSize: 13, margin: 0 }}>
              Leave the campaign? You'll drop out of the scenario.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  useStore.setState({
                    role: null,
                    playerId: null,
                    campaignId: null,
                    gameState: null,
                    you: null,
                  });
                }}
                style={{
                  ...btn.outline(),
                  color: theme.bad,
                  borderColor: theme.bad,
                }}
              >
                Yes, leave
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                style={btn.ghost()}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            style={btn.ghost()}
          >
            Leave campaign
          </button>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={cardStyle()}>
      <div
        style={{
          color: theme.muted,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: theme.headingFont,
          color: accent ?? theme.text,
          fontSize: 24,
          letterSpacing: 0.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PerksList({
  character,
  characterClass,
}: {
  character: CharacterInstance;
  characterClass: CharacterClass;
}) {
  if (characterClass.perks.length === 0) {
    return <p style={{ color: theme.muted, fontSize: 13 }}>—</p>;
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {characterClass.perks.map((perk, i) => {
        const taken = character.perksUnlocked.filter((idx) => idx === i).length;
        const max = perk.slots.count;
        const linked = perk.slots.kind === 'linked';
        const isUnlocked = linked ? taken >= max : taken > 0;
        return (
          <li
            key={perk.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '10px 0',
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: 'flex', gap: 4, paddingTop: 3, flexShrink: 0 }}>
              {Array.from({ length: max }).map((_, b) => {
                const checked = b < taken;
                return (
                  <span
                    key={b}
                    aria-label={checked ? 'checked' : 'unchecked'}
                    style={{
                      display: 'inline-block',
                      width: 14,
                      height: 14,
                      border: `1px solid ${checked ? theme.accent : theme.border}`,
                      background: checked ? theme.accent : 'transparent',
                      borderRadius: linked ? '50%' : 2,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                flex: 1,
                color: isUnlocked ? theme.text : theme.muted,
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {perk.text}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Lifetime battle-goal checkmark tracker: 18 boxes in six groups of three.
 *  Every completed group of three grants one extra perk mark (capped at +6). */
function BattleGoalCheckmarks({ count }: { count: number }) {
  const TOTAL = 18;
  const GROUP = 3;
  const filled = Math.min(count, TOTAL);
  const perkMarks = Math.floor(filled / GROUP);
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          color: theme.muted,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Battle Goals — {perkMarks} perk {perkMarks === 1 ? 'mark' : 'marks'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: TOTAL / GROUP }).map((_, g) => (
          <div key={g} style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: GROUP }).map((_, b) => {
              const idx = g * GROUP + b;
              const checked = idx < filled;
              return (
                <span
                  key={b}
                  aria-label={checked ? 'checked' : 'unchecked'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    border: `1px solid ${checked ? theme.accent : theme.border}`,
                    background: checked ? theme.accent : 'transparent',
                    borderRadius: 3,
                    color: '#0e1612',
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  {checked ? '✓' : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScenarioPanel({
  gameState,
  you,
}: {
  gameState: PublicGameState | null;
  you?: PrivatePlayerState | null;
}) {
  if (!gameState || !gameState.scenarioId) {
    return <EmptyHint text="No scenario active." />;
  }
  const scenario = getScenario(gameState.scenarioId);
  const revealedMonsters = uniqueMonsters(gameState.units);
  const level = gameState.scenarioLevel;
  const chosenGoal =
    you?.battleGoal?.chosenGoalId != null
      ? getBattleGoal(you.battleGoal.chosenGoalId)
      : null;
  const results = gameState.battleGoalResults;
  return (
    <div>
      <SectionTitle>Objective</SectionTitle>
      <p style={{ color: theme.text, fontSize: 14, margin: '0 0 6px', lineHeight: 1.4 }}>
        {scenario?.objective ?? '—'}
      </p>
      {gameState.scenarioName && (
        <p style={{ color: theme.muted, fontSize: 12, margin: 0, letterSpacing: 0.3 }}>
          {gameState.scenarioName}
        </p>
      )}

      <div style={{ height: 24 }} />
      <SectionTitle>Your battle goal</SectionTitle>
      {chosenGoal ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <GoalStatusBox status={you?.battleGoal?.chosenGoalStatus ?? 'pending'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: theme.accent, fontSize: 14, margin: '0 0 2px', fontFamily: theme.headingFont, letterSpacing: 0.5 }}>
              {chosenGoal.title}
            </p>
            <p style={{ color: theme.text, fontSize: 13, margin: 0, lineHeight: 1.4 }}>
              {chosenGoal.description}
            </p>
          </div>
        </div>
      ) : (
        <p style={{ color: theme.muted, fontSize: 13, margin: 0, lineHeight: 1.4 }}>
          {you?.battleGoal?.dealtGoalIds?.length
            ? 'Choose a battle goal to begin.'
            : 'No battle goal this scenario.'}
        </p>
      )}

      {results && results.length > 0 && (
        <>
          <div style={{ height: 24 }} />
          <SectionTitle>Battle goal results</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r) => (
              <div key={r.characterId} style={cardStyle()}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <GoalStatusBox status={r.achieved ? 'achieved' : 'failed'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 13, color: r.achieved ? theme.good : theme.text }}>
                      {r.title}
                      {r.checkmarks > 0 ? ` (+${r.checkmarks})` : ''}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: theme.muted, lineHeight: 1.4 }}>
                      {r.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 24 }} />
      <SectionTitle>Monsters revealed</SectionTitle>
      {revealedMonsters.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>—</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {revealedMonsters.map((defId) => (
            <MonsterStatRow key={defId} defId={defId} level={level} />
          ))}
        </div>
      )}
    </div>
  );
}

type GoalStatus = 'achieved' | 'failed' | 'pending';

/** A small checkbox showing a battle-goal status: a green box with a checkmark
 *  when achieved, a red box with an X when failed, or an empty box while still
 *  pending (not yet met but still possible). */
function GoalStatusBox({ status }: { status: GoalStatus }) {
  const color =
    status === 'achieved' ? theme.good : status === 'failed' ? theme.bad : theme.border;
  const symbol = status === 'achieved' ? '✓' : status === 'failed' ? '✗' : '';
  const label =
    status === 'achieved'
      ? 'Battle goal achieved'
      : status === 'failed'
        ? 'Battle goal failed'
        : 'Battle goal in progress';
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: 4,
        border: `2px solid ${color}`,
        background: status === 'pending' ? 'transparent' : `${color}22`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {symbol}
    </span>
  );
}

function uniqueMonsters(units: readonly Unit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of units) {
    if (u.kind !== 'monster') continue;
    if (seen.has(u.defId)) continue;
    seen.add(u.defId);
    out.push(u.defId);
  }
  return out;
}

function MonsterStatRow({ defId, level }: { defId: string; level: number }) {
  const def = MONSTER_DEFS[defId];
  if (!def) {
    return (
      <div style={cardStyle()}>
        <span style={{ color: theme.text, fontSize: 14 }}>{defId}</span>
      </div>
    );
  }
  const clamped = (Math.max(0, Math.min(7, level)) | 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const ranked = def.levels[clamped];
  return (
    <div style={cardStyle()}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            color: theme.accent,
            fontSize: 15,
            fontFamily: theme.headingFont,
            letterSpacing: 0.5,
          }}
        >
          {def.name}
        </span>
        <span style={{ color: theme.muted, fontSize: 11, letterSpacing: 0.5 }}>
          Lv {clamped}
        </span>
      </div>
      {ranked ? (
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 4, fontSize: 12 }}>
          <span style={{ color: theme.muted }} />
          <span style={statHeadStyle()}>HP</span>
          <span style={statHeadStyle()}>Move</span>
          <span style={statHeadStyle()}>Atk</span>
          <span style={{ color: theme.muted }}>Normal</span>
          <span style={statValStyle()}>{ranked.normal.hp}</span>
          <span style={statValStyle()}>{ranked.normal.movement}</span>
          <span style={statValStyle()}>{ranked.normal.attack}</span>
          <span style={{ color: theme.muted }}>Elite</span>
          <span style={statValStyle()}>{ranked.elite.hp}</span>
          <span style={statValStyle()}>{ranked.elite.movement}</span>
          <span style={statValStyle()}>{ranked.elite.attack}</span>
        </div>
      ) : (
        <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>
          No stats at this level.
        </p>
      )}
      {def.immunities && def.immunities.length > 0 && (
        <p
          style={{
            color: theme.muted,
            fontSize: 11,
            margin: '10px 0 0',
            paddingTop: 8,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          Immune: {def.immunities.join(', ')}
        </p>
      )}
    </div>
  );
}

function cardStyle(): CSSProperties {
  return {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    padding: 14,
  };
}

function statHeadStyle(): CSSProperties {
  return {
    color: theme.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  };
}

function statValStyle(): CSSProperties {
  return {
    color: theme.text,
    fontFamily: theme.headingFont,
    fontSize: 14,
  };
}

interface ModifierGroup {
  label: string;
  card: ModifierCard;
  count: number;
}

function groupByLabel(cards: readonly ModifierCardInstance[]): ModifierGroup[] {
  const map = new Map<string, ModifierGroup>();
  for (const ci of cards) {
    const label = modifierLabel(ci.card);
    const existing = map.get(label);
    if (existing) existing.count += 1;
    else map.set(label, { label, card: ci.card, count: 1 });
  }
  const order = ['×2', '+2', '+1', '+0', '−1', '−2', 'Null'];
  return [...map.values()].sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function ModifierGrid({ groups, muted }: { groups: ModifierGroup[]; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {groups.map((g) => (
        <div
          key={g.label}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <ModifierCardFace label={g.label} card={g.card} muted={!!muted} />
          <span
            style={{
              fontFamily: theme.headingFont,
              color: theme.text,
              fontSize: 16,
              opacity: muted ? 0.7 : 1,
            }}
          >
            ×{g.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModifierCardFace({
  label,
  card,
  muted,
}: {
  label: string;
  card: ModifierCard;
  muted: boolean;
}) {
  const isCrit = card.kind === 'crit';
  const isNull = card.kind === 'null';
  const accent = isCrit ? theme.accent : isNull ? theme.bad : theme.border;
  return (
    <div
      style={{
        width: 56,
        height: 78,
        background: theme.panelRaised,
        border: `2px solid ${accent}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontFamily: theme.headingFont,
        fontSize: label.length > 2 ? 16 : 24,
        color: isCrit ? theme.accent : isNull ? theme.bad : theme.text,
        opacity: muted ? 0.55 : 1,
      }}
    >
      {label}
    </div>
  );
}

const ITEM_SLOT_LABELS: Record<string, string> = {
  head: 'Head',
  body: 'Body',
  feet: 'Feet',
  'one-hand': 'One Hand',
  'two-hands': 'Two Hands',
  small: 'Small Item',
};

function ItemsPanel({ character }: { character: CharacterInstance }) {
  const items = character.ownedItemIds
    .map((id) => ALL_ITEMS[id])
    .filter((item): item is NonNullable<typeof item> => item != null);

  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 8px', textAlign: 'center' }}>
        <p style={{ color: theme.text, fontSize: 14, margin: '0 0 8px' }}>No items.</p>
        <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>
          This character doesn't own any items yet.
        </p>
      </div>
    );
  }

  const brought = items.filter((item) => character.broughtItemIds.includes(item.id));
  const didntBring = items.filter((item) => !character.broughtItemIds.includes(item.id));

  // Only split into labeled sections when there's something in "Didn't Bring".
  // Otherwise show a single flat list with no headings.
  if (didntBring.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {brought.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ItemGroup heading="Brought" items={brought} />
      <ItemGroup heading="Didn't Bring" items={didntBring} />
    </div>
  );
}

function ItemGroup({
  heading,
  items,
}: {
  heading: string;
  items: Item[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          color: theme.muted,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          fontFamily: theme.headingFont,
        }}
      >
        {heading}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  return (
    <div
      style={{
        padding: 10,
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{item.name}</strong>
        <span style={{ fontSize: 10, color: theme.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          {ITEM_SLOT_LABELS[item.slot] ?? item.slot}
        </span>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: theme.muted }}>
        {item.description}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        margin: '0 0 10px',
        fontFamily: theme.headingFont,
        color: theme.muted,
        fontSize: 11,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        fontWeight: 500,
      }}
    >
      {children}
    </h3>
  );
}

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PlayIcon() {
  // Lucide: sword
  return (
    <IconWrap>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
    </IconWrap>
  );
}

function ScenarioIcon() {
  // Newspaper
  return (
    <IconWrap>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <line x1="7" y1="9" x2="14" y2="9" />
      <line x1="7" y1="12" x2="14" y2="12" />
      <line x1="7" y1="15" x2="11" y2="15" />
    </IconWrap>
  );
}

function CharacterIcon() {
  return (
    <IconWrap>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </IconWrap>
  );
}
