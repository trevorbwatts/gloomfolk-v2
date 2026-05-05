import type { GameState, Hex, ModifierDeck, Unit } from '../types.js';
import { hexDistance, hexEq, hexKey, bfsReachable, inBounds, neighbors } from './hex.js';
import { hasCondition, gainCondition, removeCondition, applyHealConditions } from './conditions.js';
import { drawNormal, drawAdvantage, drawDisadvantage, buildModifierDeck } from './modifiers.js';
import { consumeNegate, triggerReactiveShieldRetaliate } from './persistents.js';

export type AttackOutcome = {
  killed: boolean;
  remainingHp: number;
};

export type AttackOptions = {
  pierce?: number;             // reduce target's shield by this amount for this attack
  isRanged?: boolean;          // true → ranged attack (auto-disadvantage if target adjacent)
  advantage?: boolean;         // attacker has advantage
  disadvantage?: boolean;      // attacker has disadvantage
  appliedConditions?: import('../types.js').ConditionId[];  // conditions to apply to target
  skipModifiers?: boolean;     // bypass modifier deck draw (for testing / direct damage)
};

// ─── Unit / Hex Queries ───────────────────────────────────────────────────────

export function activeUnits(state: GameState): Unit[] {
  return Object.values(state.units).filter((u) => !u.exhausted);
}

export function unitAt(state: GameState, hex: Hex): Unit | undefined {
  return activeUnits(state).find((u) => hexEq(u.pos, hex));
}

export function isObstacle(state: GameState, hex: Hex): boolean {
  return state.obstacles.some((o) => hexEq(o, hex));
}

// ─── Movement Blockers ────────────────────────────────────────────────────────

export function blockedFor(state: GameState, mover: Unit) {
  const occupied = new Set<string>();
  for (const u of activeUnits(state)) {
    if (u.id === mover.id) continue;
    occupied.add(hexKey(u.pos));
  }
  for (const o of state.obstacles) occupied.add(hexKey(o));
  return (h: Hex): boolean => occupied.has(hexKey(h));
}

// Jump: all figures are passable; only obstacles block intermediate hexes.
// (Final destination still must be empty — caller checks with `unitAt`.)
export function blockedForJump(state: GameState, _mover: Unit) {
  const occupied = new Set<string>();
  for (const o of state.obstacles) occupied.add(hexKey(o));
  return (h: Hex): boolean => occupied.has(hexKey(h));
}

export function reachableForJump(state: GameState, unitId: string, moveRange: number): Hex[] {
  const unit = state.units[unitId];
  if (!unit || unit.exhausted) return [];
  const blocked = blockedForJump(state, unit);
  const r = bfsReachable(unit.pos, moveRange, blocked, { width: state.width, height: state.height });
  // Final landing hex must not be occupied by another unit.
  const occupiedByUnit = new Set<string>(
    activeUnits(state).filter((u) => u.id !== unit.id).map((u) => hexKey(u.pos)),
  );
  return [...r.values()].map((n) => n.hex).filter((h) => !occupiedByUnit.has(hexKey(h)));
}

export function canJumpTo(state: GameState, unitId: string, dest: Hex, moveRange: number): boolean {
  const unit = state.units[unitId];
  if (!unit) return false;
  if (hexEq(unit.pos, dest)) return true;
  if (!inBounds(dest, { width: state.width, height: state.height })) return false;
  return reachableForJump(state, unitId, moveRange).some((h) => hexEq(h, dest));
}

// Trample: enemies are passable, only ally players + obstacles block.
export function blockedForTrample(state: GameState, mover: Unit) {
  const blocked = new Set<string>();
  for (const u of activeUnits(state)) {
    if (u.id === mover.id) continue;
    if (u.kind === 'player') blocked.add(hexKey(u.pos));
  }
  for (const o of state.obstacles) blocked.add(hexKey(o));
  return (h: Hex): boolean => blocked.has(hexKey(h));
}

// ─── Reachability ─────────────────────────────────────────────────────────────

export function reachableFor(state: GameState, unitId: string, moveRange: number): Hex[] {
  const unit = state.units[unitId];
  if (!unit || unit.exhausted) return [];
  const blocked = blockedFor(state, unit);
  const r = bfsReachable(unit.pos, moveRange, blocked, { width: state.width, height: state.height });
  return [...r.values()].map((n) => n.hex);
}

export function reachableForTrample(state: GameState, unitId: string, moveRange: number): Hex[] {
  const unit = state.units[unitId];
  if (!unit || unit.exhausted) return [];
  const blocked = blockedForTrample(state, unit);
  const r = bfsReachable(unit.pos, moveRange, blocked, { width: state.width, height: state.height });
  const enemyHexes = new Set(
    activeUnits(state).filter((u) => u.id !== unit.id && u.kind === 'enemy').map((u) => hexKey(u.pos)),
  );
  return [...r.values()].map((n) => n.hex).filter((h) => !enemyHexes.has(hexKey(h)));
}

