import type { WebSocket } from 'ws';
import type {
  ActiveEffect,
  Card,
  CardHalf,
  CardSelection,
  CharacterClass,
  CharacterInstance,
  ClientToServer,
  ConditionInstance,
  CurrentTurn,
  GameEvent,
  HalfSlot,
  Hex,
  ModifierCardInstance,
  ModifierDrawResult,
  MoneyToken,
  MonsterStatCard,
  NegativeCondition,
  PendingAction,
  PublicGameState,
  ServerToClient,
  TurnOrderEntry,
  Unit,
} from '@gloomfolk/shared';
import {
  applyModifierToAttack,
  archerDeck,
  banditArcher,
  banditScout,
  bfsForcedMove,
  bfsReachable,
  bruiser,
  silentKnife,
  createStartingModifierDeck,
  getScenario,
  goldConversionFor,
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
  defaultPoolForClass,
  startingHandFor,
  triggersReshuffle,
} from '@gloomfolk/shared';

const MONSTER_DECKS = {
  archer: archerDeck,
  scout: scoutDeck,
} as const;
import { type CampaignSave, saveCampaign } from './saves.js';
import { determineFocus, readAbility, walkPath } from './ai.js';

const MONSTER_DEFS = {
  'bandit-archer': banditArcher,
  'bandit-scout': banditScout,
} as const;

const MONSTER_DEF_BY_SETID: Record<string, MonsterStatCard | undefined> = {
  archer: banditArcher,
  scout: banditScout,
};

function monsterDefMatchesSet(defId: string, setId: string): boolean {
  const def = MONSTER_DEFS[defId as keyof typeof MONSTER_DEFS];
  return def?.setId === setId;
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
const SUPPORTED_CONDITIONS = new Set<string>(['stun', 'immobilize', 'disarm', 'muddle']);

const MAX_PLAYERS = 4;

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

/** Sum of all active move-bonus effects. */
function activeMoveBonus(p: PlayerEntry): number {
  let total = 0;
  for (const e of p.activeEffects) if (e.kind === 'move-bonus') total += e.amount;
  return total;
}

/**
 * Compute attack bonus + pierce from active effects, filtered by attackKind.
 * Consumes any 'next-attack' effects in the process.
 */
function consumeAttackBonus(
  p: PlayerEntry,
  attackKind: 'melee' | 'ranged',
): { amount: number; pierce: number } {
  let amount = 0;
  let pierce = 0;
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
    amount += e.amount;
    pierce += e.pierceBonus;
    if (e.expires !== 'next-attack') keep.push(e);
  }
  p.activeEffects = keep;
  return { amount, pierce };
}

/** Find an active retaliate effect on `unit` that can hit at distance `dist`. */
function retaliateAgainst(p: PlayerEntry, dist: number): { amount: number } | null {
  for (const e of p.activeEffects) {
    if (e.kind === 'retaliate' && dist <= e.range) return { amount: e.amount };
  }
  return null;
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
    if (c.appliedThisTurn) {
      c.appliedThisTurn = false;
      return true;
    }
    removed.push(c.kind);
    return false;
  });
  return removed;
}

function activeSlotRef(ct: CurrentTurn): HalfSlot | null {
  if (ct.activeSlot === 'top' && ct.topSlot.status === 'engaged') return ct.topSlot;
  if (ct.activeSlot === 'bottom' && ct.bottomSlot.status === 'engaged') return ct.bottomSlot;
  return null;
}

/** Build the basic-action queue substituted for a half. */
function basicActions(slot: 'top' | 'bottom'): PendingAction[] {
  if (slot === 'top') {
    return [
      { id: 'a1', type: 'attack', amount: 2, range: 1, pierce: 0, targets: 1, targetsRemaining: 1, done: false },
    ];
  }
  return [{ id: 'a1', type: 'move', amount: 2, done: false }];
}

/**
 * Build the action queue for a printed half. Walks abilities/steps in printed
 * order and emits a PendingAction for each supported step. Unsupported step
 * types become `unsupported` actions so the player can see what's on the card
 * even if the engine can't resolve them yet.
 */
