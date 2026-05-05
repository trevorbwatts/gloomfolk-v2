import {
  AI,
  CARDS,
  CHARACTERS,
  Combat,
  Conditions,
  Elements,
  HexMath,
  Persistents,
  Setup,
} from '@gloomfolk/shared';
import type {
  ClientToServer,
  GameState,
  Hex,
  ServerToClient,
  TurnAction,
  TurnStep,
} from '@gloomfolk/shared';
import type { WebSocket } from 'ws';

type PlayerEntry = {
  playerId: string;
  name: string;
  socket: WebSocket | null;
  characterId: string | null;
};

export class Room {
  readonly code: string;
  state: GameState;
  hostSocket: WebSocket | null = null;
  players = new Map<string, PlayerEntry>();
  // Active turn unit's playerId, if it's a player turn awaiting input.
  awaitingPlayerId: string | null = null;

  constructor(code: string, scenarioId = 'scenario_01') {
    this.code = code;
    this.state = Setup.initialState(scenarioId);
  }

  // ----- connection management -----

  attachHost(socket: WebSocket): void {
    this.hostSocket = socket;
    this.send(socket, { type: 'joined', playerId: 'host', role: 'host' });
    this.broadcastState();
  }

  attachPlayer(socket: WebSocket, name: string, existingPlayerId?: string): string | null {
    let entry: PlayerEntry | undefined;
    if (existingPlayerId && this.players.has(existingPlayerId)) {
      entry = this.players.get(existingPlayerId)!;
      entry.socket = socket;
      entry.name = name || entry.name;
    } else {
      if (this.players.size >= 2) {
        // Recycle the oldest slot whose socket is dead — handles refreshes
        // and dropped connections that left a phantom occupant.
        const stale = [...this.players.values()].find((p) => !p.socket);
        if (!stale) return null;
        const oldStatePlayer = this.state.players[stale.playerId];
        if (oldStatePlayer) {
          delete this.state.units[oldStatePlayer.unitId];
          delete this.state.players[stale.playerId];
        }
        this.players.delete(stale.playerId);
      }
      const playerId = `p${Math.random().toString(36).slice(2, 8)}`;
      entry = { playerId, name, socket, characterId: null };
      this.players.set(playerId, entry);
    }
    this.send(socket, {
      type: 'joined',
      playerId: entry.playerId,
      role: 'player',
    });
    this.broadcastState();
    return entry.playerId;
  }

  detachSocket(socket: WebSocket): void {
    if (this.hostSocket === socket) this.hostSocket = null;
    for (const p of this.players.values()) {
      if (p.socket === socket) p.socket = null;
    }
  }

  // ----- message dispatch -----

  handle(playerId: string, msg: ClientToServer): void {
    switch (msg.type) {
      case 'pick_character':
        return this.pickCharacter(playerId, msg.characterId);
      case 'start_scenario':
        return this.startScenario();
      case 'select_cards':
        return this.selectCards(playerId, msg.leading, msg.second);
      case 'select_long_rest':
        return this.selectLongRest(playerId);
      case 'play_turn':
        return this.playTurn(playerId, msg.steps);
      case 'long_rest_turn':
        return this.longRestTurn(playerId, msg.loseCardId);
      case 'rest':
        return this.handleRest(playerId);
      case 'path':
        return this.handlePath(playerId, msg.path);
      case 'cursor':
        return this.handleCursor(playerId, msg.px);
      case 'pending_move':
        return this.handlePendingMove(playerId, msg.hex);
      case 'target_hint':
        return this.handleTargetHint(playerId, msg.unitId);
      case 'reset_room':
        return this.resetRoom(playerId);
      default:
        return;
    }
  }

  private resetRoom(playerId: string): void {
    if (playerId !== 'host') return;
    this.state = Setup.initialState('scenario_01');
    this.awaitingPlayerId = null;
    // Drop any disconnected slots; keep live ones, just reset their picks.
    for (const [pid, entry] of [...this.players.entries()]) {
      if (!entry.socket) {
        this.players.delete(pid);
        continue;
      }
      entry.characterId = null;
    }
    this.broadcastState();
  }

  private handlePath(playerId: string, path: Hex[] | null): void {
    if (!this.hostSocket) return;
    this.send(this.hostSocket, { type: 'path', playerId, path });
  }