export function canMoveTo(state: GameState, unitId: string, dest: Hex, moveRange: number): boolean {
  const unit = state.units[unitId];
  if (!unit) return false;
  if (hexEq(unit.pos, dest)) return true;
  if (!inBounds(dest, { width: state.width, height: state.height })) return false;
  return reachableFor(state, unitId, moveRange).some((h) => hexEq(h, dest));
}

export function canTrampleTo(state: GameState, unitId: string, dest: Hex, moveRange: number): boolean {
  const unit = state.units[unitId];
  if (!unit) return false;
  if (hexEq(unit.pos, dest)) return true;
  if (!inBounds(dest, { width: state.width, height: state.height })) return false;
  return reachableForTrample(state, unitId, moveRange).some((h) => hexEq(h, dest));
}

// ─── Range / Line-of-Sight ────────────────────────────────────────────────────

// Range check: walls are not yet modelled as line segments so this is a hex-distance check.
// When wall data is available, replace the body with a line-of-sight ray cast.
export function inLineRange(state: GameState, from: Hex, to: Hex, range: number): boolean {
  const dist = hexDistance(from, to);
  return dist >= 1 && dist <= range;
}

// ─── Modifier Deck Lookup ─────────────────────────────────────────────────────

function getModifierDeck(state: GameState, unitId: string): ModifierDeck {
  const unit = state.units[unitId];
  if (!unit) throw new Error(`unknown unit ${unitId}`);
  if (unit.kind === 'player') {
    if (!state.modifierDecks.players[unitId]) {
      // Lazy-init if not present (safety net — normally set up in spawnPlayer).
      state.modifierDecks.players[unitId] = buildModifierDeck();
    }
    return state.modifierDecks.players[unitId]!;
  }
  return state.modifierDecks.monster;
}

// ─── Move ─────────────────────────────────────────────────────────────────────

export function applyMove(state: GameState, unitId: string, dest: Hex): void {
  const unit = state.units[unitId];
  if (!unit) return;
  unit.pos = { q: dest.q, r: dest.r };
}

// ─── Forced Movement (Push / Pull) ───────────────────────────────────────────

// Move target away from actor up to maxDist hexes, one step at a time.
// Returns the path taken (including start). Immobilize/stun do not block forced movement.
export function applyPush(state: GameState, actorId: string, targetId: string, maxDist: number): Hex[] {
  const actor = state.units[actorId];
  const target = state.units[targetId];
  if (!actor || !target || maxDist <= 0) return target ? [target.pos] : [];

  const bounds = { width: state.width, height: state.height };
  const path: Hex[] = [target.pos];
  let cur = target.pos;

  for (let step = 0; step < maxDist; step++) {
    const curDist = hexDistance(cur, actor.pos);
    // Valid push hexes: must increase distance from actor, not blocked, in bounds.
    // Push is unaffected by difficult terrain but still blocked by walls/obstacles/figures.
    const candidates = neighbors(cur).filter(
      (n) =>
        inBounds(n, bounds) &&
        !isObstacle(state, n) &&
        !unitAt(state, n) &&
        hexDistance(n, actor.pos) > curDist,
    );
    if (candidates.length === 0) break;
    // Greedy: maximize distance (automatic path — character-directed push done via UI in future).
    candidates.sort((a, b) => hexDistance(b, actor.pos) - hexDistance(a, actor.pos));
    cur = candidates[0]!;
    path.push(cur);
  }

  target.pos = { ...path[path.length - 1]! };
  state.log.push(`${actor.archetype} pushes ${target.archetype}`);
  return path;
}

// Move target toward actor up to maxDist hexes.
export function applyPull(state: GameState, actorId: string, targetId: string, maxDist: number): Hex[] {
  const actor = state.units[actorId];
  const target = state.units[targetId];
  if (!actor || !target || maxDist <= 0) return target ? [target.pos] : [];

  const bounds = { width: state.width, height: state.height };
  const path: Hex[] = [target.pos];
  let cur = target.pos;

  for (let step = 0; step < maxDist; step++) {
    const curDist = hexDistance(cur, actor.pos);
    const candidates = neighbors(cur).filter(
      (n) =>
        inBounds(n, bounds) &&
        !isObstacle(state, n) &&
        !unitAt(state, n) &&
        hexDistance(n, actor.pos) < curDist,
    );
    if (candidates.length === 0) break;
    candidates.sort((a, b) => hexDistance(a, actor.pos) - hexDistance(b, actor.pos));
    cur = candidates[0]!;
    path.push(cur);
  }

  target.pos = { ...path[path.length - 1]! };
  state.log.push(`${actor.archetype} pulls ${target.archetype}`);
  return path;
}

