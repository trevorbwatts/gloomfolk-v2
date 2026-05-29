import type {
  BattleGoal,
  BattleGoalEvaluationContext,
  BattleGoalTracker,
} from './types.js';

/** Accountant: "Have zero cards in your hand each time you rest."
 *  Tracker flips to violated the first time a rest happens with cards in hand.
 *  If the character never rests, the condition is vacuously satisfied. */
const accountantTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.handSizeAtRest > 0
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Acrobat: "Lose a card to negate 5 damage or more."
 *  Either card-loss method qualifies (1 from hand or 2 from discard); active-
 *  ability negation does NOT count — the card text specifies losing cards. */
const acrobatTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'damage_negated' &&
      event.characterId === ctx.ownerCharacterId &&
      event.amount >= 5 &&
      event.method.via !== 'ability'
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Ascetic: "Collect fewer loot tokens than any other player."
 *  Comparative goal — read from the evaluation context. Must be STRICTLY
 *  the lowest loot count (ties don't qualify). Solo play is vacuously
 *  achieved (no other players to compare against). */
const asceticTracker: BattleGoalTracker<Record<string, never>> = {
  init: () => ({}),
  reduce: (state) => state,
  isAchieved: (_state, ctx) => {
    const mine = ctx.lootByCharacter[ctx.characterId] ?? 0;
    const others = ctx.allCharacterIds.filter((id) => id !== ctx.characterId);
    if (others.length === 0) return true;
    return others.every((id) => (ctx.lootByCharacter[id] ?? 0) > mine);
  },
};

/** Assistant: "Kill an enemy attacked by any of your allies earlier in the
 *  round." Per round, accumulate the set of enemies an ALLY (any character
 *  other than the owner) has attacked. When the owner lands a killing blow on
 *  an enemy already in that set, the goal is met. The set resets each round,
 *  so the ally's attack must come before the kill within the same round. The
 *  owner's own attacks don't populate the set; any owner-credited kill counts. */
const assistantTracker: BattleGoalTracker<{
  readonly attackedByAlly: ReadonlySet<string>;
  readonly hit: boolean;
}> = {
  init: () => ({ attackedByAlly: new Set<string>(), hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    switch (event.kind) {
      case 'round_start':
        return { ...state, attackedByAlly: new Set<string>() };
      case 'attack':
        if (event.attackerCharacterId !== ctx.ownerCharacterId) {
          const next = new Set(state.attackedByAlly);
          next.add(event.targetUnitId);
          return { ...state, attackedByAlly: next };
        }
        return state;
      case 'enemy_killed':
        if (
          event.killerCharacterId === ctx.ownerCharacterId &&
          state.attackedByAlly.has(event.targetUnitId)
        ) {
          return { ...state, hit: true };
        }
        return state;
      default:
        return state;
    }
  },
  isAchieved: (state) => state.hit,
};

/** Bastion: "Occupy a door hex adjacent to two or more enemies at the end of
 *  a round." Satisfied if, at any round end, the owner's own figure stands on
 *  a door hex with at least two enemies adjacent. An exhausted character emits
 *  no snapshot, so it can only be met while on the board. */
const bastionTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'round_end_position' &&
      event.characterId === ctx.ownerCharacterId &&
      event.onDoorHex &&
      event.adjacentEnemyCount >= 2
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Bully: "Kill an enemy that has two or more negative conditions."
 *  Met when the owner lands a killing blow on an enemy carrying at least two
 *  negative conditions at the moment of death. */
const bullyTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.targetNegativeConditions.length >= 2
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Cleaner: "Collect three or more loot tokens in the same turn."
 *  Accumulates loot collected by the owner within a single turn; the counter
 *  resets at every turn boundary so it only ever reflects the current turn. */
const cleanerTracker: BattleGoalTracker<{
  readonly thisTurn: number;
  readonly hit: boolean;
}> = {
  init: () => ({ thisTurn: 0, hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'turn_start') {
      return { ...state, thisTurn: 0 };
    }
    if (
      event.kind === 'loot_collected' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      const thisTurn = state.thisTurn + event.tokenIds.length;
      return { thisTurn, hit: thisTurn >= 3 };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Closer: "Kill the last enemy to die in the Scenario."
 *  Can't be latched mid-scenario — a later death would supersede an earlier
 *  one. So the tracker just remembers who got the most recent kill, and the
 *  final check asks whether that was the owner. If no enemy ever dies, the
 *  goal is unachievable. */
const closerTracker: BattleGoalTracker<{
  readonly lastKiller: string | null;
  readonly anyDeath: boolean;
}> = {
  init: () => ({ lastKiller: null, anyDeath: false }),
  reduce: (state, event) => {
    if (event.kind === 'enemy_killed') {
      return { lastKiller: event.killerCharacterId, anyDeath: true };
    }
    return state;
  },
  isAchieved: (state, ctx) =>
    state.anyDeath && state.lastKiller === ctx.characterId,
};

/** Conservator: "Never perform an action with a lost icon."
 *  Violated the first time the owner performs a card ability bearing the lost
 *  icon. Vacuously satisfied if they never do. */
const conservatorTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'ability_performed' &&
      event.characterId === ctx.ownerCharacterId &&
      event.lost
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Diehard: "Never let your hit point value drop below half your maximum hit
 *  point value (rounded up)." The floor is ceil(maxHp / 2); violated the first
 *  time current HP dips below it. */
const diehardTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'hp_changed' &&
      event.characterId === ctx.ownerCharacterId &&
      event.currentHp < Math.ceil(event.maxHp / 2)
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Dynamo: "Kill an enemy with an attack that would have caused at least 4
 *  more damage than necessary." Requires the owner to land a killing attack
 *  whose damage overshot the target's remaining HP by 4 or more. */
const dynamoTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.byAttack &&
      event.overkill >= 4
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Egoist: "Collect more loot tokens than any other character."
 *  Comparative — must be STRICTLY the highest loot count (ties don't qualify).
 *  Solo play is vacuously achieved. */
const egoistTracker: BattleGoalTracker<Record<string, never>> = {
  init: () => ({}),
  reduce: (state) => state,
  isAchieved: (_state, ctx) => {
    const mine = ctx.lootByCharacter[ctx.characterId] ?? 0;
    const others = ctx.allCharacterIds.filter((id) => id !== ctx.characterId);
    if (others.length === 0) return true;
    return others.every((id) => (ctx.lootByCharacter[id] ?? 0) < mine);
  },
};

/** Executioner: "Kill an undamaged enemy with a single attack action."
 *  Met when the owner's attack drops an enemy from full HP straight to dead. */
const executionerTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.byAttack &&
      event.targetWasUndamaged
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Gambler: "Kill an enemy with an attack that has disadvantage."
 *  Met when the owner lands a killing attack rolled with disadvantage. */
const gamblerTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.byAttack &&
      event.attackAdvantage === 'disadvantage'
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Hunter: "Kill one or more elite enemies, or two or more for four players."
 *  Counts elite enemies the owner kills; the required total is 2 when there
 *  are four characters, otherwise 1. */
const hunterTracker: BattleGoalTracker<{ readonly eliteKills: number }> = {
  init: () => ({ eliteKills: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.targetRank === 'elite'
    ) {
      return { eliteKills: state.eliteKills + 1 };
    }
    return state;
  },
  isAchieved: (state, ctx) => {
    const required = ctx.allCharacterIds.length >= 4 ? 2 : 1;
    return state.eliteKills >= required;
  },
};

/** Insomniac: "Suffer damage for an attack in the same round you long rest."
 *  Tracks, per round, whether the owner long rested and whether they suffered
 *  attack damage. Met once both happen in the same round. Flags reset each
 *  round; order within the round doesn't matter. */
const insomniacTracker: BattleGoalTracker<{
  readonly longRested: boolean;
  readonly sufferedAttackDamage: boolean;
  readonly hit: boolean;
}> = {
  init: () => ({ longRested: false, sufferedAttackDamage: false, hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'round_start') {
      return { longRested: false, sufferedAttackDamage: false, hit: false };
    }
    let { longRested, sufferedAttackDamage } = state;
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.restKind === 'long'
    ) {
      longRested = true;
    }
    if (
      event.kind === 'damage_suffered' &&
      event.characterId === ctx.ownerCharacterId &&
      event.fromAttack &&
      event.amount > 0
    ) {
      sufferedAttackDamage = true;
    }
    return {
      longRested,
      sufferedAttackDamage,
      hit: longRested && sufferedAttackDamage,
    };
  },
  isAchieved: (state) => state.hit,
};

/** Masochist: "End the scenario with a hit point value of 3 or less."
 *  Tracks the owner's most recent HP value; achieved if it ends at 3 or less
 *  while still alive. An exhausted character (HP 0 or card-exhausted) is
 *  removed from play and does not qualify. If the owner never took damage,
 *  `lastHp` stays null (still at full HP, which is always > 3). */
const masochistTracker: BattleGoalTracker<{
  readonly lastHp: number | null;
  readonly exhausted: boolean;
}> = {
  init: () => ({ lastHp: null, exhausted: false }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'hp_changed' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { ...state, lastHp: event.currentHp };
    }
    if (
      event.kind === 'character_exhausted' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { ...state, exhausted: true };
    }
    return state;
  },
  isAchieved: (state) =>
    !state.exhausted && state.lastHp !== null && state.lastHp <= 3,
};

/** Mugger: "Kill an enemy and loot the loot token it drops in the same round."
 *  Per round, remembers the loot tokens dropped by enemies the owner killed;
 *  met when the owner then loots one of those tokens that same round. The set
 *  resets each round, so a token looted in a later round won't count. (A kill
 *  always precedes its token's loot, so ordering is naturally satisfied.) */
const muggerTracker: BattleGoalTracker<{
  readonly droppedThisRound: ReadonlySet<string>;
  readonly hit: boolean;
}> = {
  init: () => ({ droppedThisRound: new Set<string>(), hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'round_start') {
      return { ...state, droppedThisRound: new Set<string>() };
    }
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.droppedLootTokenId !== null
    ) {
      const next = new Set(state.droppedThisRound);
      next.add(event.droppedLootTokenId);
      return { ...state, droppedThisRound: next };
    }
    if (
      event.kind === 'loot_collected' &&
      event.characterId === ctx.ownerCharacterId &&
      event.tokenIds.some((id) => state.droppedThisRound.has(id))
    ) {
      return { ...state, hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Opener: "Kill the first enemy to die in the scenario."
 *  Latches on the very first enemy death — that killer is locked in. Achieved
 *  if it was the owner. */
const openerTracker: BattleGoalTracker<{
  readonly recorded: boolean;
  readonly firstKiller: string | null;
}> = {
  init: () => ({ recorded: false, firstKiller: null }),
  reduce: (state, event) => {
    if (state.recorded) return state;
    if (event.kind === 'enemy_killed') {
      return { recorded: true, firstKiller: event.killerCharacterId };
    }
    return state;
  },
  isAchieved: (state, ctx) =>
    state.recorded && state.firstKiller === ctx.characterId,
};

/** Optimist: "Remove a negative condition from yourself or an ally two or more
 *  times." Counts negative conditions the owner removes from a player-side
 *  figure (self or ally). Automatic end-of-turn expiry doesn't count — only
 *  removals the owner causes. Each condition removed counts once. */
const optimistTracker: BattleGoalTracker<{ readonly count: number }> = {
  init: () => ({ count: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'condition_removed' &&
      event.byCharacterId === ctx.ownerCharacterId &&
      event.targetFriendly
    ) {
      return { count: state.count + 1 };
    }
    return state;
  },
  isAchieved: (state) => state.count >= 2,
};

/** Pacifist: "Kill three or fewer enemies." Counts the owner's kills over the
 *  whole scenario; achieved if the total is 3 or fewer (including none). */
const pacifistTracker: BattleGoalTracker<{ readonly kills: number }> = {
  init: () => ({ kills: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      return { kills: state.kills + 1 };
    }
    return state;
  },
  isAchieved: (state) => state.kills <= 3,
};

/** Pauper: "Never collect a loot token from end-of-turn looting."
 *  Violated the first time the owner picks up a token via the mandatory
 *  end-of-turn auto-loot. Looting via a Loot ability is fine. Vacuously
 *  satisfied if it never happens. */
const pauperTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'loot_collected' &&
      event.characterId === ctx.ownerCharacterId &&
      event.source === 'end-of-turn' &&
      event.tokenIds.length > 0
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Pedestrian: "Never enter a hex occupied by an ally, enemy, objective, or
 *  obstacle." Violated the first time the owner moves into or through any
 *  occupied hex (e.g. passing through an ally, or jumping over an enemy or
 *  obstacle). Vacuously satisfied if they always path around. */
const pedestrianTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'entered_occupied_hex' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Pickpocket: "Collect two or more loot tokens by performing a loot ability
 *  while adjacent to one or more enemies." Accumulates tokens collected via a
 *  Loot ability while the owner stood adjacent to at least one enemy; met at
 *  two or more (a single multi-token loot or several across the scenario). */
const pickpocketTracker: BattleGoalTracker<{ readonly count: number }> = {
  init: () => ({ count: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'loot_collected' &&
      event.characterId === ctx.ownerCharacterId &&
      event.source === 'ability' &&
      event.adjacentToEnemy
    ) {
      return { count: state.count + event.tokenIds.length };
    }
    return state;
  },
  isAchieved: (state) => state.count >= 2,
};

/** Pincushion: "Be targeted by attacks from three or more enemies in the same
 *  round." Per round, collects the distinct enemies that targeted the owner
 *  with an attack (hit or not); met at three or more. Resets each round. */
const pincushionTracker: BattleGoalTracker<{
  readonly attackersThisRound: ReadonlySet<string>;
  readonly hit: boolean;
}> = {
  init: () => ({ attackersThisRound: new Set<string>(), hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'round_start') {
      return { ...state, attackersThisRound: new Set<string>() };
    }
    if (
      event.kind === 'targeted_by_enemy_attack' &&
      event.targetCharacterId === ctx.ownerCharacterId
    ) {
      const next = new Set(state.attackersThisRound);
      next.add(event.enemyUnitId);
      return { attackersThisRound: next, hit: next.size >= 3 };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Plebeian: "Never kill an elite enemy, named enemy, or boss."
 *  Violated the first time the owner kills any enemy whose rank isn't normal.
 *  Vacuously satisfied if they only ever kill normal enemies (or none). */
const plebeianTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.targetRank !== 'normal'
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Prohibitionist: "Never use a potion."
 *  Violated the first time the owner uses a potion item. */
const prohibitionistTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'item_used' &&
      event.characterId === ctx.ownerCharacterId &&
      event.isPotion
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Promoter: "Perform an ability targeting an ally before your first rest and
 *  in between each of your rests." Each rest is a checkpoint: since the last
 *  rest (or scenario start), the owner must have performed an ally-targeting
 *  ability. Resting without having done so violates the goal. The final
 *  segment after the last rest isn't checked, and never resting is vacuously
 *  satisfied. */
const promoterTracker: BattleGoalTracker<{
  readonly targetedSinceRest: boolean;
  readonly violated: boolean;
}> = {
  init: () => ({ targetedSinceRest: false, violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'ability_performed' &&
      event.characterId === ctx.ownerCharacterId &&
      event.targetedAlly
    ) {
      return { ...state, targetedSinceRest: true };
    }
    if (event.kind === 'rest' && event.characterId === ctx.ownerCharacterId) {
      if (!state.targetedSinceRest) {
        return { targetedSinceRest: false, violated: true };
      }
      return { targetedSinceRest: false, violated: false };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Ravager: "Perform two actions with Lost in the same turn." Counts lost-icon
 *  abilities the owner performs within a single turn; met at two. Resets each
 *  turn. */
const ravagerTracker: BattleGoalTracker<{
  readonly lostThisTurn: number;
  readonly hit: boolean;
}> = {
  init: () => ({ lostThisTurn: 0, hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'turn_start') {
      return { ...state, lostThisTurn: 0 };
    }
    if (
      event.kind === 'ability_performed' &&
      event.characterId === ctx.ownerCharacterId &&
      event.lost
    ) {
      const lostThisTurn = state.lostThisTurn + 1;
      return { lostThisTurn, hit: lostThisTurn >= 2 };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Recluse: "Never end your turn adjacent to any other character." Violated
 *  the first time the owner ends a turn with another player character
 *  adjacent. Solo play is vacuously satisfied. Worth 2 checkmarks with four
 *  characters, otherwise 1. */
const recluseTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'turn_end_position' &&
      event.characterId === ctx.ownerCharacterId &&
      event.adjacentCharacterCount > 0
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Ritualist: "Kill an enemy while three or more elements are strong or
 *  waning." Met when the owner lands a kill while at least three elements are
 *  in the strong or waning state. */
const ritualistTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      event.elementsStrongOrWaning >= 3
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Sadist: "Kill five or more enemies." Counts the owner's kills over the
 *  whole scenario. (Number assumed — see note; easily adjusted.) */
const sadistTracker: BattleGoalTracker<{ readonly kills: number }> = {
  init: () => ({ kills: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      return { kills: state.kills + 1 };
    }
    return state;
  },
  isAchieved: (state) => state.kills >= 5,
};

/** Scrambler: "Never long rest." Violated the first time the owner performs a
 *  long rest. Short rests are fine. */
const scramblerTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.restKind === 'long'
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Shirker: "Kill an enemy not adjacent to you while you are adjacent to
 *  another enemy." Met when the owner kills an enemy that was NOT adjacent to
 *  them (a ranged kill) while a different enemy WAS adjacent. */
const shirkerTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      !event.targetAdjacentToKiller &&
      event.killerAdjacentToOtherEnemy
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Sleeper: "Have one or more cards in your hand each time you rest." The
 *  mirror of Accountant — violated the first time the owner rests with an
 *  empty hand. Vacuously satisfied if they never rest. */
const sleeperTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.handSizeAtRest < 1
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Sluggard: "Perform a long rest while at your maximum hit point value, after
 *  you have already suffered damage." Requires having taken damage at some
 *  earlier point, healed back to full, and then long resting while at max HP. */
const sluggardTracker: BattleGoalTracker<{
  readonly sufferedDamage: boolean;
  readonly lastHp: number | null;
  readonly lastMaxHp: number | null;
  readonly hit: boolean;
}> = {
  init: () => ({
    sufferedDamage: false,
    lastHp: null,
    lastMaxHp: null,
    hit: false,
  }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'damage_suffered' &&
      event.characterId === ctx.ownerCharacterId &&
      event.amount > 0
    ) {
      return { ...state, sufferedDamage: true };
    }
    if (
      event.kind === 'hp_changed' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { ...state, lastHp: event.currentHp, lastMaxHp: event.maxHp };
    }
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.restKind === 'long' &&
      state.sufferedDamage &&
      state.lastHp !== null &&
      state.lastHp === state.lastMaxHp
    ) {
      return { ...state, hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Straggler: "Never short rest." Mirror of Scrambler — violated the first
 *  time the owner performs a short rest. Long rests are fine. */
const stragglerTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'rest' &&
      event.characterId === ctx.ownerCharacterId &&
      event.restKind === 'short'
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Streamliner: "Have five or more total cards in your hand and discard pile
 *  at the end of the scenario." Reads the owner's end-of-scenario pile sizes. */
const streamlinerTracker: BattleGoalTracker<{
  readonly total: number;
  readonly received: boolean;
}> = {
  init: () => ({ total: 0, received: false }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'scenario_end_piles' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { total: event.handCount + event.discardCount, received: true };
    }
    return state;
  },
  isAchieved: (state) => state.received && state.total >= 5,
};

/** Tormentor: "Apply a different negative condition to an enemy that already
 *  has one or more negative conditions." Met when the owner applies a negative
 *  condition to an enemy that already carried at least one negative condition,
 *  and the applied condition is a new one (not one it already had). */
const tormentorTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'condition_applied' &&
      event.byCharacterId === ctx.ownerCharacterId &&
      event.targetIsEnemy &&
      event.targetPriorNegativeConditions.length >= 1 &&
      !(event.targetPriorNegativeConditions as readonly string[]).includes(
        event.condition,
      )
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Wastrel: "Lose a card to negate 2 or less damage from an attack." Met when
 *  the owner loses a card (from hand or discard — not an active ability) to
 *  negate an attack that would have dealt 2 or less damage. The low-stakes
 *  mirror of Acrobat. */
const wastrelTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'damage_negated' &&
      event.characterId === ctx.ownerCharacterId &&
      event.fromAttack &&
      event.method.via !== 'ability' &&
      event.amount > 0 &&
      event.amount <= 2
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Weakling: "Become exhausted before any other character." Latches on the
 *  first character to become exhausted; achieved if it was the owner. */
const weaklingTracker: BattleGoalTracker<{
  readonly recorded: boolean;
  readonly firstExhausted: string | null;
}> = {
  init: () => ({ recorded: false, firstExhausted: null }),
  reduce: (state, event) => {
    if (state.recorded) return state;
    if (event.kind === 'character_exhausted') {
      return { recorded: true, firstExhausted: event.characterId };
    }
    return state;
  },
  isAchieved: (state, ctx) =>
    state.recorded && state.firstExhausted === ctx.characterId,
};

/** Workhorse: "Gain 13 or more experience before any bonus scenario
 *  experience." Sums experience the owner earns during play (excluding the
 *  end-of-scenario bonus); met at 13 or more. */
const workhorseTracker: BattleGoalTracker<{ readonly xp: number }> = {
  init: () => ({ xp: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'experience_gained' &&
      event.characterId === ctx.ownerCharacterId &&
      !event.bonus
    ) {
      return { xp: state.xp + event.amount };
    }
    return state;
  },
  isAchieved: (state) => state.xp >= 13,
};

/** Zealot: "Have three or fewer total cards in your hand and discard pile
 *  while also not exhausted at the end of the scenario." The low-card mirror
 *  of Streamliner, with the catch that you must survive — an exhausted
 *  character (including card-exhaustion, which empties these piles) fails. */
const zealotTracker: BattleGoalTracker<{
  readonly total: number;
  readonly received: boolean;
  readonly exhausted: boolean;
}> = {
  init: () => ({ total: 0, received: false, exhausted: false }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'scenario_end_piles' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return {
        ...state,
        total: event.handCount + event.discardCount,
        received: true,
      };
    }
    if (
      event.kind === 'character_exhausted' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { ...state, exhausted: true };
    }
    return state;
  },
  isAchieved: (state) =>
    state.received && !state.exhausted && state.total <= 3,
};

/** Dawdler: "Never use your lowest initiative played cards as your initiative."
 *  Each round you play two cards and pick one for turn order; this forbids
 *  ever using the lower (slower) one. Violated the first time you do. Long-rest
 *  rounds play no cards and don't count. Vacuously satisfied otherwise. */
const dawdlerTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'initiative_chosen' &&
      event.characterId === ctx.ownerCharacterId &&
      event.usedLowestOfPlayed
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Daredevil: "Add two cards to your lost pile before your first rest." Tallies
 *  cards entering the owner's lost pile until their first rest, then freezes;
 *  met if at least two were lost before resting. If they never rest, the whole
 *  scenario counts. */
const daredevilTracker: BattleGoalTracker<{
  readonly lostBeforeRest: number;
  readonly frozen: boolean;
}> = {
  init: () => ({ lostBeforeRest: 0, frozen: false }),
  reduce: (state, event, ctx) => {
    if (state.frozen) return state;
    if (event.kind === 'rest' && event.characterId === ctx.ownerCharacterId) {
      return { ...state, frozen: true };
    }
    if (
      event.kind === 'card_lost' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { ...state, lostBeforeRest: state.lostBeforeRest + event.count };
    }
    return state;
  },
  isAchieved: (state) => state.lostBeforeRest >= 2,
};

/** Assassin: "Kill an enemy before it takes its first turn." Met when the
 *  owner kills an enemy that had not yet taken a turn this scenario. */
const assassinTracker: BattleGoalTracker<{ readonly hit: boolean }> = {
  init: () => ({ hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId &&
      !event.targetHadTakenTurn
    ) {
      return { hit: true };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Duelist: "Never exit a hex adjacent to an enemy except through forced
 *  movement." Violated the first time the owner leaves an enemy-adjacent hex
 *  under their own movement. Forced movement (push/pull) is exempt. Read
 *  literally: once adjacent to an enemy, any voluntary move out violates. */
const duelistTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'exited_enemy_adjacent_hex' &&
      event.characterId === ctx.ownerCharacterId &&
      !event.forced
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Exterminator: "Kill one or more enemies of each monster type that appears
 *  in the scenario." Tracks the monster types the owner personally kills; met
 *  if that covers every type that appeared (per the evaluation context). */
const exterminatorTracker: BattleGoalTracker<{
  readonly killedTypes: ReadonlySet<string>;
}> = {
  init: () => ({ killedTypes: new Set<string>() }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      const next = new Set(state.killedTypes);
      next.add(event.targetDefId);
      return { killedTypes: next };
    }
    return state;
  },
  isAchieved: (state, ctx) =>
    ctx.monsterTypesInScenario.every((t) => state.killedTypes.has(t)),
};

/** Layabout: "Gain 7 or fewer experience before any bonus scenario
 *  experience." Mirror of Workhorse — sums in-play experience (excluding the
 *  end-of-scenario bonus); met if the total is 7 or fewer. */
const layaboutTracker: BattleGoalTracker<{ readonly xp: number }> = {
  init: () => ({ xp: 0 }),
  reduce: (state, event, ctx) => {
    if (
      event.kind === 'experience_gained' &&
      event.characterId === ctx.ownerCharacterId &&
      !event.bonus
    ) {
      return { xp: state.xp + event.amount };
    }
    return state;
  },
  isAchieved: (state) => state.xp <= 7,
};

/** Miser: "Never exit a room with loot tokens in it." Violated the first time
 *  the owner leaves a room that still holds uncollected loot. The card states
 *  no forced-movement exception, so any exit counts. */
const miserTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'exited_room_with_loot' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Overachiever: "Kill an enemy and open a door in the same turn, in either
 *  order." Tracks, per turn, whether the owner killed an enemy and opened a
 *  door; met once both happen in one turn. Resets each turn. */
const overachieverTracker: BattleGoalTracker<{
  readonly killed: boolean;
  readonly openedDoor: boolean;
  readonly hit: boolean;
}> = {
  init: () => ({ killed: false, openedDoor: false, hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'turn_start') {
      return { killed: false, openedDoor: false, hit: false };
    }
    let { killed, openedDoor } = state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      killed = true;
    }
    if (
      event.kind === 'door_opened' &&
      event.characterId === ctx.ownerCharacterId
    ) {
      openedDoor = true;
    }
    return { killed, openedDoor, hit: killed && openedDoor };
  },
  isAchieved: (state) => state.hit,
};

/** Peacemonger: "Never kill an enemy." Violated the first time the owner
 *  kills any enemy. */
const peacemongerTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Prepper: "Perform no attack abilities in the first three rounds." Tracks
 *  the current round (1-indexed); violated if the owner makes any attack
 *  during rounds 1–3. */
const prepperTracker: BattleGoalTracker<{
  readonly currentRound: number;
  readonly violated: boolean;
}> = {
  init: () => ({ currentRound: 0, violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (event.kind === 'round_start') {
      return { ...state, currentRound: event.round };
    }
    if (
      event.kind === 'attack' &&
      event.attackerCharacterId === ctx.ownerCharacterId &&
      state.currentRound <= 3
    ) {
      return { ...state, violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Slayer: "Kill two or more enemies in the same round." Counts the owner's
 *  kills within a round; met at two. Resets each round. */
const slayerTracker: BattleGoalTracker<{
  readonly killsThisRound: number;
  readonly hit: boolean;
}> = {
  init: () => ({ killsThisRound: 0, hit: false }),
  reduce: (state, event, ctx) => {
    if (state.hit) return state;
    if (event.kind === 'round_start') {
      return { ...state, killsThisRound: 0 };
    }
    if (
      event.kind === 'enemy_killed' &&
      event.killerCharacterId === ctx.ownerCharacterId
    ) {
      const killsThisRound = state.killsThisRound + 1;
      return { killsThisRound, hit: killsThisRound >= 2 };
    }
    return state;
  },
  isAchieved: (state) => state.hit,
};

/** Slowpoke: "Move no more than two hexes on each turn." Accumulates the
 *  owner's own (non-forced) movement within a turn; violated if any turn
 *  exceeds two hexes. Resets each turn. */
const slowpokeTracker: BattleGoalTracker<{
  readonly hexesThisTurn: number;
  readonly violated: boolean;
}> = {
  init: () => ({ hexesThisTurn: 0, violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (event.kind === 'turn_start') {
      return { ...state, hexesThisTurn: 0 };
    }
    if (
      event.kind === 'character_moved' &&
      event.characterId === ctx.ownerCharacterId &&
      !event.forced
    ) {
      const hexesThisTurn = state.hexesThisTurn + event.hexes;
      return { hexesThisTurn, violated: hexesThisTurn > 2 };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Wallflower: "End each of your turns adjacent to a wall, obstacle, or
 *  objective." Violated the first time the owner ends a turn not adjacent to
 *  any of those. Vacuously satisfied if they never take a turn. */
const wallflowerTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'turn_end_position' &&
      event.characterId === ctx.ownerCharacterId &&
      !event.adjacentToWallObstacleOrObjective
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Vanguard: "Never attack an enemy that has already acted in the round."
 *  Violated the first time the owner attacks an enemy that already took its
 *  turn this round. */
const vanguardTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'attack' &&
      event.attackerCharacterId === ctx.ownerCharacterId &&
      event.targetHasActedThisRound
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** Specialist: "Never perform a basic action." Violated the first time the
 *  owner uses a card for its basic Attack 2 / Move 2 action. */
const specialistTracker: BattleGoalTracker<{ readonly violated: boolean }> = {
  init: () => ({ violated: false }),
  reduce: (state, event, ctx) => {
    if (state.violated) return state;
    if (
      event.kind === 'ability_performed' &&
      event.characterId === ctx.ownerCharacterId &&
      event.basic
    ) {
      return { violated: true };
    }
    return state;
  },
  isAchieved: (state) => !state.violated,
};

/** All battle goal cards. Cards are added one at a time as their text is
 *  transcribed from the source rulebook. */
export const BATTLE_GOALS: readonly BattleGoal[] = [
  {
    id: 'accountant',
    title: 'Accountant',
    description: 'Have zero cards in your hand each time you rest.',
    checkmarks: 1,
    tracker: accountantTracker,
  },
  {
    id: 'acrobat',
    title: 'Acrobat',
    description: 'Lose a card to negate 5 damage or more.',
    checkmarks: 1,
    tracker: acrobatTracker,
  },
  {
    id: 'ascetic',
    title: 'Ascetic',
    description: 'Collect fewer loot tokens than any other player.',
    checkmarks: 1,
    tracker: asceticTracker,
  },
  {
    id: 'assistant',
    title: 'Assistant',
    description: 'Kill an enemy attacked by any of your allies earlier in the round.',
    checkmarks: 1,
    tracker: assistantTracker,
  },
  {
    id: 'bastion',
    title: 'Bastion',
    description: 'Occupy a door hex adjacent to two or more enemies at the end of a round.',
    checkmarks: 1,
    tracker: bastionTracker,
  },
  {
    id: 'bully',
    title: 'Bully',
    description: 'Kill an enemy that has two or more negative conditions.',
    checkmarks: 1,
    tracker: bullyTracker,
  },
  {
    id: 'cleaner',
    title: 'Cleaner',
    description: 'Collect three or more loot tokens in the same turn.',
    checkmarks: 1,
    tracker: cleanerTracker,
  },
  {
    id: 'closer',
    title: 'Closer',
    description: 'Kill the last enemy to die in the Scenario.',
    checkmarks: 1,
    tracker: closerTracker,
  },
  {
    id: 'conservator',
    title: 'Conservator',
    description: 'Never perform an action with a lost icon.',
    checkmarks: 1,
    tracker: conservatorTracker,
  },
  {
    id: 'diehard',
    title: 'Diehard',
    description:
      'Never let your hit point value drop below half your maximum hit point value (rounded up).',
    checkmarks: 1,
    tracker: diehardTracker,
  },
  {
    id: 'dynamo',
    title: 'Dynamo',
    description:
      'Kill an enemy with an attack that would have caused at least 4 more damage than necessary.',
    checkmarks: 1,
    tracker: dynamoTracker,
  },
  {
    id: 'egoist',
    title: 'Egoist',
    description: 'Collect more loot tokens than any other character.',
    checkmarks: 1,
    tracker: egoistTracker,
  },
  {
    id: 'executioner',
    title: 'Executioner',
    description: 'Kill an undamaged enemy with a single attack action.',
    checkmarks: 1,
    tracker: executionerTracker,
  },
  {
    id: 'gambler',
    title: 'Gambler',
    description: 'Kill an enemy with an attack that has disadvantage.',
    checkmarks: 1,
    tracker: gamblerTracker,
  },
  {
    id: 'hunter',
    title: 'Hunter',
    description: 'Kill one or more elite enemies, or two or more for four characters.',
    checkmarks: 1,
    tracker: hunterTracker,
  },
  {
    id: 'insomniac',
    title: 'Insomniac',
    description: 'Suffer damage for an attack in the same round you long rest.',
    checkmarks: 1,
    tracker: insomniacTracker,
  },
  {
    id: 'masochist',
    title: 'Masochist',
    description: 'End the scenario with a hit point value of 3 or less.',
    checkmarks: 1,
    tracker: masochistTracker,
  },
  {
    id: 'mugger',
    title: 'Mugger',
    description: 'Kill an enemy and loot the loot token it drops in the same round.',
    checkmarks: 1,
    tracker: muggerTracker,
  },
  {
    id: 'opener',
    title: 'Opener',
    description: 'Kill the first enemy to die in the scenario.',
    checkmarks: 1,
    tracker: openerTracker,
  },
  {
    id: 'optimist',
    title: 'Optimist',
    description: 'Remove a negative condition from yourself or an ally two or more times.',
    checkmarks: 1,
    tracker: optimistTracker,
  },
  {
    id: 'pacifist',
    title: 'Pacifist',
    description: 'Kill three or fewer enemies.',
    checkmarks: 1,
    tracker: pacifistTracker,
  },
  {
    id: 'pauper',
    title: 'Pauper',
    description: 'Never collect a loot token from end-of-turn looting.',
    checkmarks: 1,
    tracker: pauperTracker,
  },
  {
    id: 'pedestrian',
    title: 'Pedestrian',
    description: 'Never enter a hex occupied by an ally, enemy, objective, or obstacle.',
    checkmarks: 1,
    tracker: pedestrianTracker,
  },
  {
    id: 'pickpocket',
    title: 'Pickpocket',
    description:
      'Collect two or more loot tokens by performing a loot ability while adjacent to one or more enemies.',
    checkmarks: 1,
    tracker: pickpocketTracker,
  },
  {
    id: 'pincushion',
    title: 'Pincushion',
    description: 'Be targeted by attacks from three or more enemies in the same round.',
    checkmarks: 1,
    tracker: pincushionTracker,
  },
  {
    id: 'plebeian',
    title: 'Plebeian',
    description: 'Never kill an elite enemy, named enemy, or boss.',
    checkmarks: 1,
    tracker: plebeianTracker,
  },
  {
    id: 'prohibitionist',
    title: 'Prohibitionist',
    description: 'Never use a potion.',
    checkmarks: 1,
    tracker: prohibitionistTracker,
  },
  {
    id: 'promoter',
    title: 'Promoter',
    description:
      'Perform an ability targeting an ally before your first rest and in between each of your rests.',
    checkmarks: 1,
    tracker: promoterTracker,
  },
  {
    id: 'ravager',
    title: 'Ravager',
    description: 'Perform two actions with Lost in the same turn.',
    checkmarks: 1,
    tracker: ravagerTracker,
  },
  {
    id: 'recluse',
    title: 'Recluse',
    description:
      'Never end your turn adjacent to any other character (gain one additional checkmark for four characters).',
    checkmarks: (ctx) => (ctx.allCharacterIds.length >= 4 ? 2 : 1),
    tracker: recluseTracker,
  },
  {
    id: 'ritualist',
    title: 'Ritualist',
    description: 'Kill an enemy while three or more elements are strong or waning.',
    checkmarks: 1,
    tracker: ritualistTracker,
  },
  {
    id: 'sadist',
    title: 'Sadist',
    description: 'Kill five or more enemies.',
    checkmarks: 1,
    tracker: sadistTracker,
  },
  {
    id: 'scrambler',
    title: 'Scrambler',
    description: 'Never long rest.',
    checkmarks: 1,
    tracker: scramblerTracker,
  },
  {
    id: 'shirker',
    title: 'Shirker',
    description: 'Kill an enemy not adjacent to you while you are adjacent to another enemy.',
    checkmarks: 1,
    tracker: shirkerTracker,
  },
  {
    id: 'sleeper',
    title: 'Sleeper',
    description: 'Have one or more cards in your hand each time you rest.',
    checkmarks: 1,
    tracker: sleeperTracker,
  },
  {
    id: 'sluggard',
    title: 'Sluggard',
    description:
      'Perform a long rest while at your maximum hit point value, after you have already suffered damage.',
    checkmarks: 1,
    tracker: sluggardTracker,
  },
  {
    id: 'straggler',
    title: 'Straggler',
    description: 'Never short rest.',
    checkmarks: 1,
    tracker: stragglerTracker,
  },
  {
    id: 'streamliner',
    title: 'Streamliner',
    description:
      'Have five or more total cards in your hand and discard pile at the end of the scenario.',
    checkmarks: 1,
    tracker: streamlinerTracker,
  },
  {
    id: 'tormentor',
    title: 'Tormentor',
    description:
      'Apply a different negative condition to an enemy that already has one or more negative conditions.',
    checkmarks: 1,
    tracker: tormentorTracker,
  },
  {
    id: 'wastrel',
    title: 'Wastrel',
    description: 'Lose a card to negate 2 or less damage from an attack.',
    checkmarks: 1,
    tracker: wastrelTracker,
  },
  {
    id: 'weakling',
    title: 'Weakling',
    description: 'Become exhausted before any other character.',
    checkmarks: 1,
    tracker: weaklingTracker,
  },
  {
    id: 'workhorse',
    title: 'Workhorse',
    description: 'Gain 13 or more experience before any bonus scenario experience.',
    checkmarks: 1,
    tracker: workhorseTracker,
  },
  {
    id: 'zealot',
    title: 'Zealot',
    description:
      'Have three or fewer total cards in your hand and discard pile while also not exhausted at the end of the scenario.',
    checkmarks: 1,
    tracker: zealotTracker,
  },
  {
    id: 'dawdler',
    title: 'Dawdler',
    description: 'Never use your lowest initiative played cards as your initiative.',
    checkmarks: 2,
    tracker: dawdlerTracker,
  },
  {
    id: 'daredevil',
    title: 'Daredevil',
    description: 'Add two cards to your lost pile before your first rest.',
    checkmarks: 2,
    tracker: daredevilTracker,
  },
  {
    id: 'assassin',
    title: 'Assassin',
    description: 'Kill an enemy before it takes its first turn.',
    checkmarks: 2,
    tracker: assassinTracker,
  },
  {
    id: 'duelist',
    title: 'Duelist',
    description: 'Never exit a hex adjacent to an enemy except through forced movement.',
    checkmarks: 2,
    tracker: duelistTracker,
  },
  {
    id: 'exterminator',
    title: 'Exterminator',
    description: 'Kill one or more enemies of each monster type that appears in the scenario.',
    checkmarks: 2,
    tracker: exterminatorTracker,
  },
  {
    id: 'layabout',
    title: 'Layabout',
    description: 'Gain 7 or fewer experience before any bonus scenario experience.',
    checkmarks: 2,
    tracker: layaboutTracker,
  },
  {
    id: 'miser',
    title: 'Miser',
    description: 'Never exit a room with loot tokens in it.',
    checkmarks: 2,
    tracker: miserTracker,
  },
  {
    id: 'overachiever',
    title: 'Overachiever',
    description: 'Kill an enemy and open a door in the same turn, in either order.',
    checkmarks: 2,
    tracker: overachieverTracker,
  },
  {
    id: 'peacemonger',
    title: 'Peacemonger',
    description: 'Never kill an enemy.',
    checkmarks: 2,
    tracker: peacemongerTracker,
  },
  {
    id: 'prepper',
    title: 'Prepper',
    description: 'Perform no attack abilities in the first three rounds.',
    checkmarks: 2,
    tracker: prepperTracker,
  },
  {
    id: 'slayer',
    title: 'Slayer',
    description: 'Kill two or more enemies in the same round.',
    checkmarks: 2,
    tracker: slayerTracker,
  },
  {
    id: 'slowpoke',
    title: 'Slowpoke',
    description: 'Move no more than two hexes on each turn.',
    checkmarks: 2,
    tracker: slowpokeTracker,
  },
  {
    id: 'wallflower',
    title: 'Wallflower',
    description: 'End each of your turns adjacent to a wall, obstacle, or objective.',
    checkmarks: 2,
    tracker: wallflowerTracker,
  },
  {
    id: 'vanguard',
    title: 'Vanguard',
    description: 'Never attack an enemy that has already acted in the round.',
    checkmarks: 2,
    tracker: vanguardTracker,
  },
  {
    id: 'specialist',
    title: 'Specialist',
    description: 'Never perform a basic action.',
    checkmarks: 2,
    tracker: specialistTracker,
  },
];

export const BATTLE_GOAL_BY_ID: Readonly<Record<string, BattleGoal>> =
  Object.fromEntries(BATTLE_GOALS.map((g) => [g.id, g]));

/** Resolve a goal's checkmark reward, which may depend on the party. */
export function resolveCheckmarks(
  goal: BattleGoal,
  ctx: BattleGoalEvaluationContext,
): number {
  return typeof goal.checkmarks === 'function'
    ? goal.checkmarks(ctx)
    : goal.checkmarks;
}