  private handleCursor(playerId: string, px: { x: number; y: number } | null): void {
    if (!this.hostSocket) return;
    this.send(this.hostSocket, { type: 'cursor', playerId, px });
  }

  private handlePendingMove(playerId: string, hex: Hex | null): void {
    if (!this.hostSocket) return;
    this.send(this.hostSocket, { type: 'pending_move', playerId, hex });
  }

  private handleTargetHint(playerId: string, unitId: string | null): void {
    if (!this.hostSocket) return;
    this.send(this.hostSocket, { type: 'target_hint', playerId, unitId });
  }

  // ----- handlers -----

  private pickCharacter(playerId: string, characterId: string): void {
    if (this.state.phase !== 'lobby') return this.errorTo(playerId, 'not in lobby');
    const entry = this.players.get(playerId);
    if (!entry) return;
    if (!CHARACTERS[characterId]) return this.errorTo(playerId, 'unknown character');
    // Don't allow duplicates.
    for (const p of this.players.values()) {
      if (p.playerId !== playerId && p.characterId === characterId) {
        return this.errorTo(playerId, 'character already taken');
      }
    }
    // Remove any existing player unit before re-spawning.
    if (entry.characterId) {
      const existing = this.state.players[playerId];
      if (existing) {
        delete this.state.units[existing.unitId];
        delete this.state.players[playerId];
      }
    }
    entry.characterId = characterId;
    Setup.spawnPlayer(this.state, playerId, entry.name, characterId);
    this.broadcastState();
  }

  private startScenario(): void {
    if (this.state.phase !== 'lobby') return;
    if (this.players.size < 1) return;
    if ([...this.players.values()].some((p) => !p.characterId)) return;
    Setup.spawnEnemies(this.state);
    Setup.startRound(this.state);
    this.broadcastState();
  }

  private selectCards(playerId: string, leading: string, second: string): void {
    if (this.state.phase !== 'card_select') return this.errorTo(playerId, 'not selecting cards');
    const player = this.state.players[playerId];
    if (!player) return;
    if (leading === second) return this.errorTo(playerId, 'must select two distinct cards');
    if (!player.hand.includes(leading) || !player.hand.includes(second)) {
      return this.errorTo(playerId, 'card not in hand');
    }
    player.selectedCards = { leading, second, longRest: false, submitted: true };
    this.broadcastState();
    this.maybeAdvanceFromSelection();
  }

  private selectLongRest(playerId: string): void {
    if (this.state.phase !== 'card_select') return this.errorTo(playerId, 'not selecting cards');
    const player = this.state.players[playerId];
    if (!player) return;
    if (player.discard.length < 1) return this.errorTo(playerId, 'long rest needs at least one card in discard');
    player.selectedCards = { leading: null, second: null, longRest: true, submitted: true };
    this.broadcastState();
    this.maybeAdvanceFromSelection();
  }

  private maybeAdvanceFromSelection(): void {
    const activePlayers = Object.values(this.state.players).filter((p) => {
      const u = this.state.units[p.unitId];
      return u && !u.exhausted;
    });
    if (activePlayers.every((p) => p.selectedCards.submitted)) {
      Setup.buildTurnOrder(this.state);
      this.advanceUntilPlayer();
    }
  }

