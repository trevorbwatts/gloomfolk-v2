import type { Ability, AbilityStep, Card, CardHalf } from '@gloomfolk/shared';

function amountStr(a: unknown): string {
  return typeof a === 'number' ? String(a) : 'X';
}

function stepLabel(step: AbilityStep): string {
  switch (step.type) {
    case 'attack': return `Attack ${amountStr(step.amount)}`;
    case 'move': return `Move ${amountStr(step.amount)}`;
    case 'heal': return `Heal ${step.amount}`;
    case 'shield': return `Shield ${step.amount}`;
    case 'retaliate': return `Retaliate ${step.amount}`;
    case 'push': return `Push ${step.amount}`;
    case 'pull': return `Pull ${step.amount}`;
    case 'apply-condition': return step.condition[0]!.toUpperCase() + step.condition.slice(1);
    case 'gain-exp': return `+${step.amount} EXP`;
    case 'loot': return `Loot ${step.range}`;
    case 'create-element': return `+${step.element}`;
    case 'when': return `When ${step.cause.kind}`;
    case 'modify-future-move': return `+${step.bonusAmount} move`;
    case 'modify-future-attack': return `+atk`;
    default: return step.type;
  }
}

function abilityLabel(a: Ability): string {
  return a.steps.map(stepLabel).join(', ');
}

function halfLabel(h: CardHalf): string {
  return h.abilities.map(abilityLabel).join(' • ');
}

export function CardView({
  card,
  marker,
  onClick,
  selected,
}: {
  card: Card;
  marker?: 'L' | '2nd' | null;
  onClick?: () => void;
  selected?: boolean;
}) {
  const border = selected ? '#3a7bd5' : '#444';
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: '#1c1c20',
        color: '#eee',
        border: `2px solid ${border}`,
        borderRadius: 6,
        padding: 10,
        margin: '4px 0',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {marker && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            fontSize: 11,
            background: '#3a7bd5',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {marker === 'L' ? 'LEADING' : 'SECOND'}
        </span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong style={{ fontSize: 16 }}>{card.name}</strong>
        <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>
          init {String(card.initiative).padStart(2, '0')} · L{String(card.level)}
        </span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        <div><span style={{ opacity: 0.6 }}>Top:</span> {halfLabel(card.top) || '—'}</div>
        <div><span style={{ opacity: 0.6 }}>Bot:</span> {halfLabel(card.bottom) || '—'}</div>
      </div>
    </button>
  );
}
