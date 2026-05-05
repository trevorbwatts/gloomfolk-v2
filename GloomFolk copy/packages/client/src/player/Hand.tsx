import { useState } from 'react';
import { useStore } from '../store.js';
import { useSocket } from '../net/useSocket.js';
import { CARDS, type CardHalf } from '@gloomfolk/shared';

function ActionLine({ action }: { action: NonNullable<CardHalf['actions']>[number] }) {
  const left =
    action.kind === 'attack' ? `Attack rng ${action.range}${action.aoe ? ' AoE' : ''}`
    : action.kind === 'heal' ? `Heal rng ${action.range}`
    : action.kind === 'trample' ? 'Trample'
    : action.kind === 'charge' ? 'Charge'
    : action.kind === 'push_all' ? `Push all rng ${action.range}`
    : action.kind === 'pull_multi' ? `Pull ${action.targetCount} rng ${action.range}`
    : action.kind === 'push' ? `Push rng ${action.range}`
    : action.kind === 'pull' ? `Pull rng ${action.range}`
    : action.kind === 'shield' ? 'Shield'
    : action.kind === 'retaliate' ? 'Retaliate'
    : action.kind === 'attack_bonus' ? '+next attack'
    : action.kind === 'persistent' ? `Persistent (${action.effect.kind})`
    : '—';
  const right =
    action.kind === 'attack' ? `dmg ${action.damage}`
    : action.kind === 'heal' ? `+${action.amount}`
    : action.kind === 'trample' ? `dmg ${action.damage}`
    : action.kind === 'charge' ? 'dmg = hexes'
    : action.kind === 'push_all' ? `${action.distance}`
    : action.kind === 'pull_multi' ? `${action.distance}`
    : action.kind === 'push' || action.kind === 'pull' ? `${action.distance}`
    : action.kind === 'shield' ? `${action.value}`
    : action.kind === 'retaliate' ? `${action.value}`
    : action.kind === 'attack_bonus' ? `+${action.value}`
    : '';
  return (
    <div className="card-line">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function HalfRow({ half }: { half: CardHalf }) {
  return (
    <div className="card-half">
      <div className="card-line">
        <span>{half.jump ? 'Jump' : 'Move'}</span>
        <span>{half.move}</span>
      </div>
      {half.actions.map((a, i) => <ActionLine key={i} action={a} />)}
      {half.lost && <div className="card-line"><span style={{ color: 'var(--danger)' }}>(lost)</span><span /></div>}
      {half.infusesOnPlay && <div className="card-line"><span>Infuse</span><span>{half.infusesOnPlay}</span></div>}
    </div>
  );
}

export function Hand() {
  const { send } = useSocket();
  const hand = useStore((s) => s.hand);
  const discard = useStore((s) => s.discard);
  const state = useStore((s) => s.state);
  const playerId = useStore((s) => s.playerId);
  const player = playerId && state ? state.players[playerId] : null;
  const submitted = !!player?.selectedCards.submitted;

  // Local picks: first click = leading, second click = second. Click selected card to deselect.
  const [picks, setPicks] = useState<string[]>([]);

  const togglePick = (cardId: string) => {
    if (submitted) return;
    setPicks((cur) => {
      if (cur.includes(cardId)) return cur.filter((c) => c !== cardId);
      if (cur.length >= 2) return cur;
      return [...cur, cardId];
    });
  };

  const confirm = () => {
    if (picks.length !== 2) return;
    send({ type: 'select_cards', leading: picks[0]!, second: picks[1]! });
  };

  const longRest = () => {
    send({ type: 'select_long_rest' });
  };

  const canLongRest = !submitted && discard.length >= 1;
  const canPlay = hand.length >= 2;

  return (
    <>
      {submitted ? (
        <div className="banner your-turn">
          {player?.selectedCards.longRest ? 'Long rest declared. ' : 'Cards locked in. '}
          Waiting for other players…
        </div>
      ) : (
        <div className="banner">Pick two cards (first = leading initiative)</div>
      )}
      <div className="cards">
        {hand.map((cardId) => {
          const card = CARDS[cardId];
          if (!card) return null;
          const idx = picks.indexOf(cardId);
          const cls = idx === 0 ? ' selected leading' : idx === 1 ? ' selected' : '';
          return (
            <button
              key={cardId}
              className={`card${cls}`}
              disabled={submitted || (idx < 0 && picks.length >= 2)}
              onClick={() => togglePick(cardId)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="card-name">
                  {idx === 0 ? '⭐ ' : idx === 1 ? '② ' : ''}
                  {card.name}
                </span>
                <span className="card-init">{card.initiative}</span>
              </div>
              <HalfRow half={card.top} />
              <div className="card-divider" />
              <HalfRow half={card.bottom} />
            </button>
          );
        })}
      </div>
      {!submitted && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            className="primary"
            style={{ flex: 2, padding: '10px 12px' }}
            disabled={picks.length !== 2 || !canPlay}
            onClick={confirm}
          >
            Confirm ({picks.length}/2)
          </button>
          <button
            style={{ flex: 1, padding: '10px 12px' }}
            disabled={!canLongRest}
            onClick={longRest}
            title={canLongRest ? 'Long rest: lose 1 chosen card from discard, recover the rest, heal 2' : 'Need at least 1 card in discard'}
          >
            Long rest
          </button>
        </div>
      )}
      {discard.length > 0 && (
        <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 13 }}>
          Discard: {discard.length} card(s)
        </div>
      )}
    </>
  );
}