  private playTurn(playerId: string, steps: TurnStep[]): void {
    if (this.state.phase !== 'turn_resolution') return this.errorTo(playerId, 'not in turn phase');
    if (this.awaitingPlayerId !== playerId) return this.errorTo(playerId, 'not your turn');
    const player = this.state.players[playerId];
    if (!player) return;
    const sel = player.selectedCards;
    if (!sel.submitted || sel.longRest || !sel.leading || !sel.second) {
      return this.errorTo(playerId, 'no cards selected');
    }
    const unit = this.state.units[player.unitId];
    if (!unit) return;

    Conditions.applyStartOfTurnConditions(this.state, unit.id);
    if (unit.exhausted) {
      this.awaitingPlayerId = null;
      this.advanceTurn();
      return;
    }

    // Stun: both cards routed to discard with no effect.
    if (Conditions.hasCondition(unit, 'stun')) {
      Conditions.applyEndOfTurnConditions(this.state, unit.id);
      this.awaitingPlayerId = null;
      this.advanceTurn();
      return;
    }

    // Reset per-turn tracking. movedThisTurn covers the entire turn (both halves).
    player.movedThisTurn = false;

    // Per-card chosen-half lock: each card commits to one half across the turn.
    const chosenHalf: Record<string, 'top' | 'bottom' | null> = { [sel.leading]: null, [sel.second]: null };
    // Per-half component usage: 'move' once per half; 'action:<index>' once per action slot.
    const used: Record<string, boolean> = {};
    const usageKey = (cardId: string, half: 'top' | 'bottom', component: string) =>
      `${cardId}:${half}:${component}`;

    const validateHalf = (cardId: string, half: 'top' | 'bottom'): string | null => {
      if (!(cardId in chosenHalf)) return 'card not selected';
      const locked = chosenHalf[cardId];
      if (locked && locked !== half) return 'card already committed to other half';
      chosenHalf[cardId] = half;
      return null;
    };

    const takeAttackBonus = (): number => {
      const b = unit.nextAttackBonus;
      unit.nextAttackBonus = 0;
      return b;
    };

    for (const step of steps) {
      const card = CARDS[step.cardId];
      if (!card) return this.errorTo(playerId, 'invalid card in step');
      const halfErr = validateHalf(step.cardId, step.half);
      if (halfErr) return this.errorTo(playerId, halfErr);
      const cardHalf = card[step.half];
      const startPos = { q: unit.pos.q, r: unit.pos.r };

      if (step.kind === 'move') {
        const k = usageKey(step.cardId, step.half, 'move');
        if (used[k]) return this.errorTo(playerId, 'move already used for this half');
        const baseMove = cardHalf.move;
        const bonus = baseMove > 0 ? Persistents.consumeMoveBonus(this.state, playerId) : 0;
        const moveRange = baseMove + bonus;
        if (cardHalf.jump) {
          if (!Combat.canJumpTo(this.state, unit.id, step.moveTo, moveRange)) {
            return this.errorTo(playerId, 'invalid jump');
          }
        } else {
          if (!Combat.canMoveTo(this.state, unit.id, step.moveTo, moveRange)) {
            return this.errorTo(playerId, 'invalid move');
          }
        }
        Combat.applyMove(this.state, unit.id, step.moveTo);
        used[k] = true;
      } else if (step.kind === 'trample_move') {
        const ability = cardHalf.actions[step.actionIndex];
        if (!ability || ability.kind !== 'trample') return this.errorTo(playerId, 'no trample action at index');
        const moveK = usageKey(step.cardId, step.half, 'move');
        const actK = usageKey(step.cardId, step.half, `action:${step.actionIndex}`);
        if (used[moveK] || used[actK]) return this.errorTo(playerId, 'trample already used');
        const moveRange = cardHalf.move + (cardHalf.move > 0 ? Persistents.consumeMoveBonus(this.state, playerId) : 0);
        if (!Combat.canTrampleTo(this.state, unit.id, step.moveTo, moveRange)) {
          return this.errorTo(playerId, 'invalid trample move');
        }
        Combat.applyTrample(this.state, unit.id, step.path, ability.damage + takeAttackBonus());
        Combat.applyMove(this.state, unit.id, step.moveTo);
        used[moveK] = true;
        used[actK] = true;
      } else if (step.kind === 'charge_move') {
        const ability = cardHalf.actions[step.actionIndex];
        if (!ability || ability.kind !== 'charge') return this.errorTo(playerId, 'no charge action at index');
        const moveK = usageKey(step.cardId, step.half, 'move');
        const actK = usageKey(step.cardId, step.half, `action:${step.actionIndex}`);
        if (used[moveK] || used[actK]) return this.errorTo(playerId, 'charge already used');
        const moveRange = cardHalf.move + (cardHalf.move > 0 ? Persistents.consumeMoveBonus(this.state, playerId) : 0);
        const blocked = Combat.blockedFor(this.state, unit);
        const path = HexMath.straightLinePath(unit.pos, step.moveTo, blocked, {
          width: this.state.width, height: this.state.height,
        });
        if (!path || path.length - 1 > moveRange) {
          return this.errorTo(playerId, 'charge requires a straight-line move within range');
        }
        if (Combat.unitAt(this.state, step.moveTo) || Combat.isObstacle(this.state, step.moveTo)) {
          return this.errorTo(playerId, 'charge destination is occupied');
        }
        const hexesMoved = path.length - 1;
        Combat.applyMove(this.state, unit.id, step.moveTo);
        if (hexesMoved > 0) {
          if (!AI.isValidAttackTarget(this.state, unit.id, step.targetUnitId, ability.range)) {
            return this.errorTo(playerId, 'charge target out of range');
          }
          Combat.applyAttack(this.state, unit.id, step.targetUnitId, hexesMoved + takeAttackBonus(), {
            isRanged: ability.range > 1,
          });
        }
        used[moveK] = true;
        used[actK] = true;
      } else if (step.kind === 'action') {
        const ability = cardHalf.actions[step.actionIndex];
        if (!ability) return this.errorTo(playerId, 'no action at index');
        const k = usageKey(step.cardId, step.half, `action:${step.actionIndex}`);
        if (used[k]) return this.errorTo(playerId, 'action slot already used');
        const result = this.applyActionStep(player, unit, step.cardId, card.name, ability, step.action, takeAttackBonus);
        if (typeof result === 'string') return this.errorTo(playerId, result);
        used[k] = true;
      }

      if (unit.pos.q !== startPos.q || unit.pos.r !== startPos.r) {
        player.movedThisTurn = true;
      }
      if (unit.exhausted) break;
    }

    // After all steps: infuse on-play elements; route each card per its committed half.
    for (const cardId of [sel.leading, sel.second]) {
      const half = chosenHalf[cardId];
      if (!half) continue;
      const card = CARDS[cardId]!;
      const cardHalf = card[half];
      if (cardHalf.infusesOnPlay) Elements.infuseElement(this.state, cardHalf.infusesOnPlay);
      // Persistent activation already drained the card from hand.
      if (!player.hand.includes(cardId)) continue;
      if (cardHalf.lost) {
        player.lost.push(cardId);
        player.hand = player.hand.filter((c) => c !== cardId);
      }
      // Otherwise discard happens via endRoundCleanup.
    }

    Conditions.applyEndOfTurnConditions(this.state, unit.id);
    this.awaitingPlayerId = null;
    this.advanceTurn();
  }