// ─── Suffer Damage ────────────────────────────────────────────────────────────

// Damage not from an attack — only Ward reduces it. Not a targeted ability.
export function applySufferDamage(state: GameState, targetId: string, amount: number): void {
  const target = state.units[targetId];
  if (!target || target.exhausted) return;
  // Persistent negate-damage absorbs an entire source of suffer damage.
  if (consumeNegate(state, targetId)) return;
  let damage = amount;
  if (hasCondition(target, 'ward')) {
    removeCondition(target, 'ward');
    damage = Math.floor(damage / 2);
  }
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp === 0) target.exhausted = true;
}

// ─── Attack ───────────────────────────────────────────────────────────────────

export function applyAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  baseDamage: number,
  options?: AttackOptions,
): AttackOutcome | null {
  const attacker = state.units[attackerId];
  const target = state.units[targetId];
  if (!attacker || !target || target.exhausted) return null;

  // Disarmed attackers cannot perform attack abilities.
  if (hasCondition(attacker, 'disarm')) return null;

  // Invisible targets cannot be targeted.
  if (hasCondition(target, 'invisible')) return null;

  // Poison adds +1 attack against the target (step 1: attack bonuses/penalties).
  let effectiveBase = baseDamage;
  if (hasCondition(target, 'poison')) effectiveBase += 1;

  let finalDamage: number;
  let addedEffects: string[] = [];

  if (options?.skipModifiers) {
    finalDamage = effectiveBase;
  } else {
    // Determine advantage / disadvantage.
    const strengthened = hasCondition(attacker, 'strengthen');
    const muddled = hasCondition(attacker, 'muddle');
    const dist = hexDistance(attacker.pos, target.pos);
    const rangedVsAdjacent = (options?.isRanged ?? false) && dist === 1;

    const hasAdv = (options?.advantage || strengthened) && !options?.disadvantage && !muddled && !rangedVsAdjacent;
    const hasDisadv = (options?.disadvantage || muddled || rangedVsAdjacent) && !hasAdv;

    const deck = getModifierDeck(state, attackerId);
    const result = hasAdv
      ? drawAdvantage(deck, effectiveBase)
      : hasDisadv
        ? drawDisadvantage(deck, effectiveBase)
        : drawNormal(deck, effectiveBase);

    finalDamage = result.finalDamage;
    addedEffects = result.addedEffects;

    // Return bless/curse cards to global supply.
    // (Caller can track supply via state; no-op here since returnToSupply cards
    //  are already excluded from deck discard in the draw functions.)
  }

  // Step 3: Apply shield (after modifier, reduced by pierce).
  const pierce = options?.pierce ?? 0;
  const effectiveShield = Math.max(0, target.shieldBonus - pierce);
  finalDamage = Math.max(0, finalDamage - effectiveShield);

  // Step 4: Apply ward.
  if (hasCondition(target, 'ward')) {
    removeCondition(target, 'ward');
    finalDamage = Math.floor(finalDamage / 2);
  }

  // Step 5: Persistent negate-damage absorbs the entire damage source.
  if (finalDamage > 0 && consumeNegate(state, targetId)) {
    finalDamage = 0;
  }

  // Apply damage.
  target.hp = Math.max(0, target.hp - finalDamage);
  const killed = target.hp === 0;

  if (killed) {
    target.exhausted = true;
    state.log.push(`${attacker.archetype} defeats ${target.archetype}`);
  } else {
    // Apply conditions (even on 0 damage, but not if killed/exhausted).
    if (options?.appliedConditions) {
      for (const cond of options.appliedConditions) {
        gainCondition(target, cond);
      }
    }
    // Apply added effects from modifier cards (e.g. conditions from bless/perk cards).
    void addedEffects;
    state.log.push(`${attacker.archetype} hits ${target.archetype} for ${finalDamage}`);
  }

  // Retaliate: triggers after the attack resolves (including push/pull added effects).
  // Not an attack — not reduced by shield. Deals suffer damage to the attacker.
  if (!killed && target.retaliateBonus > 0) {
    const retRange = target.retaliateRange > 0 ? target.retaliateRange : 1;
    if (hexDistance(target.pos, attacker.pos) <= retRange) {
      applySufferDamage(state, attackerId, target.retaliateBonus);
      state.log.push(`${target.archetype} retaliates for ${target.retaliateBonus}`);
    }
  }

  return { killed, remainingHp: target.hp };
}

// ─── AoE Attack ──────────────────────────────────────────────────────────────

