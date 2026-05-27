import type {
  Ability,
  AbilityStep,
  Card,
  CardHalf,
  Disposition,
  Element,
  ElementBoardState,
  ElementSelector,
} from '@gloomfolk/shared';
import { Fragment } from 'react';
import { Flame, Snowflake, Wind, Stone, SunMedium, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../theme.js';
import { GameIcon, type IconKey } from '../icons.js';

/**
 * Live element state passed down through CardView/HalfView so that element
 * icons on create-element steps, elementRiders, and requiredElementCost can
 * glow when the element is currently available to consume.
 *
 * `null` when no live context applies (e.g. browsing your hand outside your
 * turn). The chips still render, just without availability emphasis.
 */
export interface CardElementContext {
  /** Live board (post-consume / pre-end-of-turn-infuse). */
  board: ElementBoardState;
  /** Snapshot at this turn's start — eligibility for consume is "strong or
   *  waning at start of turn", not live. */
  turnStartBoard: ElementBoardState;
  /** Already consumed this turn. Same-element-once-per-turn rule. */
  consumedThisTurn: ReadonlySet<Element>;
}

/** Human label for an element selector or a multi-element consume bundle. */
function elementSelectorText(
  sel: ElementSelector | { readonly all: readonly Element[] },
): string {
  if (typeof sel === 'string') return cap(sel);
  if ('all' in sel) return sel.all.map(cap).join(' + ');
  if (sel.kind === 'wild') return 'Wild';
  return sel.options.map(cap).join('/');
}

/** Visual chip showing one element. Glows when the live context says the
 *  element is currently available to consume (strong/waning at turn-start,
 *  not yet consumed). */
function ElementChip({
  element,
  context,
  consumeIntent,
}: {
  element: Element | { kind: 'wild' } | { kind: 'mixed'; options: readonly [Element, Element] };
  context: CardElementContext | null;
  /** When true, available = strong/waning at turn-start AND uncon­sumed.
   *  When false (e.g. on a create-element step), no glow. */
  consumeIntent: boolean;
}) {
  // Concrete element — render the Lucide glyph, no text label (the
  // surrounding "INFUSE" / "CONSUME" word in the row supplies context).
  if (typeof element === 'string') {
    const meta = ELEMENT_META[element];
    const Icon = meta.icon;
    const available = !!(
      consumeIntent &&
      context &&
      (context.turnStartBoard[element] === 'strong' ||
        context.turnStartBoard[element] === 'waning') &&
      !context.consumedThisTurn.has(element)
    );
    return (
      <span
        title={meta.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 3,
          borderRadius: 4,
          background: theme.bgSolid,
          border: `1px solid ${available ? theme.accent : theme.border}`,
          boxShadow: available ? `0 0 8px ${theme.accent}` : 'none',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        <Icon size={16} strokeWidth={1.75} color={meta.color} />
      </span>
    );
  }
  // Wild / mixed — render as a multi-pip badge.
  const options = element.kind === 'wild' ? ALL_ELEMENT_KEYS : element.options;
  return (
    <span
      title={element.kind === 'wild' ? 'Wild — pick any element' : `Mixed — ${options.map(cap).join(' or ')}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '1px 6px',
        borderRadius: 4,
        background: theme.bgSolid,
        border: `1px solid ${theme.border}`,
        fontSize: 11,
        color: theme.muted,
      }}
    >
      {options.map((opt) => (
        <span
          key={opt}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ELEMENT_META[opt].color,
            border: `1px solid ${theme.border}`,
          }}
        />
      ))}
      <span style={{ marginLeft: 3 }}>{element.kind === 'wild' ? 'Wild' : 'Mixed'}</span>
    </span>
  );
}

const ALL_ELEMENT_KEYS: readonly Element[] = ['fire', 'ice', 'air', 'earth', 'light', 'dark'];

interface ChipElementMeta {
  label: string;
  color: string;
  icon: LucideIcon;
}

const ELEMENT_META: Record<Element, ChipElementMeta> = {
  fire: { label: 'Fire', color: '#d96a4a', icon: Flame },
  ice: { label: 'Ice', color: '#74c2d6', icon: Snowflake },
  air: { label: 'Air', color: '#e7e2cf', icon: Wind },
  earth: { label: 'Earth', color: '#8a6f3b', icon: Stone },
  light: { label: 'Light', color: '#f0d774', icon: SunMedium },
  dark: { label: 'Dark', color: '#8b6cb0', icon: Moon },
};

function finalPileOf(half: CardHalf): 'lost' | 'discard' {
  const d = half.disposition;
  if (d === 'discard') return 'discard';
  if (d === 'lost') return 'lost';
  return half.finalPile ?? (d === 'persistent-round' ? 'discard' : 'lost');
}

function LostBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: theme.bad, fontWeight: 700, opacity: 1 }}>{children}</span>
  );
}

function DispositionLabel({ half }: { half: CardHalf }) {
  const d = half.disposition;
  if (d === 'discard') return <>Discard</>;
  if (d === 'lost') return <LostBadge>Lost</LostBadge>;
  const finalPile = finalPileOf(half);
  const base =
    d === 'persistent-round' ? 'Persistent Round' :
    d === 'persistent-tracked' ? 'Persistent Tracked' :
    'Persistent Scenario';
  return (
    <>
      {base} · {finalPile === 'lost' ? <LostBadge>Lost</LostBadge> : 'Discard'}
    </>
  );
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
  if (typeof r.attackBonus === 'number') parts.push(`+${r.attackBonus} Attack`);
  else if (r.attackBonus) parts.push('+X Attack');
  if (r.pierce) parts.push(`+${r.pierce.amount} Pierce`);
  if (r.advantage) parts.push('Advantage');
  if (r.gainExp) parts.push(`+${r.gainExp} XP`);
  return parts.join(', ');
}

function conditionRiderLine(r: ConditionRiderT): string {
  return `If ${causeText(r.when)}: ${bonusParts(r)}`;
}
function targetCondBonusLine(r: TargetCondBonusT): string {
  return `Against ${targetConditionText(r.condition)}: ${bonusParts(r)}`;
}

/** Non-element rider text (element riders surface in the chip block above
 *  with their own effect row, so they're excluded here to avoid duplication). */
function attackRiderLines(mods: AttackModifiersT | undefined): string[] {
  if (!mods) return [];
  const lines: string[] = [];
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
          fill={c.actor ? 'transparent' : '#6b2d2d'}
          stroke={c.actor ? theme.muted : '#a04545'}
          strokeWidth={1.25}
          strokeDasharray={c.actor ? '2 2' : undefined}
        />
      ))}
    </svg>
  );
}

function attackTargetText(t: AttackTargetT): React.ReactNode {
  if (!t || t.kind === 'melee') return null;
  switch (t.kind) {
    case 'ranged': {
      const targets = t.targets && t.targets > 1 ? `, ${t.targets} targets` : '';
      return <><GameIcon kind="range" /> Range {t.range}{targets}</>;
    }
    case 'enemies-moved-through': return 'each enemy moved through';
    case 'all-within-range':
      return <>all {t.scope ?? 'enemies'} within <GameIcon kind="range" /> Range {t.range}</>;
    case 'aoe': return null;
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

function withParen(base: React.ReactNode, suffix: React.ReactNode): React.ReactNode {
  const empty =
    suffix == null ||
    suffix === '' ||
    (Array.isArray(suffix) && suffix.length === 0);
  if (empty) return base;
  return <>{base} ({suffix})</>;
}

function joinNodes(nodes: readonly React.ReactNode[], sep: React.ReactNode = ', '): React.ReactNode {
  return nodes.map((n, i) => (
    <Fragment key={i}>
      {i > 0 ? sep : null}
      {n}
    </Fragment>
  ));
}

function withIcon(kind: IconKey, label: React.ReactNode): React.ReactNode {
  return (
    <>
      <GameIcon kind={kind} /> {label}
    </>
  );
}

function stepLabel(step: AbilityStep): React.ReactNode {
  switch (step.type) {
    case 'attack': {
      const bits: React.ReactNode[] = [];
      const tgt = attackTargetText(step.target);
      if (tgt) bits.push(tgt);
      if (step.modifiers?.pierce)
        bits.push(
          <>
            <GameIcon kind="pierce" /> Pierce {step.modifiers.pierce.amount}
          </>,
        );
      return withParen(withIcon('attack', `Attack ${amountStr(step.amount)}`), joinNodes(bits));
    }
    case 'move': {
      const traits = step.traits ?? [];
      const isJump = traits.includes('jump');
      const verb = isJump ? 'Jump' : 'Move';
      const extras: string[] = [];
      if (step.lootEnteredHexes) extras.push('loot hexes entered');
      if (step.mayBypassTraps) extras.push('may bypass traps');
      return withParen(
        withIcon(isJump ? 'jump' : 'move', `${verb} ${amountStr(step.amount)}`),
        extras.join(', '),
      );
    }
    case 'heal': return withIcon('heal', `Heal ${step.amount} (self)`);
    case 'shield': return withIcon('shield', `Shield ${step.amount}`);
    case 'retaliate': return withIcon('retaliate', `Retaliate ${step.amount}`);
    case 'push': {
      const range: React.ReactNode = step.range
        ? <><GameIcon kind="range" /> Range {step.range}</>
        : '';
      return withParen(withIcon('push', `Push ${step.amount}`), range);
    }
    case 'pull': {
      const range: React.ReactNode = step.range
        ? <><GameIcon kind="range" /> Range {step.range}</>
        : '';
      return withParen(withIcon('pull', `Pull ${step.amount}`), range);
    }
    case 'apply-condition': {
      const name = withIcon(step.condition, cap(step.condition));
      if (!step.target || step.target.kind === 'self') return name;
      if (step.target.kind === 'melee') return <>{name} an adjacent enemy</>;
      if (step.target.kind === 'ranged')
        return <>{name} a target at <GameIcon kind="range" /> Range {step.target.range}</>;
      if (step.target.kind === 'all-within-range') {
        return <>{name} all {step.target.scope ?? 'enemies'} within <GameIcon kind="range" /> Range {step.target.range}</>;
      }
      return name;
    }
    case 'gain-exp': {
      const t = step.trigger?.kind;
      if (t === 'per-enemy-targeted') return `+${step.amount} XP per enemy targeted`;
      if (t === 'on-next-retaliate-this-round')
        return <>+{step.amount} XP on your next <GameIcon kind="retaliate" /> Retaliate this round</>;
      return `+${step.amount} XP`;
    }
    case 'loot':
      return step.range === 0 ? 'Loot your hex' : `Loot within ${step.range}`;
    case 'create-element': return `Create ${elementSelectorText(step.element)}`;
    case 'when': {
      const inner = step.effects
        .filter((s) => s.type !== 'create-element')
        .map(stepLabel);
      return <>If {causeText(step.cause)}: {joinNodes(inner)}</>;
    }
    case 'modify-future-move':
      return <>+{step.bonusAmount} to your <GameIcon kind="move" /> Move abilities while active</>;
    case 'modify-future-attack': {
      const parts: React.ReactNode[] = [];
      if (step.doubleAttack) parts.push('double Attack');
      if (typeof step.bonusAmount === 'number')
        parts.push(<>+{step.bonusAmount} <GameIcon kind="attack" /> Attack</>);
      else if (step.bonusAmount)
        parts.push(<>+X <GameIcon kind="attack" /> Attack</>);
      if (step.pierceBonus)
        parts.push(<>+{step.pierceBonus} <GameIcon kind="pierce" /> Pierce</>);
      const bonus: React.ReactNode = parts.length > 0
        ? joinNodes(parts)
        : <>+<GameIcon kind="attack" /> Attack</>;
      const scope =
        step.appliesTo === 'next-attack-ability' ? 'on your next Attack' :
        step.appliesTo === 'all-attacks-this-round' ? 'on all Attacks this round' :
        'while active';
      const filter = step.attackKind ? ` (${step.attackKind} only)` : '';
      return <>{bonus} {scope}{filter}</>;
    }
    case 'control-enemy-move': {
      const end = step.endConstraint === 'adjacent-to-actor' ? ', ending adjacent to you' : '';
      return `Force a target enemy to Move ${step.moveAmount}${end}`;
    }
    case 'destroy-trap':
      return 'Destroy a trap in a hex you entered this move';
    case 'negate-damage':
      return 'Negate one source of damage';
    case 'redirect-attack': {
      const base = 'When an enemy targets an adjacent ally, redirect the Attack to yourself';
      const bypasses = step.bypasses ?? [];
      if (bypasses.length === 0) return base;
      const ignoreParts = bypasses.map((b) => b === 'line-of-sight' ? 'line of sight' : b);
      return `${base} (ignores ${joinAnd(ignoreParts)})`;
    }
  }
}

function abilityLabel(a: Ability): React.ReactNode {
  // create-element steps are surfaced as their own "INFUSE [icon]" block
  // below the ability, so we drop them from the inline label to avoid
  // duplication.
  return joinNodes(a.steps.filter((s) => s.type !== 'create-element').map(stepLabel));
}

/** Element references on an ability: create-element steps and elementRiders
 *  on its attack steps. Each entry becomes one block in the card UI: a
 *  header row ("INFUSE [icon]" or "CONSUME [icon(s)]") and, for consume,
 *  a second row with the bonus effects. */
type ChipElementRef =
  | Element
  | { kind: 'wild' }
  | { kind: 'mixed'; options: readonly [Element, Element] };
type AbilityElementEntry =
  | { kind: 'create'; elements: readonly ChipElementRef[] }
  | { kind: 'consume'; elements: readonly ChipElementRef[]; effects: string };
function abilityElements(a: Ability): AbilityElementEntry[] {
  const out: AbilityElementEntry[] = [];
  for (const step of a.steps) {
    if (step.type === 'create-element') {
      out.push({ kind: 'create', elements: [step.element] });
    } else if (step.type === 'attack') {
      const riders = step.modifiers?.elementRiders ?? [];
      for (const r of riders) {
        const c = r.consume;
        const elements: ChipElementRef[] =
          typeof c === 'object' && 'all' in c ? [...c.all] : [c];
        out.push({ kind: 'consume', elements, effects: bonusParts(r) });
      }
    }
  }
  return out;
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

function trackedSentence(half: CardHalf): React.ReactNode {
  const n = half.trackedUses ?? 0;
  const trigger = half.persistentTrigger;
  const body = joinNodes(half.abilities.map(abilityLabel), '; ');
  if (!trigger || n <= 0) return body;
  return <>On the next {n} {triggerNoun(trigger)}, gain {body}.</>;
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
        border: `1.5px solid ${theme.muted}`,
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
          opacity: finalPile === 'lost' ? 1 : 0.55,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {finalPile === 'lost' ? <LostBadge>Lost</LostBadge> : 'Discard'}
      </span>
    </div>
  );
}

export function HalfView({
  half,
  elementContext = null,
}: {
  half: CardHalf;
  elementContext?: CardElementContext | null;
}) {
  const isTracked = half.disposition === 'persistent-tracked';
  const cost = half.requiredElementCost ?? [];
  return (
    <>
      {cost.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0 8px',
            fontSize: 12,
            color: theme.muted,
          }}
        >
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Cost:</span>
          {cost.map((e, i) => (
            <ElementChip key={`${e}_${i}`} element={e} context={elementContext} consumeIntent />
          ))}
        </div>
      )}
      {half.abilities.length === 0 ? (
        <div style={{ padding: '8px 0' }}>—</div>
      ) : isTracked ? (
        <div style={{ padding: '8px 0' }}>{trackedSentence(half)}</div>
      ) : (
        half.abilities.map((a, i) => {
          const extras = abilityExtras(a);
          const patterns = abilityAoePatterns(a);
          const ele = abilityElements(a);
          return (
            <div
              key={i}
              style={{
                padding: '8px 0',
                ...(i > 0 ? { borderTop: `1px solid ${theme.border}` } : {}),
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
              {(ele.length > 0 || extras.length > 0) && (
                <div
                  style={{
                    paddingLeft: 14,
                    paddingTop: 6,
                    marginLeft: 2,
                    marginTop: 6,
                    borderLeft: `2px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {ele.map((entry, j) => (
                    <div key={`ele-${j}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 10,
                            color: theme.muted,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          {entry.kind === 'create' ? 'Infuse' : 'Consume'}
                        </span>
                        {entry.elements.map((e, k) => (
                          <ElementChip
                            key={k}
                            element={e}
                            context={elementContext}
                            consumeIntent={entry.kind === 'consume'}
                          />
                        ))}
                      </div>
                      {entry.kind === 'consume' && entry.effects && (
                        <div style={{ fontSize: 14, opacity: 0.85 }}>{entry.effects}</div>
                      )}
                    </div>
                  ))}
                  {extras.map((line, j) => (
                    <div key={`ex-${j}`} style={{ fontSize: 14, opacity: 0.85 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
      {half.disposition === 'persistent-tracked' && <UseTrack half={half} />}
      <div
        style={{
          fontSize: 11,
          opacity: finalPileOf(half) === 'lost' ? 1 : 0.55,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          textAlign: 'right',
          paddingTop: 4,
        }}
      >
        <DispositionLabel half={half} />
        {typeof half.expOnPerform === 'number' && (
          <span style={{ marginLeft: 6 }}>· +{half.expOnPerform} XP</span>
        )}
      </div>
    </>
  );
}

export function CardView({
  card,
  marker,
  onClick,
  selected,
  elementContext = null,
}: {
  card: Card;
  marker?: 'L' | '2nd' | null;
  onClick?: () => void;
  selected?: boolean;
  elementContext?: CardElementContext | null;
}) {
  const border = selected ? theme.accent : theme.border;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: theme.panel,
        color: theme.text,
        border: `2px solid ${border}`,
        borderRadius: 6,
        padding: '16px 18px',
        margin: '8px 0',
        width: '100%',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        fontFamily: theme.font,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 11, opacity: 0.55, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {card.level} · {card.name}
        </span>
        {marker ? (
          <span
            style={{
              fontSize: 11,
              background: theme.accent,
              color: '#0e1612',
              padding: '2px 6px',
              borderRadius: 3,
              fontWeight: 600,
              letterSpacing: 0.5,
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <span>{marker === 'L' ? 'LEADING' : 'SECOND'}</span>
            <span>{String(card.initiative).padStart(2, '0')}</span>
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              opacity: 0.55,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              padding: '2px 6px',
              display: 'inline-flex',
              alignItems: 'baseline',
            }}
          >
            {String(card.initiative).padStart(2, '0')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.35 }}>
        <div><HalfView half={card.top} elementContext={elementContext} /></div>
        <div
          style={{
            borderTop: `2px solid ${theme.border}`,
            margin: '16px -18px 4px',
          }}
        />
        <div><HalfView half={card.bottom} elementContext={elementContext} /></div>
      </div>
    </button>
  );
}
