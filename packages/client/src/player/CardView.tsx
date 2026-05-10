import type { Ability, AbilityStep, Card, CardHalf, Disposition } from '@gloomfolk/shared';

function dispositionLabel(half: CardHalf): string {
  const d = half.disposition;
  if (d === 'discard') return 'Discard';
  if (d === 'lost') return 'Lost';
  const finalPile = half.finalPile ?? (d === 'persistent-round' ? 'discard' : 'lost');
  const finalLabel = finalPile === 'lost' ? 'Lost' : 'Discard';
  const base =
    d === 'persistent-round' ? 'Persistent Round' :
    d === 'persistent-tracked' ? 'Persistent Tracked' :
    'Persistent Scenario';
  return `${base} · ${finalLabel}`;
}

function amountStr(a: unknown): string {
  return typeof a === 'number' ? String(a) : 'X';
}

function amountRefText(a: unknown): string | null {
  if (!a || typeof a !== 'object') return null;
  const kind = (a as { kind?: string }).kind;
  if (kind === 'hexes-moved-this-turn') return 'X = hexes you moved this turn';
  if (kind === 'damage-dealt-this-turn') return 'X = damage you dealt this turn';
  if (kind === 'target-shield-value') {
    const off = (a as { offset?: number }).offset;
    const suffix = off ? ` + ${off}` : '';
    return `X = target's Shield value${suffix}`;
  }
  return null;
}