// Resolve an attack against the primary target hex plus every unit in the AoE
// pattern around it. Each hit is an independent attack (own modifier draw), and
// the same applied conditions are inflicted on every hit target. Returns the
// outcomes for hexes that contained an enemy unit (in pattern order, primary first).
export function applyAoeAttack(
  state: GameState,
  attackerId: string,
  primaryTargetHex: Hex,
  baseDamage: number,
  pattern: import('../types.js').AoePattern,
  options?: AttackOptions,
): AttackOutcome[] {
  const outcomes: AttackOutcome[] = [];
  const hit = new Set<string>();

  const tryHex = (hex: Hex) => {
    const unit = unitAt(state, hex);
    if (!unit || unit.id === attackerId || hit.has(unit.id)) return;
    hit.add(unit.id);
    const outcome = applyAttack(state, attackerId, unit.id, baseDamage, options);
    if (outcome) outcomes.push(outcome);
  };

  // Primary target hex resolves first.
  tryHex(primaryTargetHex);

  // Each AoE offset is added to the primary target hex. Skip {0,0} since it
  // duplicates the primary; the `hit` set guards against this anyway.
  for (const off of pattern.hexes) {
    if (off.q === 0 && off.r === 0) continue;
    tryHex({ q: primaryTargetHex.q + off.q, r: primaryTargetHex.r + off.r });
  }

  return outcomes;
}

// ─── Trample ─────────────────────────────────────────────────────────────────

export function applyTrample(
  state: GameState,
  actorId: string,
  path: Hex[],
  damage: number,
): AttackOutcome[] {
  const actor = state.units[actorId];
  if (!actor) return [];
  const outcomes: AttackOutcome[] = [];
  const hit = new Set<string>();
  for (const hex of path.slice(1)) {
    const target = activeUnits(state).find((u) => u.kind === 'enemy' && hexEq(u.pos, hex));
    if (target && !hit.has(target.id)) {
      hit.add(target.id);
      const outcome = applyAttack(state, actorId, target.id, damage, { skipModifiers: true });
      if (outcome) outcomes.push(outcome);
    }
  }
  return outcomes;
}

// ─── Heal ─────────────────────────────────────────────────────────────────────

export function applyHeal(
  state: GameState,
  casterId: string,
  targetId: string,
  amount: number,
): void {
  const caster = state.units[casterId];
  const target = state.units[targetId];
  if (!caster || !target || target.exhausted) return;

  // Remove wound and poison. If poison was present, HP increase is blocked.
  const { blockHpIncrease } = applyHealConditions(target);

  const before = target.hp;
  if (!blockHpIncrease) {
    target.hp = Math.min(target.maxHp, target.hp + amount);
  }

  const healed = target.hp - before;
  if (healed > 0) {
    state.log.push(`${caster.archetype} heals ${target.archetype} for ${healed}`);
  } else {
    state.log.push(`${caster.archetype} heals ${target.archetype} (conditions removed)`);
  }
}

// ─── Active Bonuses ───────────────────────────────────────────────────────────

// Grant a shield bonus to a unit for the current round.
export function applyShieldBonus(state: GameState, unitId: string, value: number): void {
  const unit = state.units[unitId];
  if (!unit) return;
  unit.shieldBonus += value; // Multiple shield bonuses stack as a single reduction.
  // Reactive: first shield/retaliate gain per round can stack +1 of each.
  const bonus = triggerReactiveShieldRetaliate(state, unitId);
  if (bonus.shield > 0) unit.shieldBonus += bonus.shield;
  if (bonus.retaliate > 0) {
    unit.retaliateBonus += bonus.retaliate;
    if (unit.retaliateRange < 0) unit.retaliateRange = 0;
  }
}

// Grant a retaliate bonus to a unit. Range 0 = melee (adjacent) only.
export function applyRetaliateBonus(state: GameState, unitId: string, value: number, range = 0): void {
  const unit = state.units[unitId];
  if (!unit) return;
  // Multiple retaliate bonuses stack as a single damage source.
  unit.retaliateBonus += value;
  if (range > unit.retaliateRange) unit.retaliateRange = range;
  const bonus = triggerReactiveShieldRetaliate(state, unitId);
  if (bonus.shield > 0) unit.shieldBonus += bonus.shield;
  if (bonus.retaliate > 0) unit.retaliateBonus += bonus.retaliate;
}

// Clear all round-based active bonuses (shield, retaliate, next-attack). Called at end of round.
export function clearRoundBonuses(state: GameState): void {
  for (const unit of Object.values(state.units)) {
    unit.shieldBonus = 0;
    unit.retaliateBonus = 0;
    unit.retaliateRange = 0;
    unit.nextAttackBonus = 0;
  }
}

// ─── Victory Check ────────────────────────────────────────────────────────────

export function checkVictory(state: GameState): 'victory' | 'defeat' | null {
  const enemies = Object.values(state.units).filter((u) => u.kind === 'enemy');
  const players = Object.values(state.units).filter((u) => u.kind === 'player');
  if (enemies.every((e) => e.exhausted)) return 'victory';
  if (players.every((p) => p.exhausted)) return 'defeat';
  return null;
}
