import type { WebSocket } from 'ws';
import type {
  AbilityStep,
  ActiveEffect,
  AmountRef,
  AttackConsumeOffer,
  AttackElementRider,
  BattleGoalEvent,
  BattleGoalHand,
  BattleGoalScenarioResult,
  Card,
  CardHalf,
  CardSelection,
  CharacterClass,
  CharacterInstance,
  ClientToServer,
  ConditionInstance,
  CurrentTurn,
  Door,
  Element,
  ElementBoardState,
  AdvantageDraw,
  ElementSelector,
  GameEvent,
  HalfSlot,
  Hex,
  ModifierCardInstance,
  ModifierDrawResult,
  MoneyToken,
  MonsterAbilityCard,
  MonsterAbilityStep,
  MonsterAttackEffect,
  MonsterBehavior,
  MonsterConsumeEffect,
  MonsterLevel,
  MonsterRank,
  MonsterStatCard,
  NarrativeEntry,
  ScriptedAction,
  SpawnSlot,
  MonsterTurnAnim,
  MoveAnimation,
  NegativeCondition,
  PendingAction,
  PendingElementChoice,
  PendingTrapChoice,
  PendingForcedMove,
  PendingReactiveItem,
  PersistentTrigger,
  PlacedTileArt,
  PublicGameState,
  Scenario,
  ServerToClient,
  TargetCondition,
  TargetConditionalBonus,
  TrackedHalfState,
  TurnOrderEntry,
  Unit,
  ShopEntry,
} from '@gloomfolk/shared';
import {
  ALL_ELEMENTS,
  applyModifierToAttack,
  archerDeck,
  banditArcher,
  banditScout,
  cityGuard,
  guardDeck,
  cardMatchesLevel,
  bfsForcedMove,
  bfsForcedMovePath,
  bfsPath,
  bfsPathJump,
  bfsReachable,
  bfsReachableJump,
  pathCost,
  bruiser,
  silentKnife,
  createMonsterModifierDeck,
  createStartingModifierDeck,
  dealBattleGoalIds,
  evaluateBattleGoal,
  experienceRequirementByLevel,
  getBattleGoal,
  getScenario,
  goldConversionFor,
  trapDamageFor,
  MAX_SCENARIO_LEVEL,
  MIN_SCENARIO_LEVEL,
  recommendedScenarioLevel,
  hasLineOfSight,
  hexDistance,
  hexEqual,
  hexKey,
  modifierLabel,
  MONEY_TOKEN_CAP,
  reshuffleModifierDeck,
  rotateHexN,
  rotatePattern,
  scoutDeck,
  defaultLoadout,
  defaultPoolForClass,
  startingHandFor,
  triggersReshuffle,
  DEFAULT_SHOP_STOCK,
  getItem,
  validateItemLoadout,
} from '@gloomfolk/shared';

const MONSTER_DECKS = {
  archer: archerDeck,
  scout: scoutDeck,
  guard: guardDeck,
} as const;
import { type CampaignSave, saveCampaign } from './saves.js';
import type { DestinationEval } from './ai.js';
import { determineFocus, determineMovement, readAbility } from './ai.js';

const MONSTER_DEFS = {
  'bandit-archer': banditArcher,
  'bandit-scout': banditScout,
  'city-guard': cityGuard,
} as const;

const MONSTER_DEF_BY_SETID: Record<string, MonsterStatCard | undefined> = {
  archer: banditArcher,
  scout: banditScout,
  guard: cityGuard,
};

/** The stat block (both ranks) for a monster type at a given scenario level.
 *  Monster defs only carry blocks for the levels where the type actually
 *  appears; if the exact level is missing, fall back to the nearest defined
 *  level at or below it, then the nearest above. */
function rankedStatsForLevel(def: MonsterStatCard, level: number) {
  const at = (l: number) => def.levels[l as MonsterLevel];
  const exact = at(level);
  if (exact) return exact;
  for (let l = level - 1; l >= MIN_SCENARIO_LEVEL; l--) {
    const b = at(l);
    if (b) return b;
  }
  for (let l = level + 1; l <= MAX_SCENARIO_LEVEL; l++) {
    const b = at(l);
    if (b) return b;
  }
  return undefined;
}

function monsterDefMatchesSet(defId: string, setId: string): boolean {
  const def = MONSTER_DEFS[defId as keyof typeof MONSTER_DEFS];
  return def?.setId === setId;
}

/** True if the unit's monster type is immune to `condition`. Player units have
 *  no immunities. */
function unitImmuneTo(unit: Unit, condition: NegativeCondition): boolean {
  if (unit.kind !== 'monster') return false;
  const def = MONSTER_DEFS[unit.defId as keyof typeof MONSTER_DEFS];
  return def?.immunities?.includes(condition) ?? false;
}

const CHARACTER_NAMES: Record<string, string> = {
  bruiser: 'Bruiser',
  'silent-knife': 'Silent Knife',
};

const CHARACTER_CLASSES: Record<string, CharacterClass> = {
  [bruiser.id]: bruiser,
  [silentKnife.id]: silentKnife,
};

// Negative conditions the engine actually enforces today. Others are recognized
// (in the action queue) but their gameplay effect may be a no-op for now.
const SUPPORTED_CONDITIONS = new Set<string>([
  'stun',
  'immobilize',
  'disarm',
  'muddle',
  'poison',
]);

/** Conditions that persist until the figure is healed (rather than ticking off
 *  at the end of a turn). Poison and Wound per conditions.md. */
const PERSIST_UNTIL_HEALED = new Set<string>(['poison', 'wound']);

const MAX_PLAYERS = 4;

/** Time between visible steps of a monster group turn (focus → move →
 *  modifier-draw → damage → next monster). Picked to land between "snappy"
 *  and "dramatic" — slow enough to follow each action, fast enough not to
 *  drag in a four-monster set. */
const MONSTER_ANIM_STEP_MS = 800;

function unlockedSlot(): HalfSlot {
  return { status: 'unlocked', cardId: null, useBasic: false, actions: [], performedCount: 0 };
}

/**
 * Apply attack damage to `target` accounting for Shield and Pierce.
 * Effective shield = max(0, target.shield - pierce); damage subtracted by it
 * (down to 0 minimum). Returns damage actually dealt.
 */
function applyDamage(target: Unit, attackAmount: number, pierce: number): number {
  const effShield = Math.max(0, target.shield - pierce);
  const dmg = Math.max(0, attackAmount - effShield);
  target.hp -= dmg;
  return dmg;
}

/**
 * Draw the top card of `p`'s attack-modifier deck. If the deck is empty (only
 * possible if every card has already been discarded this turn), reshuffle the
 * discard back into the deck first. Sets `modifierNeedsReshuffle` if the drawn
 * card is a Null or ×2 (handled at end-of-turn, not instantly, per the rules).
 */
function drawModifier(p: PlayerEntry): ModifierCardInstance {
  if (p.modifierDeck.length === 0) {
    p.modifierDeck = reshuffleModifierDeck([], p.modifierDiscard);
    p.modifierDiscard = [];
    p.modifierNeedsReshuffle = false;
  }
  const drawn = p.modifierDeck.shift()!;
  p.modifierDiscard.push(drawn);
  if (triggersReshuffle(drawn.card)) p.modifierNeedsReshuffle = true;
  return drawn;
}

let modifierDrawSeq = 0;
function nextDrawId(): string {
  modifierDrawSeq += 1;
  return `d${modifierDrawSeq}`;
}

function hasCondition(unit: Unit, kind: NegativeCondition): boolean {
  return unit.conditions.some((c) => c.kind === kind);
}

/** Poison: all attacks targeting a poisoned figure gain +1 Attack
 *  (conditions.md). Returned as a flat add applied after any ×2 doubling. */
function poisonBonus(target: Unit): number {
  return hasCondition(target, 'poison') ? 1 : 0;
}

/** Reconcile advantage and disadvantage sources for a single attack. They do
 *  not stack: an attack carrying both is considered to have neither (a flat
 *  single draw), per advantage-disadvantage-pierce.md. Returns the net mode,
 *  or null for a normal single draw. */
export function resolveAdvantage(
  hasAdvantage: boolean,
  hasDisadvantage: boolean,
): 'advantage' | 'disadvantage' | null {
  if (hasAdvantage === hasDisadvantage) return null;
  return hasAdvantage ? 'advantage' : 'disadvantage';
}

/** Sum of all active move-bonus effects. */
function activeMoveBonus(p: PlayerEntry): number {
  let total = 0;
  for (const e of p.activeEffects) if (e.kind === 'move-bonus') total += e.amount;
  return total;
}

/**
 * Compute attack bonus + pierce from active effects, filtered by attackKind.
 * Also reports whether any matching effect doubles the attack value
 * (`double` is OR'd across effects — multiple doubling flags don't compound).
 * Consumes any 'next-attack' effects in the process.
 */
export function consumeAttackBonus(
  p: PlayerEntry,
  attackKind: 'melee' | 'ranged',
  /** Resolves a ref-valued bonus against the current target. Return `null` to
   *  signal the bonus doesn't apply to this attack (e.g. a target-Shield bonus
   *  vs an unshielded enemy) — the effect is then left unconsumed. Omitted at
   *  call sites with no single target (AOE), where ref bonuses simply skip. */
  resolveRef?: (ref: AmountRef) => number | null,
  /** Whether the attacker is currently Invisible — gates `requiresInvisible`
   *  bonuses (Smoke Bomb). */
  attackerInvisible = false,
): { amount: number; pierce: number; double: boolean } {
  let amount = 0;
  let pierce = 0;
  let double = false;
  const keep: ActiveEffect[] = [];
  for (const e of p.activeEffects) {
    if (e.kind !== 'attack-bonus') {
      keep.push(e);
      continue;
    }
    if (e.attackKind && e.attackKind !== attackKind) {
      keep.push(e);
      continue;
    }
    // Invisible-gated bonus (Smoke Bomb): only applies while Invisible; left
    // unconsumed otherwise so it waits for an attack made while Invisible.
    if (e.requiresInvisible && !attackerInvisible) {
      keep.push(e);
      continue;
    }
    // Target-gated bonuses (e.g. Single Out's +3 vs isolated) are applied
    // per-target by targetConditionalActiveBonus — never consumed here.
    if (e.targetCondition) {
      keep.push(e);
      continue;
    }
    // Ref-valued bonus (e.g. Trickster's Reversal: X+2 from target Shield).
    // A null resolution means it doesn't apply to this attack — keep it.
    let refValue = 0;
    if (e.amountRef) {
      const r = resolveRef ? resolveRef(e.amountRef) : null;
      if (r === null) {
        keep.push(e);
        continue;
      }
      refValue = r;
    }
    amount += e.amount + refValue;
    pierce += e.pierceBonus;
    if (e.doubleAttack) double = true;
    if (e.expires !== 'next-attack') keep.push(e);
  }
  p.activeEffects = keep;
  return { amount, pierce, double };
}

/** Total active retaliate that can hit at distance `dist`. Multiple retaliate
 *  effects stack (their amounts add), each only counting if the attacker is
 *  within that effect's range. Returns null when nothing applies. This matches
 *  the summed value shown by `syncUnitRetaliate` on the status chip. */
/** Acting-order rank weight: a monster set acts named → elite → normal, ties
 *  broken by ascending standee number (revealing-spawning-and-named-monsters.md).
 *  Bosses act first if ever mixed into a set. */
const RANK_ACT_ORDER: Record<MonsterRank, number> = { boss: 0, named: 1, elite: 2, normal: 3 };
export function monsterActOrder(a: Unit, b: Unit): number {
  const byRank = RANK_ACT_ORDER[a.rank ?? 'normal'] - RANK_ACT_ORDER[b.rank ?? 'normal'];
  if (byRank !== 0) return byRank;
  return (a.standeeNumber ?? 0) - (b.standeeNumber ?? 0);
}

function retaliateAgainst(p: PlayerEntry, dist: number): { amount: number } | null {
  let amount = 0;
  for (const e of p.activeEffects) {
    if (e.kind === 'retaliate' && dist <= e.range) amount += e.amount;
  }
  return amount > 0 ? { amount } : null;
}

/**
 * Apply a condition to `unit`. If already present, refresh `appliedThisTurn`
 * (which effectively resets duration per the rulebook). `isOwnTurn` should be
 * true if the unit is currently taking its own turn (so the condition survives
 * the upcoming end-of-turn tick and is cleaned at the end of the next turn).
 */
function applyConditionToUnit(unit: Unit, kind: NegativeCondition, isOwnTurn: boolean): void {
  const existing = unit.conditions.find((c) => c.kind === kind);
  if (existing) {
    existing.appliedThisTurn = isOwnTurn;
  } else {
    unit.conditions.push({ kind, appliedThisTurn: isOwnTurn });
  }
}

/**
 * End-of-turn condition tick. Conditions that were applied during this figure's
 * own turn survive (reset to appliedThisTurn=false); all others are removed.
 */
function tickConditionsEndOfTurn(unit: Unit): NegativeCondition[] {
  const removed: NegativeCondition[] = [];
  unit.conditions = unit.conditions.filter((c) => {
    // Poison/Wound don't expire on a turn boundary — they stay until a heal.
    if (PERSIST_UNTIL_HEALED.has(c.kind)) return true;
    if (c.appliedThisTurn) {
      c.appliedThisTurn = false;
      return true;
    }
    removed.push(c.kind);
    return false;
  });
  // Invisible (positive condition) ticks the same way: applied on own turn
  // survives one end-of-turn, then clears at end of next turn.
  if (unit.invisible) {
    if (unit.invisibleAppliedThisTurn) {
      unit.invisibleAppliedThisTurn = false;
    } else {
      unit.invisible = false;
    }
  }
  return removed;
}

function activeSlotRef(ct: CurrentTurn): HalfSlot | null {
  if (ct.activeSlot === 'top' && ct.topSlot.status === 'engaged') return ct.topSlot;
  if (ct.activeSlot === 'bottom' && ct.bottomSlot.status === 'engaged') return ct.bottomSlot;
  return null;
}

/** Fresh element board: every element starts inert at scenario start. */
export function freshElementBoard(): ElementBoardState {
  const o = {} as Record<Element, 'strong' | 'waning' | 'inert'>;
  for (const e of ALL_ELEMENTS) o[e] = 'inert';
  return o;
}

/** Wane one column to the left: strong → waning → inert. End-of-round only. */
function waneBoard(board: ElementBoardState): ElementBoardState {
  const out = {} as Record<Element, 'strong' | 'waning' | 'inert'>;
  for (const e of ALL_ELEMENTS) {
    const col = board[e];
    out[e] = col === 'strong' ? 'waning' : col === 'waning' ? 'inert' : 'inert';
  }
  return out;
}

/** Was this element strong or waning at the snapshot? */
function isAvailableAt(snapshot: ElementBoardState, e: Element): boolean {
  const col = snapshot[e];
  return col === 'strong' || col === 'waning';
}

/** Concrete elements that a selector resolves to without prompting. Returns
 *  null when the selector is wild/mixed and a party choice is required. */
function selectorConcrete(sel: ElementSelector): Element | null {
  if (typeof sel === 'string') return sel;
  return null;
}

function selectorOptions(sel: ElementSelector): readonly Element[] {
  if (typeof sel === 'string') return [sel];
  if (sel.kind === 'wild') return ALL_ELEMENTS;
  return sel.options;
}

/** Concrete element list for an AttackElementRider.consume. Returns null when
 *  the rider names a wild/mixed selector (deferred until player opts in). */
function riderConsumeElements(
  consume: ElementSelector | { readonly all: readonly Element[] },
): readonly Element[] | null {
  if (typeof consume === 'object' && 'all' in consume) return consume.all;
  return typeof consume === 'string' ? [consume] : null;
}

/** Build the basic-action queue substituted for a half. */
function basicActions(slot: 'top' | 'bottom'): PendingAction[] {
  if (slot === 'top') {
    return [
      {
        id: 'a1',
        type: 'attack',
        amount: 2,
        range: 1,
        pierce: 0,
        targets: 1,
        targetsRemaining: 1,
        hitsLanded: 0,
        hitTargetIds: [],
        consumeOffers: [],
        acceptedConsumeIndices: [],
        lockedRiderAttack: 0,
        lockedRiderPierce: 0,
        consumesLocked: false,
        done: false,
      },
    ];
  }
  return [{ id: 'a1', type: 'move', amount: 2, done: false }];
}

/**
 * Which AmountRef kinds the engine can resolve today. Refs outside this set
 * make the step fall back to an `unsupported` PendingAction.
 *
 * Supported:
 *   - 'hexes-moved-this-turn' (live, turn-scoped counter)
 *   - 'damage-dealt-this-turn' (live, turn-scoped counter)
 *   - 'target-shield-value' (per-target; resolved at hit time in the attack
 *     handler — the live broadcast value is just `offset` since no target is
 *     known yet)
 */
function isSupportedAmountRef(a: unknown): a is AmountRef {
  if (!a || typeof a !== 'object') return false;
  const kind = (a as { kind?: unknown }).kind;
  return (
    kind === 'hexes-moved-this-turn' ||
    kind === 'damage-dealt-this-turn' ||
    kind === 'target-shield-value'
  );
}

/**
 * Resolve an AmountRef to a concrete number. Pass `target` for per-target
 * refs (currently 'target-shield-value'); when omitted those refs fall back
 * to just `offset` so the live-broadcast display doesn't blow up.
 */
function resolveAmountRef(ref: AmountRef, ct: CurrentTurn, target?: Unit): number {
  switch (ref.kind) {
    case 'hexes-moved-this-turn':
      return ct.hexesMovedThisTurn;
    case 'damage-dealt-this-turn':
      return ct.damageDealtThisTurn;
    case 'target-shield-value':
      return (target?.shield ?? 0) + (ref.offset ?? 0);
  }
}

/**
 * On a persistent-tracked half, the active bonus re-fires per trigger rather
 * than once at engage. We therefore split each ability's steps:
 *   - `oneShot: true` ability → all steps go to the engage queue.
 *   - non-oneShot ability:
 *       - `modify-future-move` / `modify-future-attack` → engage queue (sticky
 *         bonus; lifetime tied to source card via 'end-scenario' + explicit
 *         clear on card expiry).
 *       - everything else → deferred (stored on TrackedHalfState.triggerSteps,
 *         fired per trigger by fireTrackedTrigger).
 * Returns true when the step should be deferred (not in engage queue).
 */
function shouldDeferForTrackedHalf(
  step: AbilityStep,
  abilityOneShot: boolean,
): boolean {
  if (abilityOneShot) return false;
  if (step.type === 'modify-future-move' || step.type === 'modify-future-attack') return false;
  return true;
}

/** Collect deferred steps from a persistent-tracked half (the trigger payload). */
export function collectTriggerSteps(half: CardHalf): AbilityStep[] {
  const out: AbilityStep[] = [];
  for (const ability of half.abilities) {
    const oneShot = ability.oneShot ?? false;
    for (const step of ability.steps) {
      if (shouldDeferForTrackedHalf(step, oneShot)) out.push(step);
    }
  }
  return out;
}

/**
 * Build the action queue for a printed half. Walks abilities/steps in printed
 * order and emits a PendingAction for each supported step. Unsupported step
 * types become `unsupported` actions so the player can see what's on the card
 * even if the engine can't resolve them yet.
 *
 * `riderSink` collects printed AttackElementRider lists keyed by emitted
 * PendingAction id so the room can recompute consume offers on each broadcast
 * without re-walking the card.
 */
function buildActionQueue(
  half: CardHalf,
  riderSink: Map<string, readonly AttackElementRider[]>,
): PendingAction[] {
  const out: PendingAction[] = [];
  let n = 0;
  const nextId = () => `a${++n}`;
  const trackedHalf = half.disposition === 'persistent-tracked';
  for (const ability of half.abilities) {
    const abilityOneShot = ability.oneShot ?? false;
    for (const step of ability.steps) {
      // Persistent-tracked: defer non-oneShot non-modify-future-* steps.
      if (trackedHalf && shouldDeferForTrackedHalf(step, abilityOneShot)) continue;
      // create-element is resolved automatically at finishHalf (per the
      // rulebook, infusion happens at end-of-turn if any ability of the
      // action was performed). It is not a player-clickable action.
      if (step.type === 'create-element') continue;
      if (step.type === 'move') {
        const jump = step.traits?.includes('jump') ? { jump: true as const } : {};
        const bypass = step.mayBypassTraps ? { mayBypassTraps: true as const } : {};
        if (typeof step.amount === 'number') {
          out.push({ id: nextId(), type: 'move', amount: step.amount, ...jump, ...bypass, done: false });
        } else if (isSupportedAmountRef(step.amount)) {
          out.push({
            id: nextId(),
            type: 'move',
            amount: 0,
            amountRef: step.amount,
            ...jump,
            ...bypass,
            done: false,
          });
        } else {
          out.push({ id: nextId(), type: 'unsupported', description: describeStep(step), done: false });
        }
      } else if (step.type === 'attack') {
        const numericAmount = typeof step.amount === 'number' ? step.amount : null;
        const refAmount = numericAmount === null && isSupportedAmountRef(step.amount) ? step.amount : null;
        if (numericAmount === null && refAmount === null) {
          out.push({ id: nextId(), type: 'unsupported', description: describeStep(step), done: false });
        } else {
          const tgt = step.target;
          const pierce = step.modifiers?.pierce?.amount ?? 0;
          if (tgt && tgt.kind === 'aoe') {
            const id = nextId();
            const riders = step.modifiers?.elementRiders ?? [];
            if (riders.length > 0) riderSink.set(id, riders);
            out.push({
              id,
              type: 'attack-aoe',
              amount: numericAmount ?? 0,
              ...(refAmount ? { amountRef: refAmount } : {}),
              pierce,
              pattern: tgt.pattern.map((h) => ({ q: h.q, r: h.r })),
              hitsLanded: 0,
              consumeOffers: [],
              acceptedConsumeIndices: [],
              lockedRiderAttack: 0,
              lockedRiderPierce: 0,
              consumesLocked: false,
              ...(step.modifiers?.targetConditionalBonuses
                ? { targetConditionalBonuses: step.modifiers.targetConditionalBonuses }
                : {}),
              done: false,
            });
          } else {
            const range =
              tgt && tgt.kind === 'ranged' && typeof tgt.range === 'number' ? tgt.range : 1;
            const targets =
              tgt && tgt.kind === 'ranged' && typeof tgt.targets === 'number' ? tgt.targets : 1;
            const id = nextId();
            const riders = step.modifiers?.elementRiders ?? [];
            if (riders.length > 0) riderSink.set(id, riders);
            out.push({
              id,
              type: 'attack',
              amount: numericAmount ?? 0,
              ...(refAmount ? { amountRef: refAmount } : {}),
              range,
              pierce,
              targets,
              targetsRemaining: targets,
              hitsLanded: 0,
              hitTargetIds: [],
              consumeOffers: [],
              acceptedConsumeIndices: [],
              lockedRiderAttack: 0,
              lockedRiderPierce: 0,
              consumesLocked: false,
              ...(step.modifiers?.targetConditionalBonuses
                ? { targetConditionalBonuses: step.modifiers.targetConditionalBonuses }
                : {}),
              done: false,
            });
          }
        }
      } else if (step.type === 'heal') {
        out.push({
          id: nextId(),
          type: 'heal',
          amount: step.amount,
          range: 0,
          selfOnly: step.target.kind === 'self',
          done: false,
        });
      } else if (step.type === 'shield') {
        out.push({ id: nextId(), type: 'shield', amount: step.amount, done: false });
      } else if (step.type === 'push') {
        out.push({
          id: nextId(),
          type: 'push',
          amount: step.amount,
          range: step.range ?? 1,
          done: false,
        });
      } else if (step.type === 'pull') {
        out.push({
          id: nextId(),
          type: 'pull',
          amount: step.amount,
          range: step.range ?? 1,
          done: false,
        });
      } else if (step.type === 'modify-future-move') {
        // Persistent move bonus. For persistent-tracked hosts we use
        // 'end-scenario' so the bonus survives round end; the engine clears
        // it explicitly when the source card's slots are exhausted (see
        // fireTrackedTrigger).
        out.push({
          id: nextId(),
          type: 'modify-future-move',
          amount: step.bonusAmount,
          expires:
            half.disposition === 'persistent-scenario' || half.disposition === 'persistent-tracked'
              ? 'end-scenario'
              : 'end-round',
          done: false,
        });
      } else if (step.type === 'modify-future-attack') {
        const expires =
          step.appliesTo === 'next-attack-ability'
            ? 'next-attack'
            : step.appliesTo === 'all-attacks-this-round'
              ? 'end-round'
              : 'end-scenario'; // 'while-persistent-active' — cleared by fireTrackedTrigger on card expiry
        const amount = typeof step.bonusAmount === 'number' ? step.bonusAmount : 0;
        // A non-numeric bonus (e.g. Trickster's Reversal: X+2 from the target's
        // Shield) is carried as a ref and resolved per target at attack time.
        const refAmount =
          typeof step.bonusAmount !== 'number' && isSupportedAmountRef(step.bonusAmount)
            ? step.bonusAmount
            : null;
        // A while-active bonus on an "attack while Invisible" half only applies
        // while the attacker is Invisible (Smoke Bomb).
        const requiresInvisible = half.persistentTrigger?.kind === 'attack-while-invisible';
        out.push({
          id: nextId(),
          type: 'modify-future-attack',
          amount,
          ...(refAmount ? { amountRef: refAmount } : {}),
          ...(requiresInvisible ? { requiresInvisible: true as const } : {}),
          pierceBonus: step.pierceBonus ?? 0,
          expires,
          ...(step.attackKind ? { attackKind: step.attackKind } : {}),
          ...(step.doubleAttack ? { doubleAttack: true as const } : {}),
          ...(step.targetCondition ? { targetCondition: step.targetCondition } : {}),
          done: false,
        });
      } else if (step.type === 'retaliate') {
        out.push({
          id: nextId(),
          type: 'grant-retaliate',
          amount: step.amount,
          range: 1,
          expires: half.disposition === 'persistent-scenario' ? 'end-scenario' : 'end-round',
          done: false,
        });
      } else if (step.type === 'apply-condition' && SUPPORTED_CONDITIONS.has(step.condition)) {
        const tgt = step.target;
        const condition = step.condition as NegativeCondition;
        // A condition with no target of its own "rides on the prior attack"
        // (see cards/types.ts apply-condition.target). Attach it to the most
        // recent attack so it auto-applies to whatever that attack hits, rather
        // than prompting for a separate target.
        const host =
          tgt === undefined
            ? [...out].reverse().find((a) => a.type === 'attack' || a.type === 'attack-aoe')
            : undefined;
        if (host && (host.type === 'attack' || host.type === 'attack-aoe')) {
          host.riderConditions = [...(host.riderConditions ?? []), condition];
        } else {
          const range =
            tgt && tgt.kind === 'ranged' && typeof tgt.range === 'number' ? tgt.range : 1;
          out.push({
            id: nextId(),
            type: 'apply-condition',
            condition,
            range,
            done: false,
          });
        }
      } else if (
        step.type === 'apply-condition' &&
        step.condition === 'invisible' &&
        step.target?.kind === 'self'
      ) {
        out.push({ id: nextId(), type: 'become-invisible', done: false });
      } else if (step.type === 'loot') {
        out.push({ id: nextId(), type: 'loot', range: step.range, done: false });
      } else if (step.type === 'negate-damage') {
        // Reaches here only for non-tracked persistent halves (a tracked half
        // defers negate-damage to its damage-suffered trigger). Arm a
        // round/scenario-scoped negate the player confirms like any action.
        out.push({
          id: nextId(),
          type: 'negate-damage',
          expires: half.disposition === 'persistent-scenario' ? 'end-scenario' : 'end-round',
          done: false,
        });
      } else if (step.type === 'destroy-trap') {
        out.push({
          id: nextId(),
          type: 'destroy-trap',
          gainExp: step.gainExp ?? 0,
          eligibleHexes: [],
          done: false,
        });
      } else if (step.type === 'gain-exp' || step.type === 'when') {
        // Auto-resolved at half-finish (see Room.awardHalfXp); skip emitting
        // a PendingAction so they don't appear in the user-facing queue.
      } else {
        out.push({
          id: nextId(),
          type: 'unsupported',
          description: describeStep(step),
          done: false,
        });
      }
    }
  }
  return out;
}

function describeStep(step: { type: string }): string {
  // Best-effort label for unsupported step types so the player sees them.
  const s = step as Record<string, unknown>;
  switch (step.type) {
    case 'apply-condition':
      return `Apply ${(s.condition as string) ?? '?'}`;
    case 'push':
      return `Push ${(s.amount as number) ?? '?'}`;
    case 'pull':
      return `Pull ${(s.amount as number) ?? '?'}`;
    case 'gain-exp':
      return `+${(s.amount as number) ?? '?'} EXP`;
    case 'loot':
      return `Loot ${(s.range as number) ?? '?'}`;
    case 'create-element':
      return `Create ${(s.element as string) ?? '?'}`;
    case 'retaliate':
      return `Retaliate ${(s.amount as number) ?? '?'}`;
    case 'when':
      return 'Conditional effect';
    case 'modify-future-attack':
      return 'Modify future attack';
    case 'modify-future-move':
      return 'Modify future move';
    default:
      return step.type;
  }
}