function buildActionQueue(half: CardHalf): PendingAction[] {
  const out: PendingAction[] = [];
  let n = 0;
  const nextId = () => `a${++n}`;
  for (const ability of half.abilities) {
    for (const step of ability.steps) {
      if (step.type === 'move' && typeof step.amount === 'number') {
        out.push({ id: nextId(), type: 'move', amount: step.amount, done: false });
      } else if (step.type === 'attack' && typeof step.amount === 'number') {
        const tgt = step.target;
        const pierce = step.modifiers?.pierce?.amount ?? 0;
        if (tgt && tgt.kind === 'aoe') {
          out.push({
            id: nextId(),
            type: 'attack-aoe',
            amount: step.amount,
            pierce,
            pattern: tgt.pattern.map((h) => ({ q: h.q, r: h.r })),
            done: false,
          });
        } else {
          const range =
            tgt && tgt.kind === 'ranged' && typeof tgt.range === 'number' ? tgt.range : 1;
          const targets =
            tgt && tgt.kind === 'ranged' && typeof tgt.targets === 'number' ? tgt.targets : 1;
          out.push({
            id: nextId(),
            type: 'attack',
            amount: step.amount,
            range,
            pierce,
            targets,
            targetsRemaining: targets,
            done: false,
          });
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
        // Persistent move bonus. Lifetime tied to the host half's disposition;
        // we conservatively use 'end-round' (the most common case) since
        // persistent-tracked also clears at round end in our v1.
        out.push({
          id: nextId(),
          type: 'modify-future-move',
          amount: step.bonusAmount,
          expires: half.disposition === 'persistent-scenario' ? 'end-scenario' : 'end-round',
          done: false,
        });
      } else if (step.type === 'modify-future-attack') {
        const expires =
          step.appliesTo === 'next-attack-ability'
            ? 'next-attack'
            : step.appliesTo === 'all-attacks-this-round'
              ? 'end-round'
              : 'end-round'; // 'while-persistent-active' approximated as end-round
        const amount = typeof step.bonusAmount === 'number' ? step.bonusAmount : 0;
        out.push({
          id: nextId(),
          type: 'modify-future-attack',
          amount,
          pierceBonus: step.pierceBonus ?? 0,
          expires,
          ...(step.attackKind ? { attackKind: step.attackKind } : {}),
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
        const range =
          tgt && tgt.kind === 'ranged' && typeof tgt.range === 'number' ? tgt.range : 1;
        out.push({
          id: nextId(),
          type: 'apply-condition',
          condition: step.condition as NegativeCondition,
          range,
          done: false,
        });
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
  socket: WebSocket | null;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  active: Card[];
  activeEffects: ActiveEffect[];
  selection: CardSelection | null;
  modifierDeck: ModifierCardInstance[];
  modifierDiscard: ModifierCardInstance[];
  modifierNeedsReshuffle: boolean;
  shortRestPending: { lostCardId: string; rerollableCardIds: string[] } | null;
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
  private nextEventId = 1;
  private nextMoneyTokenN = 1;

  constructor(campaign: CampaignSave) {
    this.campaign = campaign;
    // Drop stale entries from prior sessions that never claimed a character.
    campaign.players = campaign.players.filter((p) => p.activeCharacterId);
    for (const p of campaign.players) {
      this.players.set(p.playerId, {
        playerId: p.playerId,
        name: p.name,
        activeCharacterId: p.activeCharacterId,
        socket: null,
        hand: [],
        discard: [],
        lost: [],
        active: [],
        activeEffects: [],
        selection: null,
        modifierDeck: [],
        modifierDiscard: [],
        modifierNeedsReshuffle: false,
        shortRestPending: null,
      });
    }
  }

  attachHost(ws: WebSocket): void {
    this.hostSockets.add(ws);
    this.send(ws, { type: 'state', state: this.publicState() });
  }

  detachHost(ws: WebSocket): void {
    this.hostSockets.delete(ws);
  }

  kickAll(): void {
    const msg: ServerToClient = { type: 'error', message: 'campaign_deleted' };
    for (const ws of this.hostSockets) {
      this.send(ws, msg);
      try { ws.close(); } catch { /* noop */ }
    }
    this.hostSockets.clear();
    for (const p of this.players.values()) {
      if (p.socket) {
        this.send(p.socket, msg);
        try { p.socket.close(); } catch { /* noop */ }
      }
      p.socket = null;
    }
  }

  attachPlayer(ws: WebSocket, requestedId?: string): string | null {
    let entry = requestedId ? this.players.get(requestedId) : undefined;
    if (entry) {
      entry.socket = ws;
    } else {
      if (this.players.size >= MAX_PLAYERS) {
        this.send(ws, { type: 'error', message: 'room_full' });
        try { ws.close(); } catch { /* noop */ }
        return null;
      }
      const playerId = 'p_' + Math.random().toString(36).slice(2, 8);
      const name = `Player ${this.players.size + 1}`;
      entry = {
        playerId,
        name,
        activeCharacterId: null,
        socket: ws,
        hand: [],
        discard: [],
        lost: [],
        active: [],
        activeEffects: [],
        selection: null,
        modifierDeck: [],
        modifierDiscard: [],
        modifierNeedsReshuffle: false,
        shortRestPending: null,
      };
      this.players.set(playerId, entry);
      this.campaign.players.push({ playerId, name, activeCharacterId: null });
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

  startScenario(scenarioId: string): { ok: true } | { ok: false; reason: string } {
    const scenario = getScenario(scenarioId);
    if (!scenario) return { ok: false, reason: 'unknown_scenario' };

    const playerSlots = scenario.spawns.filter((s) => s.side === 'player');
    const enemySlots = scenario.spawns.filter((s) => s.side === 'enemy');
    const readyPlayers = [...this.players.values()].filter((p) => p.activeCharacterId);

    if (readyPlayers.length === 0) {
      return { ok: false, reason: 'no_players_with_characters' };
    }

    this.units = [];
    this.moneyTokens = [];
    this.moneyTokensPlaced = 0;
    this.nextMoneyTokenN = 1;
    // Backfill `gold` on any pre-existing character instances loaded from
    // an older save that predates this field.
    for (const ch of this.campaign.characters) {
      if (typeof ch.gold !== 'number') ch.gold = 0;
    }
    let unitN = 1;

    readyPlayers.forEach((p, i) => {
      const slot = playerSlots[i];
      const charInst = p.activeCharacterId
        ? this.campaign.characters.find((c) => c.id === p.activeCharacterId)
        : null;
      if (!slot || !charInst) return;
      const hp = characterHp(charInst.classId);
      this.units.push({
        id: `u${unitN++}`,
        kind: 'player',
        defId: charInst.classId,
        name: charInst.name,
        hp,
        hpMax: hp,
        shield: 0,
        conditions: [],
        hex: slot.hex,
        ownerPlayerId: p.playerId,
        moneyTokensHeld: 0,
      });
      // Deal starting hand
      p.hand = [...startingHandFor(charInst.classId)];
      p.discard = [];
      p.lost = [];
      p.selection = null;
      // Fresh, shuffled attack-modifier deck.
      p.modifierDeck = createStartingModifierDeck();
      p.modifierDiscard = [];
      p.modifierNeedsReshuffle = false;
    });

    enemySlots.forEach((slot) => {
      if (!slot.monsterId) return;
      const def = MONSTER_DEFS[slot.monsterId as keyof typeof MONSTER_DEFS];
      if (!def) return;
      const stats = def.levels[1]?.normal;
      const hp = stats?.hp ?? 5;
      this.units.push({
        id: `u${unitN++}`,
        kind: 'monster',
        defId: slot.monsterId,
        name: def.name,
        hp,
        hpMax: hp,
        shield: 0,
        conditions: [],
        hex: slot.hex,
      });
    });

    this.campaign.scenarioId = scenario.id;
    this.phase = 'card_select';
    this.round = 1;
    void this.persist();
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

  longRest(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    p.selection = { kind: 'long_rest' };
    this.maybeBeginTurnResolution();
    this.broadcastState();
    return { ok: true };
  }

  private playerDisplayName(p: PlayerEntry): string {
    if (p.activeCharacterId) {
      const charInst = this.campaign.characters.find((c) => c.id === p.activeCharacterId);
      if (charInst) return charInst.name;
    }
    return p.name;
  }

  shortRest(playerId: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== 'card_select') return { ok: false, reason: 'wrong_phase' };
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'no_player' };
    if (p.shortRestPending) return { ok: false, reason: 'already_resting' };
    if (p.discard.length < 2) return { ok: false, reason: 'need_two_in_discard' };
    const idx = Math.floor(Math.random() * p.discard.length);
    const [lost] = p.discard.splice(idx, 1);
    if (!lost) return { ok: false, reason: 'no_player' };
    p.lost.push(lost);
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
      }
    }
    cur.done = true;
    this.currentTurn = null;
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
      // All turns done — round end
      this.phase = 'round_end';
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

    const actions: PendingAction[] = useBasic
      ? basicActions(slot)
      : buildActionQueue(slot === 'top' ? card.top : card.bottom);

    target.status = 'engaged';
    target.cardId = cardId;
    target.useBasic = useBasic;
    target.actions = actions;
    ct.activeSlot = slot;
    this.broadcastState();
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
    this.broadcastState();
    return { ok: true };
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
    target: { hex?: Hex | undefined; unitId?: string | undefined } | undefined,
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

    switch (action.type) {
      case 'move': {
        if (hasCondition(unit, 'immobilize')) return { ok: false, reason: 'immobilized' };
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        if (!target?.hex) return { ok: false, reason: 'need_hex' };
        if (hexEqual(unit.hex, target.hex)) return { ok: false, reason: 'already_there' };
        const moveBonus = activeMoveBonus(guard.p);
        const reachable = this.reachableFrom(unit.hex, action.amount + moveBonus, unit.id);
        const dist = reachable.get(hexKey(target.hex));
        if (dist === undefined) return { ok: false, reason: 'unreachable' };
        unit.hex = target.hex;
        action.done = true;
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
        const dist = hexDistance(unit.hex, tgt.hex);
        if (dist > action.range) return { ok: false, reason: 'out_of_range' };
        if (action.range > 1 && !this.hasLOS(unit.hex, tgt.hex)) {
          return { ok: false, reason: 'no_line_of_sight' };
        }
        const attackKind: 'melee' | 'ranged' = action.range > 1 ? 'ranged' : 'melee';
        const { amount: bonusAmt, pierce: bonusPierce } = consumeAttackBonus(guard.p, attackKind);
        // Reset draw reveal at the start of a fresh attack action (i.e. when
        // this is the first target for this multi-target action).
        if (action.targetsRemaining === action.targets) ct.lastModifierDraws = [];
        const baseAmount = action.amount + bonusAmt;
        const drawn = drawModifier(guard.p);
        const finalAmount = applyModifierToAttack(baseAmount, drawn.card);
        const dmg = applyDamage(tgt, finalAmount, action.pierce + bonusPierce);
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
          `${unit.name} attacks ${tgt.name}: ${baseAmount} ${modifierLabel(drawn.card)} → ${finalAmount} (dealt ${dmg}).`,
        );
        if (tgt.hp <= 0) {
          this.dropMoneyTokenOnDeath(tgt);
          this.units = this.units.filter((u) => u.id !== tgt.id);
          this.pushEvent(`${tgt.name} is exhausted!`);
        }
        action.targetsRemaining -= 1;
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
        const { amount: bonusAmt, pierce: bonusPierce } = consumeAttackBonus(guard.p, 'melee');
        const baseAmount = action.amount + bonusAmt;
        ct.lastModifierDraws = [];
        let hitCount = 0;
        for (const hex of aoeHexes) {
          const tgt = this.units.find((u) => u.kind === 'monster' && hexEqual(u.hex, hex));
          if (!tgt) continue;
          const drawn = drawModifier(guard.p);
          const finalAmount = applyModifierToAttack(baseAmount, drawn.card);
          const dmg = applyDamage(tgt, finalAmount, action.pierce + bonusPierce);
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
            `${unit.name} hits ${tgt.name}: ${baseAmount} ${modifierLabel(drawn.card)} → ${finalAmount} (dealt ${dmg}).`,
          );
          if (tgt.hp <= 0) {
            this.units = this.units.filter((u) => u.id !== tgt.id);
            this.pushEvent(`${tgt.name} is exhausted!`);
          }
          hitCount += 1;
        }
        if (hitCount === 0) this.pushEvent(`${unit.name}'s AOE hits no enemies.`);
        action.done = true;
        break;
      }
      case 'heal': {
        if (hasCondition(unit, 'stun')) return { ok: false, reason: 'stunned' };
        // Self-only for now (matches our schema). Range ignored.
        const before = unit.hp;
        unit.hp = Math.min(unit.hpMax, unit.hp + action.amount);
        this.pushEvent(`${unit.name} heals ${unit.hp - before}.`);
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
        tgt.hex = target.hex;
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
          pierceBonus: action.pierceBonus,
          expires: action.expires,
          ...(action.attackKind ? { attackKind: action.attackKind } : {}),
        });
        this.pushEvent(`${unit.name} gains +${action.amount} attack${action.expires === 'next-attack' ? ' (next)' : ''}.`);
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
      case 'unsupported': {
        // Treat as skipped — not implemented yet.
        action.done = true;
        break;
      }
    }
    if (action.type !== 'unsupported') slot.performedCount += 1;
    this.broadcastState();
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
    this.broadcastState();
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

  private reachableFrom(start: Hex, budget: number, ignoreUnitId: string): Map<string, number> {
    const scenario = this.campaign.scenarioId ? getScenario(this.campaign.scenarioId) : null;
    const tilePassable = new Set<string>();
    if (scenario) {
      for (const t of scenario.tiles) {
        if (t.kind !== 'wall') tilePassable.add(`${t.q},${t.r}`);
      }
    }
    const occupied = new Set<string>();
    for (const u of this.units) {
      if (u.id === ignoreUnitId) continue;
      occupied.add(`${u.hex.q},${u.hex.r}`);
    }
    return bfsReachable(start, budget, (h) => {
      const k = `${h.q},${h.r}`;
      return tilePassable.has(k) && !occupied.has(k);
    });
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
      else if (dest === 'active') p.active.push(card);
      else p.discard.push(card);
    }
  }

  /** Set up `currentTurn` for the actor at activeTurnIndex (player turns only). */
  private openTurn(): void {
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur) {
      this.currentTurn = null;
      return;
    }
    if (cur.kind === 'player') {
      const unit = this.units.find((u) => u.id === cur.unitId);
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
        if (this.activeTurnIndex + 1 < this.turnOrder.length) {
          this.activeTurnIndex += 1;
          this.openTurn();
        } else {
          this.phase = 'round_end';
        }
        return;
      }
      this.currentTurn = {
        unitId: cur.unitId,
        topSlot: unlockedSlot(),
        bottomSlot: unlockedSlot(),
        activeSlot: null,
        lastModifierDraws: [],
      };
    } else {
      this.currentTurn = null;
      // Auto-resolve the monster group's actions and advance.
      this.resolveActiveMonsterGroup();
      cur.done = true;
      // Retaliate during the monster group's turn may have cleared the last
      // monster — wrap up before advancing.
      this.checkScenarioEnd();
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      if (this.activeTurnIndex + 1 < this.turnOrder.length) {
        this.activeTurnIndex += 1;
        this.openTurn();
      } else {
        this.phase = 'round_end';
      }
    }
  }

  private resolveActiveMonsterGroup(): void {
    const cur = this.turnOrder[this.activeTurnIndex];
    if (!cur || cur.kind !== 'monster-group') return;
    const def = MONSTER_DEF_BY_SETID[cur.setId];
    const card = MONSTER_DECKS[cur.setId as keyof typeof MONSTER_DECKS]?.cards.find(
      (c) => c.id === cur.abilityCardId,
    );
    if (!def || !card) return;
    const stat = def.levels[1]?.normal;
    if (!stat) return;

    const enemyInit = new Map<string, number>();
    for (const e of this.turnOrder) {
      if (e.kind === 'player') enemyInit.set(e.unitId, e.initiative);
    }

    const monsters = this.units.filter(
      (u) => u.kind === 'monster' && monsterDefMatchesSet(u.defId, cur.setId),
    );

    const { move, attack } = readAbility(card, stat);
    const range = attack?.range ?? 1;

    for (const m of monsters) {
      // Stun: skip the turn entirely, but still tick conditions.
      if (hasCondition(m, 'stun')) {
        this.pushEvent(`${m.name} is stunned and skips its turn.`);
        const removed = tickConditionsEndOfTurn(m);
        for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
        continue;
      }
      const canMove = move && !hasCondition(m, 'immobilize');
      const canAttack = attack && !hasCondition(m, 'disarm');
      if (hasCondition(m, 'immobilize')) this.pushEvent(`${m.name} is immobilized.`);
      if (hasCondition(m, 'disarm')) this.pushEvent(`${m.name} is disarmed.`);

      // Re-find focus each iteration since previous monsters may have moved/killed.
      const focus = determineFocus(m, range, { tiles: this.scenarioTiles(), units: this.units }, enemyInit);
      if (!focus) {
        this.pushEvent(`${m.name} sees no target.`);
        const removed = tickConditionsEndOfTurn(m);
        for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
        continue;
      }

      // Movement
      if (canMove && move) {
        const dest = walkPath(m.hex, focus.path, move.budget, range, focus.enemy.hex);
        if (!hexEqual(dest, m.hex)) {
          this.pushEvent(
            `${m.name} moves to (${dest.q},${dest.r}) toward ${focus.enemy.name}.`,
          );
          m.hex = dest;
        }
      }

      // Attack — re-check range from final position; focus may be dead from a prior monster.
      const focusUnit = this.units.find((u) => u.id === focus.enemy.id);
      const losOk = focusUnit
        ? range <= 1 || this.hasLOS(m.hex, focusUnit.hex)
        : false;
      if (canAttack && attack && focusUnit && hexDistance(m.hex, focusUnit.hex) <= range && losOk) {
        const dmg = applyDamage(focusUnit, attack.damage, 0);
        this.pushEvent(`${m.name} attacks ${focusUnit.name} for ${dmg}.`);
        if (focusUnit.hp <= 0) {
          this.units = this.units.filter((u) => u.id !== focusUnit.id);
          this.pushEvent(`${focusUnit.name} is exhausted!`);
        } else {
          // Retaliate: if the player target has retaliate active and the monster
          // is within retaliate range, deal back damage to the monster.
          const targetPlayer = focusUnit.ownerPlayerId ? this.players.get(focusUnit.ownerPlayerId) : null;
          if (targetPlayer) {
            const ret = retaliateAgainst(targetPlayer, hexDistance(m.hex, focusUnit.hex));
            if (ret) {
              const back = applyDamage(m, ret.amount, 0);
              this.pushEvent(`${focusUnit.name} retaliates ${m.name} for ${back}.`);
              if (m.hp <= 0) {
                this.dropMoneyTokenOnDeath(m);
                this.units = this.units.filter((u) => u.id !== m.id);
                this.pushEvent(`${m.name} is exhausted!`);
              }
            }
          }
        }
      } else if (canAttack && attack && focusUnit) {
        if (!losOk) {
          this.pushEvent(`${m.name} has no line-of-sight to ${focusUnit.name}.`);
        } else {
          this.pushEvent(`${m.name} cannot reach ${focusUnit.name}.`);
        }
      }

      // End of monster's individual turn — tick its conditions.
      const removed = tickConditionsEndOfTurn(m);
      for (const k of removed) this.pushEvent(`${m.name} is no longer ${k}ed.`);
    }
  }

  private scenarioTiles() {
    const scenario = this.campaign.scenarioId ? getScenario(this.campaign.scenarioId) : null;
    return scenario?.tiles ?? [];
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

  nextRound(): void {
    if (this.phase !== 'round_end') return;
    this.round += 1;
    this.turnOrder = [];
    this.activeTurnIndex = 0;
    for (const p of this.players.values()) p.selection = null;
    // Round-bounded effects expire: clear all unit shields.
    for (const u of this.units) u.shield = 0;
    // Persistent-round cards leave the active area (to discard); 'end-round'
    // active effects expire. Persistent-scenario cards & 'end-scenario' effects stay.
    for (const p of this.players.values()) {
      const stayActive: Card[] = [];
      for (const card of p.active) {
        // We don't track which half kept the card alive; conservative rule for v1:
        // if EITHER half has persistent-scenario disposition, keep it; otherwise discard.
        const isScenario =
          card.top.disposition === 'persistent-scenario' ||
          card.bottom.disposition === 'persistent-scenario';
        if (isScenario) stayActive.push(card);
        else p.discard.push(card);
      }
      p.active = stayActive;
      p.activeEffects = p.activeEffects.filter((e) => e.expires === 'end-scenario');
    }
    this.phase = 'card_select';
    this.broadcastState();
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
      const def = u.defId === 'bandit-archer' ? banditArcher : u.defId === 'bandit-scout' ? banditScout : null;
      if (def) setIds.add(def.setId);
    }
    for (const setId of setIds) {
      const deck = MONSTER_DECKS[setId as keyof typeof MONSTER_DECKS];
      if (!deck) continue;
      // Round 1 just draws the first card. Shuffle/discard pile is step-7+ work.
      const drawn = deck.cards[(this.round - 1) % deck.cards.length];
      if (!drawn) continue;
      order.push({
        kind: 'monster-group',
        setId,
        abilityCardId: drawn.id,
        abilityCardName: drawn.name,
        initiative: drawn.initiative,
        done: false,
      });
    }

    order.sort((a, b) => a.initiative - b.initiative);
    this.turnOrder = order;
    this.activeTurnIndex = 0;
    this.phase = 'turn_resolution';
    // Card selection has finalized — any pending short-rest reroll choice expires.
    for (const p of this.players.values()) p.shortRestPending = null;
    this.openTurn();
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
      gold: 0,
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
      return { ok: false, reason: 'already_claimed' };
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

  publicState(): PublicGameState {
    const scenario = this.campaign.scenarioId ? getScenario(this.campaign.scenarioId) : null;
    return {
      campaignId: this.campaign.id,
      campaignName: this.campaign.name,
      phase: this.phase,
      round: this.round,
      characters: this.campaign.characters,
      scenarioId: this.campaign.scenarioId,
      scenarioName: scenario?.name ?? null,
      tiles: scenario?.tiles ?? [],
      units: this.units,
      moneyTokens: this.moneyTokens,
      moneyTokensPlaced: this.moneyTokensPlaced,
      scenarioLevel: this.scenarioLevel,
      turnOrder: this.turnOrder,
      activeTurnIndex: this.activeTurnIndex,
      currentTurn: this.currentTurn,
      events: this.events,
      players: [...this.players.values()].map((p) => ({
        playerId: p.playerId,
        name: p.name,
        characterId: p.activeCharacterId,
        connected: p.socket !== null,
        submitted: p.selection !== null,
      })),
    };
  }

  /**
   * Drop a money token in the hex where a monster died, unless the 25-token
   * scenario cap has been reached or the dying unit was a summon/spawn/ally.
   * We currently only have plain monsters (no summons/allies modeled), so the
   * exception is a no-op for now — but we still guard against `kind !== 'monster'`.
   * Rule: monster-damage-and-death.md.
   */
  private dropMoneyTokenOnDeath(dead: Unit): void {
    if (dead.kind !== 'monster') return;
    if (this.moneyTokensPlaced >= MONEY_TOKEN_CAP) return;
    this.moneyTokens.push({
      id: `m${this.nextMoneyTokenN++}`,
      hex: { q: dead.hex.q, r: dead.hex.r },
    });
    this.moneyTokensPlaced += 1;
  }

  /**
   * End-of-turn auto-loot: characters MUST loot money tokens in their hex
   * at the end of their turn (mandatory-experience-end-of-turn-looting.md).
   * Removes the token(s) from the map and adds them to the unit's held count.
   */
  private autoLootForUnit(unit: Unit): void {
    if (unit.kind !== 'player') return;
    const here: MoneyToken[] = [];
    const rest: MoneyToken[] = [];
    for (const t of this.moneyTokens) {
      (hexEqual(t.hex, unit.hex) ? here : rest).push(t);
    }
    if (here.length === 0) return;
    this.moneyTokens = rest;
    unit.moneyTokensHeld = (unit.moneyTokensHeld ?? 0) + here.length;
    this.pushEvent(
      `${unit.name} loots ${here.length} money token${here.length === 1 ? '' : 's'} (holding ${unit.moneyTokensHeld}).`,
    );
  }

  /**
   * Check whether all enemies have been defeated. If so, transition to
   * 'victory' and convert each player unit's held money tokens to gold on
   * their CharacterInstance using the scenario-level conversion rate.
   */
  private checkScenarioEnd(): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.phase === 'lobby') return;
    const monstersAlive = this.units.some((u) => u.kind === 'monster');
    if (monstersAlive) return;
    if (this.units.length === 0) return; // not yet set up
    this.endScenario('victory');
  }

  private endScenario(outcome: 'victory' | 'defeat'): void {
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
          activeEffects: p.activeEffects,
          selection: p.selection,
          modifierDeck: p.modifierDeck,
          modifierDiscard: p.modifierDiscard,
          modifierNeedsReshuffle: p.modifierNeedsReshuffle,
          shortRestPending: p.shortRestPending,
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
