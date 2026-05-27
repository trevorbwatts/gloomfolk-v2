import type {
  CharacterInstance,
  LobbyPlayer,
  MonsterAbilityCard,
  MonsterAbilityStep,
  MonsterStatCard,
  TurnOrderEntry,
  Unit,
} from '@gloomfolk/shared';
import { archerDeck, banditArcher, banditScout, scoutDeck } from '@gloomfolk/shared';
import { Fragment, type ReactNode } from 'react';
import { classAvatarUrl, monsterAvatarUrl, onAvatarError } from '../avatars.js';
import { theme } from '../theme.js';

const SET_AVATAR_DEFID: Record<string, string> = {
  archer: 'bandit-archer',
  scout: 'bandit-scout',
};

const SET_NAMES: Record<string, string> = {
  archer: 'Bandit Archers',
  scout: 'Bandit Scouts',
};

const STAT_CARDS_BY_DEFID: Record<string, MonsterStatCard> = {
  'bandit-archer': banditArcher,
  'bandit-scout': banditScout,
};

const CARD_BY_ID: Map<string, MonsterAbilityCard> = (() => {
  const m = new Map<string, MonsterAbilityCard>();
  for (const deck of [archerDeck, scoutDeck]) {
    for (const c of deck.cards) m.set(c.id, c);
  }
  return m;
})();

const ELITE_COLOR = '#ffd84d';

type RankedBase = { normal: number | null; elite: number | null };

function ranksInSet(setId: string, units: readonly Unit[]): { normal: boolean; elite: boolean } {
  let normal = false;
  let elite = false;
  for (const u of units) {
    if (u.kind !== 'monster') continue;
    const def = STAT_CARDS_BY_DEFID[u.defId];
    if (!def || def.setId !== setId) continue;
    // Unit doesn't carry rank yet; treat every spawned monster as normal.
    // When elite spawning is added, set `elite = true` for those units here.
    normal = true;
  }
  return { normal, elite };
}

function baseStat(
  setId: string,
  units: readonly Unit[],
  scenarioLevel: number,
  pick: (b: { hp: number; movement: number; attack: number }) => number,
): RankedBase {
  const ranks = ranksInSet(setId, units);
  // Find any stat card belonging to this set among units in play.
  let def: MonsterStatCard | undefined;
  for (const u of units) {
    if (u.kind !== 'monster') continue;
    const d = STAT_CARDS_BY_DEFID[u.defId];
    if (d && d.setId === setId) {
      def = d;
      break;
    }
  }
  const level = def?.levels[scenarioLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7];
  return {
    normal: ranks.normal && level ? pick(level.normal) : null,
    elite: ranks.elite && level ? pick(level.elite) : null,
  };
}

function resolved(base: RankedBase, modifier: number): RankedBase {
  return {
    normal: base.normal == null ? null : Math.max(0, base.normal + modifier),
    elite: base.elite == null ? null : Math.max(0, base.elite + modifier),
  };
}

