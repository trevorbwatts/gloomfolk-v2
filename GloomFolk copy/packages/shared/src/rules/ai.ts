import type { GameState, Hex, Unit } from '../types.js';
import { ENEMIES } from '../content/enemies.js';
import { hexDistance, hexEq, hexKey, bfsReachable } from './hex.js';
import { applyAttack, applyMove, blockedFor } from './combat.js';
import { hasCondition } from './conditions.js';

function nearestPlayer(state: GameState, from: Hex): Unit | null {
  const players = Object.values(state.units).filter((u) => u.kind === 'player' && !u.exhausted);
  if (players.length === 0) return null;
  let best = players[0]!;
  let bestDist = hexDistance(from, best.pos);
  for (const p of players.slice(1)) {
    const d = hexDistance(from, p.pos);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

// Pick the reachable hex (within move range) that is in attack range of target if possible,
// otherwise the reachable hex that minimizes distance to target.
function pickDestination(
  state: GameState,
  enemy: Unit,
  target: Unit,
  moveRange: number,
  attackRange: number,
): Hex {
  const blocked = blockedFor(state, enemy);
  const reach = bfsReachable(enemy.pos, moveRange, blocked, {
    width: state.width,
    height: state.height,
  });
  const options = [...reach.values()].map((n) => n.hex);
  // Prefer hexes already in attack range; among those, closest to target.
  const inAttack = options.filter(
    (h) => hexDistance(h, target.pos) >= 1 && hexDistance(h, target.pos) <= attackRange,
  );
  const pool = inAttack.length > 0 ? inAttack : options;
  let best = pool[0]!;
  let bestScore = hexDistance(best, target.pos);
  for (const h of pool.slice(1)) {
    const d = hexDistance(h, target.pos);
    if (d < bestScore) {
      best = h;
      bestScore = d;
    }
  }
  return best;
}

export function applyEnemyTurn(state: GameState, enemyId: string): void {
  const enemy = state.units[enemyId];
  if (!enemy || enemy.exhausted || enemy.kind !== 'enemy') return;

  // Stun: cannot perform any abilities. Cards are discarded with no effect.
  if (hasCondition(enemy, 'stun')) return;

  const def = ENEMIES[enemy.archetype];
  if (!def) return;
  const target = nearestPlayer(state, enemy.pos);
  if (!target) return;

  // Immobilize: cannot move.
  const canMove = !hasCondition(enemy, 'immobilize');

  const dist = hexDistance(enemy.pos, target.pos);
  const inRange = dist >= 1 && dist <= def.attackRange;

  if (inRange) {
    // Already in range — attack without moving.
    applyAttack(state, enemy.id, target.id, def.attackDamage, {
      isRanged: def.attackRange > 1,
    });
    return;
  }

  if (canMove) {
    const dest = pickDestination(state, enemy, target, def.move, def.attackRange);
    if (!hexEq(dest, enemy.pos)) {
      applyMove(state, enemy.id, dest);
      state.log.push(`${enemy.archetype} moves`);
    }
  }

  const newDist = hexDistance(enemy.pos, target.pos);
  if (newDist >= 1 && newDist <= def.attackRange) {
    applyAttack(state, enemy.id, target.id, def.attackDamage, {
      isRanged: def.attackRange > 1,
    });
  }
}

// Choose target for player attack/heal: must be in range, must be valid kind.
export function isValidAttackTarget(state: GameState, attackerId: string, targetId: string, range: number): boolean {
  const attacker = state.units[attackerId];
  const target = state.units[targetId];
  if (!attacker || !target || target.exhausted) return false;
  if (target.kind === attacker.kind) return false;
  const d = hexDistance(attacker.pos, target.pos);
  return d >= 1 && d <= range;
}

export function isValidHealTarget(state: GameState, casterId: string, targetId: string, range: number): boolean {
  const caster = state.units[casterId];
  const target = state.units[targetId];
  if (!caster || !target || target.exhausted) return false;
  if (target.kind !== caster.kind) return false;
  const d = hexDistance(caster.pos, target.pos);
  return d <= range;
}

// Use hexKey to keep import retained for ai planning extensions.
void hexKey;
