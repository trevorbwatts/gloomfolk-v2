import type { LobbyPlayer, TurnOrderEntry } from '@gloomfolk/shared';

const SET_NAMES: Record<string, string> = {
  archer: 'Bandit Archers',
  scout: 'Bandit Scouts',
};

export function TurnOrder({
  order,
  activeIndex,
  players,
}: {
  order: TurnOrderEntry[];
  activeIndex: number;
  players: LobbyPlayer[];
}) {
  if (order.length === 0) return null;
  return (
    <ol style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
      {order.map((e, i) => {
        const isActive = i === activeIndex;
        const isDone = e.done;
        const label =
          e.kind === 'player'
            ? players.find((p) => p.playerId === e.playerId)?.name ?? '???'
            : SET_NAMES[e.setId] ?? e.setId;
        const sub =
          e.kind === 'player'
            ? e.leadingCardId === null
              ? 'Long Rest'
              : `init ${e.initiative}`
            : `${e.abilityCardName} · init ${e.initiative}`;
        return (
          <li
            key={i}
            style={{
              padding: '6px 10px',
              marginBottom: 4,
              borderLeft: `4px solid ${isActive ? '#ffd84d' : isDone ? '#666' : '#333'}`,
              background: isActive ? '#2a2615' : '#1c1c20',
              opacity: isDone ? 0.5 : 1,
            }}
          >
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{sub}</div>
          </li>
        );
      })}
    </ol>
  );
}