function RankedValue({ value }: { value: RankedBase }) {
  const parts: ReactNode[] = [];
  if (value.normal != null) parts.push(<span key="n">{value.normal}</span>);
  if (value.elite != null) {
    if (parts.length) parts.push(<span key="sep"> / </span>);
    parts.push(
      <span key="e" style={{ color: ELITE_COLOR }}>
        {value.elite}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <>{parts}</>;
}

function renderStep(
  step: MonsterAbilityStep,
  setId: string,
  units: readonly Unit[],
  scenarioLevel: number,
): ReactNode {
  switch (step.kind) {
    case 'move': {
      const base = baseStat(setId, units, scenarioLevel, (b) => b.movement);
      const value = resolved(base, step.modifier);
      const traits = step.traits?.length ? ` (${step.traits.join(', ')})` : '';
      return (
        <>
          Move <RankedValue value={value} />
          {traits}
        </>
      );
    }
    case 'attack': {
      const base = baseStat(setId, units, scenarioLevel, (b) => b.attack);
      const value = resolved(base, step.modifier);
      const tail: string[] = [];
      if (step.range != null) tail.push(`Range ${step.range}`);
      if (step.targets != null) tail.push(`Target ${step.targets}`);
      if (step.effects?.length) {
        for (const e of step.effects) tail.push(e.condition);
      }
      return (
        <>
          Attack <RankedValue value={value} />
          {tail.length > 0 && ` · ${tail.join(' · ')}`}
        </>
      );
    }
    case 'loot':
      return `Loot ${step.range}`;
    case 'create-trap':
      return `Place trap (${step.damage} dmg)`;
    case 'infuse':
      return `Infuse ${step.element}`;
    case 'consume': {
      const eff = step.effect;
      const label =
        eff.kind === 'attack-bonus'
          ? `Attack ${eff.amount >= 0 ? `+${eff.amount}` : eff.amount}`
          : eff.kind === 'range-bonus'
            ? `Range ${eff.amount >= 0 ? `+${eff.amount}` : eff.amount}`
            : `Shield ${eff.amount >= 0 ? `+${eff.amount}` : eff.amount}`;
      return `Consume ${step.element} → ${label}`;
    }
  }
}

export function TurnOrder({
  order,
  activeIndex,
  players,
  characters,
  units,
  scenarioLevel,
  round,
}: {
  order: TurnOrderEntry[];
  activeIndex: number;
  players: LobbyPlayer[];
  characters: CharacterInstance[];
  units: Unit[];
  scenarioLevel: number;
  round: number;
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
        Round {round}
      </div>
      {order.length === 0 && (
        <div
          style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: theme.muted,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Waiting for players to choose their cards…
        </div>
      )}
      <ol style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
        {order.map((e, i) => {
        const isActive = i === activeIndex;
        const isDone = e.done;
        const accent = isActive ? '#ffd84d' : isDone ? '#666' : '#333';
        const bg = isActive ? '#2a2615' : '#1c1c20';

        const isLongRest = e.kind === 'player' && e.leadingCardId === null;

        let label: string;
        let avatarUrl: string | null = null;
        if (e.kind === 'player') {
          const player = players.find((p) => p.playerId === e.playerId);
          const character = player?.characterId
            ? characters.find((c) => c.id === player.characterId)
            : undefined;
          label = character?.name ?? player?.name ?? '???';
          if (character) avatarUrl = classAvatarUrl(character.classId);
        } else {
          label = SET_NAMES[e.setId] ?? e.setId;
          const defId = SET_AVATAR_DEFID[e.setId];
          if (defId) avatarUrl = monsterAvatarUrl(defId);
        }

        const card =
          e.kind === 'monster-group' ? CARD_BY_ID.get(e.abilityCardId) : undefined;

        return (
          <li
            key={i}
            style={{
              padding: 0,
              marginBottom: 4,
              borderLeft: `4px solid ${accent}`,
              background: bg,
              borderRadius: 4,
              overflow: 'hidden',
              opacity: isDone ? 0.5 : 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 10px',
              }}
            >
              <div
                style={{
                  minWidth: 38,
                  padding: '4px 4px',
                  background: isActive ? '#1f1a08' : '#12141a',
                  border: `1px solid ${theme.border}`,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLongRest ? theme.muted : theme.text,
                  alignSelf: 'stretch',
                }}
              >
                {isLongRest ? (
                  <div style={{ fontSize: 11, letterSpacing: 0.5 }}>REST</div>
                ) : (
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      lineHeight: 1,
                      fontFamily: theme.headingFont,
                    }}
                  >
                    {e.initiative}
                  </div>
                )}
              </div>

              {avatarUrl && (
                <img
                  src={avatarUrl}
                  onError={onAvatarError}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `1px solid ${theme.border}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    fontFamily: theme.headingFont,
                    lineHeight: 1.1,
                  }}
                >
                  {label}
                </div>
                {e.kind === 'player' && isLongRest && (
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Long Rest</div>
                )}
              </div>
            </div>

            {e.kind === 'monster-group' && (
              <div
                style={{
                  borderTop: `1px solid ${theme.border}`,
                  padding: '8px 10px 10px',
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    color: theme.accent,
                    fontFamily: theme.headingFont,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  {e.abilityCardName}
                  {card?.shuffle && (
                    <span style={{ color: theme.muted, marginLeft: 6, fontSize: 14 }}>
                      ↻ shuffle
                    </span>
                  )}
                </div>
                {card && card.abilities.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {card.abilities.map((step, j) => (
                      <li
                        key={j}
                        style={{
                          fontSize: 15,
                          color: theme.text,
                          padding: '2px 0',
                        }}
                      >
                        <Fragment>{renderStep(step, e.setId, units, scenarioLevel)}</Fragment>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
      </ol>
    </div>
  );
}
