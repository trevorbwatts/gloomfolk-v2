import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { useSocket } from '../net/useSocket.js';
import {
  CARDS,
  Combat,
  AI,
  HexMath,
  type AbilityAction,
  type CardHalf,
  type GameState,
  type Hex,
  type TurnAction,
  type TurnStep,
  type Unit,
} from '@gloomfolk/shared';
import { HEX_SIZE, computeBoardPixelBounds, nearestHexFromPx } from '../util/board.js';

export function TurnPlay() {
  const { send } = useSocket();
  const state = useStore((s) => s.state);
  const playerId = useStore((s) => s.playerId);
  const awaitingUnitId = useStore((s) => s.awaitingTurnUnitId);
  const leadingCardId = useStore((s) => s.awaitingLeadingCardId);
  const secondCardId = useStore((s) => s.awaitingSecondCardId);
  const longRest = useStore((s) => s.awaitingLongRest);
  const setYourTurn = useStore((s) => s.setYourTurn);

  const player = playerId && state ? state.players[playerId] : null;
  const myUnit = player ? state?.units[player.unitId] : null;
  const isMyTurn = !!awaitingUnitId && myUnit && awaitingUnitId === myUnit.id;

  if (!state || !player) return null;
  if (!isMyTurn || !myUnit) {
    const activeUnitId = state.turnOrder[state.activeTurn];
    const activePlayer = activeUnitId ? Object.values(state.players).find((p) => p.unitId === activeUnitId) : null;
    const name = activePlayer ? activePlayer.name : (activeUnitId ? state.units[activeUnitId]?.archetype ?? 'someone' : 'someone');
    return <div className="banner">Waiting for {name}…</div>;
  }
  if (longRest) return <LongRestUI onSent={() => setYourTurn(null, null, null, false)} />;
  if (!leadingCardId || !secondCardId) return <div className="banner">Loading turn…</div>;

  return (
    <TwoCardTurn
      state={state}
      myUnit={myUnit}
      leadingCardId={leadingCardId}
      secondCardId={secondCardId}
      send={send}
      onComplete={() => setYourTurn(null, null, null, false)}
    />
  );
}