function characterHp(characterId: string): number {
  if (characterId === 'bruiser') return bruiser.hp[1] ?? 10;
  // Silent Knife class file not yet defined — use a sane default.
  return 8;
}

interface PlayerEntry {
  playerId: string;
  name: string;
  activeCharacterId: string | null;
  /** Stable per-device id used to dedupe rejoins from the same phone. */
  deviceId: string | null;
  socket: WebSocket | null;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  active: Card[];
  activeTracked: TrackedHalfState[];
  activeEffects: ActiveEffect[];
  /** Deferred XP from `on-next-retaliate-this-round` riders: each entry is
   *  granted the next time this player retaliates, then the queue is cleared.
   *  Expires (drops) at end of round if no retaliate occurred. */
  pendingRetaliateXp: { amount: number; label: string }[];
  selection: CardSelection | null;
  /** Placement phase: true once this player has placed and tapped Ready. */
  placementReady: boolean;
  modifierDeck: ModifierCardInstance[];
  modifierDiscard: ModifierCardInstance[];
  modifierNeedsReshuffle: boolean;
  shortRestPending: { lostCardId: string; rerollableCardIds: string[] } | null;
  longRestPending: {
    step: 'choose_lost' | 'choose_optional';
    candidateCardIds: string[];
    healUsed: boolean;
  } | null;
}

export class Room {
  campaign: CampaignSave;
  hostSockets = new Set<WebSocket>();
  players = new Map<string, PlayerEntry>();
  units: Unit[] = [];
  phase: PublicGameState['phase'] = 'lobby';
  round = 0;
  turnOrder: TurnOrderEntry[] = [];
  activeTurnIndex = 0;
  currentTurn: CurrentTurn | null = null;
  events: GameEvent[] = [];
  moneyTokens: MoneyToken[] = [];
  moneyTokensPlaced = 0;
  scenarioLevel = 0;
  /** Latest unit slide for client-side animation. Sticky — clients de-dupe on
   *  `id`, so a stale entry just sits here until the next move. */
  lastMove: MoveAnimation | null = null;
  /** Active player's staged push/pull preview — broadcast to all clients so
   *  the desktop can render the planned path. */
  pendingForcedMove: PendingForcedMove | null = null;
  /** Live element board. Shared across all figures; persists round-to-round
   *  (waning at end of round, refreshed by infusions). */
  elementBoard: ElementBoardState = freshElementBoard();
  /** Shared monster attack-modifier deck. Every monster on the board draws
   *  from this single deck. Reshuffles at end of round if a Null or ×2 was
   *  drawn. */
  monsterModifierDeck: ModifierCardInstance[] = [];
  monsterModifierDiscard: ModifierCardInstance[] = [];
  monsterModifierNeedsReshuffle = false;
  /** Step-by-step animation state for the active monster group turn. The
   *  generator advances one yield per ~MONSTER_ANIM_STEP_MS; clients see one
   *  spotlight + arrow + modifier flip per step. Null when no monster group
   *  is currently resolving. */
  monsterTurnAnim: MonsterTurnAnim | null = null;
  private monsterAnimGen: Generator<unknown, void, unknown> | null = null;
  private monsterAnimTimer: ReturnType<typeof setTimeout> | null = null;
  /** Outstanding reactive-item prompt pausing the monster animation (e.g.
   *  Leather Armor). The generator is suspended until respondReactiveItem. */
  pendingReactiveItem: PendingReactiveItem | null = null;
  /** Outstanding wild/mixed element selector waiting on a party/player pick. */
  pendingElementChoice: PendingElementChoice | null = null;
  /** Continuation invoked when `pendingElementChoice` is resolved. Captures
   *  whatever follow-up the prompt was blocking (queue the infusion, mark
   *  consume, etc.). */
  private pendingChoiceFollowup: ((picked: Element) => void) | null = null;
  /** Outstanding trap spring-or-bypass prompt (cards with `mayBypassTraps`). */
  pendingTrapChoice: PendingTrapChoice | null = null;
  /** Continuation invoked when `pendingTrapChoice` is resolved with the
   *  player's spring/bypass decision; resumes walking the move's trap hexes. */
  private pendingTrapFollowup: ((spring: boolean) => void) | null = null;
  private nextTrapChoiceN = 1;
  /** Trap hexes that have been sprung (or destroyed) this scenario, by hexKey.
   *  The scenario tile definition is a shared singleton, so per-room trap
   *  removal is tracked here and applied in `scenarioTiles()` rather than by
   *  mutating the scenario. */
  private sprungTraps = new Set<string>();
  /** Move actions (keyed `slot:actionId`) whose trap tracking has been reset
   *  this turn. Lets a multi-confirm move accumulate entered trap hexes while a
   *  brand-new move ability starts fresh. Cleared each turn in openTurn. */
  private movesStartedThisTurn = new Set<string>();
  /** Battle goals dealt this scenario, keyed by characterId. Secret — only
   *  surfaced to the owning player via PrivatePlayerState, and revealed to
   *  everyone at scenario end. */
  private battleGoalHands = new Map<string, BattleGoalHand>();
  /** Append-only log of battle-goal events for the current scenario. Folded
   *  through each character's chosen-goal tracker at scenario end. */
  private battleGoalLog: BattleGoalEvent[] = [];
  /** Revealed results, populated by endScenario. */
  private battleGoalResults: BattleGoalScenarioResult[] | null = null;
  /** Monster-type ids that appeared this scenario (for Exterminator). */
  private monsterTypesSeen = new Set<string>();
  /** Rooms currently revealed. Empty set means "no room gating" (single-room
   *  scenarios show everything). The starting room is added at scenario start;
   *  more rooms are added as doors open. */
  private revealedRooms = new Set<string>();
  /** Available starting hexes for the placement phase (player-start overlays in
   *  the revealed starting room). Players claim distinct ones before play. */
  private startingPositions: Hex[] = [];
  /** Door ids that have already been opened (so they can't reveal twice). */
  private openedDoorIds = new Set<string>();
  /** Rooms we've already announced as cleared (for one-time "door unlocked"
   *  event log lines). */
  private clearedRoomsAnnounced = new Set<string>();
  /** Per spawned monster unit id → its room (for room-cleared / reveal logic). */
  private monsterRoomById = new Map<string, string>();
  /** Per spawned monster unit id → its behavior (normal / dummy / scripted). */
  private monsterBehaviorById = new Map<string, MonsterBehavior>();
  /** Scripted action per monster set this round (for the synthetic ability
   *  card scripted figures perform instead of drawing). Rebuilt each round. */
  private scriptedActionBySet = new Map<string, ScriptedAction>();
  /** Story-text blocks waiting to be shown (FIFO). The head is broadcast as
   *  `narrative`; players dismiss it to advance. */
  private narrativeQueue: NarrativeEntry[] = [];
  /** Monotonic unit-id counter for the current scenario (players + monsters,
   *  including monsters spawned later when a door opens). */
  private nextUnitN = 1;
  /** Unit ids of monsters whose group has taken its turn this round. Cleared
   *  each round. Drives Assassin (kill before it acts) and Vanguard. */
  private monstersActedThisRound = new Set<string>();
  /** Per monster type (`monsterId`), the standee numbers currently in use this
   *  scenario. Drawn at random on placement, returned to the pool on death —
   *  mirrors the physical standee bag. Cleared at scenario start. */
  private standeesInUse = new Map<string, Set<number>>();
  private nextEventId = 1;
  private nextMoneyTokenN = 1;
  private nextMoveId = 1;
  private nextChoiceN = 1;
  /** Printed-card rider sources keyed by emitted PendingAction id. Lets
   *  refreshConsumeOffers recompute available consume offers each broadcast
   *  without re-walking the card. Reset every openTurn. */
  private riderSources = new Map<string, readonly AttackElementRider[]>();

  constructor(campaign: CampaignSave) {
    this.campaign = campaign;
    // Drop stale entries from prior sessions that never claimed a character.
    // Saved player records that did claim a character stay in campaign.players
    // so attachPlayer can lazily restore them on reconnect (by saved playerId)
    // or hand the character off to a fresh player via takeover.
    campaign.players = campaign.players.filter((p) => p.activeCharacterId);
    // Initialize shop stock on legacy saves that predate items.
    if (!Array.isArray(campaign.shop)) {
      campaign.shop = DEFAULT_SHOP_STOCK.map((s) => ({ ...s }));
    }
    // Backfill item fields on legacy character instances.
    for (const ch of campaign.characters) {
      if (!Array.isArray(ch.ownedItemIds)) ch.ownedItemIds = [];
      if (!Array.isArray(ch.broughtItemIds)) ch.broughtItemIds = [];
      if (!Array.isArray(ch.sessionPurchasedItemIds)) ch.sessionPurchasedItemIds = [];
      if (!Array.isArray(ch.spentItemIds)) ch.spentItemIds = [];
      if (!Array.isArray(ch.activeItems)) ch.activeItems = [];
      if (typeof ch.battleGoalCheckmarks !== 'number') {
        ch.battleGoalCheckmarks = 0;
      }
      if (typeof ch.shoppingDone !== 'boolean') ch.shoppingDone = false;
    }
  }

  private newPlayerEntry(
    playerId: string,
    name: string,
    activeCharacterId: string | null,
    socket: WebSocket | null,
    deviceId: string | null = null,
  ): PlayerEntry {
    return {
      playerId,
      name,
      activeCharacterId,
      deviceId,
      socket,
      hand: [],
      discard: [],
      lost: [],
      active: [],
      activeTracked: [],
      activeEffects: [],
      pendingRetaliateXp: [],
      selection: null,
      placementReady: false,
      modifierDeck: [],
      modifierDiscard: [],
      modifierNeedsReshuffle: false,
      shortRestPending: null,
      longRestPending: null,
    };
  }

  attachHost(ws: WebSocket): void {
    this.hostSockets.add(ws);
    this.send(ws, { type: 'state', state: this.publicState() });
  }

  detachHost(ws: WebSocket): void {
    this.hostSockets.delete(ws);
  }

  kickAll(): void {
    // Stop any in-flight monster animation so its scheduled tick doesn't
    // try to broadcast into a torn-down room.
    if (this.monsterAnimTimer) {
      clearTimeout(this.monsterAnimTimer);
      this.monsterAnimTimer = null;
    }
    this.monsterAnimGen = null;
    this.monsterTurnAnim = null;
    const msg: ServerToClient = { type: 'error', message: 'campaign_deleted' };
    // Detach (but don't close) host sockets — the host who issued the delete
    // is one of these, and we still need to send them the refreshed campaign
    // list on the same socket. The host's UI clears its local campaign state
    // on receiving 'campaign_deleted'.
    for (const ws of this.hostSockets) this.send(ws, msg);
    this.hostSockets.clear();
    for (const p of this.players.values()) {
      if (p.socket) {
        this.send(p.socket, msg);
        try { p.socket.close(); } catch { /* noop */ }
      }
      p.socket = null;
    }
  }

  attachPlayer(ws: WebSocket, requestedId?: string, deviceId?: string): string | null {
    let entry = requestedId ? this.players.get(requestedId) : undefined;
    // Idempotent rejoin: a phone that already has a live slot in this campaign
    // (same deviceId) reattaches to it rather than spawning a duplicate — even
    // if it lost its saved playerId (tapped Back / cleared its session).
    if (!entry && deviceId) {
      for (const e of this.players.values()) {
        if (e.deviceId && e.deviceId === deviceId) {
          entry = e;
          break;
        }
      }
    }
    if (entry) {
      entry.socket = ws;
      // Backfill the deviceId on a slot created before we knew it (e.g. an
      // older client, or a reconnect by playerId).
      if (deviceId && !entry.deviceId) {
        entry.deviceId = deviceId;
        const saved = this.campaign.players.find((p) => p.playerId === entry!.playerId);
        if (saved && !saved.deviceId) {
          saved.deviceId = deviceId;
          void this.persist();
        }
      }
    } else {
      // Saved-session reconnect: restore a persisted slot (with a claimed
      // character) matched by its playerId or, failing that, its deviceId.
      const saved = this.campaign.players.find(
        (p) =>
          (requestedId && p.playerId === requestedId) ||
          (deviceId && p.deviceId === deviceId),
      );
      if (saved && saved.activeCharacterId) {
        entry = this.newPlayerEntry(
          saved.playerId,
          saved.name,
          saved.activeCharacterId,
          ws,
          saved.deviceId ?? deviceId ?? null,
        );
        this.players.set(saved.playerId, entry);
      }
    }
    if (!entry) {
      if (this.players.size >= MAX_PLAYERS) {
        this.send(ws, { type: 'error', message: 'room_full' });
        try { ws.close(); } catch { /* noop */ }
        return null;
      }
      const playerId = 'p_' + Math.random().toString(36).slice(2, 8);
      const name = `Player ${this.players.size + 1}`;
      entry = this.newPlayerEntry(playerId, name, null, ws, deviceId ?? null);
      this.players.set(playerId, entry);
      this.campaign.players.push({ playerId, name, activeCharacterId: null, ...(deviceId ? { deviceId } : {}) });
      void this.persist();
    }
    this.send(ws, {
      type: 'joined',
      role: 'player',
      playerId: entry.playerId,
      campaignId: this.campaign.id,
    });
    this.broadcastState();
    return entry.playerId;
  }