  // Resolves the action component of a half. Returns null on success or an error string.
  private applyActionStep(
    player: import('@gloomfolk/shared').PlayerState,
    unit: import('@gloomfolk/shared').Unit,
    cardId: string,
    cardName: string,
    ability: import('@gloomfolk/shared').AbilityAction,
    action: TurnAction,
    takeAttackBonus: () => number,
  ): string | null {
    if (action.kind === 'trample' || action.kind === 'charge') {
      return 'trample/charge are move+action combos — use trample_move/charge_move step';
    }
    if (action.kind === 'attack' || action.kind === 'aoe_self') {
      if (ability.kind !== 'attack') return 'action slot is not an attack';
      if (action.kind === 'aoe_self' && (!ability.aoe || ability.aoeCenter !== 'self')) {
        return 'action slot has no self-centered AoE';
      }
      if (action.kind === 'attack' && !AI.isValidAttackTarget(this.state, unit.id, action.targetUnitId, ability.range)) {
        return 'invalid attack target';
      }
      let bonusDamage = 0;
      const cb = ability.conditionalBonus;
      if (cb && player.movedThisTurn) {
        bonusDamage = cb.ifMovedThisTurn.damage ?? 0;
        for (const c of cb.ifMovedThisTurn.selfConditions ?? []) Conditions.gainCondition(unit, c);
      }
      const attackOpts = {
        isRanged: ability.range > 1,
        pierce: ability.pierce,
        appliedConditions: ability.appliedConditions,
      };
      const totalDamage = ability.damage + bonusDamage + takeAttackBonus();
      let hits = 0;
      if (ability.aoe) {
        const center = action.kind === 'aoe_self' || ability.aoeCenter === 'self'
          ? unit.pos
          : action.kind === 'attack' ? this.state.units[action.targetUnitId]?.pos : undefined;
        if (center) {
          const outcomes = Combat.applyAoeAttack(this.state, unit.id, center, totalDamage, ability.aoe, attackOpts);
          hits = outcomes.length;
        }
      } else if (action.kind === 'attack') {
        const outcome = Combat.applyAttack(this.state, unit.id, action.targetUnitId, totalDamage, attackOpts);
        hits = outcome ? 1 : 0;
      }
      if (hits > 0) {
        if (ability.infuses) Elements.infuseElement(this.state, ability.infuses);
        for (const c of ability.selfConditionsOnHit ?? []) Conditions.gainCondition(unit, c);
      }
      return null;
    }
    if (action.kind === 'heal') {
      if (ability.kind !== 'heal') return 'action slot is not a heal';
      if (!AI.isValidHealTarget(this.state, unit.id, action.targetUnitId, ability.range)) {
        return 'invalid heal target';
      }
      Combat.applyHeal(this.state, unit.id, action.targetUnitId, ability.amount);
      return null;
    }
    if (action.kind === 'push_all') {
      if (ability.kind !== 'push_all') return 'action slot is not push_all';
      const range = ability.range;
      const distance = ability.distance;
      const targets = Object.values(this.state.units).filter(
        (u) => u.kind === 'enemy' && !u.exhausted &&
          HexMath.hexDistance(u.pos, unit.pos) >= 1 &&
          HexMath.hexDistance(u.pos, unit.pos) <= range,
      );
      for (const t of targets) Combat.applyPush(this.state, unit.id, t.id, distance);
      return null;
    }
    if (action.kind === 'pull_multi') {
      if (ability.kind !== 'pull_multi') return 'action slot is not pull_multi';
      const range = ability.range;
      const distance = ability.distance;
      const count = ability.targetCount;
      const candidates = Object.values(this.state.units)
        .filter((u) => u.kind === 'enemy' && !u.exhausted &&
          HexMath.hexDistance(u.pos, unit.pos) >= 1 &&
          HexMath.hexDistance(u.pos, unit.pos) <= range)
        .sort((a, b) => HexMath.hexDistance(a.pos, unit.pos) - HexMath.hexDistance(b.pos, unit.pos));
      for (const t of candidates.slice(0, count)) {
        Combat.applyPull(this.state, unit.id, t.id, distance);
      }
      return null;
    }
    if (action.kind === 'none') {
      if (ability.kind === 'shield') {
        Combat.applyShieldBonus(this.state, unit.id, ability.value);
        this.state.log.push(`${unit.archetype} gains shield ${ability.value}`);
      } else if (ability.kind === 'retaliate') {
        Combat.applyRetaliateBonus(this.state, unit.id, ability.value, ability.range ?? 0);
        this.state.log.push(`${unit.archetype} gains retaliate ${ability.value}`);
      } else if (ability.kind === 'attack_bonus') {
        unit.nextAttackBonus += ability.value;
        this.state.log.push(`${unit.archetype} gains +${ability.value} on next attack`);
      } else if (ability.kind === 'persistent') {
        Persistents.addPersistent(player, cardId, ability.effect);
        player.hand = player.hand.filter((c) => c !== cardId);
        this.state.log.push(`${unit.archetype} activates ${cardName}`);
      }
      return null;
    }
    return 'unknown action';
  }