function cap(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

type Step = AbilityStep;
type AttackStep = Extract<Step, { type: 'attack' }>;
type AttackTargetT = AttackStep['target'];
type AttackModifiersT = NonNullable<AttackStep['modifiers']>;
type ElementRiderT = NonNullable<AttackModifiersT['elementRiders']>[number];
type ConditionRiderT = NonNullable<AttackModifiersT['conditionRiders']>[number];
type TargetCondBonusT = NonNullable<AttackModifiersT['targetConditionalBonuses']>[number];
type TargetCondT = TargetCondBonusT['condition'];
type CauseT = Extract<Step, { type: 'when' }>['cause'];

function targetConditionText(c: TargetCondT): string {
  switch (c.kind) {
    case 'target-undamaged': return 'undamaged targets';
    case 'target-adjacent-to-your-ally': return 'targets adjacent to one of your allies';
    case 'target-isolated-from-allies': return 'isolated targets';
    case 'all-of': return c.conditions.map(targetConditionText).join(' and ');
  }
}

function bonusParts(r: {
  attackBonus?: number | string;
  pierce?: { amount: number };
  gainExp?: number;
  advantage?: boolean;
}): string {
  const parts: string[] = [];
  if (typeof r.attackBonus === 'number') parts.push(`+${r.attackBonus} attack`);
  else if (r.attackBonus) parts.push('+X attack');
  if (r.pierce) parts.push(`+${r.pierce.amount} pierce`);
  if (r.advantage) parts.push('advantage');
  if (r.gainExp) parts.push(`+${r.gainExp} XP`);
  return parts.join(', ');
}

function elementRiderLine(r: ElementRiderT): string {
  return `Consume ${cap(r.consume)}: ${bonusParts(r)}`;
}
function conditionRiderLine(r: ConditionRiderT): string {
  return `If ${causeText(r.when)}: ${bonusParts(r)}`;
}
function targetCondBonusLine(r: TargetCondBonusT): string {
  return `Against ${targetConditionText(r.condition)}: ${bonusParts(r)}`;
}

function attackRiderLines(mods: AttackModifiersT | undefined): string[] {
  if (!mods) return [];
  const lines: string[] = [];
  for (const r of mods.elementRiders ?? []) lines.push(elementRiderLine(r));
  for (const r of mods.conditionRiders ?? []) lines.push(conditionRiderLine(r));
  for (const r of mods.targetConditionalBonuses ?? []) lines.push(targetCondBonusLine(r));
  return lines;
}

function stepExtras(step: AbilityStep): string[] {
  const lines: string[] = [];
  if (step.type === 'attack' || step.type === 'move' || step.type === 'heal' ||
      step.type === 'shield' || step.type === 'retaliate' ||
      step.type === 'push' || step.type === 'pull') {
    const ref = amountRefText((step as { amount?: unknown }).amount);
    if (ref) lines.push(ref);
  }
  if (step.type === 'attack') lines.push(...attackRiderLines(step.modifiers));
  if (step.type === 'when') lines.push(...step.effects.flatMap(stepExtras));
  return lines;
}

function abilityExtras(a: Ability): string[] {
  return a.steps.flatMap(stepExtras);
}

type HexPt = { readonly q: number; readonly r: number };
function abilityAoePatterns(a: Ability): readonly (readonly HexPt[])[] {
  const out: (readonly HexPt[])[] = [];
  for (const s of a.steps) {
    if (s.type === 'attack' && s.target?.kind === 'aoe') out.push(s.target.pattern);
    if (s.type === 'when') {
      for (const inner of s.effects) {
        if (inner.type === 'attack' && inner.target?.kind === 'aoe') out.push(inner.target.pattern);
      }
    }
  }
  return out;
}

function AoePattern({ pattern }: { pattern: readonly HexPt[] }) {
  const size = 9;
  const w = Math.sqrt(3) * size;
  const hexes: { q: number; r: number; actor: boolean }[] = [
    { q: 0, r: 0, actor: true },
    ...pattern.map((p) => ({ q: p.q, r: p.r, actor: false })),
  ];
  const centers = hexes.map((h) => ({
    cx: w * (h.q + h.r / 2),
    cy: 1.5 * size * h.r,
    actor: h.actor,
  }));
  const pad = 2;
  const minX = Math.min(...centers.map((c) => c.cx)) - w / 2 - pad;
  const maxX = Math.max(...centers.map((c) => c.cx)) + w / 2 + pad;
  const minY = Math.min(...centers.map((c) => c.cy)) - size - pad;
  const maxY = Math.max(...centers.map((c) => c.cy)) + size + pad;
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const corners = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`);
    }
    return pts.join(' ');
  };
  return (
    <svg
      width={vbW}
      height={vbH}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      style={{ flex: '0 0 auto' }}
    >
      {centers.map((c, i) => (
        <polygon
          key={i}
          points={corners(c.cx, c.cy)}
          fill={c.actor ? 'transparent' : '#7a3a3a'}
          stroke={c.actor ? '#c8c8d0' : '#b85555'}
          strokeWidth={1.25}
          strokeDasharray={c.actor ? '2 2' : undefined}
        />
      ))}
    </svg>
  );
}

function attackTargetText(t: AttackTargetT): string {
  if (!t || t.kind === 'melee') return '';
  switch (t.kind) {
    case 'ranged': {
      const targets = t.targets && t.targets > 1 ? `, ${t.targets} targets` : '';
      return `range ${t.range}${targets}`;
    }
    case 'enemies-moved-through': return 'each enemy moved through';
    case 'all-within-range': return `all ${t.scope ?? 'enemies'} within range ${t.range}`;
    case 'aoe': return '';
  }
}

function causeText(c: CauseT): string {
  switch (c.kind) {
    case 'moved-in-straight-line': return 'you moved in a straight line';
    case 'moved-this-turn': return 'you moved this turn';
    case 'first-shield-or-retaliate-this-round':
      return 'this is your first Shield or Retaliate this round';
  }
}

function withParen(base: string, suffix: string): string {
  return suffix ? `${base} (${suffix})` : base;
}

function stepLabel(step: AbilityStep): string {
  switch (step.type) {
    case 'attack': {
      const bits: string[] = [];
      const tgt = attackTargetText(step.target);
      if (tgt) bits.push(tgt);
      if (step.modifiers?.pierce) bits.push(`pierce ${step.modifiers.pierce.amount}`);
      return withParen(`Attack ${amountStr(step.amount)}`, bits.join(', '));
    }
    case 'move': {
      const traits = step.traits ?? [];
      const verb = traits.includes('jump') ? 'Jump' : 'Move';
      const extras: string[] = [];
      if (step.lootEnteredHexes) extras.push('loot hexes entered');
      if (step.mayBypassTraps) extras.push('may bypass traps');
      return withParen(`${verb} ${amountStr(step.amount)}`, extras.join(', '));
    }
    case 'heal': return `Heal ${step.amount} (self)`;
    case 'shield': return `Shield ${step.amount}`;
    case 'retaliate': return `Retaliate ${step.amount}`;
    case 'push': {
      const range = step.range ? `range ${step.range}` : '';
      return withParen(`Push ${step.amount}`, range);
    }
    case 'pull': {
      const range = step.range ? `range ${step.range}` : '';
      return withParen(`Pull ${step.amount}`, range);
    }
    case 'apply-condition': {
      const name = cap(step.condition);
      if (!step.target || step.target.kind === 'self') return name;
      if (step.target.kind === 'melee') return `${name} an adjacent enemy`;
      if (step.target.kind === 'ranged') return `${name} a target at range ${step.target.range}`;
      if (step.target.kind === 'all-within-range') {
        return `${name} all ${step.target.scope ?? 'enemies'} within range ${step.target.range}`;
      }
      return name;
    }
    case 'gain-exp': {
      const t = step.trigger?.kind;
      if (t === 'per-enemy-targeted') return `+${step.amount} XP per enemy targeted`;
      if (t === 'on-next-retaliate-this-round') return `+${step.amount} XP on your next Retaliate this round`;
      return `+${step.amount} XP`;
    }
    case 'loot':
      return step.range === 0 ? 'Loot your hex' : `Loot within ${step.range}`;
    case 'create-element': return `Create ${cap(step.element)}`;
    case 'when': {
      const inner = step.effects.map(stepLabel).join(', ');
      return `If ${causeText(step.cause)}: ${inner}`;
    }
    case 'modify-future-move':
      return `+${step.bonusAmount} to your move abilities while active`;
    case 'modify-future-attack': {
      const parts: string[] = [];
      if (step.doubleAttack) parts.push('double attack');
      if (typeof step.bonusAmount === 'number') parts.push(`+${step.bonusAmount} attack`);
      else if (step.bonusAmount) parts.push('+X attack');
      if (step.pierceBonus) parts.push(`+${step.pierceBonus} pierce`);
      const bonus = parts.join(', ') || '+attack';
      const scope =
        step.appliesTo === 'next-attack-ability' ? 'on your next attack' :
        step.appliesTo === 'all-attacks-this-round' ? 'on all attacks this round' :
        'while active';
      const filter = step.attackKind ? ` (${step.attackKind} only)` : '';
      return `${bonus} ${scope}${filter}`;
    }
    case 'control-enemy-move': {
      const end = step.endConstraint === 'adjacent-to-actor' ? ', ending adjacent to you' : '';
      return `Force a target enemy to move ${step.moveAmount}${end}`;
    }
    case 'destroy-trap':
      return 'Destroy a trap in a hex you entered this move';
    case 'negate-damage':
      return 'Negate one source of damage';
    case 'redirect-attack': {
      const base = 'When an enemy targets an adjacent ally, redirect the attack to yourself';
      const bypasses = step.bypasses ?? [];
      if (bypasses.length === 0) return base;
      const ignoreParts = bypasses.map((b) => b === 'line-of-sight' ? 'line of sight' : b);
      return `${base} (ignores ${joinAnd(ignoreParts)})`;
    }
  }
}

function abilityLabel(a: Ability): string {
  return a.steps.map(stepLabel).join(', ');
}

type PersistentTriggerT = NonNullable<CardHalf['persistentTrigger']>;
function triggerNoun(t: PersistentTriggerT): string {
  switch (t.kind) {
    case 'attack-targets-self': return 'attacks targeting you';
    case 'damage-suffered': return 'sources of damage you suffer';
    case 'move-ability-performed': return 'move abilities you perform';
    case 'attack-against-isolated-enemy': return 'attacks you make against an isolated enemy';
    case 'melee-attack-against-shielded-enemy': return 'melee attacks you make against a Shielded enemy';
    case 'attack-while-invisible': return 'attacks you make while Invisible';
  }
}

function trackedSentence(half: CardHalf): string {
  const n = half.trackedUses ?? 0;
  const trigger = half.persistentTrigger;
  const body = half.abilities.map(abilityLabel).join('; ');
  if (!trigger || n <= 0) return body;
  return `On the next ${n} ${triggerNoun(trigger)}, gain ${body}.`;
}

function UseTrack({ half }: { half: CardHalf }) {
  const slots = half.trackedUses ?? 0;
  if (slots <= 0) return null;
  const exp = half.useSlotExp ?? [];
  const finalPile = half.finalPile ?? 'lost';
  const finalExp = exp.length === slots ? exp[slots - 1] ?? null : null;

  const circle = (key: string, xpInside: number | null) => (
    <span
      key={key}
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: '1.5px solid #c8c8d0',
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        lineHeight: 1,
        opacity: xpInside != null ? 1 : 0.85,
      }}
    >
      {xpInside != null ? `+${xpInside}` : ''}
    </span>
  );
  const arrow = (key: string) => (
    <span
      key={key}
      style={{
        flex: '0 0 auto',
        fontSize: 14,
        opacity: 0.5,
        lineHeight: 1,
      }}
    >
      →
    </span>
  );

  const items: React.ReactNode[] = [];
  for (let i = 0; i < slots; i++) {
    const xpInside = i > 0 ? exp[i - 1] ?? null : null;
    items.push(circle(`c${i}`, xpInside));
    if (i < slots - 1) items.push(arrow(`a${i}`));
  }

  return (
    <div style={{ paddingTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {items}
      {finalExp != null && (
        <>
          {arrow('af')}
          <span style={{ fontSize: 11, opacity: 0.75 }}>+{finalExp} XP</span>
        </>
      )}
      {arrow('aend')}
      <span
        style={{
          fontSize: 11,
          opacity: 0.55,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {finalPile === 'lost' ? 'Lost' : 'Discard'}
      </span>
    </div>
  );
}

export function HalfView({ half }: { half: CardHalf }) {
  const isTracked = half.disposition === 'persistent-tracked';
  return (
    <>
      {half.abilities.length === 0 ? (
        <div style={{ padding: '8px 0' }}>—</div>
      ) : isTracked ? (
        <div style={{ padding: '8px 0' }}>{trackedSentence(half)}</div>
      ) : (
        half.abilities.map((a, i) => {
          const extras = abilityExtras(a);
          const patterns = abilityAoePatterns(a);
          return (
            <div
              key={i}
              style={{
                padding: '8px 0',
                ...(i > 0 ? { borderTop: '1px solid #2e2e34' } : {}),
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: '1 1 auto' }}>{abilityLabel(a)}</div>
                {patterns.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flex: '0 0 auto', alignItems: 'center' }}>
                    {patterns.map((p, j) => <AoePattern key={j} pattern={p} />)}
                  </div>
                )}
              </div>
              {extras.map((line, j) => (
                <div
                  key={j}
                  style={{
                    fontSize: 14,
                    opacity: 0.85,
                    paddingLeft: 14,
                    paddingTop: 6,
                    borderLeft: '2px solid #3a3a42',
                    marginLeft: 2,
                    marginTop: 6,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          );
        })
      )}
      {half.disposition === 'persistent-tracked' && <UseTrack half={half} />}
      <div
        style={{
          fontSize: 11,
          opacity: 0.55,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          textAlign: 'right',
          paddingTop: 4,
        }}
      >
        {dispositionLabel(half)}
      </div>
    </>
  );
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
        padding: '16px 18px',
        margin: '8px 0',
        width: '100%',
        boxSizing: 'border-box',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, opacity: 0.55, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {card.level} · {card.name}
        </span>
        <span style={{ fontSize: 11, opacity: 0.55, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {String(card.initiative).padStart(2, '0')}
        </span>
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.35 }}>
        <div><HalfView half={card.top} /></div>
        <div
          style={{
            borderTop: '2px solid #4a4a52',
            margin: '16px -18px 4px',
          }}
        />
        <div><HalfView half={card.bottom} /></div>
      </div>
    </button>
  );
}