  detachPlayer(playerId: string): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    entry.socket = null;
    // An unclaimed slot (player connected but never picked a character) is
    // dropped on disconnect so the lobby only lists actual participants.
    if (!entry.activeCharacterId && this.phase === 'lobby') {
      this.players.delete(playerId);
      this.campaign.players = this.campaign.players.filter((p) => p.playerId !== playerId);
      void this.persist();
    }
    this.broadcastState();
  }

  startScenario(
    scenarioId: string,
    level?: number,
    custom?: { scenario: Scenario; tileArt: PlacedTileArt[] },
  ): { ok: true } | { ok: false; reason: string } {
    const scenario = custom?.scenario ?? getScenario(scenarioId);
    if (!scenario) return { ok: false, reason: 'unknown_scenario' };

    const playerSlots = scenario.spawns.filter((s) => s.side === 'player');
    const enemySlots = scenario.spawns.filter((s) => s.side === 'enemy');
    const readyPlayers = [...this.players.values()].filter((p) => p.activeCharacterId);

    // Gloomhaven requires a party of at least two.
    if (readyPlayers.length < 2) {
      return { ok: false, reason: 'need_two_players' };
    }

    const partyLevels: number[] = [];
    for (const p of readyPlayers) {
      const charInst = this.campaign.characters.find(
        (c) => c.id === p.activeCharacterId,
      );
      if (!charInst || charInst.loadout === null || !charInst.shoppingDone) {
        return { ok: false, reason: 'players_not_ready' };
      }
      partyLevels.push(charInst.level);
    }

    // Scenario level drives monster stats, trap/hazard damage, gold conversion
    // and bonus XP (see docs/rules/scenario-level.md). The host may override it
    // in the lobby; otherwise default to the recommended level for the party.
    const chosen = level ?? recommendedScenarioLevel(partyLevels);
    this.scenarioLevel = Math.max(
      MIN_SCENARIO_LEVEL,
      Math.min(MAX_SCENARIO_LEVEL, Math.floor(chosen)),
    );

    // Adopt (or clear) the custom scenario + its artwork. Stored on the
    // campaign so persist() saves it and it survives reload. Set before any
    // currentScenario()-driven setup below so spawns/tiles resolve correctly.
    if (custom) {
      this.campaign.customScenario = custom.scenario;
      this.campaign.tileArt = custom.tileArt;
      console.info(
        `[room] custom scenario "${custom.scenario.name}" started with ` +
          `${custom.tileArt.length} tile-art piece(s).`,
      );
    } else {
      delete this.campaign.customScenario;
      delete this.campaign.tileArt;
    }

    this.units = [];
    this.standeesInUse = new Map();
    this.moneyTokens = [];
    this.moneyTokensPlaced = 0;
    this.nextMoneyTokenN = 1;
    // Reset scenario room/door/narrative state. The starting room (first in the
    // reveal order) is visible immediately; rooms with no `rooms` list aren't
    // gated at all (everything visible).
    this.revealedRooms = new Set(scenario.rooms?.[0] ? [scenario.rooms[0]] : []);
    this.openedDoorIds = new Set();
    this.clearedRoomsAnnounced = new Set();
    this.monsterRoomById = new Map();
    this.monsterBehaviorById = new Map();
    this.scriptedActionBySet = new Map();
    this.narrativeQueue = [];
    this.nextUnitN = 1;
    // Element board resets at scenario start (rulebook: tokens enter the
    // inert column when the table is reset).
    this.elementBoard = freshElementBoard();
    this.pendingElementChoice = null;
    this.pendingChoiceFollowup = null;
    this.pendingTrapChoice = null;
    this.pendingTrapFollowup = null;
    this.sprungTraps = new Set();
    this.movesStartedThisTurn = new Set();
    // Fresh shared monster modifier deck for the scenario.
    this.monsterModifierDeck = createMonsterModifierDeck();
    this.monsterModifierDiscard = [];
    this.monsterModifierNeedsReshuffle = false;
    // Backfill `gold` on any pre-existing character instances loaded from
    // an older save that predates this field.
    for (const ch of this.campaign.characters) {
      if (typeof ch.gold !== 'number') ch.gold = 0;
      if (!('loadout' in ch)) (ch as CharacterInstance).loadout = null;
      if (!Array.isArray(ch.ownedItemIds)) ch.ownedItemIds = [];
      if (!Array.isArray(ch.broughtItemIds)) ch.broughtItemIds = [];
      // A new scenario closes the shopping session — prior purchases are no
      // longer undoable.
      ch.sessionPurchasedItemIds = [];
      ch.spentItemIds = [];
      ch.activeItems = [];
    }

    // Available starting hexes the party will choose from during placement —
    // every player-start slot in a currently-revealed room (all of them at
    // scenario start, since only the starting room is revealed and that's where
    // the starts live).
    this.startingPositions = playerSlots
      .filter((s) => !s.room || this.revealedRooms.has(s.room))
      .map((s) => ({ q: s.hex.q, r: s.hex.r }));

    // Player figures are NOT placed here. Each player picks a starting hex in
    // the placement phase (see placePlayer); we only do the position-independent
    // per-player setup (hand, modifier deck, effects) now.
    readyPlayers.forEach((p) => {
      const charInst = p.activeCharacterId
        ? this.campaign.characters.find((c) => c.id === p.activeCharacterId)
        : null;
      if (!charInst) return;
      p.placementReady = false;
      // Deal starting hand from the character's chosen loadout (if any),
      // falling back to the class default. We resolve loadout card IDs
      // against the class's full card list.
      const classDef = CHARACTER_CLASSES[charInst.classId];
      const chosenIds =
        charInst.loadout && classDef
          ? charInst.loadout
          : classDef
            ? defaultLoadout(classDef, charInst.pool)
            : null;
      if (chosenIds && classDef) {
        const byId = new Map(classDef.cards.map((c) => [c.id, c]));
        p.hand = chosenIds
          .map((id) => byId.get(id))
          .filter((c): c is Card => !!c);
      } else {
        p.hand = [...startingHandFor(charInst.classId)];
      }
      p.discard = [];
      p.lost = [];
      p.active = [];
      p.activeTracked = [];
      p.activeEffects = [];
      p.pendingRetaliateXp = [];
      p.selection = null;
      // Fresh, shuffled attack-modifier deck. Items brought into the scenario
      // can inject extra -1 cards (e.g. Hide Armor adds two).
      const extraMinusOnes: ModifierCardInstance[] = [];
      for (const iid of charInst?.broughtItemIds ?? []) {
        const count = getItem(iid)?.negativeModifierCount ?? 0;
        for (let k = 0; k < count; k++) {
          extraMinusOnes.push({
            id: `item-m${extraMinusOnes.length + 1}`,
            card: { kind: 'flat', amount: -1 },
          });
        }
      }
      p.modifierDeck = extraMinusOnes.length
        ? reshuffleModifierDeck(createStartingModifierDeck(), extraMinusOnes)
        : createStartingModifierDeck();
      p.modifierDiscard = [];
      p.modifierNeedsReshuffle = false;
    });

    // Only spawn enemies in revealed rooms. Enemies in rooms behind a closed
    // door are placed later, when their door is opened (see openDoor).
    enemySlots.forEach((slot) => {
      if (slot.room && !this.revealedRooms.has(slot.room)) return;
      this.spawnEnemySlot(slot, readyPlayers.length);
    });

    // Deal battle goals: each ready character gets three in secret and keeps
    // one. Reset the per-scenario log/results and the monster-type set.
    this.battleGoalHands.clear();
    this.battleGoalLog = [];
    this.battleGoalResults = null;
    this.monsterTypesSeen = new Set(
      enemySlots
        .map((s) => s.monsterId)
        .filter((id): id is string => typeof id === 'string'),
    );
    for (const p of readyPlayers) {
      if (!p.activeCharacterId) continue;
      const charInst = this.campaign.characters.find(
        (c) => c.id === p.activeCharacterId,
      );
      if (charInst && typeof charInst.battleGoalCheckmarks !== 'number') {
        charInst.battleGoalCheckmarks = 0;
      }
      this.battleGoalHands.set(p.activeCharacterId, {
        dealtGoalIds: dealBattleGoalIds(3),
        chosenGoalId: null,
      });
    }

    this.campaign.scenarioId = scenario.id;
    // Show the intro story, then let players choose where to stand. Card
    // selection (round 1) begins only after the host taps Begin in placement.
    this.phase = 'placement';
    this.round = 1;
    // Scenario intro story text, if any.
    if (scenario.narrative?.start) this.narrativeQueue.push(scenario.narrative.start);
    // First round begins.
    this.battleGoalLog.push({ kind: 'round_start', round: 1 });
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Placement phase: claim (or move to) a starting hex. The player's figure is
   *  created on first placement and slid on subsequent picks. Disallowed once
   *  the player has tapped Ready (they must unready to move). */
  placePlayer(playerId: string, hex: Hex): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'placement') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p || !p.activeCharacterId) return { ok: false, reason: 'no_player' };
    if (p.placementReady) return { ok: false, reason: 'already_ready' };
    if (!this.startingPositions.some((s) => hexEqual(s, hex))) {
      return { ok: false, reason: 'not_a_start_hex' };
    }
    // Can't stand where another figure already is.
    const occupant = this.units.find((u) => hexEqual(u.hex, hex));
    if (occupant && occupant.ownerPlayerId !== playerId) {
      return { ok: false, reason: 'hex_occupied' };
    }
    const charInst = this.campaign.characters.find((c) => c.id === p.activeCharacterId);
    if (!charInst) return { ok: false, reason: 'no_character' };
    const existing = this.units.find(
      (u) => u.kind === 'player' && u.ownerPlayerId === playerId,
    );
    if (existing) {
      existing.hex = { q: hex.q, r: hex.r };
    } else {
      const hp = characterHp(charInst.classId);
      this.units.push({
        id: `u${this.nextUnitN++}`,
        kind: 'player',
        defId: charInst.classId,
        name: charInst.name,
        hp,
        hpMax: hp,
        shield: 0,
        retaliate: [],
        conditions: [],
        hex: { q: hex.q, r: hex.r },
        ownerPlayerId: playerId,
        moneyTokensHeld: 0,
      });
    }
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Placement phase: lock in (or release) this player's chosen starting hex.
   *  A player must have placed a figure before they can ready up. */
  setPlacementReady(
    playerId: string,
    ready: boolean,
  ): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'placement') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p || !p.activeCharacterId) return { ok: false, reason: 'no_player' };
    if (
      ready &&
      !this.units.some((u) => u.kind === 'player' && u.ownerPlayerId === playerId)
    ) {
      return { ok: false, reason: 'not_placed' };
    }
    p.placementReady = ready;
    this.broadcastState();
    return { ok: true };
  }

  /** True when every connected character-player has placed a figure and tapped
   *  Ready — the host may begin play. */
  private placementComplete(): boolean {
    const mustPlace = [...this.players.values()].filter(
      (p) => p.activeCharacterId && p.socket !== null,
    );
    if (mustPlace.length === 0) return false;
    return mustPlace.every(
      (p) =>
        p.placementReady &&
        this.units.some((u) => u.kind === 'player' && u.ownerPlayerId === p.playerId),
    );
  }

  /** Placement phase: host begins play. Advances to round-1 card selection. */
  beginScenarioPlay(): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'placement') return { ok: false, reason: 'wrong_phase' };
    if (!this.placementComplete()) return { ok: false, reason: 'placement_incomplete' };
    this.phase = 'card_select';
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Spawn a single enemy slot onto the board. Used at scenario start (revealed
   *  rooms) and when a door reveals a new room. */
  private spawnEnemySlot(slot: SpawnSlot, playerCount: number): void {
    if (!slot.monsterId) return;
    const def = MONSTER_DEFS[slot.monsterId as keyof typeof MONSTER_DEFS];
    if (!def) return;
    // Rank scales with party size (Gloomhaven). Elites use the elite stat
    // block; named/normal use the normal block (named stat overrides aren't
    // modelled yet — see revealing-spawning-and-named-monsters.md). The
    // standee count per slot also varies by party size: a slot with no rank at
    // this count ('none' in the editor — omitted from `ranks` by the compiler)
    // simply isn't placed. Scaling is defined for 2–4 players; clamp solo play
    // to the 2-player column.
    let rank: MonsterRank;
    if (!slot.ranks) {
      rank = 'normal';
    } else {
      const pc = Math.min(4, Math.max(2, playerCount));
      const r = slot.ranks[pc];
      if (!r) return; // 'none' at this party size — this figure doesn't spawn.
      rank = r;
    }
    const ranked = rankedStatsForLevel(def, this.scenarioLevel);
    const stats = rank === 'elite' ? ranked?.elite : ranked?.normal;
    const hp = stats?.hp ?? 5;
    const standeeNumber = this.allocateStandeeNumber(slot.monsterId, def.standeeCount);
    const id = `u${this.nextUnitN++}`;
    this.units.push({
      id,
      kind: 'monster',
      defId: slot.monsterId,
      name: standeeNumber !== undefined ? `${def.name} ${standeeNumber}` : def.name,
      ...(standeeNumber !== undefined ? { standeeNumber } : {}),
      rank,
      hp,
      hpMax: hp,
      shield: 0,
      retaliate: [],
      conditions: [],
      hex: slot.hex,
    });
    if (slot.room) this.monsterRoomById.set(id, slot.room);
    this.monsterBehaviorById.set(id, slot.behavior ?? 'normal');
  }

  /** Behavior of a monster unit (defaults to 'normal'). */
  private behaviorOf(unitId: string): MonsterBehavior {
    return this.monsterBehaviorById.get(unitId) ?? 'normal';
  }

  /** True when every monster originally placed in `room` is dead. */
  private roomCleared(room: string): boolean {
    return !this.units.some(
      (u) => u.kind === 'monster' && this.monsterRoomById.get(u.id) === room,
    );
  }

  /** True when a door's unlock condition is currently satisfied. A
   *  room-cleared door only unlocks once that room is actually revealed —
   *  otherwise a hidden room (whose monsters haven't spawned) would read as
   *  "cleared" and the door would open prematurely. */
  private doorUnlocked(door: Door): boolean {
    if (door.unlock === 'manual') return true;
    const room = door.unlock.allMonstersDeadIn;
    return this.revealedRooms.has(room) && this.roomCleared(room);
  }

  /** The scenario currently in play: a host-supplied custom (builder-authored)
   *  scenario when present, otherwise the registry scenario named by
   *  `campaign.scenarioId`. */
  private currentScenario(): Scenario | null {
    if (this.campaign.customScenario) return this.campaign.customScenario;
    return this.campaign.scenarioId ? getScenario(this.campaign.scenarioId) : null;
  }

  /** Doors the party can open right now: unlocked, and the room they'd reveal
   *  isn't already shown. (Doors sit on tile edges, so we don't require the
   *  door hex itself to be a floor tile.) */
  private openableDoors(): { id: string; hex: Hex }[] {
    const scenario = this.currentScenario();
    if (!scenario?.doors) return [];
    return scenario.doors
      .filter(
        (d) =>
          !this.openedDoorIds.has(d.id) &&
          !this.revealedRooms.has(d.revealsRoom) &&
          this.doorUnlocked(d),
      )
      .map((d) => ({ id: d.id, hex: d.hex }));
  }

  /** Visible, unopened doors with their token numbers, for the board to draw a
   *  door icon + numbered token. The token number is the door's 1-based index
   *  in the scenario's door list (door1 → ①, door2 → ②). */
  private doorViews(): { id: string; hex: Hex; number: number; openable: boolean }[] {
    const scenario = this.currentScenario();
    if (!scenario?.doors) return [];
    const visible = new Set(this.scenarioTiles().map((t) => hexKey(t)));
    return scenario.doors
      .map((d, i) => ({ d, number: i + 1 }))
      .filter(({ d }) => !this.openedDoorIds.has(d.id) && visible.has(hexKey(d.hex)))
      .map(({ d, number }) => ({
        id: d.id,
        hex: { q: d.hex.q, r: d.hex.r },
        number,
        openable: this.doorUnlocked(d) && !this.revealedRooms.has(d.revealsRoom),
      }));
  }

  /** If an unlocked, unopened door sits on `hex`, open it. Called when a player
   *  moves onto a door hex (Gloomhaven: a door opens when a figure enters it). */
  private maybeOpenDoorAt(playerId: string, hex: Hex): void {
    const scenario = this.currentScenario();
    const door = scenario?.doors?.find((d) => hexEqual(d.hex, hex));
    if (!door) return;
    if (this.openedDoorIds.has(door.id)) return;
    if (this.revealedRooms.has(door.revealsRoom)) return;
    if (!this.doorUnlocked(door)) return;
    this.openDoor(playerId, door.id);
  }

  /** Open a door: reveal its room, spawn that room's enemies, and fire its
   *  narrative section. */
  openDoor(_playerId: string, doorId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase === 'lobby' || this.phase === 'victory' || this.phase === 'defeat') {
      return { ok: false, reason: 'wrong_phase' };
    }
    const scenario = this.currentScenario();
    const door = scenario?.doors?.find((d) => d.id === doorId);
    if (!door) return { ok: false, reason: 'unknown_door' };
    if (this.openedDoorIds.has(doorId)) return { ok: false, reason: 'already_open' };
    if (!this.doorUnlocked(door)) return { ok: false, reason: 'door_locked' };

    this.openedDoorIds.add(doorId);
    this.revealedRooms.add(door.revealsRoom);
    const playerCount = this.units.filter((u) => u.kind === 'player').length;
    for (const slot of scenario?.spawns ?? []) {
      if (slot.side === 'enemy' && slot.room === door.revealsRoom) {
        this.spawnEnemySlot(slot, playerCount);
      }
    }
    // Revealed monsters act this round. For any set new to the board, draw its
    // ability card and splice its initiative token relative to the acting
    // figure (docs/rules/revealing-spawning-and-named-monsters.md). Sets already
    // in play keep their existing card — newly-placed members just inherit it.
    if (this.phase === 'turn_resolution') {
      const existingSets = new Set<string>();
      for (const e of this.turnOrder) {
        if (e.kind === 'monster-group') existingSets.add(e.setId);
      }
      const revealedSets = new Set<string>();
      for (const u of this.units) {
        if (u.kind !== 'monster') continue;
        const def = MONSTER_DEFS[u.defId as keyof typeof MONSTER_DEFS];
        if (def && !existingSets.has(def.setId)) revealedSets.add(def.setId);
      }
      const newEntries: TurnOrderEntry[] = [];
      for (const setId of revealedSets) {
        const entry = this.buildMonsterSetTurnEntry(setId);
        if (entry) newEntries.push(entry);
      }
      this.spliceRevealedSetsIntoTurnOrder(newEntries);
    }
    this.pushEvent('A door opens, revealing a new room.');
    if (door.narrativeKey && scenario?.narrative?.[door.narrativeKey]) {
      this.narrativeQueue.push(scenario.narrative[door.narrativeKey]!);
    }
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Dismiss the story-text block currently shown to the party. */
  dismissNarrative(): { ok: true } {
    this.narrativeQueue.shift();
    this.broadcastState();
    return { ok: true };
  }

  selectCards(
    playerId: string,
    leadingId: string,
    secondId: string,
  ): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (leadingId === secondId) return { ok: false, reason: 'cards_must_differ' };
    const leading = p.hand.find((c) => c.id === leadingId);
    const second = p.hand.find((c) => c.id === secondId);
    if (!leading || !second) return { ok: false, reason: 'card_not_in_hand' };
    p.selection = { kind: 'cards', leadingId, secondId };
    this.maybeBeginTurnResolution();
    this.broadcastState();
    return { ok: true };
  }

  /** Effective discard for rest purposes per docs/rules/resting.md: discard
   *  plus active-area cards whose played half doesn't have a lost-disposition
   *  (i.e. cards that don't have a lost icon). Used both for the ≥2 gate and
   *  for the long-rest choose-lost candidate list. */
  private effectiveDiscardForRest(p: PlayerEntry): Card[] {
    const eligibleActive = p.active.filter(
      (c) => c.top.disposition !== 'lost' && c.bottom.disposition !== 'lost',
    );
    return [...p.discard, ...eligibleActive];
  }

  longRest(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (this.effectiveDiscardForRest(p).length < 2) {
      return { ok: false, reason: 'need_two_in_discard' };
    }
    p.selection = { kind: 'long_rest' };
    this.maybeBeginTurnResolution();
    this.broadcastState();
    return { ok: true };
  }

  longRestChooseLost(
    playerId: string,
    cardId: string,
  ): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'turn_resolution') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    const pending = p.longRestPending;
    if (!pending || pending.step !== 'choose_lost') {
      return { ok: false, reason: 'not_choosing_lost' };
    }
    if (!pending.candidateCardIds.includes(cardId)) {
      return { ok: false, reason: 'card_not_candidate' };
    }
    // Battle goals: the long rest resolves here. Emit the rest before its own
    // card loss (Daredevil contract); hand size is captured before discard
    // returns to hand below.
    {
      const cid = this.charIdForPlayer(playerId);
      if (cid) {
        this.emitBG({
          kind: 'rest',
          characterId: cid,
          restKind: 'long',
          handSizeAtRest: p.hand.length,
        });
      }
    }
    // The chosen card may be in discard OR in the active area. Active-area
    // cards never return to hand (only discard does); the lost card is
    // pulled from whichever pile it lives in.
    const discardIdx = p.discard.findIndex((c) => c.id === cardId);
    if (discardIdx >= 0) {
      const [lost] = p.discard.splice(discardIdx, 1);
      if (!lost) return { ok: false, reason: 'card_missing' };
      p.lost.push(lost);
    } else {
      const activeIdx = p.active.findIndex((c) => c.id === cardId);
      if (activeIdx < 0) return { ok: false, reason: 'card_missing' };
      const [lost] = p.active.splice(activeIdx, 1);
      if (!lost) return { ok: false, reason: 'card_missing' };
      p.lost.push(lost);
      // Drop any parallel tracked state for this active card.
      p.activeTracked = p.activeTracked.filter((t) => t.cardId !== lost.id);
      p.activeEffects = p.activeEffects.filter((e) => e.sourceCardId !== lost.id);
    }
    {
      const cid = this.charIdForPlayer(playerId);
      if (cid) this.emitBG({ kind: 'card_lost', characterId: cid, count: 1 });
    }
    // Remaining discard returns to hand. Active-area cards stay put.
    p.hand.push(...p.discard);
    p.discard = [];
    p.longRestPending = { step: 'choose_optional', candidateCardIds: [], healUsed: false };
    const lostCard = p.lost[p.lost.length - 1];
    this.pushEvent(
      `${this.playerDisplayName(p)} long rests — lost ${lostCard?.name ?? '?'}.`,
    );
    const recovered = this.recoverSpentItems(p);
    if (recovered.length > 0) {
      this.pushEvent(
        `${this.playerDisplayName(p)} recovers ${recovered.join(', ')}.`,
      );
    }
    this.broadcastState();
    return { ok: true };
  }

  longRestHeal(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'turn_resolution') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    const pending = p.longRestPending;
    if (!pending || pending.step !== 'choose_optional') {
      return { ok: false, reason: 'not_in_optional_step' };
    }
    if (pending.healUsed) return { ok: false, reason: 'heal_already_used' };
    const unit = this.units.find((u) => u.ownerPlayerId === p.playerId);
    if (!unit) return { ok: false, reason: 'no_unit' };
    const restored = this.healUnit(unit, 2);
    pending.healUsed = true;
    if (restored > 0) {
      this.pushEvent(`${unit.name} heals ${restored} from long rest.`);
    }
    this.broadcastState();
    return { ok: true };
  }

  longRestFinish(playerId: string): { ok: true } | { ok: false; reason: string } {
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (!p.longRestPending) return { ok: false, reason: 'not_resting' };
    p.longRestPending = null;
    // Delegate to endTurn for condition tick + auto-loot + turn advance.
    // disposePlayerCards is a no-op since selection.kind !== 'cards'.
    return this.endTurn(playerId);
  }

  private playerDisplayName(p: PlayerEntry): string {
    if (p.activeCharacterId) {
      const charInst = this.campaign.characters.find((c) => c.id === p.activeCharacterId);
      if (charInst) return charInst.name;
    }
    return p.name;
  }

  /**
   * Add XP to the player's active character. Emits a narration event so the
   * change is visible mid-scenario. Level-up itself happens at Downtime
   * (between scenarios) per the rulebook — we only accumulate XP here.
   */
  private grantXp(p: PlayerEntry, amount: number, reason: string): void {
    if (amount <= 0) return;
    if (!p.activeCharacterId) return;
    const ch = this.campaign.characters.find((c) => c.id === p.activeCharacterId);
    if (!ch) return;
    ch.xp += amount;
    // Battle goals: in-play experience (not the end-of-scenario bonus).
    this.emitBG({
      kind: 'experience_gained',
      characterId: ch.id,
      amount,
      bonus: false,
    });
    this.pushEvent(`${ch.name} gains +${amount} EXP (${reason}). Total: ${ch.xp}.`);
    // If they're now over the next-level threshold, hint at it. Actual
    // level-up application is a Downtime concern, not implemented yet.
    const nextLevel = (ch.level + 1) as keyof typeof experienceRequirementByLevel;
    const need = experienceRequirementByLevel[nextLevel];
    if (typeof need === 'number' && ch.xp >= need && ch.level < 9) {
      this.pushEvent(`${ch.name} has enough XP to reach level ${nextLevel} at downtime.`);
    }
  }

  /**
   * Apply non-attack damage to a unit (traps, hazards). Mirrors the tail of the
   * monster-attack flow without the modifier-draw/attack-only bits: existing
   * shield reduces it, the `damage-suffered` tracked trigger may negate it, the
   * battle-goal signals fire (`fromAttack: false`), and a unit reduced to 0 HP
   * is exhausted/killed. Returns the damage actually dealt.
   */
  private sufferDamage(unit: Unit, amount: number, source: string): number {
    if (amount <= 0) return 0;
    const playerEntry = unit.ownerPlayerId ? this.players.get(unit.ownerPlayerId) : null;
    let effShield = Math.max(0, unit.shield);
    if (playerEntry) effShield += this.consumeActiveItemShield(playerEntry);
    let dmg = Math.max(0, amount - effShield);
    if (dmg > 0 && playerEntry) {
      const result = this.fireTrackedTrigger(playerEntry, 'damage-suffered');
      if (result.damageNegated || this.consumeNegateNextDamage(playerEntry)) dmg = 0;
    }
    unit.hp -= dmg;
    const cid = this.charIdForUnit(unit);
    if (dmg > 0 && cid) {
      this.emitBG({ kind: 'damage_suffered', characterId: cid, amount: dmg, fromAttack: false });
      this.emitBG({
        kind: 'hp_changed',
        characterId: cid,
        currentHp: Math.max(0, unit.hp),
        maxHp: unit.hpMax,
      });
    }
    this.pushEvent(`${unit.name} suffers ${dmg} damage from ${source}.`);
    if (unit.hp <= 0) {
      if (cid) {
        this.emitBG({ kind: 'character_exhausted', characterId: cid, cause: 'hp' });
      }
      this.units = this.units.filter((u) => u.id !== unit.id);
      this.pushEvent(`${unit.name} is exhausted!`);
    }
    return dmg;
  }

  /** Consume one armed `negate-next-damage` effect (Trickster's Reversal
   *  bottom), if any. Returns true when a source of damage should be negated. */
  private consumeNegateNextDamage(p: PlayerEntry): boolean {
    const idx = p.activeEffects.findIndex((e) => e.kind === 'negate-next-damage');
    if (idx < 0) return false;
    p.activeEffects.splice(idx, 1);
    return true;
  }

  /** Spring the trap on `hex`: remove it and deal trap damage to `unit`. */
  private springTrapAt(unit: Unit, hex: Hex): void {
    this.removeTrapAt(hex);
    this.pushEvent(`${unit.name} springs a trap!`);
    this.sufferDamage(unit, trapDamageFor(this.scenarioLevel), 'a trap');
  }

  /**
   * Fire a persistent-tracked trigger for every active card whose trigger
   * matches. Advances the use-slot, awards `useSlotExp` if any, and expires
   * the card (to `finalPile`) when slots are exhausted. Also clears any
   * activeEffects sourced from an expired card.
   *
   * Called from:
   *   - 'attack-targets-self': monster AI, just before each monster→player attack.
   *   - 'damage-suffered': after damage is dealt to a player unit (pre-hp-apply,
   *     so 'negate-damage' can interpose).
   *   - 'move-ability-performed': after a successful Move action by a player.
   *   - 'attack-against-isolated-enemy', 'melee-attack-against-shielded-enemy',
   *     'attack-while-invisible': fired per landed hit via fireAttackConditionalTriggers.
   */
  /**
   * Consume one charge from each active `shield-on-attack` item the player has
   * brought, returning the total Shield to add against the incoming attack.
   * Exhausted items become spent and drop off the active list.
   */
  private consumeActiveItemShield(p: PlayerEntry): number {
    const instance = this.campaign.characters.find(
      (c) => c.id === p.activeCharacterId,
    );
    if (!instance || !Array.isArray(instance.activeItems)) return 0;
    let bonus = 0;
    for (const ai of instance.activeItems) {
      if (ai.usesRemaining <= 0) continue;
      const effect = getItem(ai.itemId)?.effect;
      if (effect?.kind !== 'shield-on-attack') continue;
      bonus += effect.amount;
      ai.usesRemaining -= 1;
      if (ai.usesRemaining <= 0 && !instance.spentItemIds.includes(ai.itemId)) {
        instance.spentItemIds.push(ai.itemId);
        this.pushEvent(`${instance.name}'s ${getItem(ai.itemId)?.name ?? ai.itemId} is spent.`);
      }
    }
    instance.activeItems = instance.activeItems.filter((ai) => ai.usesRemaining > 0);
    return bonus;
  }

  /** Apply a Heal of `amount` to `unit`, resolving condition interactions
   *  (conditions.md): healing removes Poison and Wound. Poison additionally
   *  prevents the heal from raising current HP (the heal is "used up" clearing
   *  the poison). Returns the HP actually restored. */
  private healUnit(unit: Unit, amount: number): number {
    const hadPoison = hasCondition(unit, 'poison');
    const hadWound = hasCondition(unit, 'wound');
    if (hadPoison || hadWound) {
      unit.conditions = unit.conditions.filter(
        (c) => c.kind !== 'poison' && c.kind !== 'wound',
      );
      const cured = [hadPoison ? 'poison' : null, hadWound ? 'wound' : null]
        .filter((x): x is string => x !== null)
        .join(' and ');
      this.pushEvent(`${unit.name} is cured of ${cured}.`);
      // Battle goals: a heal removed negative condition(s). Attribute to the
      // current actor (heals happen on a character's turn). targetFriendly is
      // true when the healed figure is a player character.
      const actor = this.currentTurn
        ? this.units.find((u) => u.id === this.currentTurn!.unitId) ?? null
        : null;
      const byCharacterId = actor ? this.charIdForUnit(actor) : null;
      const targetFriendly = unit.kind === 'player';
      if (hadPoison) {
        this.emitBG({ kind: 'condition_removed', byCharacterId, targetFriendly, condition: 'poison' });
      }
      if (hadWound) {
        this.emitBG({ kind: 'condition_removed', byCharacterId, targetFriendly, condition: 'wound' });
      }
    }
    // Poison blocks any HP gain from this heal.
    if (hadPoison) return 0;
    const before = unit.hp;
    unit.hp = Math.min(unit.hpMax, unit.hp + amount);
    const gained = unit.hp - before;
    if (gained > 0) {
      const cid = this.charIdForUnit(unit);
      if (cid) {
        this.emitBG({
          kind: 'hp_changed',
          characterId: cid,
          currentHp: unit.hp,
          maxHp: unit.hpMax,
        });
      }
    }
    return gained;
  }

  /** Long rest refreshes spent items (Gloomhaven 2E). Returns the recovered
   *  item names so the rest narration can list them. Items with `lost` usage
   *  are NOT recovered. Also clears any leftover active charges (e.g. a
   *  partially-used Hide Armor) so the item can be re-activated next time. */
  private recoverSpentItems(p: PlayerEntry): string[] {
    const instance = this.campaign.characters.find(
      (c) => c.id === p.activeCharacterId,
    );
    if (!instance) return [];
    const recovered: string[] = [];
    const notRecoverable = (kind: string | undefined) =>
      kind === 'lost' || kind === 'permanently-lost';
    instance.spentItemIds = instance.spentItemIds.filter((id) => {
      const item = getItem(id);
      if (item && !notRecoverable(item.usage.kind)) {
        recovered.push(item.name);
        return false;
      }
      return true;
    });
    if (Array.isArray(instance.activeItems)) {
      instance.activeItems = instance.activeItems.filter((ai) =>
        notRecoverable(getItem(ai.itemId)?.usage.kind),
      );
    }
    return recovered;
  }

  /** Id of an unspent, brought `disadvantage-when-attacked` item the player
   *  could spend in reaction to an incoming attack, or null if none. */
  private findReactiveDisadvantageItem(p: PlayerEntry): string | null {
    const instance = this.campaign.characters.find(
      (c) => c.id === p.activeCharacterId,
    );
    if (!instance) return null;
    for (const id of instance.broughtItemIds) {
      if (instance.spentItemIds.includes(id)) continue;
      if (getItem(id)?.effect.kind === 'disadvantage-when-attacked') return id;
    }
    return null;
  }

  /** Id of an unspent, brought `shield-when-attacked` item the player could
   *  spend in reaction to an incoming attack, or null if none. */
  private findReactiveShieldItem(p: PlayerEntry): string | null {
    const instance = this.campaign.characters.find(
      (c) => c.id === p.activeCharacterId,
    );
    if (!instance) return null;
    for (const id of instance.broughtItemIds) {
      if (instance.spentItemIds.includes(id)) continue;
      if (getItem(id)?.effect.kind === 'shield-when-attacked') return id;
    }
    return null;
  }

  private fireTrackedTrigger(
    p: PlayerEntry,
    kind: PersistentTrigger['kind'],
  ): { damageNegated: boolean } {
    let damageNegated = false;
    if (p.activeTracked.length === 0) return { damageNegated };
    const expiredCardIds: string[] = [];
    const unit = this.units.find((u) => u.ownerPlayerId === p.playerId);
    for (const t of p.activeTracked) {
      if (t.persistentTrigger.kind !== kind) continue;
      // Execute the trigger payload (shield/retaliate/negate-damage). Other
      // step types are accepted by the type system but not used by any
      // current persistent-tracked card; they're no-ops here.
      for (const step of t.triggerSteps) {
        if (step.type === 'shield' && unit) {
          unit.shield += step.amount;
          this.pushEvent(`${unit.name} gains Shield ${step.amount} (${t.cardId}).`);
        } else if (step.type === 'retaliate') {
          p.activeEffects.push({
            id: `e${p.activeEffects.length + 1}`,
            sourceCardId: t.cardId,
            kind: 'retaliate',
            amount: step.amount,
            range: 1,
            expires: 'end-round',
          });
          if (unit) this.pushEvent(`${unit.name} gains Retaliate ${step.amount} (${t.cardId}).`);
        } else if (step.type === 'negate-damage') {
          damageNegated = true;
          if (unit) this.pushEvent(`${unit.name} negates incoming damage (${t.cardId}).`);
        }
      }
      // Award EXP on this slot transition, if any.
      const expIdx = t.currentSlot - 1;
      const exp = t.useSlotExp[expIdx];
      if (typeof exp === 'number' && exp > 0) {
        this.grantXp(p, exp, `slot ${t.currentSlot} of ${t.cardId}`);
      }
      t.currentSlot += 1;
      if (t.currentSlot > t.trackedUses) {
        expiredCardIds.push(t.cardId);
      }
    }
    if (expiredCardIds.length > 0) {
      p.activeTracked = p.activeTracked.filter((t) => !expiredCardIds.includes(t.cardId));
      for (const cid of expiredCardIds) {
        const idx = p.active.findIndex((c) => c.id === cid);
        if (idx === -1) continue;
        const [card] = p.active.splice(idx, 1);
        if (!card) continue;
        // Find finalPile from the half. Look it up in the now-removed tracked
        // entry (we lost it above). Reconstruct: search the card's halves for
        // a persistent-tracked disposition.
        const half =
          card.top.disposition === 'persistent-tracked'
            ? card.top
            : card.bottom.disposition === 'persistent-tracked'
              ? card.bottom
              : null;
        const finalPile = half?.finalPile ?? 'lost';
        if (finalPile === 'lost') p.lost.push(card);
        else p.discard.push(card);
        // Clear any active effects this card was sustaining.
        p.activeEffects = p.activeEffects.filter((e) => e.sourceCardId !== cid);
        this.pushEvent(`${this.playerDisplayName(p)}'s ${card.name} is used up (→ ${finalPile}).`);
      }
    }
    return { damageNegated };
  }

  /**
   * Walk a finished printed half and award all immediate XP it owes:
   *   - `expOnPerform` (any non-basic ability of the half was performed).
   *   - `gain-exp` steps with `immediate` trigger.
   *   - `gain-exp` steps with `per-enemy-targeted` trigger, using the actual
   *     `hitsLanded` of the preceding attack step in the same ability.
   *
   * Deferred:
   *   - `on-next-retaliate-this-round` — queued onto `pendingRetaliateXp` and
   *     granted the next time the player retaliates this round.
   *
   * Awarded elsewhere (at attack-resolution time, not here):
   *   - Element-rider XP — granted in `lockConsumeOffers`.
   *   - Target-conditional XP (adjacent-to-ally / isolated / undamaged, incl.
   *     `all-of`) — granted per landed target in the attack handler.
   *   - `destroy-trap.gainExp` — granted when the trap is destroyed in
   *     `performAction`.
   *
   * Not yet awarded:
   *   - Non-element condition-rider XP (`conditionRiders[].gainExp`, e.g.
   *     "if you moved this turn") on attacks.
   *   - `useSlotExp` on persistent-tracked halves.
   */
  private awardHalfXp(
    p: PlayerEntry,
    half: CardHalf,
    actions: readonly PendingAction[],
    cardName: string,
  ): void {
    if (typeof half.expOnPerform === 'number') {
      this.grantXp(p, half.expOnPerform, cardName);
    }
    // Map printed steps to PendingActions in order. `buildActionQueue` emits
    // one action per supported step type AND for unsupported steps; the only
    // step types it *skips* are 'gain-exp' (handled here) and 'when' wrappers.
    let paIdx = 0;
    for (const ability of half.abilities) {
      let lastAttackHits = 0;
      for (const step of ability.steps) {
        if (step.type === 'gain-exp') {
          const trigger = step.trigger?.kind ?? 'immediate';
          if (trigger === 'immediate') {
            this.grantXp(p, step.amount, cardName);
          } else if (trigger === 'per-enemy-targeted') {
            this.grantXp(p, step.amount * lastAttackHits, cardName);
          } else if (trigger === 'on-next-retaliate-this-round') {
            // Deferred: held until this player's next retaliate this round
            // (see resolveMonsterAttack), then granted and the queue cleared.
            p.pendingRetaliateXp.push({ amount: step.amount, label: cardName });
          }
          continue;
        }
        if (step.type === 'when') {
          continue;
        }
        const pa = actions[paIdx++];
        if (step.type === 'attack' && pa && (pa.type === 'attack' || pa.type === 'attack-aoe')) {
          lastAttackHits = pa.hitsLanded;
        }
      }
    }
  }

  shortRest(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (p.shortRestPending) return { ok: false, reason: 'already_resting' };
    if (p.discard.length < 2) return { ok: false, reason: 'need_two_in_discard' };
    // Battle goals: emit the rest before its own card loss (per the
    // ordering contract Daredevil relies on). Hand size is captured before
    // the discard pile returns to hand.
    {
      const cid = this.charIdForPlayer(playerId);
      if (cid) {
        this.emitBG({
          kind: 'rest',
          characterId: cid,
          restKind: 'short',
          handSizeAtRest: p.hand.length,
        });
      }
    }
    const idx = Math.floor(Math.random() * p.discard.length);
    const [lost] = p.discard.splice(idx, 1);
    if (!lost) return { ok: false, reason: 'no_player' };
    p.lost.push(lost);
    {
      const cid = this.charIdForPlayer(playerId);
      if (cid) this.emitBG({ kind: 'card_lost', characterId: cid, count: 1 });
    }
    const returned = p.discard.slice();
    p.hand.push(...returned);
    p.discard = [];
    p.shortRestPending = {
      lostCardId: lost.id,
      rerollableCardIds: returned.map((c) => c.id),
    };
    this.pushEvent(`${this.playerDisplayName(p)} took a short rest. Lost: ${lost.name}.`);
    this.broadcastState();
    return { ok: true };
  }

  shortRestReroll(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    const pending = p.shortRestPending;
    if (!pending) return { ok: false, reason: 'no_pending_short_rest' };
    if (pending.rerollableCardIds.length === 0) return { ok: false, reason: 'no_other_cards' };

    const lostIdx = p.lost.findIndex((c) => c.id === pending.lostCardId);
    if (lostIdx < 0) return { ok: false, reason: 'lost_card_missing' };
    const restoredCard = p.lost.splice(lostIdx, 1)[0]!;
    p.hand.push(restoredCard);

    const pickIdx = Math.floor(Math.random() * pending.rerollableCardIds.length);
    const newLostId = pending.rerollableCardIds[pickIdx]!;
    const handIdx = p.hand.findIndex((c) => c.id === newLostId);
    if (handIdx < 0) return { ok: false, reason: 'reroll_card_missing' };
    const newLost = p.hand.splice(handIdx, 1)[0]!;
    p.lost.push(newLost);

    const unit = this.units.find((u) => u.ownerPlayerId === p.playerId);
    if (unit) unit.hp = Math.max(0, unit.hp - 1);

    p.shortRestPending = null;
    this.pushEvent(`${this.playerDisplayName(p)} suffered 1 damage to reroll their short rest. Lost: ${newLost.name}.`);
    this.broadcastState();
    return { ok: true };
  }

  shortRestAccept(playerId: string): { ok: true } | { ok: false; reason: string } {
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (!p.shortRestPending) return { ok: true };
    p.shortRestPending = null;
    this.broadcastState();
    return { ok: true };
  }

  unsubmit(playerId: string): void {
    if (this.phase !== 'card_select') return;
    const p = this.players.get(playerId);
    if (!p) return;
    p.selection = null;
    this.broadcastState();
  }

  endTurn(actorId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'turn_resolution') return { ok: false, reason: 'wrong_phase' };
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur) return { ok: false, reason: 'no_active_turn' };
    // Authorize: the active player, or the host (actorId === 'host')
    if (actorId !== 'host') {
      if (cur.kind !== 'player' || cur.playerId !== actorId) {
        return { ok: false, reason: 'not_your_turn' };
      }
    }
    // Auto-finish any still-engaged half so XP/infusions resolve before the
    // turn closes (the final half is intentionally left engaged so the player
    // can click End Turn directly without a "Done" step).
    if (cur.kind === 'player' && this.currentTurn) {
      const ct = this.currentTurn;
      if (ct.topSlot.status === 'engaged') this.finishHalf(cur.playerId, 'top');
      if (ct.bottomSlot.status === 'engaged') this.finishHalf(cur.playerId, 'bottom');
    }
    // Player turn ending: dispose selected cards + tick conditions on the unit.
    if (cur.kind === 'player') {
      const p = this.players.get(cur.playerId);
      if (p) {
        this.disposePlayerCards(p);
        this.maybeReshuffleModifierDeck(p);
      }
      const unit = this.units.find((u) => u.id === cur.unitId);
      if (unit) {
        // Mandatory end-of-turn loot: pick up any money token in this hex.
        this.autoLootForUnit(unit);
        const removed = tickConditionsEndOfTurn(unit);
        for (const k of removed) this.pushEvent(`${unit.name} is no longer ${k}ed.`);
        // Battle goals: snapshot the end-of-turn position.
        const cid = this.charIdForUnit(unit);
        if (cid) {
          this.emitBG({
            kind: 'turn_end_position',
            characterId: cid,
            adjacentCharacterCount: this.adjacentCharacterCount(unit),
            adjacentToWallObstacleOrObjective:
              this.isAdjacentToWallObstacleOrObjective(unit.hex),
          });
        }
      }
      // End-of-turn element infusion: every queued concrete element jumps to
      // the strong column. Multiple queued infusions of the same element all
      // collapse to strong (no stacking).
      if (this.currentTurn && this.currentTurn.pendingInfusions.length > 0) {
        const board = { ...this.elementBoard };
        const infused = new Set<Element>();
        for (const e of this.currentTurn.pendingInfusions) {
          if (board[e] !== 'strong') {
            board[e] = 'strong';
            infused.add(e);
          }
        }
        this.elementBoard = board;
        if (infused.size > 0 && unit) {
          this.pushEvent(`${unit.name} infuses ${[...infused].join(', ')}.`);
        }
      }
    }
    cur.done = true;
    this.currentTurn = null;
    this.pendingForcedMove = null;
    // Did this turn (e.g. via retaliate) clear the last monster? Wrap up.
    this.checkScenarioEnd();
    const phaseAfter = this.phase as PublicGameState['phase'];
    if (phaseAfter === 'victory' || phaseAfter === 'defeat') {
      this.broadcastState();
      return { ok: true };
    }
    if (this.activeTurnIndex + 1 < this.turnOrder.length) {
      this.activeTurnIndex += 1;
      this.openTurn();
    } else {
      this.advanceToNextRound();
    }
    this.broadcastState();
    return { ok: true };
  }

  engageHalf(
    playerId: string,
    slot: 'top' | 'bottom',
    cardId: string,
    useBasic: boolean,
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const p = guard.p;

    const target = slot === 'top' ? ct.topSlot : ct.bottomSlot;
    const other = slot === 'top' ? ct.bottomSlot : ct.topSlot;
    if (target.status !== 'unlocked') return { ok: false, reason: 'slot_not_unlocked' };

    const sel = p.selection;
    if (!sel || sel.kind !== 'cards') return { ok: false, reason: 'no_selection' };
    if (cardId !== sel.leadingId && cardId !== sel.secondId) return { ok: false, reason: 'not_a_selected_card' };
    if (other.cardId === cardId) return { ok: false, reason: 'card_already_used' };

    const card = p.hand.find((c) => c.id === cardId);
    if (!card) return { ok: false, reason: 'card_not_in_hand' };

    const half = slot === 'top' ? card.top : card.bottom;
    // Action-level required elemental cost (printed in the upper-left of
    // the card). All listed elements must be strong/waning at start-of-turn
    // AND still unconsumed; engaging the half consumes them immediately.
    // (No-op when useBasic, since the basic substitution skips the printed
    // cost entirely.)
    if (!useBasic && half.requiredElementCost && half.requiredElementCost.length > 0) {
      const result = this.tryPayRequiredCost(ct, half.requiredElementCost);
      if (!result.ok) return result;
    }

    const actions: PendingAction[] = useBasic
      ? basicActions(slot)
      : buildActionQueue(half, this.riderSources);

    // Winged Shoes (or similar) granted Jump to every move this turn — apply
    // it to moves in this freshly-built queue too.
    if (ct.jumpAllMoves) {
      for (const a of actions) if (a.type === 'move') a.jump = true;
    }

    target.status = 'engaged';
    target.cardId = cardId;
    target.useBasic = useBasic;
    target.actions = actions;
    ct.activeSlot = slot;
    this.broadcastState();
    return { ok: true };
  }

  /**
   * Reverse an engaged half before anything has been performed. Returns the
   * slot to `unlocked` so the player can pick the other card/half. Refunds any
   * required element cost that engaging consumed (engageHalf marks the cost
   * inert immediately). Refused once any action in the half has been performed.
   */
  unengageHalf(
    playerId: string,
    slot: 'top' | 'bottom',
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const target = slot === 'top' ? ct.topSlot : ct.bottomSlot;
    if (target.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    if (target.performedCount > 0 || target.actions.some((a) => a.done)) {
      return { ok: false, reason: 'already_performed' };
    }
    // Refund the required element cost engageHalf consumed (if any). Only the
    // elements this engage paid for sit at the tail of consumedThisTurn, and
    // tryPayRequiredCost only pays when they weren't already consumed — so
    // restoring them to the turn-start board value and dropping them from
    // consumedThisTurn is a clean reversal.
    if (!target.useBasic && target.cardId) {
      const card = guard.p.hand.find((c) => c.id === target.cardId);
      const half = card ? (slot === 'top' ? card.top : card.bottom) : null;
      const cost = half?.requiredElementCost ?? [];
      if (cost.length > 0) {
        const live = { ...this.elementBoard };
        const consumed = [...ct.consumedThisTurn];
        for (const e of cost) {
          live[e] = ct.turnStartElementBoard[e];
          const idx = consumed.indexOf(e);
          if (idx >= 0) consumed.splice(idx, 1);
        }
        this.elementBoard = live;
        ct.consumedThisTurn = consumed;
      }
    }
    target.status = 'unlocked';
    target.cardId = null;
    target.useBasic = false;
    target.actions = [];
    target.performedCount = 0;
    if (ct.activeSlot === slot) ct.activeSlot = null;
    this.broadcastState();
    return { ok: true };
  }

  /** Validate + consume all requiredElementCost entries against the current
   *  turn's start-of-turn snapshot. On success, marks the live board inert
   *  and appends to consumedThisTurn. */
  private tryPayRequiredCost(
    ct: CurrentTurn,
    required: readonly Element[],
  ): { ok: true } | { ok: false; reason: string } {
    // Tally how many of each element are needed (a card might list "fire,
    // fire" — extremely rare but the schema allows it).
    const need = new Map<Element, number>();
    for (const e of required) need.set(e, (need.get(e) ?? 0) + 1);
    const consumed = new Map<Element, number>();
    for (const e of ct.consumedThisTurn) consumed.set(e, (consumed.get(e) ?? 0) + 1);
    for (const [e, count] of need) {
      // Already-consumed entries this turn don't count against the snapshot.
      if (!isAvailableAt(ct.turnStartElementBoard, e)) {
        return { ok: false, reason: `required_${e}_unavailable` };
      }
      if ((consumed.get(e) ?? 0) + count > 1) {
        // Same-element-twice not allowed in one turn.
        return { ok: false, reason: `${e}_already_consumed_this_turn` };
      }
    }
    // Pay the cost.
    const live = { ...this.elementBoard };
    const newConsumed = [...ct.consumedThisTurn];
    for (const e of need.keys()) {
      live[e] = 'inert';
      newConsumed.push(e);
    }
    this.elementBoard = live;
    ct.consumedThisTurn = newConsumed;
    return { ok: true };
  }

  finishHalf(
    playerId: string,
    slot: 'top' | 'bottom',
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const target = slot === 'top' ? ct.topSlot : ct.bottomSlot;
    if (target.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    target.status = 'done';
    if (ct.activeSlot === slot) ct.activeSlot = null;
    // Award XP for the printed half (skipped for basic-substitution halves).
    // "If any part of the [non-basic] action is performed" gates expOnPerform
    // and immediate gain-exp triggers per the rulebook.
    if (!target.useBasic && target.performedCount > 0 && target.cardId) {
      const card = guard.p.hand.find((c) => c.id === target.cardId);
      if (card) {
        const half = slot === 'top' ? card.top : card.bottom;
        this.awardHalfXp(guard.p, half, target.actions, card.name);
        // Queue end-of-turn elemental infusions from this half's
        // create-element steps. Rule: only applies when at least one ability
        // of the action was performed (gated by performedCount > 0 above).
        this.queueInfusionsFromHalf(ct, half, playerId);
      }
    }
    // Battle goals: a half was performed (basic or printed). `lost` reflects a
    // lost-icon printed half; basic actions discard. targetedAlly is not yet
    // detected (TODO — needs action-target inspection; affects Promoter).
    if (target.performedCount > 0) {
      const cid = this.charIdForPlayer(playerId);
      if (cid) {
        let lost = false;
        if (!target.useBasic && target.cardId) {
          const card = guard.p.hand.find((c) => c.id === target.cardId);
          const half = card ? (slot === 'top' ? card.top : card.bottom) : null;
          lost = half?.disposition === 'lost';
        }
        this.emitBG({
          kind: 'ability_performed',
          characterId: cid,
          lost,
          basic: target.useBasic,
          targetedAlly: false,
        });
      }
    }
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Walk a printed half's create-element steps. Concrete selectors append
   *  to ct.pendingInfusions immediately; wild/mixed selectors chain into the
   *  pendingElementChoice prompt sequence. */
  private queueInfusionsFromHalf(
    ct: CurrentTurn,
    half: CardHalf,
    playerId: string,
  ): void {
    const wildPending: ElementSelector[] = [];
    for (const ability of half.abilities) {
      for (const step of ability.steps) {
        if (step.type !== 'create-element') continue;
        const concrete = selectorConcrete(step.element);
        if (concrete) {
          ct.pendingInfusions = [...ct.pendingInfusions, concrete];
        } else {
          wildPending.push(step.element);
        }
      }
    }
    if (wildPending.length === 0) return;
    // Chain prompts in order. Each resolution either pushes the next prompt
    // or appends the picked element + completes the chain.
    const runNext = (queue: ElementSelector[]): void => {
      const next = queue.shift();
      if (!next) return;
      this.pendingElementChoice = {
        id: `c${this.nextChoiceN++}`,
        context: { kind: 'create-element', playerId },
        options: selectorOptions(next),
        prompt: 'Pick an element to infuse',
      };
      this.pendingChoiceFollowup = (picked) => {
        if (this.currentTurn) {
          this.currentTurn.pendingInfusions = [
            ...this.currentTurn.pendingInfusions,
            picked,
          ];
        }
        this.pendingElementChoice = null;
        this.pendingChoiceFollowup = null;
        runNext(queue);
      };
    };
    runNext(wildPending);
  }

  /**
   * Confirm an engaged persistent half whose engage-time queue is empty —
   * i.e. all its meaningful steps are deferred to triggers (e.g. Warding
   * Strength's bottom: Shield + Retaliate that fire on attack-targets-self).
   *
   * The player has no PendingActions to click, so we need an explicit confirm
   * gesture. This credits the half as performed (performedCount = 1) so the
   * end-of-turn disposePlayerCards routes the card to the active pile and
   * creates the activeTracked entry. The "skip" path for the same screen is
   * the existing player_finish_half (no credit → card discards normally).
   */
  confirmPersistentHalf(
    playerId: string,
    slot: 'top' | 'bottom',
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const target = slot === 'top' ? guard.ct.topSlot : guard.ct.bottomSlot;
    if (target.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    if (target.useBasic) return { ok: false, reason: 'basic_has_no_persistent_effect' };
    if (target.actions.some((a) => !a.done)) {
      return { ok: false, reason: 'queue_not_empty' };
    }
    const card = target.cardId ? guard.p.hand.find((c) => c.id === target.cardId) : null;
    if (!card) return { ok: false, reason: 'card_not_in_hand' };
    const half = slot === 'top' ? card.top : card.bottom;
    if (
      half.disposition !== 'persistent-round' &&
      half.disposition !== 'persistent-tracked' &&
      half.disposition !== 'persistent-scenario'
    ) {
      return { ok: false, reason: 'half_not_persistent' };
    }
    // Credit the engagement-confirm as a performance. disposePlayerCards
    // gates routing-to-active on performedCount > 0; finishHalf also gates
    // expOnPerform XP on it.
    target.performedCount = Math.max(target.performedCount, 1);
    return this.finishHalf(playerId, slot);
  }

  /** Skip the half without performing — equivalent to engage + immediate finish with no actions. */
  skipHalf(
    playerId: string,
    slot: 'top' | 'bottom',
    cardId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const r = this.engageHalf(playerId, slot, cardId, false);
    if (!r.ok) return r;
    return this.finishHalf(playerId, slot);
  }

  performAction(
    playerId: string,
    slotKind: 'top' | 'bottom',
    actionId: string,
    target:
      | { hex?: Hex | undefined; unitId?: string | undefined; path?: Hex[] | undefined }
      | undefined,
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const slot = slotKind === 'top' ? ct.topSlot : ct.bottomSlot;
    if (slot.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    const action = slot.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, reason: 'no_action' };
    if (action.done) return { ok: false, reason: 'action_already_done' };

    const unit = this.units.find((u) => u.id === ct.unitId);
    if (!unit) return { ok: false, reason: 'no_unit' };

    // Set when a move pauses for a per-hex trap spring/bypass prompt. The
    // post-switch bookkeeping is then deferred to the trap-resolution
    // continuation (finalizeMoveAction).
    let pausedForTrap = false;
    switch (action.type) {
      case 'move': {
        if (hasCondition(unit, 'immobilize')) return { ok: false, reason: 'immobilized' };
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (!target?.hex) return { ok: false, reason: 'need_hex' };
        if (hexEqual(unit.hex, target.hex)) return { ok: false, reason: 'already_there' };
        // First confirm of this move ability → reset the entered-trap tracking
        // that a later destroy-trap step reads. Subsequent partial confirms of
        // the same action accumulate onto it.
        const moveKey = `${slotKind}:${actionId}`;
        if (!this.movesStartedThisTurn.has(moveKey)) {
          this.movesStartedThisTurn.add(moveKey);
          ct.trapHexesEnteredThisMove = [];
        }
        const startHex = { q: unit.hex.q, r: unit.hex.r };
        // Ordered hexes entered this confirm (excludes the start hex), used to
        // spring/bypass traps after the move commits.
        let enteredHexes: Hex[] = [];
        const moveBonus = activeMoveBonus(guard.p);
        const budget = action.amount + moveBonus;
        const isJump = action.jump === true;
        // A walk pays 2 movement to enter difficult terrain; a jump ignores
        // difficult terrain, so each hex of a jump costs 1.
        const enterCost = isJump ? (() => 1) : this.enterCostForTiles();
        let stepsTaken: number;
        // Movement points this confirm actually spends (difficult terrain
        // inflates it past the physical hex count). Subtracted from the budget
        // below so leftover movement survives a partial confirm.
        let movementCost: number;
        if (target.path && target.path.length > 0) {
          // Client-provided path. `stepsTaken` is the count of hexes actually
          // walked (for cards like Balanced Measure, whose attack equals hexes
          // moved this turn — a path around an obstacle counts every step). The
          // movement budget is spent in movement points, which difficult
          // terrain inflates, so it's checked separately via pathCost.
          const path = target.path;
          movementCost = pathCost(path, enterCost);
          if (movementCost > budget) return { ok: false, reason: 'path_over_budget' };
          const last = path[path.length - 1]!;
          if (!hexEqual(last, target.hex)) return { ok: false, reason: 'path_dest_mismatch' };
          const canEnd = this.passableForUnit(unit.id);
          // Mid-path: a jump ignores all figures, a walk may pass through allies
          // but not enemies. The destination (last step) must still be unoccupied.
          const walkable = isJump ? this.walkableForJump() : this.walkableForUnit(unit);
          let prev = unit.hex;
          for (let i = 0; i < path.length; i++) {
            const step = path[i]!;
            if (hexDistance(prev, step) !== 1) return { ok: false, reason: 'path_not_contiguous' };
            const isLast = i === path.length - 1;
            const ok = isLast ? canEnd(step) : walkable(step);
            if (!ok) return { ok: false, reason: 'path_blocked' };
            prev = step;
          }
          stepsTaken = path.length;
          enteredHexes = path.map((h) => ({ q: h.q, r: h.r }));
        } else {
          const reachable = isJump
            ? this.reachableFromJump(unit.hex, budget, unit.id)
            : this.reachableFrom(unit.hex, budget, unit);
          // `reachable` is keyed by movement cost; presence means it's affordable.
          if (!reachable.has(hexKey(target.hex))) return { ok: false, reason: 'unreachable' };
          movementCost = reachable.get(hexKey(target.hex))!;
          // hexesMovedThisTurn counts physical hexes, not movement points, so
          // reconstruct the cheapest path and use its hex count.
          const canEnd = this.passableForUnit(unit.id);
          const path = isJump
            ? bfsPathJump(unit.hex, target.hex, budget, this.walkableForJump(), canEnd)
            : bfsPath(unit.hex, target.hex, budget, this.walkableForUnit(unit), canEnd, enterCost);
          stepsTaken = path ? path.length - 1 : reachable.get(hexKey(target.hex))!;
          // bfsPath returns [start, …steps]; drop the start to get entered hexes.
          enteredHexes = path ? path.slice(1).map((h) => ({ q: h.q, r: h.r })) : [target.hex];
        }
        unit.hex = target.hex;
        ct.hexesMovedThisTurn += stepsTaken;
        const animPath: Hex[] =
          target.path && target.path.length > 0
            ? [startHex, ...target.path]
            : [startHex, target.hex];
        this.lastMove = { id: this.nextMoveId++, unitId: unit.id, path: animPath };
        // Battle goals: movement signals. `animPath` includes the start hex
        // at [0] and the destination at the end. Pass-through detection only
        // works when the client supplied an explicit path.
        {
          const cid = this.charIdForUnit(unit);
          if (cid) {
            this.emitBG({
              kind: 'character_moved',
              characterId: cid,
              hexes: stepsTaken,
              forced: false,
            });
            // Duelist: each enemy-adjacent hex the unit left.
            for (let i = 0; i < animPath.length - 1; i++) {
              const from = animPath[i]!;
              if (
                this.units.some(
                  (u) =>
                    u.kind === 'monster' &&
                    u.hp > 0 &&
                    hexDistance(u.hex, from) === 1,
                )
              ) {
                this.emitBG({
                  kind: 'exited_enemy_adjacent_hex',
                  characterId: cid,
                  forced: false,
                });
              }
            }
            // Pedestrian: each occupied hex the unit entered (pass-throughs).
            for (let i = 1; i < animPath.length; i++) {
              const h = animPath[i]!;
              const occ = this.units.find(
                (u) => u.id !== unit.id && u.hp > 0 && hexEqual(u.hex, h),
              );
              if (occ) {
                this.emitBG({
                  kind: 'entered_occupied_hex',
                  characterId: cid,
                  occupant: occ.kind === 'monster' ? 'enemy' : 'ally',
                });
              }
            }
            // Overachiever: entered a door hex (best-effort — no door
            // open/closed state is tracked, so re-entries also emit).
            if (this.isDoorHex(target.hex)) {
              this.emitBG({ kind: 'door_opened', characterId: cid });
            }
          }
        }
        // Spend only the movement points this confirm used. If budget remains,
        // keep the move pending so the player can keep moving — e.g. after
        // stopping on a door hex to open it — or Skip the leftover. A move with
        // a dynamic amount (X = hexes moved this turn) stays one-shot, since its
        // "remaining" can't be tracked the same way.
        const remainingBudget = budget - movementCost;
        if (action.amountRef || remainingBudget < 1) {
          action.done = true;
        } else {
          action.amount -= movementCost;
        }
        // Stepping onto an unlocked door opens it (reveals the next room).
        this.maybeOpenDoorAt(playerId, unit.hex);
        // The move-ability trigger represents finishing the whole move, so it
        // fires once the action is actually done — not on each partial confirm.
        if (action.done) this.fireTrackedTrigger(guard.p, 'move-ability-performed');
        // Traps in entered hexes. A move that may bypass traps prompts per hex
        // (spring or leave it); otherwise entered traps spring automatically.
        const trapHexes = enteredHexes.filter((h) => this.isTrapHex(h));
        if (trapHexes.length > 0) {
          if (action.mayBypassTraps) {
            pausedForTrap = true;
            this.resolveTrapHexes(playerId, slotKind, actionId, unit, trapHexes, 0);
          } else {
            for (const h of trapHexes) {
              if (unit.hp > 0) this.springTrapAt(unit, h);
            }
          }
        }
        break;
      }
      case 'attack': {
        if (hasCondition(unit, 'disarm')) return { ok: false, reason: 'disarmed' };
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (action.targetsRemaining <= 0) return { ok: false, reason: 'no_targets_left' };
        if (!target?.unitId) return { ok: false, reason: 'need_target_unit' };
        const tgt = this.units.find((u) => u.id === target.unitId);
        if (!tgt) return { ok: false, reason: 'no_target' };
        if (tgt.kind === 'player') return { ok: false, reason: 'cannot_attack_ally' };
        // Each shot of a multi-target (`Target N`) attack must hit a distinct
        // enemy — an enemy already hit by this same ability can't be re-targeted.
        if (action.hitTargetIds.includes(tgt.id)) return { ok: false, reason: 'already_targeted' };
        const dist = hexDistance(unit.hex, tgt.hex);
        if (dist > action.range) return { ok: false, reason: 'out_of_range' };
        if (action.range > 1 && !this.hasLOS(unit.hex, tgt.hex)) {
          return { ok: false, reason: 'no_line_of_sight' };
        }
        const attackKind: 'melee' | 'ranged' = action.range > 1 ? 'ranged' : 'melee';
        const { amount: bonusAmt, pierce: bonusPierce, double } = consumeAttackBonus(
          guard.p,
          attackKind,
          (ref) =>
            // A target-Shield bonus only applies against a Shielded target;
            // other refs resolve normally.
            ref.kind === 'target-shield-value' && tgt.shield <= 0
              ? null
              : resolveAmountRef(ref, ct, tgt),
          unit.invisible === true,
        );
        // Reset draw reveal at the start of a fresh attack action (i.e. when
        // this is the first target for this multi-target action).
        if (action.targetsRemaining === action.targets) ct.lastModifierDraws = [];
        // Lock in element-rider opt-ins on the first sub-target. Marks the
        // consumed elements inert, grants any rider XP, snapshots the
        // attack/pierce bonus to apply to every sub-target of this ability.
        if (!action.consumesLocked) {
          this.lockConsumeOffers(action, guard.p);
        }
        // Per-target re-resolve for refs whose value depends on the target
        // (e.g. target-shield-value). Counter-based refs (hexes-moved,
        // damage-dealt) were already refreshed by refreshAmountRefs().
        const resolvedAmount =
          action.amountRef && action.amountRef.kind === 'target-shield-value'
            ? resolveAmountRef(action.amountRef, ct, tgt)
            : action.amount;
        // Doubling applies to the printed/inherent attack value only — flat
        // bonuses (consumed activeEffects + locked element riders) are added
        // afterward. See cards/types.ts modify-future-attack.doubleAttack.
        const printedAttack = double ? resolvedAmount * 2 : resolvedAmount;
        // Per-target conditional bonuses (e.g. +2 Attack vs an isolated target):
        // the card's printed bonuses plus any target-gated persistent bonus
        // (Single Out's +3). Evaluated pre-damage so "undamaged" sees full HP.
        const cardCond = this.resolveTargetConditionalBonuses(
          action.targetConditionalBonuses,
          unit,
          tgt,
        );
        const activeCond = this.targetConditionalActiveBonus(guard.p, attackKind, unit, tgt);
        const condAttack = cardCond.attack + activeCond.attack;
        const condPierce = cardCond.pierce + activeCond.pierce;
        const baseAmount =
          printedAttack + bonusAmt + action.lockedRiderAttack + poisonBonus(tgt) + condAttack;
        // Conditional persistent triggers fire BEFORE damage applies, so the
        // "isolated"/"shielded"/"invisible" predicates see pre-attack state.
        this.fireAttackConditionalTriggers(guard.p, unit, tgt, attackKind);
        // Advantage sources: Simple Bow designation on this target, or a printed
        // conditional bonus that grants advantage vs this target.
        // Disadvantage sources: a ranged attack (range > 1) on an ADJACENT
        // target (distance 1) auto-gains Disadvantage (RAW, target-adjacent).
        // Simple Bow rides along with the next ranged attack you perform.
        const chargeAdvantage = ct.advantageCharge && attackKind === 'ranged';
        const hasAdvantage = chargeAdvantage || cardCond.advantage;
        const autoDisadvantage = action.range > 1 && dist === 1;
        const drawMode = resolveAdvantage(hasAdvantage, autoDisadvantage);
        // The Simple Bow charge is consumed on this attack even if it cancelled
        // against the ranged-on-adjacent disadvantage (the item is still spent).
        if (chargeAdvantage) ct.advantageCharge = false;
        const firstDraw = drawModifier(guard.p);
        let drawn = firstDraw;
        let finalAmount = applyModifierToAttack(baseAmount, firstDraw.card);
        // Advantage/Disadvantage: draw a second modifier and keep the better
        // (advantage) or worse (disadvantage) result. Both cards discard.
        let advantageDraw: AdvantageDraw | undefined;
        if (drawMode) {
          const second = drawModifier(guard.p);
          const secondFinal = applyModifierToAttack(baseAmount, second.card);
          const useSecond =
            drawMode === 'advantage' ? secondFinal > finalAmount : secondFinal < finalAmount;
          if (useSecond) {
            drawn = second;
            finalAmount = secondFinal;
          }
          advantageDraw = {
            mode: drawMode,
            cards: [firstDraw.card, second.card],
            usedIndex: useSecond ? 1 : 0,
          };
        }
        // Scouting Lens rides along with the next attack you perform (any range).
        let itemPierce = 0;
        if (ct.pierceCharge) {
          itemPierce = ct.pierceCharge.amount;
          ct.pierceCharge = null;
        }
        const hpBeforeHit = tgt.hp;
        const dmg = applyDamage(
          tgt,
          finalAmount,
          action.pierce + bonusPierce + action.lockedRiderPierce + itemPierce + condPierce,
        );
        ct.lastModifierDraws.push({
          id: nextDrawId(),
          card: drawn.card,
          targetUnitId: tgt.id,
          targetName: tgt.name,
          baseAmount,
          finalAmount,
          damageDealt: dmg,
          ...(advantageDraw ? { advantageDraw } : {}),
        });
        const drawTag = advantageDraw
          ? advantageDraw.mode === 'advantage'
            ? ' [Advantage]'
            : ' [Disadvantage]'
          : hasAdvantage && autoDisadvantage
            ? ' [Advantage + Disadvantage cancel]'
            : '';
        this.pushEvent(
          `${unit.name} attacks ${tgt.name}: ${baseAmount} ${modifierLabel(drawn.card)} → ${finalAmount} (dealt ${dmg})${itemPierce ? ` [Pierce ${itemPierce}]` : ''}${drawTag}.`,
        );
        // Poison Dagger: apply Poison on the next melee attack you perform,
        // provided it didn't miss and the target survives (a kill can't be
        // poisoned).
        const poisonRides = ct.poisonCharge && attackKind === 'melee';
        if (
          poisonRides &&
          drawn.card.kind !== 'null' &&
          tgt.hp > 0 &&
          !unitImmuneTo(tgt, 'poison')
        ) {
          // Battle goals (Tormentor): capture prior conditions before applying.
          const cid = this.charIdForUnit(unit);
          if (cid) {
            this.emitBG({
              kind: 'condition_applied',
              byCharacterId: cid,
              targetIsEnemy: true,
              condition: 'poison',
              targetPriorNegativeConditions: tgt.conditions.map((c) => c.kind),
            });
          }
          applyConditionToUnit(tgt, 'poison', /*isOwnTurn*/ false);
          this.pushEvent(`${tgt.name} is Poisoned.`);
        }
        if (poisonRides) ct.poisonCharge = false;
        // Conditions printed below this attack (e.g. Shield Bash's Stun) ride on
        // the attack and apply automatically to the target it hit.
        this.applyAttackRiderConditions(unit, tgt, action.riderConditions, drawn.card.kind === 'null');
        // Battle goals: this character attacked an enemy.
        {
          const attackerCid = this.charIdForUnit(unit);
          if (attackerCid) {
            this.emitBG({
              kind: 'attack',
              attackerCharacterId: attackerCid,
              targetUnitId: tgt.id,
              targetHasActedThisRound: this.monstersActedThisRound.has(tgt.id),
            });
          }
        }
        if (tgt.hp <= 0) {
          this.recordEnemyKilled(tgt, {
            killerCharacterId: this.charIdForUnit(unit),
            byAttack: true,
            finalDamage: finalAmount,
            hpBeforeHit,
            attackAdvantage: advantageDraw ? advantageDraw.mode : 'normal',
            killerHex: unit.hex,
          });
          this.units = this.units.filter((u) => u.id !== tgt.id);
          this.pushEvent(`${tgt.name} is exhausted!`);
        }
        action.targetsRemaining -= 1;
        action.hitsLanded += 1;
        action.hitTargetIds = [...action.hitTargetIds, tgt.id];
        ct.damageDealtThisTurn += dmg;
        // XP from a printed conditional bonus (e.g. Single Out: +1 XP vs an
        // isolated target). Granted once per matching target hit.
        if (cardCond.exp > 0) this.grantXp(guard.p, cardCond.exp, 'conditional bonus');
        if (action.targetsRemaining <= 0) action.done = true;
        break;
      }
      case 'attack-aoe': {
        if (hasCondition(unit, 'disarm')) return { ok: false, reason: 'disarmed' };
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (!target?.hex) return { ok: false, reason: 'need_anchor_hex' };
        const anchorOffset: Hex = {
          q: target.hex.q - unit.hex.q,
          r: target.hex.r - unit.hex.r,
        };
        // Find a rotation r such that rotated(pattern[0]) === anchorOffset.
        const p0 = action.pattern[0];
        if (!p0) return { ok: false, reason: 'empty_pattern' };
        let chosenRot = -1;
        for (let r = 0; r < 6; r++) {
          const rot = rotateHexN(p0, r);
          if (rot.q === anchorOffset.q && rot.r === anchorOffset.r) {
            chosenRot = r;
            break;
          }
        }
        if (chosenRot < 0) return { ok: false, reason: 'invalid_anchor' };
        const rotated = rotatePattern(action.pattern, chosenRot);
        const aoeHexes = rotated.map((o) => ({ q: unit.hex.q + o.q, r: unit.hex.r + o.r }));
        // Most AOE patterns target hexes adjacent to the actor (melee). LOS check
        // is per-hex; for v1 we only enforce LOS to the anchor (target.hex).
        // (Adjacent hexes effectively pass.)
        const { amount: bonusAmt, pierce: bonusPierce, double } = consumeAttackBonus(
          guard.p,
          'melee',
          undefined,
          unit.invisible === true,
        );
        ct.lastModifierDraws = [];
        if (!action.consumesLocked) {
          this.lockConsumeOffers(action, guard.p);
        }
        let hitCount = 0;
        for (const hex of aoeHexes) {
          const tgt = this.units.find((u) => u.kind === 'monster' && hexEqual(u.hex, hex));
          if (!tgt) continue;
          const resolvedAmount =
            action.amountRef && action.amountRef.kind === 'target-shield-value'
              ? resolveAmountRef(action.amountRef, ct, tgt)
              : action.amount;
          // Doubling applies to the printed attack value only (see single-
          // target branch above for the rationale). Applied per-target so a
          // future per-target doubling effect can slot in here.
          const printedAttack = double ? resolvedAmount * 2 : resolvedAmount;
          // Per-target conditional bonuses, evaluated per enemy the AOE hits.
          // (Advantage from a conditional bonus isn't applied to AOE — no AOE
          // card grants it, and AOE doesn't draw with advantage.)
          const cardCond = this.resolveTargetConditionalBonuses(
            action.targetConditionalBonuses,
            unit,
            tgt,
          );
          const activeCond = this.targetConditionalActiveBonus(guard.p, 'melee', unit, tgt);
          const condAttack = cardCond.attack + activeCond.attack;
          const condPierce = cardCond.pierce + activeCond.pierce;
          const baseAmount =
            printedAttack + bonusAmt + action.lockedRiderAttack + poisonBonus(tgt) + condAttack;
          // Per-target conditional triggers (isolated/shielded/invisible).
          // AOE attacks are treated as melee for the shielded check.
          this.fireAttackConditionalTriggers(guard.p, unit, tgt, 'melee');
          const drawn = drawModifier(guard.p);
          const finalAmount = applyModifierToAttack(baseAmount, drawn.card);
          // Scouting Lens rides along with the first enemy this AOE hits.
          let itemPierce = 0;
          if (ct.pierceCharge) {
            itemPierce = ct.pierceCharge.amount;
            ct.pierceCharge = null;
          }
          const hpBeforeHit = tgt.hp;
          const dmg = applyDamage(
            tgt,
            finalAmount,
            action.pierce + bonusPierce + action.lockedRiderPierce + itemPierce + condPierce,
          );
          ct.lastModifierDraws.push({
            id: nextDrawId(),
            card: drawn.card,
            targetUnitId: tgt.id,
            targetName: tgt.name,
            baseAmount,
            finalAmount,
            damageDealt: dmg,
          });
          this.pushEvent(
            `${unit.name} hits ${tgt.name}: ${baseAmount} ${modifierLabel(drawn.card)} → ${finalAmount} (dealt ${dmg})${itemPierce ? ` [Pierce ${itemPierce}]` : ''}.`,
          );
          // Poison Dagger rides along with the first enemy this AOE hits (AOE
          // counts as melee). Consumed on that first hit regardless of outcome.
          const poisonRides = ct.poisonCharge;
          if (
            poisonRides &&
            drawn.card.kind !== 'null' &&
            tgt.hp > 0 &&
            !unitImmuneTo(tgt, 'poison')
          ) {
            const cid = this.charIdForUnit(unit);
            if (cid) {
              this.emitBG({
                kind: 'condition_applied',
                byCharacterId: cid,
                targetIsEnemy: true,
                condition: 'poison',
                targetPriorNegativeConditions: tgt.conditions.map((c) => c.kind),
              });
            }
            applyConditionToUnit(tgt, 'poison', /*isOwnTurn*/ false);
            this.pushEvent(`${tgt.name} is Poisoned.`);
          }
          if (poisonRides) ct.poisonCharge = false;
          // Ridered conditions apply to every enemy the AOE hits.
          this.applyAttackRiderConditions(unit, tgt, action.riderConditions, drawn.card.kind === 'null');
          {
            const attackerCid = this.charIdForUnit(unit);
            if (attackerCid) {
              this.emitBG({
                kind: 'attack',
                attackerCharacterId: attackerCid,
                targetUnitId: tgt.id,
                targetHasActedThisRound: this.monstersActedThisRound.has(tgt.id),
              });
            }
          }
          if (tgt.hp <= 0) {
            this.recordEnemyKilled(tgt, {
              killerCharacterId: this.charIdForUnit(unit),
              byAttack: true,
              finalDamage: finalAmount,
              hpBeforeHit,
              killerHex: unit.hex,
            });
            this.units = this.units.filter((u) => u.id !== tgt.id);
            this.pushEvent(`${tgt.name} is exhausted!`);
          }
          hitCount += 1;
          ct.damageDealtThisTurn += dmg;
          // XP from a printed conditional bonus, per matching enemy hit.
          if (cardCond.exp > 0) this.grantXp(guard.p, cardCond.exp, 'conditional bonus');
        }
        if (hitCount === 0) this.pushEvent(`${unit.name}'s AOE hits no enemies.`);
        action.hitsLanded = hitCount;
        action.done = true;
        break;
      }
      case 'heal': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        // Self-only for now (matches our schema). Range ignored.
        const restored = this.healUnit(unit, action.amount);
        this.pushEvent(`${unit.name} heals ${restored}.`);
        action.done = true;
        break;
      }
      case 'shield': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        unit.shield += action.amount;
        this.pushEvent(`${unit.name} gains Shield ${action.amount}.`);
        action.done = true;
        break;
      }
      case 'push':
      case 'pull': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (!target?.unitId) return { ok: false, reason: 'need_target_unit' };
        if (!target.hex) return { ok: false, reason: 'need_dest_hex' };
        const tgt = this.units.find((u) => u.id === target.unitId);
        if (!tgt) return { ok: false, reason: 'no_target' };
        if (tgt.kind === 'player') return { ok: false, reason: 'cannot_force_move_ally' };
        if (hexDistance(unit.hex, tgt.hex) > action.range) return { ok: false, reason: 'out_of_range' };
        const reachable = this.forcedMoveReachable(tgt.hex, action.amount, unit.hex, action.type, tgt.id);
        const distSteps = reachable.get(hexKey(target.hex));
        if (distSteps === undefined || distSteps === 0) return { ok: false, reason: 'invalid_dest' };
        const startHex = tgt.hex;
        const animPath: Hex[] =
          target.path && target.path.length > 0
            ? [startHex, ...target.path]
            : [startHex, target.hex];
        tgt.hex = target.hex;
        this.lastMove = { id: this.nextMoveId++, unitId: tgt.id, path: animPath };
        this.pendingForcedMove = null;
        this.pushEvent(`${unit.name} ${action.type === 'push' ? 'pushes' : 'pulls'} ${tgt.name} to (${target.hex.q},${target.hex.r}).`);
        action.done = true;
        break;
      }
      case 'apply-condition': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (!target?.unitId) return { ok: false, reason: 'need_target_unit' };
        const tgt = this.units.find((u) => u.id === target.unitId);
        if (!tgt) return { ok: false, reason: 'no_target' };
        if (tgt.kind === 'player') return { ok: false, reason: 'cannot_target_ally' };
        if (hexDistance(unit.hex, tgt.hex) > action.range) return { ok: false, reason: 'out_of_range' };
        // Battle goals (Tormentor): capture the enemy's prior negative
        // conditions before applying the new one.
        {
          const cid = this.charIdForUnit(unit);
          if (cid) {
            this.emitBG({
              kind: 'condition_applied',
              byCharacterId: cid,
              targetIsEnemy: true,
              condition: action.condition,
              targetPriorNegativeConditions: tgt.conditions.map((c) => c.kind),
            });
          }
        }
        applyConditionToUnit(tgt, action.condition, /*isOwnTurn*/ false);
        this.pushEvent(`${tgt.name} is ${action.condition}ed.`);
        action.done = true;
        break;
      }
      case 'modify-future-move': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        guard.p.activeEffects.push({
          id: `e${guard.p.activeEffects.length + 1}`,
          sourceCardId: slot.cardId ?? '',
          kind: 'move-bonus',
          amount: action.amount,
          expires: action.expires,
        });
        this.pushEvent(`${unit.name} gains +${action.amount} move${action.expires === 'end-scenario' ? ' (scenario)' : ''}.`);
        action.done = true;
        break;
      }
      case 'modify-future-attack': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        guard.p.activeEffects.push({
          id: `e${guard.p.activeEffects.length + 1}`,
          sourceCardId: slot.cardId ?? '',
          kind: 'attack-bonus',
          amount: action.amount,
          ...(action.amountRef ? { amountRef: action.amountRef } : {}),
          ...(action.requiresInvisible ? { requiresInvisible: true as const } : {}),
          pierceBonus: action.pierceBonus,
          expires: action.expires,
          ...(action.attackKind ? { attackKind: action.attackKind } : {}),
          ...(action.doubleAttack ? { doubleAttack: true as const } : {}),
          ...(action.targetCondition ? { targetCondition: action.targetCondition } : {}),
        });
        const desc = action.doubleAttack
          ? `${unit.name} prepares to double their next attack.`
          : `${unit.name} gains +${action.amount} attack${action.expires === 'next-attack' ? ' (next)' : ''}.`;
        this.pushEvent(desc);
        action.done = true;
        break;
      }
      case 'grant-retaliate': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        guard.p.activeEffects.push({
          id: `e${guard.p.activeEffects.length + 1}`,
          sourceCardId: slot.cardId ?? '',
          kind: 'retaliate',
          amount: action.amount,
          range: action.range,
          expires: action.expires,
        });
        this.pushEvent(`${unit.name} gains Retaliate ${action.amount}.`);
        action.done = true;
        break;
      }
      case 'become-invisible': {
        unit.invisible = true;
        unit.invisibleAppliedThisTurn = true;
        this.pushEvent(`${unit.name} becomes Invisible.`);
        action.done = true;
        break;
      }
      case 'negate-damage': {
        guard.p.activeEffects.push({
          id: `e${guard.p.activeEffects.length + 1}`,
          sourceCardId: slot.cardId ?? '',
          kind: 'negate-next-damage',
          expires: action.expires,
        });
        this.pushEvent(
          `${unit.name} prepares to negate the next damage ${
            action.expires === 'end-scenario' ? 'this scenario' : 'this round'
          }.`,
        );
        action.done = true;
        break;
      }
      case 'loot': {
        const n = this.lootTokensInRange(unit, action.range, 'ability');
        if (n === 0) {
          this.pushEvent(`${unit.name} finds no money tokens to loot.`);
        }
        action.done = true;
        break;
      }
      case 'destroy-trap': {
        if (!target?.hex) return { ok: false, reason: 'need_hex' };
        // Eligible: a still-present trap the actor entered (and bypassed)
        // during this turn's move ability.
        const entered = ct.trapHexesEnteredThisMove.some((h) => hexEqual(h, target.hex!));
        if (!entered || !this.isTrapHex(target.hex)) {
          return { ok: false, reason: 'no_eligible_trap' };
        }
        this.removeTrapAt(target.hex);
        ct.trapHexesEnteredThisMove = ct.trapHexesEnteredThisMove.filter(
          (h) => !hexEqual(h, target.hex!),
        );
        this.pushEvent(`${unit.name} destroys a trap.`);
        if (action.gainExp > 0) this.grantXp(guard.p, action.gainExp, 'destroy trap');
        action.done = true;
        break;
      }
      case 'unsupported': {
        // Treat as skipped — not implemented yet.
        action.done = true;
        break;
      }
    }
    // A move paused for a trap prompt defers this bookkeeping to
    // finalizeActionPerformed, called from the trap-resolution continuation.
    if (pausedForTrap) return { ok: true };
    this.finalizeActionPerformed(playerId, slotKind, slot, action);
    return { ok: true };
  }

  /** Post-action bookkeeping shared by the normal path and the deferred
   *  trap-resolution continuation: credit the performance, track Lost-action
   *  usage, then auto-finish the half (or broadcast). */
  private finalizeActionPerformed(
    playerId: string,
    slotKind: 'top' | 'bottom',
    slot: HalfSlot,
    action: PendingAction,
  ): void {
    const ct = this.currentTurn;
    if (!ct) {
      this.broadcastState();
      return;
    }
    const p = this.players.get(playerId);
    if (action.type !== 'unsupported') slot.performedCount += 1;
    // Track whether an action from a Lost-disposition half was performed this
    // turn (gates items like Focusing Rod). The top slot plays the leading
    // card's top half; the bottom slot plays the second card's bottom half.
    if (action.type !== 'unsupported' && !slot.useBasic && slot.cardId && p) {
      const card = p.hand.find((c) => c.id === slot.cardId);
      const half = card ? (slotKind === 'top' ? card.top : card.bottom) : null;
      if (half?.disposition === 'lost') ct.performedLostAction = true;
    }
    const otherSlot = slotKind === 'top' ? ct.bottomSlot : ct.topSlot;
    // Auto-finish only when the other half is still pending — leaves the
    // final half engaged so the client can show an explicit End Turn button.
    if (slot.actions.every((a) => a.done) && otherSlot.status !== 'done') {
      this.finishHalf(playerId, slotKind);
    } else {
      this.broadcastState();
    }
  }

  /**
   * Walk the trap hexes a bypass-capable move entered, prompting per hex. For
   * each hex with a live trap, raise a `pendingTrapChoice` and suspend until the
   * player answers via `resolveTrapChoice`: spring (take damage, remove trap) or
   * bypass (leave it, mark it destroy-eligible). When no trap hexes remain, run
   * the deferred post-action bookkeeping.
   */
  private resolveTrapHexes(
    playerId: string,
    slotKind: 'top' | 'bottom',
    actionId: string,
    unit: Unit,
    hexes: readonly Hex[],
    index: number,
  ): void {
    const ct = this.currentTurn;
    if (!ct) return;
    for (let i = index; i < hexes.length; i++) {
      const h = hexes[i]!;
      if (unit.hp <= 0) break;
      if (!this.isTrapHex(h)) continue;
      const choiceId = `trap-${this.nextTrapChoiceN++}`;
      this.pendingTrapChoice = {
        id: choiceId,
        unitId: unit.id,
        hex: { q: h.q, r: h.r },
        prompt: `${unit.name} entered a trap. Spring it (take ${trapDamageFor(
          this.scenarioLevel,
        )} damage) or bypass it?`,
      };
      this.pendingTrapFollowup = (spring: boolean) => {
        this.pendingTrapChoice = null;
        this.pendingTrapFollowup = null;
        if (spring) {
          this.springTrapAt(unit, h);
        } else {
          ct.trapHexesEnteredThisMove.push({ q: h.q, r: h.r });
        }
        this.resolveTrapHexes(playerId, slotKind, actionId, unit, hexes, i + 1);
      };
      this.broadcastState();
      return;
    }
    // No more trap prompts — finish the move action now.
    const slot = slotKind === 'top' ? ct.topSlot : ct.bottomSlot;
    const action = slot.actions.find((a) => a.id === actionId);
    if (action) this.finalizeActionPerformed(playerId, slotKind, slot, action);
    else this.broadcastState();
  }

  /** Resolve an outstanding trap spring-or-bypass prompt. */
  resolveTrapChoice(
    playerId: string,
    choiceId: string,
    spring: boolean,
  ): { ok: true } | { ok: false; reason: string } {
    const choice = this.pendingTrapChoice;
    if (!choice || choice.id !== choiceId) return { ok: false, reason: 'no_pending_choice' };
    // Only the acting player may answer (it's their move).
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur || cur.kind !== 'player' || cur.playerId !== playerId) {
      return { ok: false, reason: 'not_your_choice' };
    }
    const followup = this.pendingTrapFollowup;
    if (followup) followup(spring);
    return { ok: true };
  }

  skipAction(
    playerId: string,
    slotKind: 'top' | 'bottom',
    actionId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const slot = slotKind === 'top' ? ct.topSlot : ct.bottomSlot;
    if (slot.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    const action = slot.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, reason: 'no_action' };
    action.done = true;
    if (action.type === 'push' || action.type === 'pull') {
      this.pendingForcedMove = null;
    }
    const otherSlot = slotKind === 'top' ? ct.bottomSlot : ct.topSlot;
    if (slot.actions.every((a) => a.done) && otherSlot.status !== 'done') {
      this.finishHalf(playerId, slotKind);
    } else {
      this.broadcastState();
    }
    return { ok: true };
  }

  /** Centerline-based line-of-sight check: walls block, units do not. */
  hasLOS(a: Hex, b: Hex): boolean {
    const walls = new Set<string>();
    for (const t of this.scenarioTiles()) {
      if (t.kind === 'wall') walls.add(`${t.q},${t.r}`);
    }
    return hasLineOfSight(a, b, (h) => walls.has(`${h.q},${h.r}`));
  }

  /** Valid destinations for a Push or Pull on `start`, anchored at `actorHex`. */
  forcedMoveReachable(
    start: Hex,
    budget: number,
    actorHex: Hex,
    direction: 'push' | 'pull',
    movedUnitId: string,
  ): Map<string, number> {
    const tilePassable = new Set<string>();
    for (const t of this.scenarioTiles()) if (t.kind !== 'wall') tilePassable.add(`${t.q},${t.r}`);
    const occupied = new Set<string>();
    for (const u of this.units) {
      if (u.id === movedUnitId) continue;
      occupied.add(`${u.hex.q},${u.hex.r}`);
    }
    return bfsForcedMove(start, budget, actorHex, direction, (h) => {
      const k = `${h.q},${h.r}`;
      return tilePassable.has(k) && !occupied.has(k);
    });
  }

  /** Draw a random unused standee number (1..count) for `monsterId`, or
   *  undefined if the pool is exhausted (standee shortage — the figure is placed
   *  without a number rather than failing placement). */
  private allocateStandeeNumber(monsterId: string, count: number): number | undefined {
    let used = this.standeesInUse.get(monsterId);
    if (!used) {
      used = new Set();
      this.standeesInUse.set(monsterId, used);
    }
    const free: number[] = [];
    for (let n = 1; n <= count; n++) if (!used.has(n)) free.push(n);
    if (free.length === 0) return undefined;
    const pick = free[Math.floor(Math.random() * free.length)]!;
    used.add(pick);
    return pick;
  }

  /** Return a dead monster's standee number to its type's pool. */
  private freeStandeeNumber(unit: Unit): void {
    if (unit.kind !== 'monster' || unit.standeeNumber === undefined) return;
    this.standeesInUse.get(unit.defId)?.delete(unit.standeeNumber);
  }

  /** A monster target is "isolated" when no other monsters are in its adjacent
   *  hexes. Used by `attack-against-isolated-enemy` triggers (e.g. Single Out). */
  private isIsolatedMonster(target: Unit): boolean {
    if (target.kind !== 'monster') return false;
    for (const u of this.units) {
      if (u.id === target.id) continue;
      if (u.kind !== 'monster') continue;
      if (hexDistance(u.hex, target.hex) === 1) return false;
    }
    return true;
  }

  /** Evaluate a printed per-target condition for `attacker` hitting `target`.
   *  Drives both a card's `targetConditionalBonuses` and target-gated persistent
   *  attack bonuses. */
  private matchesTargetCondition(
    cond: TargetCondition,
    attacker: Unit,
    target: Unit,
  ): boolean {
    switch (cond.kind) {
      case 'target-undamaged':
        return target.hp >= target.hpMax;
      case 'target-isolated-from-allies':
        return this.isIsolatedMonster(target);
      case 'target-adjacent-to-your-ally':
        // Adjacent to at least one of the acting player's allies — any other
        // player figure (the attacker themself doesn't count).
        for (const u of this.units) {
          if (u.id === target.id || u.id === attacker.id) continue;
          if (u.kind !== 'player') continue;
          if (hexDistance(u.hex, target.hex) === 1) return true;
        }
        return false;
      case 'all-of':
        return cond.conditions.every((c) => this.matchesTargetCondition(c, attacker, target));
    }
  }

  /** Sum the bonuses from a card's printed `targetConditionalBonuses` that match
   *  `target`. Used by both single-target and AOE attack resolution. */
  private resolveTargetConditionalBonuses(
    bonuses: readonly TargetConditionalBonus[] | undefined,
    attacker: Unit,
    target: Unit,
  ): { attack: number; pierce: number; exp: number; advantage: boolean } {
    let attack = 0;
    let pierce = 0;
    let exp = 0;
    let advantage = false;
    for (const b of bonuses ?? []) {
      if (!this.matchesTargetCondition(b.condition, attacker, target)) continue;
      attack += b.attackBonus ?? 0;
      pierce += b.pierce?.amount ?? 0;
      exp += b.gainExp ?? 0;
      if (b.advantage) advantage = true;
    }
    return { attack, pierce, exp, advantage };
  }

  /** Sum target-gated persistent attack bonuses (e.g. Single Out's +3 vs
   *  isolated) that apply against `target`. These are never consumed — they
   *  persist until their source card expires. */
  private targetConditionalActiveBonus(
    p: PlayerEntry,
    attackKind: 'melee' | 'ranged',
    attacker: Unit,
    target: Unit,
  ): { attack: number; pierce: number } {
    let attack = 0;
    let pierce = 0;
    for (const e of p.activeEffects) {
      if (e.kind !== 'attack-bonus' || !e.targetCondition) continue;
      if (e.attackKind && e.attackKind !== attackKind) continue;
      if (!this.matchesTargetCondition(e.targetCondition, attacker, target)) continue;
      attack += e.amount;
      pierce += e.pierceBonus;
    }
    return { attack, pierce };
  }

  /** Fire all attack-time conditional persistent triggers for a player who just
   *  hit a single target. Called once per target landed (single-attack and AOE). */
  private fireAttackConditionalTriggers(
    p: PlayerEntry,
    attacker: Unit,
    target: Unit,
    attackKind: 'melee' | 'ranged',
  ): void {
    if (this.isIsolatedMonster(target)) {
      this.fireTrackedTrigger(p, 'attack-against-isolated-enemy');
    }
    if (attackKind === 'melee' && target.shield > 0) {
      this.fireTrackedTrigger(p, 'melee-attack-against-shielded-enemy');
    }
    if (attacker.invisible) {
      this.fireTrackedTrigger(p, 'attack-while-invisible');
    }
  }

  private passableForUnit(ignoreUnitId: string): (h: Hex) => boolean {
    const tilePassable = new Set<string>();
    for (const t of this.scenarioTiles()) {
      if (t.kind !== 'wall') tilePassable.add(`${t.q},${t.r}`);
    }
    const occupied = new Set<string>();
    for (const u of this.units) {
      if (u.id === ignoreUnitId) continue;
      occupied.add(`${u.hex.q},${u.hex.r}`);
    }
    return (h: Hex) => {
      const k = `${h.q},${h.r}`;
      return tilePassable.has(k) && !occupied.has(k);
    };
  }

  /**
   * Walkable predicate for a jump: walls block, but enemies do not. Used
   * for mid-path hexes — the destination still has to pass `passableForUnit`.
   */
  private walkableForJump(): (h: Hex) => boolean {
    const tilePassable = new Set<string>();
    for (const t of this.scenarioTiles()) {
      if (t.kind !== 'wall') tilePassable.add(`${t.q},${t.r}`);
    }
    return (h: Hex) => tilePassable.has(`${h.q},${h.r}`);
  }

  /**
   * Walkable predicate for a normal (ground) move: walls and enemy figures
   * block, but the mover may pass through its allies (figures of the same
   * kind). Used for mid-path hexes — the destination still has to pass
   * `passableForUnit`, which also rejects ally-occupied hexes.
   */
  private walkableForUnit(mover: Unit): (h: Hex) => boolean {
    const tilePassable = new Set<string>();
    for (const t of this.scenarioTiles()) {
      if (t.kind !== 'wall') tilePassable.add(`${t.q},${t.r}`);
    }
    const enemyOccupied = new Set<string>();
    for (const u of this.units) {
      if (u.id === mover.id) continue;
      if (u.kind !== mover.kind) enemyOccupied.add(`${u.hex.q},${u.hex.r}`);
    }
    return (h: Hex) => {
      const k = `${h.q},${h.r}`;
      return tilePassable.has(k) && !enemyOccupied.has(k);
    };
  }

  /**
   * Movement cost to step into a hex: difficult terrain costs 2, everything
   * else 1. Mirrors the monster AI's terrain cost so players and monsters are
   * charged the same for difficult terrain.
   */
  private enterCostForTiles(): (h: Hex) => number {
    const difficult = new Set<string>();
    for (const t of this.scenarioTiles()) {
      if (t.kind === 'difficult') difficult.add(`${t.q},${t.r}`);
    }
    return (h: Hex) => (difficult.has(`${h.q},${h.r}`) ? 2 : 1);
  }

  private reachableFrom(start: Hex, budget: number, mover: Unit): Map<string, number> {
    return bfsReachable(
      start,
      budget,
      this.walkableForUnit(mover),
      this.passableForUnit(mover.id),
      this.enterCostForTiles(),
    );
  }

  private reachableFromJump(start: Hex, budget: number, ignoreUnitId: string): Map<string, number> {
    return bfsReachableJump(start, budget, this.walkableForJump(), this.passableForUnit(ignoreUnitId));
  }

  /**
   * Dispose the two selected cards based on what happened in their slots.
   * - Basic action used → discard (printed half is not "performed").
   * - Printed half performed → use that half's disposition (lost / discard;
   *   persistent treated as discard for now).
   * - Card never engaged in either slot → discard with no effect.
   */
  /** Reshuffle the modifier deck if a Null or ×2 was drawn this turn. */
  private maybeReshuffleModifierDeck(p: PlayerEntry): void {
    if (!p.modifierNeedsReshuffle) return;
    p.modifierDeck = reshuffleModifierDeck(p.modifierDeck, p.modifierDiscard);
    p.modifierDiscard = [];
    p.modifierNeedsReshuffle = false;
    this.pushEvent(`${this.playerDisplayName(p)}'s modifier deck reshuffles.`);
  }

  /** Draw the top card of the shared monster modifier deck, reshuffling on
   *  the fly if the deck is empty. Sets the reshuffle flag for end-of-round
   *  if the drawn card is a Null or ×2. */
  private drawMonsterModifier(): ModifierCardInstance {
    if (this.monsterModifierDeck.length === 0) {
      this.monsterModifierDeck = reshuffleModifierDeck([], this.monsterModifierDiscard);
      this.monsterModifierDiscard = [];
      this.monsterModifierNeedsReshuffle = false;
    }
    const drawn = this.monsterModifierDeck.shift()!;
    this.monsterModifierDiscard.push(drawn);
    if (triggersReshuffle(drawn.card)) this.monsterModifierNeedsReshuffle = true;
    return drawn;
  }

  /** Reshuffle the monster modifier deck if a Null or ×2 was drawn this round. */
  private maybeReshuffleMonsterModifierDeck(): void {
    if (!this.monsterModifierNeedsReshuffle) return;
    this.monsterModifierDeck = reshuffleModifierDeck(
      this.monsterModifierDeck,
      this.monsterModifierDiscard,
    );
    this.monsterModifierDiscard = [];
    this.monsterModifierNeedsReshuffle = false;
    this.pushEvent(`Monster modifier deck reshuffles.`);
  }

  private disposePlayerCards(p: PlayerEntry): void {
    if (!p.selection || p.selection.kind !== 'cards') return;
    const ct = this.currentTurn;
    const ids = [p.selection.leadingId, p.selection.secondId];
    for (const id of ids) {
      const idx = p.hand.findIndex((c) => c.id === id);
      if (idx === -1) continue;
      const [card] = p.hand.splice(idx, 1);
      if (!card) continue;
      let dest: 'discard' | 'lost' | 'active' = 'discard';
      if (ct) {
        const slot =
          ct.topSlot.cardId === id
            ? { which: 'top' as const, slot: ct.topSlot }
            : ct.bottomSlot.cardId === id
              ? { which: 'bottom' as const, slot: ct.bottomSlot }
              : null;
        if (slot && !slot.slot.useBasic) {
          const half = slot.which === 'top' ? card.top : card.bottom;
          const performedAny = slot.slot.performedCount > 0;
          if (half.disposition === 'lost' && performedAny) dest = 'lost';
          else if (
            performedAny &&
            (half.disposition === 'persistent-round' ||
              half.disposition === 'persistent-tracked' ||
              half.disposition === 'persistent-scenario')
          ) {
            dest = 'active';
          }
        }
      }
      if (dest === 'lost') p.lost.push(card);
      else if (dest === 'active') {
        p.active.push(card);
        // Persistent-tracked halves get parallel use-slot bookkeeping.
        if (ct) {
          const which: 'top' | 'bottom' | null =
            ct.topSlot.cardId === id ? 'top' : ct.bottomSlot.cardId === id ? 'bottom' : null;
          if (which) {
            const half = which === 'top' ? card.top : card.bottom;
            if (
              half.disposition === 'persistent-tracked' &&
              typeof half.trackedUses === 'number' &&
              half.persistentTrigger
            ) {
              p.activeTracked.push({
                cardId: card.id,
                halfKind: which,
                currentSlot: 1,
                trackedUses: half.trackedUses,
                persistentTrigger: half.persistentTrigger,
                useSlotExp: half.useSlotExp ?? [],
                finalPile: half.finalPile ?? 'lost',
                triggerSteps: collectTriggerSteps(half),
              });
            }
          }
        }
      }
      else p.discard.push(card);
    }
  }

  /** Set up `currentTurn` for the actor at activeTurnIndex (player turns only). */
  private openTurn(): void {
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur) {
      this.currentTurn = null;
    this.pendingForcedMove = null;
      return;
    }
    // Battle goals: a new turn is starting. characterId is the acting
    // character, or null for a monster-group turn.
    this.emitBG({
      kind: 'turn_start',
      characterId:
        cur.kind === 'player' ? this.charIdForPlayer(cur.playerId) : null,
    });
    if (cur.kind === 'player') {
      const unit = this.units.find((u) => u.id === cur.unitId);
      // Long rest takes over the whole turn (Card Selection step, init 99).
      // No currentTurn slots — the player walks through choose-lost +
      // optional heal/items via longRestPending instead.
      const p = this.players.get(cur.playerId);
      if (p && p.selection?.kind === 'long_rest') {
        if (unit && hasCondition(unit, 'stun')) {
          this.pushEvent(`${unit.name} is stunned — long rest fails.`);
          const removed = tickConditionsEndOfTurn(unit);
          for (const k of removed) this.pushEvent(`${unit.name} is no longer ${k}ed.`);
          cur.done = true;
          this.currentTurn = null;
          this.pendingForcedMove = null;
          if (this.activeTurnIndex + 1 < this.turnOrder.length) {
            this.activeTurnIndex += 1;
            this.openTurn();
          } else {
            this.advanceToNextRound();
          }
          return;
        }
        const candidates = this.effectiveDiscardForRest(p).map((c) => c.id);
        p.longRestPending = {
          step: 'choose_lost',
          candidateCardIds: candidates,
          healUsed: false,
        };
        this.currentTurn = null;
        this.pendingForcedMove = null;
        return;
      }
      // Stunned players cannot perform any abilities — auto-skip their turn.
      if (unit && hasCondition(unit, 'stun')) {
        this.pushEvent(`${unit.name} is stunned and skips their turn.`);
        const p = this.players.get(cur.playerId);
        if (p) {
          this.disposePlayerCards(p);
          this.maybeReshuffleModifierDeck(p);
        }
        const removed = tickConditionsEndOfTurn(unit);
        for (const k of removed) this.pushEvent(`${unit.name} is no longer ${k}ed.`);
        cur.done = true;
        this.currentTurn = null;
    this.pendingForcedMove = null;
        if (this.activeTurnIndex + 1 < this.turnOrder.length) {
          this.activeTurnIndex += 1;
          this.openTurn();
        } else {
          this.advanceToNextRound();
        }
        return;
      }
      this.currentTurn = {
        unitId: cur.unitId,
        topSlot: unlockedSlot(),
        bottomSlot: unlockedSlot(),
        activeSlot: null,
        lastModifierDraws: [],
        hexesMovedThisTurn: 0,
        trapHexesEnteredThisMove: [],
        damageDealtThisTurn: 0,
        // Consume eligibility is evaluated against the start-of-turn board,
        // not live state — so snapshot it here.
        turnStartElementBoard: { ...this.elementBoard },
        pendingInfusions: [],
        consumedThisTurn: [],
        jumpAllMoves: false,
        pierceCharge: null,
        poisonCharge: false,
        advantageCharge: false,
        performedLostAction: false,
      };
      // New turn → fresh rider-source map (the previous turn's are stale).
      this.riderSources = new Map();
      // New turn → no move ability has reset its trap tracking yet.
      this.movesStartedThisTurn = new Set();
    } else {
      this.currentTurn = null;
      this.pendingForcedMove = null;
      // Run the monster group's actions step-by-step so clients can see
      // each spotlight, focus arrow, movement slide, and modifier flip.
      // The generator yields once per visible step; advanceMonsterAnim()
      // drives it on a timer and finishes the turn when the generator
      // completes.
      this.startMonsterGroupAnim();
    }
  }

  private startMonsterGroupAnim(): void {
    if (this.monsterAnimTimer) {
      clearTimeout(this.monsterAnimTimer);
      this.monsterAnimTimer = null;
    }
    this.monsterAnimGen = this.runMonsterGroupAnim();
    // Run the first step immediately so the spotlight appears as soon as
    // the monster group's turn opens, then pace subsequent steps.
    this.advanceMonsterAnim();
  }

  private advanceMonsterAnim(resume?: unknown): void {
    const gen = this.monsterAnimGen;
    if (!gen) return;
    const result = gen.next(resume);
    if (result.done) {
      this.finishMonsterGroupAnim();
      return;
    }
    // A reactive-item prompt suspends the animation: broadcast the pending
    // prompt and stop the timer. respondReactiveItem() resumes the generator.
    if (result.value === 'await-prompt') {
      this.broadcastState();
      return;
    }
    this.broadcastState();
    this.monsterAnimTimer = setTimeout(() => {
      this.monsterAnimTimer = null;
      this.advanceMonsterAnim();
    }, MONSTER_ANIM_STEP_MS);
  }

  /** Answer a pending reactive-item prompt and resume the monster animation. */
  respondReactiveItem(playerId: string, spend: boolean): void {
    const pending = this.pendingReactiveItem;
    if (!pending || pending.playerId !== playerId) return;
    if (!this.monsterAnimGen) {
      this.pendingReactiveItem = null;
      return;
    }
    this.advanceMonsterAnim(spend);
  }

  /** Host-driven fast-forward: drain any remaining yields synchronously,
   *  then finish the turn. The board updates land in one broadcast at the
   *  end (the intermediate states are skipped). */
  requestSkipMonsterAnim(): void {
    const gen = this.monsterAnimGen;
    if (!gen) return;
    if (this.monsterAnimTimer) {
      clearTimeout(this.monsterAnimTimer);
      this.monsterAnimTimer = null;
    }
    // Drain remaining yields. Each yield is a view-state update; we just
    // discard them and let the final state propagate via finish().
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const r = gen.next();
      if (r.done) break;
    }
    this.finishMonsterGroupAnim();
  }

  private finishMonsterGroupAnim(): void {
    this.monsterAnimGen = null;
    if (this.monsterAnimTimer) {
      clearTimeout(this.monsterAnimTimer);
      this.monsterAnimTimer = null;
    }
    this.monsterTurnAnim = null;
    this.pendingReactiveItem = null;
    const cur = this.turnOrder[this.activeTurnIndex];
    if (cur) cur.done = true;
    // Battle goals: this group has now acted this round.
    if (cur && cur.kind === 'monster-group') {
      for (const u of this.units) {
        if (u.kind === 'monster' && monsterDefMatchesSet(u.defId, cur.setId)) {
          this.monstersActedThisRound.add(u.id);
        }
      }
    }
    // Retaliate during the monster group's turn may have cleared the last
    // monster — wrap up before advancing.
    this.checkScenarioEnd();
    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.broadcastState();
      return;
    }
    if (this.activeTurnIndex + 1 < this.turnOrder.length) {
      this.activeTurnIndex += 1;
      this.openTurn();
    } else {
      this.advanceToNextRound();
    }
    this.broadcastState();
  }

  /**
   * Pick the targets a monster attack hits from a standing hex: its focus
   * first (required — fixed by the focus step), then the nearest other enemies
   * within range and line-of-sight, up to the card's Target count. Returns []
   * if the focus itself can't be reached from `from`.
   */
  private selectAttackTargets(
    from: Hex,
    focusId: string,
    range: number,
    maxTargets: number,
  ): Unit[] {
    const inRange = (u: Unit): boolean => {
      if (u.kind !== 'player') return false;
      const d = hexDistance(from, u.hex);
      if (d < 1 || d > range) return false;
      if (range > 1 && !this.hasLOS(from, u.hex)) return false;
      return true;
    };
    const focusU = this.units.find((u) => u.id === focusId && inRange(u));
    if (!focusU) return [];
    const others = this.units
      .filter((u) => u.id !== focusId && inRange(u))
      .sort((a, b) => hexDistance(from, a.hex) - hexDistance(from, b.hex));
    return [focusU, ...others.slice(0, Math.max(0, maxTargets - 1))];
  }

  /**
   * Resolve a single monster attack against one target — draw (with
   * Disadvantage where it applies), reactive items, damage, condition riders,
   * and retaliate. A generator so the caller can `yield*` it per target; it
   * yields animation beats and `'await-prompt'` for reactive-item prompts.
   */
  private *resolveMonsterAttackOnTarget(
    m: Unit,
    tgtUnit: Unit,
    attack: { damage: number; effects: readonly MonsterAttackEffect[] },
    range: number,
    setId: string,
    abilityCardName: string,
  ): Generator<unknown, void, unknown> {
    // Persistent-tracked: a monster attack targeting a player fires
    // 'attack-targets-self' on that player's active cards BEFORE the draw.
    const targetPlayerEntry = tgtUnit.ownerPlayerId
      ? this.players.get(tgtUnit.ownerPlayerId)
      : null;
    if (targetPlayerEntry) this.fireTrackedTrigger(targetPlayerEntry, 'attack-targets-self');

    // Reactive item: before drawing, offer the target a chance to spend a
    // disadvantage-when-attacked item (e.g. Leather Armor).
    let disadvantage = false;
    if (targetPlayerEntry) {
      const reactiveId = this.findReactiveDisadvantageItem(targetPlayerEntry);
      if (reactiveId) {
        const reactiveItem = getItem(reactiveId)!;
        this.pendingReactiveItem = {
          playerId: targetPlayerEntry.playerId,
          itemId: reactiveId,
          attackerName: m.name,
          targetUnitId: tgtUnit.id,
          prompt: `${m.name} is attacking ${tgtUnit.name}. Spend ${reactiveItem.name} to give the attacker Disadvantage?`,
        };
        const spend = yield 'await-prompt';
        this.pendingReactiveItem = null;
        if (spend) {
          disadvantage = true;
          const inst = this.campaign.characters.find(
            (c) => c.id === targetPlayerEntry.activeCharacterId,
          );
          if (inst && !inst.spentItemIds.includes(reactiveId)) {
            inst.spentItemIds.push(reactiveId);
          }
          this.pushEvent(
            `${tgtUnit.name} spends ${reactiveItem.name}: ${m.name} attacks with Disadvantage.`,
          );
        }
      }
    }

    // RAW: a ranged attack (range > 1) on an ADJACENT target (distance 1)
    // auto-gains Disadvantage. Does not stack with Leather Armor's.
    const rangedOnAdjacent = range > 1 && hexDistance(m.hex, tgtUnit.hex) === 1;
    if (rangedOnAdjacent && !disadvantage) {
      this.pushEvent(`${m.name} fires at adjacent ${tgtUnit.name}: Disadvantage.`);
    }
    disadvantage = disadvantage || rangedOnAdjacent;

    // Roll the shared monster attack-modifier deck. Disadvantage draws two
    // cards and uses the worse (lower-damage) result.
    const firstDraw = this.drawMonsterModifier();
    let drawn = firstDraw;
    const baseAmount = attack.damage + poisonBonus(tgtUnit);
    let finalAmount = applyModifierToAttack(baseAmount, firstDraw.card);
    let advantageDraw: AdvantageDraw | undefined;
    if (disadvantage) {
      const second = this.drawMonsterModifier();
      const secondFinal = applyModifierToAttack(baseAmount, second.card);
      const useSecond = secondFinal < finalAmount;
      if (useSecond) {
        drawn = second;
        finalAmount = secondFinal;
      }
      advantageDraw = {
        mode: 'disadvantage',
        cards: [firstDraw.card, second.card],
        usedIndex: useSecond ? 1 : 0,
      };
    }

    // Step 3 — modifier draw reveal.
    this.monsterTurnAnim = {
      setId,
      abilityCardName,
      activeMonsterId: m.id,
      targetUnitId: tgtUnit.id,
      phase: 'modifier-draw',
      modifierDraw: {
        card: drawn.card,
        baseAmount,
        finalAmount,
        damageDealt: null,
        targetUnitId: tgtUnit.id,
        targetName: tgtUnit.name,
        ...(advantageDraw ? { advantageDraw } : {}),
      },
    };
    yield;

    // Compute damage (shield/pierce) without applying hp yet, so a
    // damage-suffered trigger (Juggernaut → negate-damage) can interpose.
    let effShield = Math.max(0, tgtUnit.shield);
    if (finalAmount > 0 && targetPlayerEntry) {
      effShield += this.consumeActiveItemShield(targetPlayerEntry);
    }
    // Reactive item: Heater Shield. Offer only if damage would still get
    // through existing shields.
    if (finalAmount - effShield > 0 && targetPlayerEntry) {
      const shieldId = this.findReactiveShieldItem(targetPlayerEntry);
      if (shieldId) {
        const shieldItem = getItem(shieldId)!;
        const amt =
          shieldItem.effect.kind === 'shield-when-attacked' ? shieldItem.effect.amount : 0;
        this.pendingReactiveItem = {
          playerId: targetPlayerEntry.playerId,
          itemId: shieldId,
          attackerName: m.name,
          targetUnitId: tgtUnit.id,
          prompt: `${m.name} hits ${tgtUnit.name} for ${finalAmount}. Spend ${shieldItem.name} to gain Shield ${amt} for this attack?`,
        };
        const spend = yield 'await-prompt';
        this.pendingReactiveItem = null;
        if (spend) {
          effShield += amt;
          const inst = this.campaign.characters.find(
            (c) => c.id === targetPlayerEntry.activeCharacterId,
          );
          if (inst && !inst.spentItemIds.includes(shieldId)) {
            inst.spentItemIds.push(shieldId);
          }
          this.pushEvent(
            `${tgtUnit.name} spends ${shieldItem.name}: Shield ${amt} for this attack.`,
          );
        }
      }
    }
    // Battle goals: this enemy attack targets a character (hit or not).
    {
      const targetCid = this.charIdForUnit(tgtUnit);
      if (targetCid) {
        this.emitBG({
          kind: 'targeted_by_enemy_attack',
          targetCharacterId: targetCid,
          enemyUnitId: m.id,
        });
      }
    }
    let dmg = Math.max(0, finalAmount - effShield);
    if (dmg > 0 && targetPlayerEntry) {
      const result = this.fireTrackedTrigger(targetPlayerEntry, 'damage-suffered');
      if (result.damageNegated || this.consumeNegateNextDamage(targetPlayerEntry)) dmg = 0;
    }
    tgtUnit.hp -= dmg;
    // Battle goals: the character actually suffered attack damage.
    if (dmg > 0) {
      const targetCid = this.charIdForUnit(tgtUnit);
      if (targetCid) {
        this.emitBG({
          kind: 'damage_suffered',
          characterId: targetCid,
          amount: dmg,
          fromAttack: true,
        });
        this.emitBG({
          kind: 'hp_changed',
          characterId: targetCid,
          currentHp: Math.max(0, tgtUnit.hp),
          maxHp: tgtUnit.hpMax,
        });
      }
    }
    this.pushEvent(
      `${m.name} attacks ${tgtUnit.name}: ${baseAmount} ${modifierLabel(drawn.card)} → ${finalAmount} (dealt ${dmg}).`,
    );

    // Step 4 — damage applied.
    this.monsterTurnAnim = {
      setId,
      abilityCardName,
      activeMonsterId: m.id,
      targetUnitId: tgtUnit.id,
      phase: 'damage',
      modifierDraw: {
        card: drawn.card,
        baseAmount,
        finalAmount,
        damageDealt: dmg,
        targetUnitId: tgtUnit.id,
        targetName: tgtUnit.name,
        ...(advantageDraw ? { advantageDraw } : {}),
      },
    };
    yield;

    if (tgtUnit.hp <= 0) {
      const exhaustedCid = this.charIdForUnit(tgtUnit);
      if (exhaustedCid) {
        this.emitBG({
          kind: 'character_exhausted',
          characterId: exhaustedCid,
          cause: 'hp',
        });
      }
      this.units = this.units.filter((u) => u.id !== tgtUnit.id);
      this.pushEvent(`${tgtUnit.name} is exhausted!`);
    } else {
      // Condition riders (e.g. Poison, Muddle) apply to the surviving target
      // when the attack didn't miss and the target isn't immune.
      if (drawn.card.kind !== 'null') {
        for (const eff of attack.effects) {
          if (eff.kind !== 'apply-condition') continue;
          if (!SUPPORTED_CONDITIONS.has(eff.condition)) continue;
          if (unitImmuneTo(tgtUnit, eff.condition)) continue;
          applyConditionToUnit(tgtUnit, eff.condition, /*isOwnTurn*/ false);
          this.pushEvent(`${tgtUnit.name} is ${eff.condition}ed.`);
        }
      }
      // Retaliate: if the player target has retaliate active and the monster
      // is within retaliate range, deal back damage to the monster.
      const targetPlayer = tgtUnit.ownerPlayerId ? this.players.get(tgtUnit.ownerPlayerId) : null;
      if (targetPlayer) {
        const ret = retaliateAgainst(targetPlayer, hexDistance(m.hex, tgtUnit.hex));
        if (ret) {
          const back = applyDamage(m, ret.amount, 0);
          this.pushEvent(`${tgtUnit.name} retaliates ${m.name} for ${back}.`);
          // Deferred `on-next-retaliate-this-round` XP riders fire now, then
          // the queue is cleared (a single retaliate consumes all pending).
          if (targetPlayer.pendingRetaliateXp.length > 0) {
            for (const q of targetPlayer.pendingRetaliateXp) {
              this.grantXp(targetPlayer, q.amount, q.label);
            }
            targetPlayer.pendingRetaliateXp = [];
          }
          if (m.hp <= 0) {
            // Retaliate is not an attack — byAttack: false.
            this.recordEnemyKilled(m, {
              killerCharacterId: this.charIdForUnit(tgtUnit),
              byAttack: false,
              killerHex: tgtUnit.hex,
            });
            this.units = this.units.filter((u) => u.id !== m.id);
            this.pushEvent(`${m.name} is exhausted!`);
          }
        }
      }
    }
  }

  /** Step-paced monster group turn resolver.
   *
   *  Each `yield` is a visible beat for clients (focus, move, modifier flip,
   *  damage). The runner (`advanceMonsterAnim`) calls `next()` once per
   *  MONSTER_ANIM_STEP_MS and broadcasts after each yield, so the user sees
   *  one action at a time. The skip path drains every remaining yield
   *  synchronously and the final state lands in a single broadcast.
   *
   *  Semantically identical to the previous sync resolver: same focus AI,
   *  same modifier draw timing, same retaliate / death / infusion handling. */
  /** Build the synthetic ability card a scripted monster set performs this
   *  round. The scripted action carries *absolute* Move/Attack values; we
   *  convert them to the deck's modifier form against the set's normal stat
   *  block so the existing resolver (readAbility) produces those exact values. */
  private scriptedCardFor(setId: string): MonsterAbilityCard | undefined {
    const sa = this.scriptedActionBySet.get(setId);
    const def = MONSTER_DEF_BY_SETID[setId];
    if (!sa || !def) return undefined;
    const base = rankedStatsForLevel(def, this.scenarioLevel)?.normal;
    const baseMove = base?.movement ?? 0;
    const baseAttack = base?.attack ?? 0;
    const abilities: MonsterAbilityStep[] = [];
    if (sa.move !== undefined) abilities.push({ kind: 'move', modifier: sa.move - baseMove });
    if (sa.attack !== undefined) abilities.push({ kind: 'attack', modifier: sa.attack - baseAttack });
    return {
      id: `scripted:${setId}`,
      setId,
      name: 'Scripted Action',
      initiative: sa.initiative,
      abilities,
    };
  }

  private *runMonsterGroupAnim(): Generator<unknown, void, unknown> {
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur || cur.kind !== 'monster-group') return;
    const def = MONSTER_DEF_BY_SETID[cur.setId];
    // Scripted groups don't draw a deck card — they synthesize a fixed one.
    const card = cur.abilityCardId.startsWith('scripted:')
      ? this.scriptedCardFor(cur.setId)
      : MONSTER_DECKS[cur.setId as keyof typeof MONSTER_DECKS]?.cards.find(
          (c) => c.id === cur.abilityCardId,
        );
    if (!def || !card) return;
    const ranked = rankedStatsForLevel(def, this.scenarioLevel);
    const stat = ranked?.normal;
    if (!stat) return;
    const setId = cur.setId;
    const abilityCardName = cur.abilityCardName;

    const enemyInit = new Map<string, number>();
    for (const e of this.turnOrder) {
      if (e.kind === 'player') enemyInit.set(e.unitId, e.initiative);
    }

    const monsters = this.units
      .filter(
        (u) =>
          u.kind === 'monster' &&
          monsterDefMatchesSet(u.defId, cur.setId) &&
          // Training dummies never act.
          this.behaviorOf(u.id) !== 'dummy',
      )
      // Acting order within the set: named → elite → normal, then ascending
      // standee number.
      .sort(monsterActOrder);

    // Set-block start: if the card has a consume step and at least one
    // member of the set is going to act, resolve the consume now. Members
    // that act in this block benefit; late spawns do not (we capture the
    // member set as `eligibleConsumers` before any monster acts).
    const willActMembers = monsters.filter(
      (m) => !hasCondition(m, 'stun'),
    );
    const consumeEffects: MonsterConsumeEffect[] = [];
    if (willActMembers.length > 0) {
      for (const step of card.abilities) {
        if (step.kind !== 'consume') continue;
        const eOrNull = this.resolveMonsterElementSelector(step.element, cur.setId, 'consume');
        if (!eOrNull) continue;
        // Element must be strong or waning to consume.
        if (this.elementBoard[eOrNull] === 'inert') {
          this.pushEvent(`${cur.abilityCardName}: cannot consume ${eOrNull} (inert).`);
          continue;
        }
        this.elementBoard = { ...this.elementBoard, [eOrNull]: 'inert' };
        consumeEffects.push(step.effect);
        this.pushEvent(`${cur.abilityCardName} consumes ${eOrNull}.`);
      }
    }

    const consumedRangeBonus = consumeEffects
      .filter((e) => e.kind === 'range-bonus')
      .reduce((s, e) => s + e.amount, 0);
    const consumedAttackBonus = consumeEffects
      .filter((e) => e.kind === 'attack-bonus')
      .reduce((s, e) => s + e.amount, 0);
    const consumedShieldBonus = consumeEffects
      .filter((e) => e.kind === 'shield-bonus')
      .reduce((s, e) => s + e.amount, 0);

    // The ability's move/attack values come from each acting figure's own
    // rank stat block (elites hit harder / move differently), with the set-wide
    // consume bonuses layered on. Computed per member inside the loop below.
    const abilityForRank = (rank: MonsterRank | undefined) => {
      const rankStat = (rank === 'elite' ? ranked?.elite : ranked?.normal) ?? stat;
      const base = readAbility(card, rankStat);
      const attack = base.attack
        ? {
            range: base.attack.range + consumedRangeBonus,
            damage: base.attack.damage + consumedAttackBonus,
            targets: base.attack.targets,
            effects: base.attack.effects,
          }
        : null;
      return { move: base.move, attack, range: attack?.range ?? 1 };
    };

    // TODO: per-figure consume-benefit (monsters-and-elements.md). Today no
    // monster set has reveal/spawn-mid-block, so every acting member is
    // eligible. When that lands, snapshot eligible IDs before any spawn
    // hooks fire and gate the bonus inside the loop.
    void consumedShieldBonus; // reserved for end-of-block shield apply
    let anyMemberActed = false;

    for (const m of monsters) {
      // Stun: skip the turn entirely, but still tick conditions. Spotlight
      // the stunned monster so the party sees why nothing happened.
      if (hasCondition(m, 'stun')) {
        this.pushEvent(`${m.name} is stunned and skips its turn.`);
        this.monsterTurnAnim = {
          setId,
          abilityCardName,
          activeMonsterId: m.id,
          targetUnitId: null,
          phase: 'focus',
          modifierDraw: null,
        };
        yield;
        const removed = tickConditionsEndOfTurn(m);
        for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
        continue;
      }
      const { move, attack, range } = abilityForRank(m.rank);
      const canMove = move && !hasCondition(m, 'immobilize');
      const canAttack = attack && !hasCondition(m, 'disarm');
      if (hasCondition(m, 'immobilize')) this.pushEvent(`${m.name} is immobilized.`);
      if (hasCondition(m, 'disarm')) this.pushEvent(`${m.name} is disarmed.`);

      // Re-find focus each iteration since previous monsters may have moved/killed.
      const focus = determineFocus(m, range, { tiles: this.scenarioTiles(), units: this.units }, enemyInit);
      if (!focus) {
        this.pushEvent(`${m.name} sees no target.`);
        this.monsterTurnAnim = {
          setId,
          abilityCardName,
          activeMonsterId: m.id,
          targetUnitId: null,
          phase: 'focus',
          modifierDraw: null,
        };
        yield;
        const removed = tickConditionsEndOfTurn(m);
        for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
        continue;
      }

      // Step 1 — focus: spotlight monster + arrow to target. No state
      // mutation yet so the user can see "who they target" before anything
      // moves.
      this.monsterTurnAnim = {
        setId,
        abilityCardName,
        activeMonsterId: m.id,
        targetUnitId: focus.enemy.id,
        phase: 'focus',
        modifierDraw: null,
      };
      yield;

      // Step 2 — movement. Stamp lastMove so the client slides the token
      // along the path (the existing useMoveAnim hook handles the slide).
      if (canMove && move) {
        const startHex = m.hex;
        const maxTargets = attack?.targets ?? 1;
        // What an attack achieves from a candidate hex: how many targets it
        // lands (focus + nearest others within range/LOS, capped at the card's
        // Target count) and how many of those are ranged-on-adjacent
        // (Disadvantage). determineMovement uses this to pick a hex that
        // maximizes attacks while minimizing disadvantage.
        const evaluateFrom = (from: Hex): DestinationEval => {
          const set = this.selectAttackTargets(from, focus.enemy.id, range, maxTargets);
          const disadvantaged =
            range > 1 ? set.filter((u) => hexDistance(from, u.hex) === 1).length : 0;
          return { canHitFocus: set.length > 0, attacks: set.length, disadvantaged };
        };
        const plan = determineMovement(
          m,
          focus,
          range,
          move.budget,
          { tiles: this.scenarioTiles(), units: this.units },
          evaluateFrom,
        );
        if (!hexEqual(plan.destination, m.hex)) {
          const animPath: Hex[] =
            plan.path.length > 0 ? plan.path : [startHex, plan.destination];
          this.pushEvent(
            `${m.name} moves to (${plan.destination.q},${plan.destination.r}) toward ${focus.enemy.name}.`,
          );
          m.hex = plan.destination;
          this.lastMove = { id: this.nextMoveId++, unitId: m.id, path: animPath };
          anyMemberActed = true;
          this.monsterTurnAnim = {
            setId,
            abilityCardName,
            activeMonsterId: m.id,
            targetUnitId: focus.enemy.id,
            phase: 'move',
            modifierDraw: null,
          };
          yield;
        }
      }

      // Attack — re-check range from final position; focus may be dead from a prior monster.
      const focusUnit = this.units.find((u) => u.id === focus.enemy.id);
      // Build the attack's target set from the monster's final position: focus
      // first, then the nearest other enemies in range/LOS, capped at the
      // card's Target count. Each is resolved as its own attack (own draw,
      // reactive prompts, damage, conditions, retaliate).
      const targetSet =
        canAttack && attack && focusUnit
          ? this.selectAttackTargets(m.hex, focusUnit.id, range, attack.targets)
          : [];
      if (attack && targetSet.length > 0) {
        anyMemberActed = true;
        for (const tgtUnit of targetSet) {
          // A target may have been removed earlier in this volley (or by
          // retaliate); skip anything no longer on the board.
          if (!this.units.some((u) => u.id === tgtUnit.id)) continue;
          yield* this.resolveMonsterAttackOnTarget(
            m,
            tgtUnit,
            attack,
            range,
            setId,
            abilityCardName,
          );
          if (m.hp <= 0) break; // monster died to retaliate — stop attacking
        }
      } else if (canAttack && attack && focusUnit) {
        if (range > 1 && !this.hasLOS(m.hex, focusUnit.hex)) {
          this.pushEvent(`${m.name} has no line-of-sight to ${focusUnit.name}.`);
        } else {
          this.pushEvent(`${m.name} cannot reach ${focusUnit.name}.`);
        }
      }

      // End of monster's individual turn — tick its conditions.
      const removed = tickConditionsEndOfTurn(m);
      for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
    }

    // Set-block end: if any member of the set acted, fire all `infuse`
    // steps on the card. Multiple infusions of the same element collapse
    // to a single strong (no stacking). Wild/mixed gets a host-prompt; for
    // v1 we auto-pick the first option and log a hint event (the synchronous
    // resolve flow doesn't pause for prompts — set-block prompts are a
    // future refactor).
    if (anyMemberActed) {
      const infused = new Set<Element>();
      for (const step of card.abilities) {
        if (step.kind !== 'infuse') continue;
        const eOrNull = this.resolveMonsterElementSelector(step.element, cur.setId, 'infuse');
        if (!eOrNull) continue;
        if (this.elementBoard[eOrNull] !== 'strong') {
          this.elementBoard = { ...this.elementBoard, [eOrNull]: 'strong' };
          infused.add(eOrNull);
        }
      }
      if (infused.size > 0) {
        this.pushEvent(`${cur.abilityCardName} infuses ${[...infused].join(', ')}.`);
      }
    }
  }

  /** Resolve a monster element selector to a concrete element. Wild/mixed
   *  in monster sets is supposed to defer to a party-choice prompt; for
   *  v1 (no monster card uses elements yet) we auto-pick the first option
   *  and emit a hint event. Returns null only if the selector is malformed. */
  private resolveMonsterElementSelector(
    sel: ElementSelector,
    setId: string,
    kind: 'consume' | 'infuse',
  ): Element | null {
    const concrete = selectorConcrete(sel);
    if (concrete) return concrete;
    const opts = selectorOptions(sel);
    const first = opts[0];
    if (!first) return null;
    this.pushEvent(
      `${setId} ${kind}: wild/mixed party choice not yet interactive — auto-picking ${first}.`,
    );
    return first;
  }

  /** Tile artwork for currently-revealed rooms only, so what's behind an
   *  unopened door stays hidden. Mirrors `scenarioTiles()` room gating — an art
   *  piece's `tileSideId` is its room id. */
  private visibleTileArt(): PlacedTileArt[] {
    const art = this.campaign.tileArt;
    if (!art || art.length === 0) return [];
    const scenario = this.currentScenario();
    // No room gating (single-tile maps): all art shows.
    if (!scenario?.rooms || scenario.rooms.length === 0) return art;
    return art.filter((a) => this.revealedRooms.has(a.tileSideId));
  }

  private scenarioTiles() {
    const scenario = this.currentScenario();
    if (!scenario) return [];
    // No room gating: single-room maps (no `rooms`) show every tile.
    const visible =
      !scenario.rooms || scenario.rooms.length === 0
        ? scenario.tiles
        : // Otherwise only tiles in revealed rooms (room-less tiles always show).
          scenario.tiles.filter((t) => !t.room || this.revealedRooms.has(t.room));
    // Sprung/destroyed traps revert to floor. The scenario is a shared
    // singleton, so apply per-room trap removal here without mutating it.
    if (this.sprungTraps.size === 0) return visible;
    return visible.map((t) =>
      t.kind === 'trap' && this.sprungTraps.has(hexKey(t)) ? { ...t, kind: 'floor' as const } : t,
    );
  }

  /** A live trap sits on this hex (a 'trap' tile in a revealed room that has not
   *  yet been sprung or destroyed). */
  private isTrapHex(hex: Hex): boolean {
    return this.scenarioTiles().some((t) => t.kind === 'trap' && hexEqual(t, hex));
  }

  /** Mark a trap removed (sprung or destroyed) for the rest of the scenario. */
  private removeTrapAt(hex: Hex): void {
    this.sprungTraps.add(hexKey(hex));
  }

  private pushEvent(text: string): void {
    this.events.push({ id: this.nextEventId++, text });
    if (this.events.length > 20) this.events.splice(0, this.events.length - 20);
  }

  /** Guard for player-action handlers: phase, active turn, ownership, and turn state present. */
  private requireMyTurn(
    playerId: string,
  ):
    | { ok: false; reason: string }
    | { ok: true; ct: CurrentTurn; p: PlayerEntry } {
    if (this.phase !== 'turn_resolution') return { ok: false, reason: 'wrong_phase' };
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur || cur.kind !== 'player' || cur.playerId !== playerId) {
      return { ok: false, reason: 'not_your_turn' };
    }
    const ct = this.currentTurn;
    if (!ct) return { ok: false, reason: 'no_turn_state' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    return { ok: true, ct, p };
  }

  /** Advance to the next round's card-select phase. Called automatically once
   *  every actor in the current round has resolved their turn. Does NOT
   *  broadcast — callers do that after their own state changes. */
  private advanceToNextRound(): void {
    // Battle goals: snapshot each living character's end-of-round position
    // before the round closes, then mark the next round's start.
    for (const u of this.units) {
      const cid = this.charIdForUnit(u);
      if (!cid) continue;
      this.emitBG({
        kind: 'round_end_position',
        characterId: cid,
        onDoorHex: this.isDoorHex(u.hex),
        adjacentEnemyCount: this.adjacentEnemyCount(u),
      });
    }
    this.round += 1;
    this.monstersActedThisRound.clear();
    this.emitBG({ kind: 'round_start', round: this.round });
    this.turnOrder = [];
    this.activeTurnIndex = 0;
    for (const p of this.players.values()) p.selection = null;
    // Round-bounded effects expire: clear all unit shields.
    for (const u of this.units) u.shield = 0;
    // Shared monster modifier deck reshuffles between rounds if a Null or ×2
    // came up. (Player decks reshuffle per-turn instead — they're personal.)
    this.maybeReshuffleMonsterModifierDeck();
    // End-of-round element wane: every token shifts one column left
    // (strong → waning → inert).
    const before = this.elementBoard;
    this.elementBoard = waneBoard(before);
    const waned = ALL_ELEMENTS.filter((e) => before[e] !== this.elementBoard[e]);
    if (waned.length > 0) this.pushEvent(`Elements wane: ${waned.join(', ')}.`);
    // Persistent-round cards leave the active area (to discard); 'end-round'
    // active effects expire. Cards stay in the active area until their own
    // disposition rule fires: persistent-scenario lasts to scenario end, and
    // persistent-tracked lasts until its tracked uses run out (removed by
    // fireTrackedTrigger). Only round-bounded cards leave here.
    for (const p of this.players.values()) {
      const stayActive: Card[] = [];
      for (const card of p.active) {
        // We don't track which half kept the card alive; conservative rule:
        // if EITHER half is persistent-scenario or persistent-tracked, keep it.
        const survivesRound =
          card.top.disposition === 'persistent-scenario' ||
          card.bottom.disposition === 'persistent-scenario' ||
          card.top.disposition === 'persistent-tracked' ||
          card.bottom.disposition === 'persistent-tracked';
        if (survivesRound) stayActive.push(card);
        else p.discard.push(card);
      }
      p.active = stayActive;
      p.activeEffects = p.activeEffects.filter((e) => e.expires === 'end-scenario');
      // `on-next-retaliate-this-round` riders that never fired expire now.
      p.pendingRetaliateXp = [];
    }
    this.phase = 'card_select';
  }

  private maybeBeginTurnResolution(): void {
    const ready = [...this.players.values()].filter(
      (p) => p.activeCharacterId && p.socket !== null,
    );
    if (ready.length === 0) return;
    if (!ready.every((p) => p.selection !== null)) return;
    // All connected players with characters have submitted — build turn order.
    const order: TurnOrderEntry[] = [];

    for (const p of ready) {
      const unit = this.units.find((u) => u.ownerPlayerId === p.playerId);
      if (!unit) continue;
      const sel = p.selection!;
      if (sel.kind === 'long_rest') {
        order.push({
          kind: 'player',
          playerId: p.playerId,
          unitId: unit.id,
          initiative: 99,
          leadingCardId: null,
          done: false,
        });
      } else {
        const leadingCard = p.hand.find((c) => c.id === sel.leadingId);
        const secondCard = p.hand.find((c) => c.id === sel.secondId);
        // Battle goals (Dawdler): did the player use the lower-initiative
        // (slower) of their two played cards? Equal counts as "lowest".
        const cid = this.charIdForPlayer(p.playerId);
        if (cid) {
          const li = leadingCard?.initiative ?? 99;
          const si = secondCard?.initiative ?? 99;
          this.emitBG({
            kind: 'initiative_chosen',
            characterId: cid,
            usedLowestOfPlayed: li <= si,
          });
        }
        order.push({
          kind: 'player',
          playerId: p.playerId,
          unitId: unit.id,
          initiative: leadingCard?.initiative ?? 99,
          leadingCardId: sel.leadingId,
          done: false,
        });
      }
    }

    // Monster groups by setId — one entry per distinct setId on the board.
    const setIds = new Set<string>();
    for (const u of this.units) {
      if (u.kind !== 'monster') continue;
      const def = MONSTER_DEFS[u.defId as keyof typeof MONSTER_DEFS];
      if (def) setIds.add(def.setId);
    }
    this.scriptedActionBySet = new Map();
    for (const setId of setIds) {
      const entry = this.buildMonsterSetTurnEntry(setId);
      if (entry) order.push(entry);
    }

    order.sort((a, b) => a.initiative - b.initiative);
    this.turnOrder = order;
    this.activeTurnIndex = 0;
    this.phase = 'turn_resolution';
    // Card selection has finalized — any pending short-rest reroll choice expires.
    for (const p of this.players.values()) p.shortRestPending = null;
    this.openTurn();
  }

  /** Build the turn-order entry for one monster set, drawing its ability card
   *  for the current round (or resolving its scripted action). Returns null if
   *  the set has no living, non-dummy actors. Shared by round-start ordering and
   *  mid-round reveals (docs/rules/revealing-spawning-and-named-monsters.md). */
  private buildMonsterSetTurnEntry(setId: string): TurnOrderEntry | null {
    // Living, non-dummy members of this set. If every member is a training
    // dummy (or the set is empty of actors), the set takes no turn.
    const actors = this.units.filter(
      (u) =>
        u.kind === 'monster' &&
        monsterDefMatchesSet(u.defId, setId) &&
        this.behaviorOf(u.id) !== 'dummy',
    );
    if (actors.length === 0) return null;

    // Scripted figures ignore the deck and perform a fixed action at a fixed
    // initiative. (When a set mixes scripted + normal — rare — the scripted
    // action wins for the whole group; our scenarios keep this uniform.)
    const scripted = actors
      .map((u) => this.behaviorOf(u.id))
      .find((b): b is { scripted: ScriptedAction } => typeof b === 'object');
    if (scripted) {
      this.scriptedActionBySet.set(setId, scripted.scripted);
      return {
        kind: 'monster-group',
        setId,
        abilityCardId: `scripted:${setId}`,
        abilityCardName: 'Scripted Action',
        initiative: scripted.scripted.initiative,
        done: false,
      };
    }

    const deck = MONSTER_DECKS[setId as keyof typeof MONSTER_DECKS];
    if (!deck) return null;
    // Round 1 just draws the first card. Shuffle/discard pile is step-7+ work.
    const drawn = deck.cards[(this.round - 1) % deck.cards.length];
    if (!drawn) return null;
    return {
      kind: 'monster-group',
      setId,
      abilityCardId: drawn.id,
      abilityCardName: drawn.name,
      initiative: drawn.initiative,
      done: false,
    };
  }

  /** Splice newly-revealed monster sets into the current round's initiative
   *  order (docs/rules/revealing-spawning-and-named-monsters.md). A set whose
   *  initiative is at or before the acting figure's acts next (immediately
   *  after them); a set whose initiative comes after slots into normal order.
   *  The acting figure keeps its index, so its interrupted turn resumes. */
  private spliceRevealedSetsIntoTurnOrder(newEntries: TurnOrderEntry[]): void {
    if (newEntries.length === 0) return;
    const acting = this.turnOrder[this.activeTurnIndex];
    if (!acting) {
      this.turnOrder = [...this.turnOrder, ...newEntries].sort(
        (a, b) => a.initiative - b.initiative,
      );
      return;
    }
    const head = this.turnOrder.slice(0, this.activeTurnIndex + 1);
    const tail = this.turnOrder.slice(this.activeTurnIndex + 1);
    const actNext = newEntries
      .filter((e) => e.initiative <= acting.initiative)
      .sort((a, b) => a.initiative - b.initiative);
    const later = [
      ...tail,
      ...newEntries.filter((e) => e.initiative > acting.initiative),
    ].sort((a, b) => a.initiative - b.initiative);
    this.turnOrder = [...head, ...actNext, ...later];
  }

  createCharacter(
    playerId: string,
    classId: string,
    characterName: string,
  ): { ok: true; characterInstanceId: string } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };

    const classDef = CHARACTER_CLASSES[classId];
    if (!classDef) return { ok: false, reason: 'unknown_class' };

    const trimmed = characterName.trim();
    if (!trimmed) return { ok: false, reason: 'name_required' };

    const id = 'ch_' + Math.random().toString(36).slice(2, 8);
    const instance: CharacterInstance = {
      id,
      classId,
      name: trimmed,
      level: 1,
      xp: 0,
      perksUnlocked: [],
      pool: [...defaultPoolForClass(classDef)],
      claimedByPlayerId: playerId,
      // Rulebook: each character starts with 25 gold to spend on shop items
      // (items 1–13, the supply with no reputation requirement).
      gold: 25,
      loadout: null,
      shoppingDone: false,
      ownedItemIds: [],
      broughtItemIds: [],
      sessionPurchasedItemIds: [],
      spentItemIds: [],
      activeItems: [],
      battleGoalCheckmarks: 0,
    };

    this.campaign.characters.push(instance);
    entry.activeCharacterId = id;
    const saved = this.campaign.players.find((p) => p.playerId === playerId);
    if (saved) saved.activeCharacterId = id;
    void this.persist();
    this.broadcastState();
    return { ok: true, characterInstanceId: id };
  }

  claimCharacter(
    playerId: string,
    characterInstanceId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };

    const instance = this.campaign.characters.find((c) => c.id === characterInstanceId);
    if (!instance) return { ok: false, reason: 'character_not_found' };
    if (instance.claimedByPlayerId && instance.claimedByPlayerId !== playerId) {
      // Allow takeover if the current owner is offline (no live player entry).
      // Mid-scenario this resets any in-flight hand/discard state for that
      // character; for the lobby case (the common one) there's nothing to
      // lose.
      const owner = this.players.get(instance.claimedByPlayerId);
      if (owner && owner.socket !== null) {
        return { ok: false, reason: 'already_claimed' };
      }
      if (owner) this.players.delete(instance.claimedByPlayerId);
      this.campaign.players = this.campaign.players.filter(
        (p) => p.playerId !== instance.claimedByPlayerId,
      );
    }

    instance.claimedByPlayerId = playerId;
    entry.activeCharacterId = characterInstanceId;
    const saved = this.campaign.players.find((p) => p.playerId === playerId);
    if (saved) saved.activeCharacterId = characterInstanceId;
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  unclaimCharacter(playerId: string): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    const instance = this.campaign.characters.find((c) => c.id === entry.activeCharacterId);
    if (instance && instance.claimedByPlayerId === playerId) {
      instance.claimedByPlayerId = null;
    }
    entry.activeCharacterId = null;
    const saved = this.campaign.players.find((p) => p.playerId === playerId);
    if (saved) saved.activeCharacterId = null;
    void this.persist();
    this.broadcastState();
  }

  setLoadout(
    playerId: string,
    cardIds: string[],
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'no_character' };
    if (instance.claimedByPlayerId !== playerId) {
      return { ok: false, reason: 'not_your_character' };
    }
    const classDef = CHARACTER_CLASSES[instance.classId];
    if (!classDef) return { ok: false, reason: 'unknown_class' };
    if (cardIds.length !== classDef.handSize) {
      return { ok: false, reason: 'wrong_count' };
    }
    const seen = new Set<string>();
    const poolSet = new Set(instance.pool);
    for (const id of cardIds) {
      if (seen.has(id)) return { ok: false, reason: 'duplicate_card' };
      seen.add(id);
      if (!poolSet.has(id)) return { ok: false, reason: 'card_not_in_pool' };
    }
    instance.loadout = [...cardIds];
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Mark the player's pre-scenario shopping as finished (ready up). Requires
   *  a locked loadout — you can't ready up before choosing a hand. */
  finishShopping(
    playerId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    if (!entry.activeCharacterId) return { ok: false, reason: 'no_character' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'character_not_found' };
    if (instance.loadout === null) return { ok: false, reason: 'no_loadout' };
    instance.shoppingDone = true;
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /** Re-open the shop after readying up (un-ready). */
  reopenShopping(
    playerId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    if (!entry.activeCharacterId) return { ok: false, reason: 'no_character' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'character_not_found' };
    instance.shoppingDone = false;
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  buyItem(
    playerId: string,
    itemId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'no_character' };
    if (instance.claimedByPlayerId !== playerId) {
      return { ok: false, reason: 'not_your_character' };
    }
    if (this.phase !== 'lobby') {
      return { ok: false, reason: 'can_only_buy_in_lobby' };
    }
    const item = getItem(itemId);
    if (!item) return { ok: false, reason: 'unknown_item' };
    if (instance.ownedItemIds.includes(itemId)) {
      return { ok: false, reason: 'already_owned' };
    }
    if (instance.gold < item.cost) {
      return { ok: false, reason: 'not_enough_gold' };
    }
    const shop = this.campaign.shop ?? [];
    const stock = shop.find((s) => s.itemId === itemId);
    if (!stock || stock.remaining <= 0) {
      return { ok: false, reason: 'out_of_stock' };
    }
    stock.remaining -= 1;
    instance.gold -= item.cost;
    instance.ownedItemIds.push(itemId);
    // Remember this as a same-session purchase so it can be undone until the
    // scenario starts.
    if (!Array.isArray(instance.sessionPurchasedItemIds)) {
      instance.sessionPurchasedItemIds = [];
    }
    instance.sessionPurchasedItemIds.push(itemId);
    // Auto-bring the freshly bought item, but only if doing so still satisfies
    // slot limits — otherwise leave it owned-but-not-brought for the player to
    // sort out manually.
    const withNew = [...instance.broughtItemIds, itemId];
    if (validateItemLoadout(instance.level, instance.ownedItemIds, withNew).ok) {
      instance.broughtItemIds = withNew;
    }
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  /**
   * Undo a purchase made during the current shopping session: refund the gold,
   * return the item to shop stock, and remove it from owned/brought. Only items
   * in `sessionPurchasedItemIds` (bought this trip, before the scenario starts)
   * can be undone.
   */
  undoBuyItem(
    playerId: string,
    itemId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'no_character' };
    if (instance.claimedByPlayerId !== playerId) {
      return { ok: false, reason: 'not_your_character' };
    }
    if (this.phase !== 'lobby') {
      return { ok: false, reason: 'can_only_buy_in_lobby' };
    }
    const session = instance.sessionPurchasedItemIds ?? [];
    if (!session.includes(itemId)) {
      return { ok: false, reason: 'not_bought_this_session' };
    }
    const item = getItem(itemId);
    if (!item) return { ok: false, reason: 'unknown_item' };
    instance.gold += item.cost;
    instance.ownedItemIds = instance.ownedItemIds.filter((id) => id !== itemId);
    instance.broughtItemIds = instance.broughtItemIds.filter((id) => id !== itemId);
    instance.sessionPurchasedItemIds = session.filter((id) => id !== itemId);
    const stock = (this.campaign.shop ?? []).find((s) => s.itemId === itemId);
    if (stock) stock.remaining += 1;
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  setItemLoadout(
    playerId: string,
    itemIds: string[],
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'no_character' };
    if (instance.claimedByPlayerId !== playerId) {
      return { ok: false, reason: 'not_your_character' };
    }
    if (this.phase !== 'lobby') {
      return { ok: false, reason: 'can_only_set_in_lobby' };
    }
    const validation = validateItemLoadout(
      instance.level,
      instance.ownedItemIds,
      itemIds,
    );
    if (!validation.ok) return { ok: false, reason: validation.reason };
    instance.broughtItemIds = [...itemIds];
    void this.persist();
    this.broadcastState();
    return { ok: true };
  }

  useItem(
    playerId: string,
    itemId: string,
    slot: 'top' | 'bottom' | undefined,
    actionId: string | undefined,
    targetUnitId?: string,
    targetCardId?: string,
  ): { ok: true } | { ok: false; reason: string } {
    const result = this.useItemInner(playerId, itemId, slot, actionId, targetUnitId, targetCardId);
    // Battle goals (Prohibitionist): a successful use of any item — covering
    // every effect branch and the activation path — emits one item_used event.
    if (result.ok) {
      const cid = this.charIdForPlayer(playerId);
      const item = getItem(itemId);
      if (cid && item) {
        this.emitBG({
          kind: 'item_used',
          characterId: cid,
          itemId,
          isPotion: item.isPotion ?? false,
        });
      }
    }
    return result;
  }

  private useItemInner(
    playerId: string,
    itemId: string,
    slot: 'top' | 'bottom' | undefined,
    actionId: string | undefined,
    targetUnitId?: string,
    targetCardId?: string,
  ): { ok: true } | { ok: false; reason: string } {
    const entry = this.players.get(playerId);
    if (!entry) return { ok: false, reason: 'no_player' };
    const instance = this.campaign.characters.find(
      (c) => c.id === entry.activeCharacterId,
    );
    if (!instance) return { ok: false, reason: 'no_character' };
    if (!instance.broughtItemIds.includes(itemId)) {
      return { ok: false, reason: 'item_not_brought' };
    }
    if (instance.spentItemIds.includes(itemId)) {
      return { ok: false, reason: 'item_already_spent' };
    }
    const item = getItem(itemId);
    if (!item) return { ok: false, reason: 'unknown_item' };
    const ct = this.currentTurn;
    if (!ct) return { ok: false, reason: 'no_active_turn' };
    const unit = this.units.find((u) => u.id === ct.unitId);
    if (!unit || unit.ownerPlayerId !== playerId) {
      return { ok: false, reason: 'not_your_turn' };
    }

    if (item.effect.kind === 'move-bonus') {
      if (slot === undefined || actionId === undefined) {
        return { ok: false, reason: 'item_needs_action_context' };
      }
      const halfSlot = slot === 'top' ? ct.topSlot : ct.bottomSlot;
      const action = halfSlot.actions.find((a) => a.id === actionId);
      if (!action || action.done) return { ok: false, reason: 'action_unavailable' };
      if (action.type !== 'move') {
        return { ok: false, reason: 'item_only_usable_during_move' };
      }
      action.amount += item.effect.amount;
    } else if (item.effect.kind === 'jump-this-turn') {
      // Turn-scoped: every move this turn gains Jump. Flag future move queues
      // (set in engageHalf) and patch any moves already queued.
      ct.jumpAllMoves = true;
      for (const halfSlot of [ct.topSlot, ct.bottomSlot]) {
        for (const a of halfSlot.actions) if (a.type === 'move') a.jump = true;
      }
    } else if (item.effect.kind === 'shield-on-attack') {
      // Activate into the active area. Uses are consumed automatically by
      // incoming attacks; the item becomes spent once they run out.
      if (instance.activeItems.some((ai) => ai.itemId === itemId)) {
        return { ok: false, reason: 'item_already_active' };
      }
      instance.activeItems.push({ itemId, usesRemaining: item.effect.uses });
      this.pushEvent(`${instance.name} activates ${item.name}.`);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'heal-self') {
      // Turn-scoped self-heal. Reject only when it would do nothing — at full HP
      // with no Poison/Wound to clear — so the single-use item isn't wasted.
      const canCure = hasCondition(unit, 'poison') || hasCondition(unit, 'wound');
      if (unit.hp >= unit.hpMax && !canCure) {
        return { ok: false, reason: 'already_full_hp' };
      }
      const restored = this.healUnit(unit, item.effect.amount);
      this.pushEvent(`${instance.name} uses ${item.name}: heals ${restored}.`);
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'pierce-one-attack') {
      // Arm Pierce on the next attack you perform this turn — it rides along
      // with whatever target that attack hits. Requires an attack to be queued.
      const hasAttack = [ct.topSlot, ct.bottomSlot].some((hs) =>
        hs.actions.some(
          (a) => !a.done && (a.type === 'attack' || a.type === 'attack-aoe'),
        ),
      );
      if (!hasAttack) return { ok: false, reason: 'item_only_usable_during_attack' };
      ct.pierceCharge = { amount: item.effect.amount };
      this.pushEvent(
        `${instance.name} uses ${item.name}: Pierce ${item.effect.amount} on the next attack.`,
      );
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'poison-one-attack') {
      // Arm Poison on the next MELEE attack you perform this turn — it rides
      // along with whatever target that attack hits. Requires a melee attack.
      const hasMeleeAttack = [ct.topSlot, ct.bottomSlot].some((hs) =>
        hs.actions.some(
          (a) =>
            !a.done &&
            (a.type === 'attack-aoe' || (a.type === 'attack' && a.range <= 1)),
        ),
      );
      if (!hasMeleeAttack) {
        return { ok: false, reason: 'item_only_usable_during_melee_attack' };
      }
      ct.poisonCharge = true;
      this.pushEvent(`${instance.name} uses ${item.name}: Poison on the next melee attack.`);
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'advantage-one-attack') {
      // Arm Advantage on the next RANGED attack you perform this turn — it
      // rides along with whatever target that attack hits. Requires a ranged
      // attack to be queued.
      const hasRangedAttack = [ct.topSlot, ct.bottomSlot].some((hs) =>
        hs.actions.some((a) => !a.done && a.type === 'attack' && a.range > 1),
      );
      if (!hasRangedAttack) {
        return { ok: false, reason: 'item_only_usable_during_ranged_attack' };
      }
      ct.advantageCharge = true;
      this.pushEvent(`${instance.name} uses ${item.name}: Advantage on the next ranged attack.`);
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'heal-after-lost') {
      // Gated: only after performing an action from a Lost-disposition card
      // this turn. Heals one figure (self or ally) within range.
      if (!ct.performedLostAction) {
        return { ok: false, reason: 'no_lost_action_yet' };
      }
      if (targetUnitId === undefined) {
        return { ok: false, reason: 'item_needs_target' };
      }
      const tgt = this.units.find((u) => u.id === targetUnitId);
      if (!tgt || tgt.kind !== 'player') {
        return { ok: false, reason: 'invalid_target' };
      }
      if (hexDistance(unit.hex, tgt.hex) > item.effect.range) {
        return { ok: false, reason: 'target_out_of_range' };
      }
      // Reject only when it would do nothing — full HP with no Poison/Wound to
      // clear — so the single-use item isn't wasted.
      const canCure = hasCondition(tgt, 'poison') || hasCondition(tgt, 'wound');
      if (tgt.hp >= tgt.hpMax && !canCure) {
        return { ok: false, reason: 'target_full_hp' };
      }
      const restored = this.healUnit(tgt, item.effect.amount);
      this.pushEvent(`${instance.name} uses ${item.name}: heals ${tgt.name} ${restored}.`);
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'retrieve-discarded-card') {
      // Return one printed-level-N card from the discard pile to hand.
      if (targetCardId === undefined) {
        return { ok: false, reason: 'item_needs_card_target' };
      }
      const wantLevel = item.effect.cardLevel;
      const idx = entry.discard.findIndex(
        (c) => c.id === targetCardId && cardMatchesLevel(c.level, wantLevel),
      );
      if (idx === -1) {
        return { ok: false, reason: 'card_not_in_discard' };
      }
      const [card] = entry.discard.splice(idx, 1);
      if (!card) return { ok: false, reason: 'card_not_in_discard' };
      entry.hand.push(card);
      this.pushEvent(`${instance.name} uses ${item.name}: retrieves ${card.name} from the discard pile.`);
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else if (item.effect.kind === 'infuse-element') {
      // Reuse the element-choice flow: prompt the player to pick any element,
      // then queue it as a pending infusion (becomes Strong at end of turn).
      if (this.pendingElementChoice) {
        return { ok: false, reason: 'resolve_pending_choice_first' };
      }
      this.pendingElementChoice = {
        id: `c${this.nextChoiceN++}`,
        context: { kind: 'create-element', playerId },
        options: ALL_ELEMENTS,
        prompt: `${item.name}: pick an element to infuse`,
      };
      this.pendingChoiceFollowup = (picked) => {
        if (this.currentTurn) {
          this.currentTurn.pendingInfusions = [...this.currentTurn.pendingInfusions, picked];
        }
        this.pendingElementChoice = null;
        this.pendingChoiceFollowup = null;
        this.pushEvent(`${instance.name} uses ${item.name}: infuses ${picked}.`);
      };
      instance.spentItemIds.push(itemId);
      this.broadcastState();
      return { ok: true };
    } else {
      return { ok: false, reason: 'effect_not_implemented' };
    }

    instance.spentItemIds.push(itemId);
    this.pushEvent(`${instance.name} uses ${item.name}.`);
    this.broadcastState();
    return { ok: true };
  }

  pickCharacter(playerId: string, characterId: string): void {
    const entry = this.players.get(playerId);
    if (!entry) return;
    entry.activeCharacterId = characterId;
    const saved = this.campaign.players.find((p) => p.playerId === playerId);
    if (saved) saved.activeCharacterId = characterId;
    void this.persist();
    this.broadcastState();
  }

  forwardCursor(playerId: string, px: { x: number; y: number }): void {
    const msg: ServerToClient = { type: 'cursor', playerId, px };
    for (const ws of this.hostSockets) this.send(ws, msg);
  }

  forwardPendingMove(
    playerId: string,
    hex: { q: number; r: number } | null,
  ): void {
    const msg: ServerToClient = { type: 'pending_move', playerId, hex };
    for (const ws of this.hostSockets) this.send(ws, msg);
  }

  /** Stage (or clear) the active player's planned push/pull. Computes the
   *  full path on the server and broadcasts the new state so the desktop
   *  view can render the planned slide for the whole party to see. */
  setForcedMovePreview(
    playerId: string,
    preview: { targetUnitId: string; destination: Hex } | null,
  ): void {
    if (preview === null) {
      if (this.pendingForcedMove?.playerId === playerId) {
        this.pendingForcedMove = null;
        this.broadcastState();
      }
      return;
    }
    const ct = this.currentTurn;
    if (!ct) return;
    const actor = this.units.find((u) => u.id === ct.unitId);
    if (!actor || actor.kind !== 'player' || actor.ownerPlayerId !== playerId) return;
    const action = this.findActiveForcedMoveAction(ct);
    if (!action) return;
    const tgt = this.units.find((u) => u.id === preview.targetUnitId);
    if (!tgt || tgt.kind === 'player') return;
    if (hexDistance(actor.hex, tgt.hex) > action.range) return;
    const tilePassable = new Set<string>();
    for (const t of this.scenarioTiles()) if (t.kind !== 'wall') tilePassable.add(hexKey(t));
    const occupied = new Set<string>();
    for (const u of this.units) {
      if (u.id === tgt.id) continue;
      occupied.add(hexKey(u.hex));
    }
    const path = bfsForcedMovePath(
      tgt.hex,
      preview.destination,
      action.amount,
      actor.hex,
      action.type,
      (h) => {
        const k = hexKey(h);
        return tilePassable.has(k) && !occupied.has(k);
      },
    );
    if (!path) return;
    this.pendingForcedMove = {
      playerId,
      targetUnitId: tgt.id,
      path,
      direction: action.type,
    };
    this.broadcastState();
  }

  private findActiveForcedMoveAction(
    ct: CurrentTurn,
  ): (PendingAction & { type: 'push' | 'pull' }) | null {
    for (const slot of [ct.topSlot, ct.bottomSlot]) {
      for (const a of slot.actions) {
        if (!a.done && (a.type === 'push' || a.type === 'pull')) {
          return a as PendingAction & { type: 'push' | 'pull' };
        }
      }
    }
    return null;
  }

  /** Refresh any `amountRef`-bound amounts on the active turn's queue from the
   *  current state. Cheap; called before every broadcast so the player sees
   *  Attack X / Move X update live as they move or deal damage. */
  /** Denormalize each player unit's active Retaliate onto the Unit for client
   *  display, aggregated into bands by range (amounts sharing a range are
   *  summed; bands sorted by ascending range). Source of truth remains
   *  PlayerEntry.activeEffects. Monsters can't gain Retaliate today. */
  private syncUnitRetaliate(): void {
    for (const u of this.units) {
      if (u.kind !== 'player' || !u.ownerPlayerId) {
        u.retaliate = [];
        continue;
      }
      const p = this.players.get(u.ownerPlayerId);
      if (!p) {
        u.retaliate = [];
        continue;
      }
      const byRange = new Map<number, number>();
      for (const e of p.activeEffects) {
        if (e.kind === 'retaliate') {
          byRange.set(e.range, (byRange.get(e.range) ?? 0) + e.amount);
        }
      }
      u.retaliate = [...byRange.entries()]
        .filter(([, amount]) => amount > 0)
        .sort(([a], [b]) => a - b)
        .map(([range, amount]) => ({ amount, range }));
    }
  }

  private refreshAmountRefs(): void {
    const ct = this.currentTurn;
    if (!ct) return;
    for (const slot of [ct.topSlot, ct.bottomSlot]) {
      for (const a of slot.actions) {
        if ((a.type === 'attack' || a.type === 'attack-aoe' || a.type === 'move') && a.amountRef) {
          a.amount = resolveAmountRef(a.amountRef, ct);
        }
      }
    }
  }

  /** Recompute the per-attack consume-offer list from this turn's snapshot
   *  + live consumedThisTurn. Skips actions whose consumes are already
   *  locked (offers frozen at first-target). Wild/mixed riders are dropped
   *  for v1 (they need an inline prompt that doesn't fit a multi-target
   *  flow; deferred). */
  private refreshConsumeOffers(): void {
    const ct = this.currentTurn;
    if (!ct) return;
    const snapshot = ct.turnStartElementBoard;
    const consumed = new Set<Element>(ct.consumedThisTurn);
    for (const slot of [ct.topSlot, ct.bottomSlot]) {
      for (const a of slot.actions) {
        if (a.type !== 'attack' && a.type !== 'attack-aoe') continue;
        if (a.consumesLocked) continue;
        const sources = this.riderSources.get(a.id) ?? [];
        const offers: AttackConsumeOffer[] = [];
        sources.forEach((rider, riderIndex) => {
          const elems = riderConsumeElements(rider.consume);
          if (!elems) return; // wild/mixed rider — deferred
          // Every element in the bundle must be strong/waning at turn-start
          // AND uncon­sumed this turn.
          if (!elems.every((e) => isAvailableAt(snapshot, e) && !consumed.has(e))) return;
          offers.push({
            riderIndex,
            consumes: elems,
            attackBonus: rider.attackBonus ?? 0,
            pierceBonus: rider.pierce?.amount ?? 0,
            gainExp: rider.gainExp ?? 0,
          });
        });
        a.consumeOffers = offers;
        // Drop accepted indices that no longer point at a valid offer
        // (e.g. element got consumed elsewhere). Re-map by riderIndex.
        const validOfferRiderIdx = new Set(offers.map((o) => o.riderIndex));
        a.acceptedConsumeIndices = a.acceptedConsumeIndices.filter((i) => {
          const src = sources[i];
          if (!src) return false;
          return validOfferRiderIdx.has(i);
        });
      }
    }
  }

  /** Recompute the tappable hexes for any pending `destroy-trap` action: trap
   *  hexes the actor entered (and bypassed) this move that still hold a trap. */
  private refreshTrapEligibility(): void {
    const ct = this.currentTurn;
    if (!ct) return;
    const eligible = ct.trapHexesEnteredThisMove.filter((h) => this.isTrapHex(h));
    for (const slot of [ct.topSlot, ct.bottomSlot]) {
      for (const a of slot.actions) {
        if (a.type === 'destroy-trap') {
          a.eligibleHexes = eligible.map((h) => ({ q: h.q, r: h.r }));
        }
      }
    }
  }

  /** First-sub-target lock-in. Walks accepted offers, marks each element
   *  inert, appends to consumedThisTurn, sums attack/pierce contributions,
   *  grants any rider XP. Subsequent sub-targets read the locked totals. */
  private lockConsumeOffers(
    action: PendingAction & { type: 'attack' | 'attack-aoe' },
    p: PlayerEntry,
  ): void {
    const ct = this.currentTurn;
    if (!ct) return;
    let atkBonus = 0;
    let pierceBonus = 0;
    let xpGain = 0;
    const elementsToConsume: Element[] = [];
    const acceptedSet = new Set(action.acceptedConsumeIndices);
    for (const offer of action.consumeOffers) {
      if (!acceptedSet.has(offer.riderIndex)) continue;
      atkBonus += offer.attackBonus;
      pierceBonus += offer.pierceBonus;
      xpGain += offer.gainExp;
      elementsToConsume.push(...offer.consumes);
    }
    if (elementsToConsume.length > 0) {
      const live = { ...this.elementBoard };
      for (const e of elementsToConsume) live[e] = 'inert';
      this.elementBoard = live;
      ct.consumedThisTurn = [...ct.consumedThisTurn, ...elementsToConsume];
      this.pushEvent(`Consumed ${elementsToConsume.join(', ')}.`);
    }
    if (xpGain > 0) {
      this.grantXp(p, xpGain, 'element rider');
    }
    action.lockedRiderAttack = atkBonus;
    action.lockedRiderPierce = pierceBonus;
    action.consumesLocked = true;
    // Locked offers stay visible (so the UI can show "consumed" pills) but
    // no longer toggleable.
  }

  /** Player toggles an opt-in for an element-rider on the active attack. */
  toggleConsumeRider(
    playerId: string,
    slotKind: 'top' | 'bottom',
    actionId: string,
    riderIndex: number,
  ): { ok: true } | { ok: false; reason: string } {
    const guard = this.requireMyTurn(playerId);
    if (!guard.ok) return guard;
    const ct = guard.ct;
    const slot = slotKind === 'top' ? ct.topSlot : ct.bottomSlot;
    if (slot.status !== 'engaged') return { ok: false, reason: 'slot_not_engaged' };
    const action = slot.actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, reason: 'no_action' };
    if (action.type !== 'attack' && action.type !== 'attack-aoe') {
      return { ok: false, reason: 'not_an_attack' };
    }
    if (action.consumesLocked) return { ok: false, reason: 'consumes_locked' };
    // Ensure the rider corresponds to a currently-available offer.
    const offer = action.consumeOffers.find((o) => o.riderIndex === riderIndex);
    if (!offer) return { ok: false, reason: 'offer_unavailable' };
    const current = new Set(action.acceptedConsumeIndices);
    if (current.has(riderIndex)) current.delete(riderIndex);
    else current.add(riderIndex);
    action.acceptedConsumeIndices = [...current];
    this.broadcastState();
    return { ok: true };
  }

  /** Resolve an outstanding wild/mixed element prompt by handing the picked
   *  element to the deferred follow-up. */
  resolveElementChoice(
    playerId: string,
    choiceId: string,
    element: Element,
  ): { ok: true } | { ok: false; reason: string } {
    const choice = this.pendingElementChoice;
    if (!choice || choice.id !== choiceId) return { ok: false, reason: 'no_pending_choice' };
    // Authorize: the actor named in the context, or for monster sets, any
    // player or the host (party decides per the rulebook). The host actorId
    // is signaled by playerId === 'host'.
    const ctx = choice.context;
    if (ctx.kind === 'create-element' || ctx.kind === 'consume-rider') {
      if (playerId !== ctx.playerId && playerId !== 'host') {
        return { ok: false, reason: 'not_your_choice' };
      }
    }
    // For monster-* contexts, accept any caller (player or host).
    if (!choice.options.includes(element)) {
      return { ok: false, reason: 'element_not_in_options' };
    }
    const followup = this.pendingChoiceFollowup;
    if (followup) followup(element);
    this.broadcastState();
    return { ok: true };
  }

  publicState(): PublicGameState {
    this.refreshAmountRefs();
    this.refreshConsumeOffers();
    this.refreshTrapEligibility();
    this.syncUnitRetaliate();
    const scenario = this.currentScenario();
    return {
      campaignId: this.campaign.id,
      campaignName: this.campaign.name,
      phase: this.phase,
      round: this.round,
      characters: this.campaign.characters,
      scenarioId: this.campaign.scenarioId,
      scenarioName: scenario?.name ?? null,
      tiles: this.scenarioTiles(),
      ...(() => {
        const art = this.visibleTileArt();
        return art.length ? { tileArt: art } : {};
      })(),
      units: this.units,
      moneyTokens: this.moneyTokens,
      moneyTokensPlaced: this.moneyTokensPlaced,
      scenarioLevel: this.scenarioLevel,
      turnOrder: this.turnOrder,
      activeTurnIndex: this.activeTurnIndex,
      elementBoard: this.elementBoard,
      pendingTrapChoice: this.pendingTrapChoice,
      monsterModifierDeck: this.monsterModifierDeck,
      monsterModifierDiscard: this.monsterModifierDiscard,
      monsterModifierNeedsReshuffle: this.monsterModifierNeedsReshuffle,
      monsterTurnAnim: this.monsterTurnAnim,
      battleGoalResults: this.battleGoalResults,
      narrative: this.narrativeQueue[0] ?? null,
      openableDoors: this.openableDoors(),
      doors: this.doorViews(),
      startingPositions: this.phase === 'placement' ? this.startingPositions : [],
      pendingElementChoice: this.pendingElementChoice,
      pendingReactiveItem: this.pendingReactiveItem,
      currentTurn: this.currentTurn,
      events: this.events,
      lastMove: this.lastMove,
      pendingForcedMove: this.pendingForcedMove,
      players: [...this.players.values()].map((p) => ({
        playerId: p.playerId,
        name: p.name,
        characterId: p.activeCharacterId,
        connected: p.socket !== null,
        submitted: p.selection !== null,
        placementReady: p.placementReady,
      })),
      shop: this.campaign.shop ?? [],
    };
  }

  /**
   * Drop a money token in the hex where a monster died, unless the 25-token
   * scenario cap has been reached or the dying unit was a summon/spawn/ally.
   * We currently only have plain monsters (no summons/allies modeled), so the
   * exception is a no-op for now — but we still guard against `kind !== 'monster'`.
   * Rule: monster-damage-and-death.md.
   */
  private dropMoneyTokenOnDeath(dead: Unit): string | null {
    if (dead.kind !== 'monster') return null;
    if (this.moneyTokensPlaced >= MONEY_TOKEN_CAP) return null;
    const id = `m${this.nextMoneyTokenN++}`;
    this.moneyTokens.push({ id, hex: { q: dead.hex.q, r: dead.hex.r } });
    this.moneyTokensPlaced += 1;
    return id;
  }

  /**
   * End-of-turn auto-loot: characters MUST loot money tokens in their hex
   * at the end of their turn (mandatory-experience-end-of-turn-looting.md).
   * Removes the token(s) from the map and adds them to the unit's held count.
   */
  private autoLootForUnit(unit: Unit): void {
    this.lootTokensInRange(unit, 0, 'end-of-turn');
  }

  /**
   * Loot every money token within `range` hexes of `unit` (range 0 = own hex).
   * Removes them from the map, adds to the unit's held count, emits the battle
   * goal event, and returns how many were collected. Shared by the mandatory
   * end-of-turn auto-loot (range 0) and Loot abilities (range 1+).
   */
  private lootTokensInRange(
    unit: Unit,
    range: number,
    source: 'end-of-turn' | 'ability',
  ): number {
    if (unit.kind !== 'player') return 0;
    const here: MoneyToken[] = [];
    const rest: MoneyToken[] = [];
    for (const t of this.moneyTokens) {
      (hexDistance(t.hex, unit.hex) <= range ? here : rest).push(t);
    }
    if (here.length === 0) return 0;
    this.moneyTokens = rest;
    unit.moneyTokensHeld = (unit.moneyTokensHeld ?? 0) + here.length;
    const cid = this.charIdForUnit(unit);
    if (cid) {
      this.emitBG({
        kind: 'loot_collected',
        characterId: cid,
        tokenIds: here.map((t) => t.id),
        source,
        adjacentToEnemy: this.adjacentEnemyCount(unit) > 0,
      });
    }
    this.pushEvent(
      `${unit.name} loots ${here.length} money token${here.length === 1 ? '' : 's'} (holding ${unit.moneyTokensHeld}).`,
    );
    return here.length;
  }

  // ---- Battle goals ------------------------------------------------------

  /** characterId (CharacterInstance id) controlling a player unit, or null. */
  private charIdForUnit(unit: Unit): string | null {
    if (unit.kind !== 'player' || !unit.ownerPlayerId) return null;
    return this.players.get(unit.ownerPlayerId)?.activeCharacterId ?? null;
  }

  /** Apply each condition that rides on an attack to the target it just hit.
   *  A negative condition applied to an enemy through an attack is mandatory,
   *  so there is no player choice here. Skipped on a miss or a kill (a dead
   *  figure can't carry a condition) and for immune targets. */
  private applyAttackRiderConditions(
    attacker: Unit,
    target: Unit,
    conditions: readonly NegativeCondition[] | undefined,
    missed: boolean,
  ): void {
    if (!conditions || conditions.length === 0 || missed || target.hp <= 0) return;
    for (const condition of conditions) {
      if (unitImmuneTo(target, condition)) continue;
      const cid = this.charIdForUnit(attacker);
      if (cid) {
        this.emitBG({
          kind: 'condition_applied',
          byCharacterId: cid,
          targetIsEnemy: true,
          condition,
          targetPriorNegativeConditions: target.conditions.map((c) => c.kind),
        });
      }
      applyConditionToUnit(target, condition, /*isOwnTurn*/ false);
      this.pushEvent(`${target.name} is ${condition}ed.`);
    }
  }

  private charIdForPlayer(playerId: string): string | null {
    return this.players.get(playerId)?.activeCharacterId ?? null;
  }

  /** Number of living enemy (monster) figures adjacent to a unit. */
  private adjacentEnemyCount(unit: Unit): number {
    return this.units.filter(
      (u) => u.kind === 'monster' && u.hp > 0 && hexDistance(u.hex, unit.hex) === 1,
    ).length;
  }

  /** Number of OTHER living player characters adjacent to a unit. */
  private adjacentCharacterCount(unit: Unit): number {
    return this.units.filter(
      (u) =>
        u.kind === 'player' &&
        u.id !== unit.id &&
        u.hp > 0 &&
        hexDistance(u.hex, unit.hex) === 1,
    ).length;
  }

  /** Whether a hex carries a door tile. */
  private isDoorHex(hex: Hex): boolean {
    return this.scenarioTiles().some(
      (t) => t.q === hex.q && t.r === hex.r && t.kind === 'door',
    );
  }

  /** Whether a hex is adjacent to a wall tile. Obstacles and objectives are
   *  not yet modeled as distinct tiles, so only walls are detected here
   *  (Wallflower under-counts until overlay obstacles/objectives exist). */
  private isAdjacentToWallObstacleOrObjective(hex: Hex): boolean {
    return this.scenarioTiles().some(
      (t) => t.kind === 'wall' && hexDistance({ q: t.q, r: t.r }, hex) === 1,
    );
  }

  private countStrongOrWaningElements(): number {
    return ALL_ELEMENTS.filter(
      (e) => this.elementBoard[e] === 'strong' || this.elementBoard[e] === 'waning',
    ).length;
  }

  /** Drop the death loot token and emit the rich `enemy_killed` event. Call at
   *  every monster death (this performs the loot drop, so death sites must no
   *  longer call dropMoneyTokenOnDeath themselves). Must run before the unit is
   *  removed from `this.units`. */
  private recordEnemyKilled(
    dead: Unit,
    opts: {
      killerCharacterId: string | null;
      byAttack: boolean;
      /** Damage the killing blow would have caused (pre-shield), for overkill. */
      finalDamage?: number;
      /** Target HP just before the killing blow, for overkill / undamaged. */
      hpBeforeHit?: number;
      attackAdvantage?: 'advantage' | 'disadvantage' | 'normal' | null;
      /** Killer's hex, for adjacency facts. Null for non-character kills. */
      killerHex?: Hex | null;
    },
  ): void {
    const droppedLootTokenId = this.dropMoneyTokenOnDeath(dead);
    // Return the dead figure's standee number to its type's pool so a later
    // reveal/spawn of the same type can reuse it.
    this.freeStandeeNumber(dead);
    this.monsterTypesSeen.add(dead.defId);
    const hpBefore = opts.hpBeforeHit ?? dead.hpMax;
    const wouldCause = opts.finalDamage ?? 0;
    const killerHex = opts.killerHex ?? null;
    this.emitBG({
      kind: 'enemy_killed',
      killerCharacterId: opts.killerCharacterId,
      targetUnitId: dead.id,
      targetNegativeConditions: dead.conditions.map((c) => c.kind),
      byAttack: opts.byAttack,
      overkill: opts.byAttack ? Math.max(0, wouldCause - hpBefore) : 0,
      targetWasUndamaged: hpBefore >= dead.hpMax,
      attackAdvantage: opts.attackAdvantage ?? (opts.byAttack ? 'normal' : null),
      targetRank: dead.rank ?? 'normal',
      targetDefId: dead.defId,
      droppedLootTokenId,
      elementsStrongOrWaning: this.countStrongOrWaningElements(),
      targetAdjacentToKiller: killerHex
        ? hexDistance(killerHex, dead.hex) === 1
        : false,
      killerAdjacentToOtherEnemy: killerHex
        ? this.units.some(
            (u) =>
              u.kind === 'monster' &&
              u.id !== dead.id &&
              u.hp > 0 &&
              hexDistance(u.hex, killerHex) === 1,
          )
        : false,
      targetHadTakenTurn: this.monstersActedThisRound.has(dead.id),
    });
  }

  /** Append a battle-goal event to the scenario log. No-op outside a scenario
   *  (or before any goals were dealt). */
  private emitBG(event: BattleGoalEvent): void {
    if (this.battleGoalHands.size === 0) return;
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.battleGoalLog.push(event);
  }

  /** Keep one of the three dealt battle goals for the current scenario. */
  chooseBattleGoal(
    playerId: string,
    goalId: string,
  ): { ok: true } | { ok: false; reason: string } {
    const charId = this.charIdForPlayer(playerId);
    if (!charId) return { ok: false, reason: 'no_character' };
    const hand = this.battleGoalHands.get(charId);
    if (!hand) return { ok: false, reason: 'no_battle_goal_dealt' };
    if (!hand.dealtGoalIds.includes(goalId)) {
      return { ok: false, reason: 'goal_not_dealt' };
    }
    hand.chosenGoalId = goalId;
    this.broadcastState();
    return { ok: true };
  }

  /** The owning player's secret battle-goal hand, for PrivatePlayerState.
   *  Augmented with a live pass/fail status for the chosen goal so the
   *  Scenario tab can show a running checkbox. */
  private battleGoalHandForPlayer(playerId: string): BattleGoalHand | null {
    const charId = this.charIdForPlayer(playerId);
    if (!charId) return null;
    const hand = this.battleGoalHands.get(charId);
    if (!hand) return null;
    const chosenGoalStatus = hand.chosenGoalId
      ? this.liveGoalStatus(charId, hand.chosenGoalId)
      : null;
    return { ...hand, chosenGoalStatus };
  }

  /** Best-effort live status of a chosen goal, folded from the in-progress
   *  event log. A goal that's satisfiable at the very start but not now has
   *  been broken ('failed', e.g. a "never…" goal); one that's never yet been
   *  satisfied is still 'pending'. */
  private liveGoalStatus(
    charId: string,
    goalId: string,
  ): 'achieved' | 'failed' | 'pending' {
    const allCharacterIds = [...this.battleGoalHands.keys()];
    const lootByCharacter: Record<string, number> = {};
    for (const cid of allCharacterIds) lootByCharacter[cid] = 0;
    for (const u of this.units) {
      const cid = this.charIdForUnit(u);
      if (cid) lootByCharacter[cid] = u.moneyTokensHeld ?? 0;
    }
    const ctx = {
      characterId: charId,
      allCharacterIds,
      lootByCharacter,
      monsterTypesInScenario: [...this.monsterTypesSeen],
    };
    if (evaluateBattleGoal(goalId, this.battleGoalLog, ctx).achieved) {
      return 'achieved';
    }
    // Satisfied with no events at all → a "never break this" goal that has now
    // been broken; otherwise it just hasn't happened yet.
    return evaluateBattleGoal(goalId, [], ctx).achieved ? 'failed' : 'pending';
  }

  /** Fold the scenario's event log through each character's chosen goal and
   *  award checkmarks. Checkmarks are granted only on victory (a lost scenario
   *  grants nothing, per the rules), but results are revealed either way. */
  private evaluateBattleGoals(outcome: 'victory' | 'defeat'): void {
    const allCharacterIds = [...this.battleGoalHands.keys()];
    // Capture loot counts now, before endScenario converts tokens to gold.
    const lootByCharacter: Record<string, number> = {};
    for (const cid of allCharacterIds) lootByCharacter[cid] = 0;
    for (const u of this.units) {
      const cid = this.charIdForUnit(u);
      if (cid) lootByCharacter[cid] = u.moneyTokensHeld ?? 0;
    }
    const monsterTypesInScenario = [...this.monsterTypesSeen];

    // Emit per-character end-of-scenario pile snapshots before folding.
    for (const cid of allCharacterIds) {
      const p = [...this.players.values()].find(
        (pl) => pl.activeCharacterId === cid,
      );
      this.battleGoalLog.push({
        kind: 'scenario_end_piles',
        characterId: cid,
        handCount: p?.hand.length ?? 0,
        discardCount: p?.discard.length ?? 0,
      });
    }

    const results: BattleGoalScenarioResult[] = [];
    for (const [characterId, hand] of this.battleGoalHands) {
      if (!hand.chosenGoalId) continue;
      const goal = getBattleGoal(hand.chosenGoalId);
      if (!goal) continue;
      const res = evaluateBattleGoal(hand.chosenGoalId, this.battleGoalLog, {
        characterId,
        allCharacterIds,
        lootByCharacter,
        monsterTypesInScenario,
      });
      const checkmarks = outcome === 'victory' ? res.checkmarks : 0;
      results.push({
        characterId,
        goalId: goal.id,
        title: goal.title,
        description: goal.description,
        achieved: res.achieved,
        checkmarks,
      });
      if (checkmarks > 0) {
        const charInst = this.campaign.characters.find(
          (c) => c.id === characterId,
        );
        if (charInst) {
          if (typeof charInst.battleGoalCheckmarks !== 'number') {
            charInst.battleGoalCheckmarks = 0;
          }
          charInst.battleGoalCheckmarks += checkmarks;
          this.pushEvent(
            `${charInst.name} achieved battle goal "${goal.title}" (+${checkmarks} checkmark${checkmarks === 1 ? '' : 's'}, total ${charInst.battleGoalCheckmarks}).`,
          );
        }
      }
    }
    this.battleGoalResults = results;
  }

  /**
   * Evaluate the scenario's victory condition. If met, transition to 'victory'
   * (firing any victory story text) and convert each player unit's held money
   * tokens to gold on their CharacterInstance at the scenario-level rate. Also
   * announces newly-cleared rooms so the party sees doors unlock.
   */
  private checkScenarioEnd(): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.phase === 'lobby') return;
    if (this.units.length === 0) return; // not yet set up
    const scenario = this.currentScenario();
    if (!scenario) return;

    // One-time "door unlocked" announcements as rooms get cleared.
    for (const door of scenario.doors ?? []) {
      if (door.unlock === 'manual') continue;
      const room = door.unlock.allMonstersDeadIn;
      if (
        this.revealedRooms.has(room) &&
        !this.openedDoorIds.has(door.id) &&
        !this.clearedRoomsAnnounced.has(room) &&
        this.roomCleared(room)
      ) {
        this.clearedRoomsAnnounced.add(room);
        this.pushEvent('A door unlocks — the way forward is open.');
      }
    }

    if (this.scenarioWon(scenario)) {
      if (scenario.narrative?.victory) this.narrativeQueue.push(scenario.narrative.victory);
      this.endScenario('victory');
    }
  }

  /** Whether the scenario's victory condition is currently satisfied. */
  private scenarioWon(scenario: ReturnType<typeof getScenario>): boolean {
    if (!scenario) return false;
    const victory = scenario.victory ?? { kind: 'killAll' };
    switch (victory.kind) {
      case 'killAll': {
        if (this.units.some((u) => u.kind === 'monster')) return false;
        // Don't win while rooms remain hidden behind doors — their enemies
        // haven't been faced yet.
        if (scenario.rooms?.some((r) => !this.revealedRooms.has(r))) return false;
        return true;
      }
      default:
        throw new Error(`victory condition '${victory.kind}' not yet implemented`);
    }
  }

  private endScenario(outcome: 'victory' | 'defeat'): void {
    // Evaluate battle goals first — this reads per-character loot counts,
    // which the gold-conversion loop below zeroes out.
    this.evaluateBattleGoals(outcome);
    const rate = goldConversionFor(this.scenarioLevel);
    for (const unit of this.units) {
      if (unit.kind !== 'player' || !unit.ownerPlayerId) continue;
      const tokens = unit.moneyTokensHeld ?? 0;
      if (tokens <= 0) continue;
      const p = this.players.get(unit.ownerPlayerId);
      const charId = p?.activeCharacterId;
      const charInst = charId
        ? this.campaign.characters.find((c) => c.id === charId)
        : null;
      if (!charInst) continue;
      if (typeof charInst.gold !== 'number') charInst.gold = 0;
      const earned = tokens * rate;
      charInst.gold += earned;
      unit.moneyTokensHeld = 0;
      this.pushEvent(
        `${charInst.name} converts ${tokens} money token${tokens === 1 ? '' : 's'} into ${earned} gold (now ${charInst.gold}).`,
      );
    }
    this.moneyTokens = [];
    this.phase = outcome;
    this.currentTurn = null;
    this.pendingForcedMove = null;
    this.pushEvent(outcome === 'victory' ? 'Scenario complete — victory!' : 'Scenario lost.');
    void this.persist();
  }

  broadcastState(): void {
    const state = this.publicState();
    const baseMsg: ServerToClient = { type: 'state', state };
    for (const ws of this.hostSockets) this.send(ws, baseMsg);
    for (const p of this.players.values()) {
      if (!p.socket) continue;
      this.send(p.socket, {
        type: 'state',
        state,
        you: {
          playerId: p.playerId,
          hand: p.hand,
          discard: p.discard,
          lost: p.lost,
          active: p.active,
          activeTracked: p.activeTracked,
          activeEffects: p.activeEffects,
          selection: p.selection,
          modifierDeck: p.modifierDeck,
          modifierDiscard: p.modifierDiscard,
          modifierNeedsReshuffle: p.modifierNeedsReshuffle,
          shortRestPending: p.shortRestPending,
          longRestPending: p.longRestPending,
          battleGoal: this.battleGoalHandForPlayer(p.playerId),
        },
      });
    }
  }

  private async persist(): Promise<void> {
    try {
      await saveCampaign(this.campaign);
    } catch (err) {
      console.error('persist failed', err);
    }
  }

  private send(ws: WebSocket, msg: ServerToClient): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
}

// Type-narrowed helper used by the index dispatcher
export type AnyClientMsg = ClientToServer;