  private longRestTurn(playerId: string, loseCardId: string): void {
    if (this.state.phase !== 'turn_resolution') return this.errorTo(playerId, 'not in turn phase');
    if (this.awaitingPlayerId !== playerId) return this.errorTo(playerId, 'not your turn');
    const player = this.state.players[playerId];
    if (!player) return;
    if (!player.selectedCards.longRest) return this.errorTo(playerId, 'not long-resting');
    if (!player.discard.includes(loseCardId)) return this.errorTo(playerId, 'card not in discard');
    const unit = this.state.units[player.unitId];
    if (!unit) return;

    Conditions.applyStartOfTurnConditions(this.state, unit.id);
    if (unit.exhausted) {
      this.awaitingPlayerId = null;
      this.advanceTurn();
      return;
    }

    // Long rest: lose 1 chosen card from discard, recover the rest to hand, heal 2.
    player.discard = player.discard.filter((c) => c !== loseCardId);
    player.lost.push(loseCardId);
    player.hand = [...player.hand, ...player.discard];
    player.discard = [];
    unit.hp = Math.min(unit.maxHp, unit.hp + 2);
    this.state.log.push(`${unit.archetype} long rests (heal 2, lost ${loseCardId})`);

    Conditions.applyEndOfTurnConditions(this.state, unit.id);
    this.awaitingPlayerId = null;
    this.advanceTurn();
  }