function LongRestUI({ onSent }: { onSent: () => void }) {
  const { send } = useSocket();
  const discard = useStore((s) => s.discard);
  return (
    <>
      <div className="banner your-turn">Long rest — pick a card from discard to permanently lose</div>
      <div className="cards">
        {discard.map((cardId) => {
          const card = CARDS[cardId];
          if (!card) return null;
          return (
            <button key={cardId} className="card" onClick={() => { send({ type: 'long_rest_turn', loseCardId: cardId }); onSent(); }}>
              <div className="card-name">{card.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>init {card.initiative}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// A single resolution step in a card half.
type Component =
  | { kind: 'move'; cardId: string; cardSlot: 0 | 1; half: 'top' | 'bottom' }
  | { kind: 'action'; cardId: string; cardSlot: 0 | 1; half: 'top' | 'bottom'; actionIndex: number };

function buildQueue(
  cards: { id: string; card: NonNullable<(typeof CARDS)[string]> }[],
  halves: ('top' | 'bottom')[],
): Component[] {
  const out: Component[] = [];
  for (let slot = 0 as 0 | 1; slot < 2; slot++) {
    const cardEntry = cards[slot]!;
    const half = halves[slot]!;
    const ch = cardEntry.card[half];
    // For combo halves (trample/charge) we treat them as a single combined step
    // emitted as an action component; the resolver below picks a different code path.
    const comboIdx = ch.actions.findIndex((a) => a.kind === 'trample' || a.kind === 'charge');
    if (comboIdx >= 0) {
      out.push({ kind: 'action', cardId: cardEntry.id, cardSlot: slot, half, actionIndex: comboIdx });
      continue;
    }
    if (ch.move > 0) out.push({ kind: 'move', cardId: cardEntry.id, cardSlot: slot, half });
    for (let i = 0; i < ch.actions.length; i++) {
      out.push({ kind: 'action', cardId: cardEntry.id, cardSlot: slot, half, actionIndex: i });
    }
    slot = (slot as number) as 0 | 1; // appease TS narrowing on loop counter
  }
  return out;
}

function TwoCardTurn({
  state,
  myUnit,
  leadingCardId,
  secondCardId,
  send,
  onComplete,
}: {
  state: GameState;
  myUnit: Unit;
  leadingCardId: string;
  secondCardId: string;
  send: ReturnType<typeof useSocket>['send'];
  onComplete: () => void;
}) {
  const cards = [
    { id: leadingCardId, card: CARDS[leadingCardId]! },
    { id: secondCardId, card: CARDS[secondCardId]! },
  ];
  const [halves, setHalves] = useState<{ leading: 'top' | 'bottom' | null; second: 'top' | 'bottom' | null }>({
    leading: null, second: null,
  });
  const [queue, setQueue] = useState<Component[] | null>(null);
  const [queueIdx, setQueueIdx] = useState(0);
  const [path, setPath] = useState<Hex[]>([{ q: myUnit.pos.q, r: myUnit.pos.r }]);
  const [pendingMove, setPendingMove] = useState<Hex | null>(null);
  const stepsRef = useRef<TurnStep[]>([]);
  const previewRef = useRef<GameState>(state);
  const [sending, setSending] = useState(false);

  const cur = queue && queue[queueIdx] ? queue[queueIdx] : null;
  const curCard = cur ? cards[cur.cardSlot]!.card : null;
  const curHalf: CardHalf | null = cur && curCard ? curCard[cur.half] : null;
  const curAbility: AbilityAction | null = cur && curHalf && cur.kind === 'action' ? curHalf.actions[cur.actionIndex] ?? null : null;

  // Reset path tail when entering a move component.
  useEffect(() => {
    if (cur?.kind === 'move') {
      const u = previewRef.current.units[myUnit.id];
      const pos = u ? u.pos : myUnit.pos;
      setPath([{ q: pos.q, r: pos.r }]);
      setPendingMove(null);
    }
  }, [queueIdx, cur?.kind]);

  // Push path updates to the host while picking a move.
  const lastSentRef = useRef<string>('');
  useEffect(() => {
    if (cur?.kind !== 'move' || pendingMove !== null) return;
    const key = JSON.stringify(path);
    if (key === lastSentRef.current) return;
    lastSentRef.current = key;
    send({ type: 'path', path: path.length > 0 ? path : null });
  }, [path, cur?.kind, pendingMove, send]);

  // Cleanup on unmount.
  useEffect(() => () => {
    send({ type: 'path', path: null });
    send({ type: 'cursor', px: null });
    send({ type: 'pending_move', hex: null });
    send({ type: 'target_hint', unitId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queue === null) {
    return (
      <PickHalves
        leadingCard={cards[0]!.card}
        secondCard={cards[1]!.card}
        halves={halves}
        setHalves={setHalves}
        onBegin={() => {
          if (!halves.leading || !halves.second) return;
          previewRef.current = state;
          setQueue(buildQueue(cards, [halves.leading, halves.second]));
          setQueueIdx(0);
        }}
      />
    );
  }
  if (sending) return <div className="banner">Resolving turn…</div>;
  if (!cur || !curHalf || !curCard) return null;

  const advance = () => {
    if (queueIdx + 1 >= queue.length) {
      setSending(true);
      send({ type: 'play_turn', steps: stepsRef.current });
      send({ type: 'path', path: null });
      send({ type: 'cursor', px: null });
      send({ type: 'pending_move', hex: null });
      send({ type: 'target_hint', unitId: null });
      onComplete();
    } else {
      setQueueIdx(queueIdx + 1);
      send({ type: 'pending_move', hex: null });
      send({ type: 'target_hint', unitId: null });
    }
  };

  const previewState = previewRef.current;
  const previewUnit = previewState.units[myUnit.id]!;

  // Component: move
  if (cur.kind === 'move') {
    return (
      <ResolveMove
        state={previewState}
        unit={previewUnit}
        card={curCard}
        half={cur.half}
        path={path}
        setPath={setPath}
        send={send}
        onConfirm={(dest) => {
          stepsRef.current.push({ kind: 'move', cardId: cur.cardId, half: cur.half, moveTo: dest });
          applyMoveToPreview(previewRef, myUnit.id, dest);
          send({ type: 'pending_move', hex: dest });
          send({ type: 'path', path: null });
          advance();
        }}
      />
    );
  }

  // Component: action — combo (trample/charge) takes the move-and-action path.
  if (curAbility?.kind === 'trample') {
    return (
      <ResolveMove
        state={previewState}
        unit={previewUnit}
        card={curCard}
        half={cur.half}
        path={path}
        setPath={setPath}
        send={send}
        onConfirm={(dest) => {
          stepsRef.current.push({
            kind: 'trample_move', cardId: cur.cardId, half: cur.half,
            actionIndex: cur.actionIndex, moveTo: dest, path,
          });
          applyMoveToPreview(previewRef, myUnit.id, dest);
          advance();
        }}
      />
    );
  }
  if (curAbility?.kind === 'charge') {
    if (!pendingMove) {
      return (
        <ResolveMove
          state={previewState}
          unit={previewUnit}
          card={curCard}
          half={cur.half}
          path={path}
          setPath={setPath}
          send={send}
          onConfirm={(dest) => setPendingMove(dest)}
        />
      );
    }
    return (
      <ResolveAction
        state={previewState}
        myUnit={previewUnit}
        cardName={curCard.name}
        half={cur.half}
        ability={curAbility}
        send={send}
        onSubmit={(action) => {
          if (action.kind === 'charge') {
            stepsRef.current.push({
              kind: 'charge_move', cardId: cur.cardId, half: cur.half,
              actionIndex: cur.actionIndex, moveTo: pendingMove,
              targetUnitId: action.targetUnitId,
            });
            applyMoveToPreview(previewRef, myUnit.id, pendingMove);
            setPendingMove(null);
            advance();
          }
        }}
        onChangeMove={() => setPendingMove(null)}
      />
    );
  }

  // Standard action component.
  return (
    <ResolveAction
      state={previewState}
      myUnit={previewUnit}
      cardName={curCard.name}
      half={cur.half}
      ability={curAbility!}
      send={send}
      onSubmit={(action) => {
        stepsRef.current.push({ kind: 'action', cardId: cur.cardId, half: cur.half, actionIndex: cur.actionIndex, action });
        advance();
      }}
      onChangeMove={() => {
        // Pop the most recent move step for this cardId+half if present, and rewind to it in the queue.
        const popIdx = stepsRef.current.findIndex(
          (s) => s.cardId === cur.cardId && s.half === cur.half && s.kind === 'move',
        );
        if (popIdx >= 0) {
          stepsRef.current.splice(popIdx, 1);
          previewRef.current = computePreview(state, myUnit.id, stepsRef.current);
          // Rewind queue to the move component for this card.
          const moveQIdx = queue.findIndex((q) => q.kind === 'move' && q.cardId === cur.cardId);
          if (moveQIdx >= 0) setQueueIdx(moveQIdx);
        }
        send({ type: 'pending_move', hex: null });
        send({ type: 'target_hint', unitId: null });
      }}
    />
  );
}

function PickHalves({
  leadingCard,
  secondCard,
  halves,
  setHalves,
  onBegin,
}: {
  leadingCard: NonNullable<(typeof CARDS)[string]>;
  secondCard: NonNullable<(typeof CARDS)[string]>;
  halves: { leading: 'top' | 'bottom' | null; second: 'top' | 'bottom' | null };
  setHalves: (h: { leading: 'top' | 'bottom' | null; second: 'top' | 'bottom' | null }) => void;
  onBegin: () => void;
}) {
  function HalfPicker({ slot, card }: { slot: 'leading' | 'second'; card: NonNullable<(typeof CARDS)[string]> }) {
    const cur = halves[slot];
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          {slot === 'leading' ? '⭐ ' : '② '}
          <strong style={{ color: 'var(--text)' }}>{card.name}</strong> (init {card.initiative})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['top', 'bottom'] as const).map((h) => {
            const ch = card[h];
            return (
              <button
                key={h}
                className={cur === h ? 'primary' : ''}
                style={{ flex: 1, padding: '10px 8px', textAlign: 'left' }}
                onClick={() => setHalves({ ...halves, [slot]: h })}
              >
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</div>
                <div>{ch.jump ? 'Jump' : 'Move'} {ch.move}{ch.lost ? ' • lost' : ''}</div>
                {ch.actions.map((a, i) => (
                  <div key={i} style={{ fontSize: 12 }}>{describeAction(a)}</div>
                ))}
                {ch.infusesOnPlay && <div style={{ fontSize: 12 }}>Infuse {ch.infusesOnPlay}</div>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const ready = !!halves.leading && !!halves.second;
  return (
    <>
      <div className="banner your-turn">Pick a half from each card. Leading resolves first.</div>
      <HalfPicker slot="leading" card={leadingCard} />
      <HalfPicker slot="second" card={secondCard} />
      <button className="primary" style={{ width: '100%', padding: '12px' }} disabled={!ready} onClick={onBegin}>
        Begin turn
      </button>
    </>
  );
}

function describeAction(action: AbilityAction): string {
  switch (action.kind) {
    case 'attack': return `Attack ${action.damage} rng ${action.range}${action.aoe ? ' (AoE)' : ''}`;
    case 'heal': return `Heal ${action.amount} rng ${action.range}`;
    case 'trample': return `Trample ${action.damage}`;
    case 'charge': return `Charge (dmg = hexes)`;
    case 'push': return `Push rng ${action.range} dist ${action.distance}`;
    case 'pull': return `Pull rng ${action.range} dist ${action.distance}`;
    case 'push_all': return `Push all rng ${action.range} dist ${action.distance}`;
    case 'pull_multi': return `Pull ${action.targetCount} rng ${action.range} dist ${action.distance}`;
    case 'shield': return `Shield ${action.value}`;
    case 'retaliate': return `Retaliate ${action.value}`;
    case 'attack_bonus': return `+${action.value} to next attack`;
    case 'persistent': return `Persistent (${action.effect.kind})`;
    case 'none': return 'No action';
  }
}

function ResolveMove({
  state,
  unit,
  card,
  half,
  path,
  setPath,
  send,
  onConfirm,
}: {
  state: GameState;
  unit: Unit;
  card: NonNullable<(typeof CARDS)[string]>;
  half: 'top' | 'bottom';
  path: Hex[];
  setPath: (p: Hex[]) => void;
  send: ReturnType<typeof useSocket>['send'];
  onConfirm: (dest: Hex) => void;
}) {
  const cardHalf = card[half];
  const stepsUsed = Math.max(0, path.length - 1);
  const isTrample = cardHalf.actions.some((a) => a.kind === 'trample');
  const blockedFn = cardHalf.jump
    ? Combat.blockedForJump(state, unit)
    : isTrample
      ? Combat.blockedForTrample(state, unit)
      : Combat.blockedFor(state, unit);
  return (
    <>
      <div className="banner your-turn">
        <strong>{card.name}</strong> ({half}) — {cardHalf.jump ? 'jump' : 'move'} {stepsUsed}/{cardHalf.move}
      </div>
      <Touchpad
        state={state}
        tailHex={path[path.length - 1] ?? unit.pos}
        onHex={(hex) => setPath(extendPath(state, unit, path, hex, cardHalf.move, blockedFn))}
        onCursor={(px) => send({ type: 'cursor', px })}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={{ flex: 1, padding: '10px 12px' }} onClick={() => setPath([{ q: unit.pos.q, r: unit.pos.r }])}>
          Reset path
        </button>
        <button
          className="primary"
          style={{ flex: 2, padding: '10px 12px' }}
          onClick={() => onConfirm(path[path.length - 1] ?? unit.pos)}
        >
          Confirm move ({stepsUsed})
        </button>
      </div>
    </>
  );
}

function ResolveAction({
  state,
  myUnit,
  cardName,
  half,
  ability,
  send,
  onSubmit,
  onChangeMove,
}: {
  state: GameState;
  myUnit: Unit;
  cardName: string;
  half: 'top' | 'bottom';
  ability: AbilityAction;
  send: ReturnType<typeof useSocket>['send'];
  onSubmit: (action: TurnAction) => void;
  onChangeMove: () => void;
}) {
  const ak = ability.kind;
  const allUnits = Object.values(state.units).filter((u) => !u.exhausted);
  let targets: typeof allUnits = [];
  if (ak === 'attack' && ability.aoeCenter !== 'self') {
    targets = allUnits.filter((u) => AI.isValidAttackTarget(state, myUnit.id, u.id, ability.range));
  } else if (ak === 'heal') {
    targets = allUnits.filter((u) => AI.isValidHealTarget(state, myUnit.id, u.id, ability.range));
  } else if (ak === 'charge') {
    targets = allUnits.filter((u) => AI.isValidAttackTarget(state, myUnit.id, u.id, ability.range));
  }

  const [targetId, setTargetId] = useState<string | null>(targets[0]?.id ?? null);
  useEffect(() => {
    if (targets.length === 0) { if (targetId !== null) setTargetId(null); return; }
    if (!targets.some((t) => t.id === targetId)) setTargetId(targets[0]!.id);
  }, [targets.map((t) => t.id).join('|')]);
  useEffect(() => { send({ type: 'target_hint', unitId: targetId }); }, [targetId, send]);

  const handleCursorPx = (px: { x: number; y: number } | null) => {
    send({ type: 'cursor', px });
    if (!px || targets.length === 0) return;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const t of targets) {
      const p = HexMath.hexToPixel(t.pos, HEX_SIZE);
      const dx = p.x - px.x;
      const dy = p.y - px.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = t.id; }
    }
    if (best && best !== targetId) setTargetId(best);
  };

  const target = targets.find((u) => u.id === targetId) ?? null;
  const targetLabel = target ? `${target.archetype} — HP ${target.hp}/${target.maxHp}` : null;
  const targetHex: Hex = target ? target.pos : myUnit.pos;

  const isSelfAoe = ak === 'attack' && ability.aoeCenter === 'self';
  const needsTarget = (ak === 'attack' && !isSelfAoe) || ak === 'heal' || ak === 'charge';
  const verb = isSelfAoe ? 'Unleash AoE'
    : ak === 'attack' ? 'Confirm attack'
    : ak === 'heal' ? 'Confirm heal'
    : ak === 'charge' ? 'Confirm charge'
    : ak === 'push_all' ? 'Push all adjacent'
    : ak === 'pull_multi' ? 'Pull targets'
    : ak === 'shield' || ak === 'retaliate' || ak === 'attack_bonus' ? 'Activate'
    : ak === 'persistent' ? 'Activate persistent'
    : 'Skip';
  const buildAction = (): TurnAction | null => {
    if (ak === 'attack') {
      if (isSelfAoe) return { kind: 'aoe_self' };
      if (!target) return null;
      return { kind: 'attack', targetUnitId: target.id };
    }
    if (ak === 'heal') return target ? { kind: 'heal', targetUnitId: target.id } : null;
    if (ak === 'charge') return target ? { kind: 'charge', targetUnitId: target.id } : null;
    if (ak === 'push_all') return { kind: 'push_all' };
    if (ak === 'pull_multi') return { kind: 'pull_multi' };
    return { kind: 'none' };
  };

  return (
    <>
      <div className="banner your-turn">
        <strong>{cardName}</strong> ({half}) — {describeAction(ability)}
      </div>
      {targetLabel && (
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>
          Targeting: <strong style={{ color: 'var(--text)' }}>{targetLabel}</strong>
        </div>
      )}
      <Touchpad state={state} tailHex={targetHex} onHex={() => {}} onCursor={handleCursorPx} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={{ flex: 1, padding: '10px 12px' }} onClick={onChangeMove}>Change move</button>
        <button
          className="primary"
          style={{ flex: 2, padding: '10px 12px' }}
          disabled={needsTarget && !target}
          onClick={() => { const a = buildAction(); if (a) onSubmit(a); }}
        >
          {verb}
        </button>
        <button style={{ flex: 1, padding: '10px 12px' }} onClick={() => onSubmit({ kind: 'none' })}>Skip</button>
      </div>
    </>
  );
}

function applyMoveToPreview(ref: React.MutableRefObject<GameState>, unitId: string, dest: Hex) {
  const cur = ref.current;
  const u = cur.units[unitId];
  if (!u) return;
  ref.current = { ...cur, units: { ...cur.units, [unitId]: { ...u, pos: { ...dest } } } };
}

function computePreview(initial: GameState, unitId: string, steps: TurnStep[]): GameState {
  let cur = initial;
  const u = cur.units[unitId];
  if (!u) return cur;
  let pos = { ...u.pos };
  for (const s of steps) {
    if (s.kind === 'move' || s.kind === 'trample_move' || s.kind === 'charge_move') {
      pos = { ...s.moveTo };
    }
  }
  cur = { ...cur, units: { ...cur.units, [unitId]: { ...u, pos } } };
  return cur;
}

function Touchpad({
  state,
  tailHex,
  onHex,
  onCursor,
}: {
  state: GameState;
  tailHex: Hex;
  onHex: (hex: Hex) => void;
  onCursor: (px: { x: number; y: number } | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cursorPxRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastHexKey = useRef<string>('');
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (lastPointerRef.current) return;
    const p = HexMath.hexToPixel(tailHex, HEX_SIZE);
    cursorPxRef.current = { x: p.x, y: p.y };
    lastHexKey.current = HexMath.hexKey(tailHex);
    onCursor({ x: p.x, y: p.y });
  }, [tailHex.q, tailHex.r]);

  const handleDelta = useCallback(
    (dx: number, dy: number) => {
      const el = ref.current;
      const cur = cursorPxRef.current;
      if (!el || !cur) return;
      const now = performance.now();
      if (now - lastSentAt.current < 33) return;
      lastSentAt.current = now;
      const rect = el.getBoundingClientRect();
      const bounds = computeBoardPixelBounds(state);
      const sx = bounds.width / Math.max(1, rect.width);
      const sy = bounds.height / Math.max(1, rect.height);
      cur.x = Math.max(bounds.minX, Math.min(bounds.minX + bounds.width, cur.x + dx * sx));
      cur.y = Math.max(bounds.minY, Math.min(bounds.minY + bounds.height, cur.y + dy * sy));
      onCursor({ x: cur.x, y: cur.y });
      const hex = nearestHexFromPx(state, cur);
      if (!hex) return;
      const key = HexMath.hexKey(hex);
      if (key === lastHexKey.current) return;
      lastHexKey.current = key;
      onHex(hex);
    },
    [state, onHex, onCursor],
  );

  return (
    <div
      ref={ref}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lastPointerRef.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
        const last = lastPointerRef.current;
        if (!last) return;
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last.x = e.clientX;
        last.y = e.clientY;
        if (dx === 0 && dy === 0) return;
        handleDelta(dx, dy);
      }}
      onPointerUp={() => { lastPointerRef.current = null; }}
      onPointerCancel={() => { lastPointerRef.current = null; }}
      style={{
        height: 220, background: 'var(--panel)', border: '2px dashed var(--border)',
        borderRadius: 12, marginBottom: 12, touchAction: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', fontSize: 13, userSelect: 'none',
      }}
    >
      drag to steer the cursor
    </div>
  );
}

function extendPath(
  state: GameState,
  unit: Unit,
  current: Hex[],
  target: Hex,
  budget: number,
  blockedFn?: (h: Hex) => boolean,
): Hex[] {
  if (current.length === 0) return [{ q: unit.pos.q, r: unit.pos.r }];
  const tail = current[current.length - 1]!;
  if (HexMath.hexEq(target, tail)) return current;
  if (current.length >= 2 && HexMath.hexEq(target, current[current.length - 2]!)) {
    return current.slice(0, -1);
  }
  for (let i = current.length - 3; i >= 0; i--) {
    if (HexMath.hexEq(target, current[i]!)) return current.slice(0, i + 1);
  }
  const fixedBlocked = blockedFn ?? Combat.blockedFor(state, unit);
  const onPath = new Set(current.slice(0, -1).map(HexMath.hexKey));
  const blocked = (h: Hex): boolean => fixedBlocked(h) || onPath.has(HexMath.hexKey(h));
  const stepsUsed = current.length - 1;
  const remaining = budget - stepsUsed;
  if (remaining <= 0) return current;
  if (HexMath.hexDistance(tail, target) === 1 && !blocked(target)) return [...current, target];
  const reach = HexMath.bfsReachable(tail, remaining, blocked, { width: state.width, height: state.height });
  let goal = reach.get(HexMath.hexKey(target));
  if (!goal) {
    let bestDist = Infinity;
    let bestSteps = Infinity;
    for (const node of reach.values()) {
      if (node.dist === 0) continue;
      const d = HexMath.hexDistance(node.hex, target);
      if (d < bestDist || (d === bestDist && node.dist < bestSteps)) { bestDist = d; bestSteps = node.dist; goal = node; }
    }
  }
  if (!goal) return current;
  const sub = HexMath.pathTo(reach, HexMath.hexKey(goal.hex));
  return [...current, ...sub.slice(1)];
}