  private handleRest(playerId: string): void {
    if (this.state.phase !== 'turn_resolution') return this.errorTo(playerId, 'cannot rest now');
    if (this.awaitingPlayerId !== playerId) return this.errorTo(playerId, 'not your turn');
    Setup.rest(this.state, playerId);
    this.awaitingPlayerId = null;
    this.advanceTurn();
  }

  // ----- turn flow -----

  private advanceTurn(): void {
    // Did the last action end the scenario?
    const result = Combat.checkVictory(this.state);
    if (result) {
      this.state.phase = result;
      this.broadcastState();
      return;
    }
    this.state.activeTurn += 1;
    if (this.state.activeTurn >= this.state.turnOrder.length) {
      // End of round.
      Setup.endRoundCleanup(this.state);
      const result2 = Combat.checkVictory(this.state);
      if (result2) {
        this.state.phase = result2;
        this.broadcastState();
        return;
      }
      Setup.startRound(this.state);
      this.broadcastState();
      return;
    }
    this.advanceUntilPlayer();
  }

  private advanceUntilPlayer(): void {
    while (this.state.activeTurn < this.state.turnOrder.length) {
      const unitId = this.state.turnOrder[this.state.activeTurn]!;
      const unit = this.state.units[unitId];
      if (!unit || unit.exhausted) {
        this.state.activeTurn += 1;
        continue;
      }
      if (unit.kind === 'enemy') {
        // Broadcast first so the host can highlight this enemy as active
        // before the AI applies its move; then apply, broadcast, and pause
        // so the host can animate before we step to the next unit.
        this.broadcastState();
        setTimeout(() => {
          Conditions.applyStartOfTurnConditions(this.state, unitId);
          AI.applyEnemyTurn(this.state, unitId);
          Conditions.applyEndOfTurnConditions(this.state, unitId);
          const result = Combat.checkVictory(this.state);
          if (result) {
            this.state.phase = result;
            this.broadcastState();
            return;
          }
          this.state.activeTurn += 1;
          this.broadcastState();
          setTimeout(() => this.advanceUntilPlayer(), 700);
        }, 450);
        return;
      }
      // Player turn — find the player whose unit this is.
      const player = Object.values(this.state.players).find((p) => p.unitId === unitId);
      if (!player) {
        this.state.activeTurn += 1;
        continue;
      }
      this.awaitingPlayerId = player.socketId;
      const sel = player.selectedCards;
      this.broadcastState();
      const entry = this.players.get(player.socketId);
      if (entry?.socket) {
        this.send(entry.socket, {
          type: 'your_turn',
          unitId,
          leadingCardId: sel.leading ?? '',
          secondCardId: sel.second,
          longRest: sel.longRest,
        });
      }
      return;
    }
    // No player turns left this round.
    Setup.endRoundCleanup(this.state);
    const result = Combat.checkVictory(this.state);
    if (result) {
      this.state.phase = result;
      this.broadcastState();
      return;
    }
    Setup.startRound(this.state);
    this.broadcastState();
  }

  // ----- send helpers -----

  private send(socket: WebSocket, msg: ServerToClient): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  private errorTo(playerId: string, message: string): void {
    const entry = this.players.get(playerId);
    if (!entry?.socket) return;
    this.send(entry.socket, { type: 'error', message });
  }

  broadcastState(): void {
    const baseMsg: ServerToClient = { type: 'state', state: this.state };
    if (this.hostSocket) this.send(this.hostSocket, baseMsg);
    for (const entry of this.players.values()) {
      if (!entry.socket) continue;
      const player = this.state.players[entry.playerId];
      const msg: ServerToClient = {
        type: 'state',
        state: this.state,
        you: player
          ? { playerId: entry.playerId, hand: player.hand, discard: player.discard, lost: player.lost }
          : { playerId: entry.playerId, hand: [], discard: [], lost: [] },
      };
      this.send(entry.socket, msg);
    }
  }
}

