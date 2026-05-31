import type {
  ActiveEffect,
  Card,
  CharacterInstance,
  Hex,
  ModifierCardInstance,
  PersistentTrigger,
  TrackedHalfState,
  Unit,
} from '@gloomfolk/shared';

import { Room, collectTriggerSteps, freshElementBoard } from '../src/room.js';
import type { CampaignSave } from '../src/saves.js';

/** Mirror of the unexported PlayerEntry shape — just the fields tests touch. */
export type PlayerEntry = {
  playerId: string;
  name: string;
  activeCharacterId: string | null;
  socket: null;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  active: Card[];
  activeTracked: TrackedHalfState[];
  activeEffects: ActiveEffect[];
  pendingRetaliateXp: { amount: number; label: string }[];
  selection: null;
  modifierDeck: ModifierCardInstance[];
  modifierDiscard: ModifierCardInstance[];
  modifierNeedsReshuffle: boolean;
  shortRestPending: null;
};

export interface Fixture {
  room: Room;
  player: PlayerEntry;
  character: CharacterInstance;
  unit: Unit;
}

export function makeFixture(opts?: {
  characterId?: string;
  playerId?: string;
  classId?: string;
}): Fixture {
  const characterId = opts?.characterId ?? 'char-1';
  const playerId = opts?.playerId ?? 'p-1';
  const character: CharacterInstance = {
    id: characterId,
    classId: opts?.classId ?? 'bruiser',
    name: 'Test Character',
    level: 1,
    xp: 0,
    perksUnlocked: [],
    pool: [],
    claimedByPlayerId: playerId,
    gold: 0,
    loadout: null,
    shoppingDone: false,
    ownedItemIds: [],
    broughtItemIds: [],
    sessionPurchasedItemIds: [],
    spentItemIds: [],
    activeItems: [],
    battleGoalCheckmarks: 0,
  };
  const campaign: CampaignSave = {
    id: 'test-campaign',
    name: 'Test',
    createdAt: 0,
    updatedAt: 0,
    scenarioId: null,
    characters: [character],
    players: [{ playerId, name: 'Test Player', activeCharacterId: characterId }],
  };
  const room = new Room(campaign);
  // Suppress save-to-disk during tests — Room calls persist() on state
  // changes and we don't want a real ./saves directory ballooning.
  (room as unknown as { persist: () => Promise<void> }).persist = async () => {};

  const player: PlayerEntry = {
    playerId,
    name: 'Test Player',
    activeCharacterId: characterId,
    socket: null,
    hand: [],
    discard: [],
    lost: [],
    active: [],
    activeTracked: [],
    activeEffects: [],
    pendingRetaliateXp: [],
    selection: null,
    modifierDeck: [],
    modifierDiscard: [],
    modifierNeedsReshuffle: false,
    shortRestPending: null,
  };
  // Cast through unknown — Map<string, PlayerEntry> with the real (unexported)
  // PlayerEntry is structurally compatible with ours for the fields we set.
  (room.players as unknown as Map<string, PlayerEntry>).set(playerId, player);

  const unit: Unit = {
    id: 'u-player',
    kind: 'player',
    defId: characterId,
    name: 'Test Character',
    hp: 10,
    hpMax: 10,
    hex: { q: 0, r: 0 },
    shield: 0,
    retaliate: [],
    conditions: [],
    ownerPlayerId: playerId,
  };
  room.units.push(unit);

  return { room, player, character, unit };
}

export function addMonster(
  room: Room,
  opts: { id: string; hex: Hex; shield?: number; hp?: number },
): Unit {
  const m: Unit = {
    id: opts.id,
    kind: 'monster',
    defId: 'archer',
    name: opts.id,
    hp: opts.hp ?? 5,
    hpMax: opts.hp ?? 5,
    hex: opts.hex,
    shield: opts.shield ?? 0,
    retaliate: [],
    conditions: [],
  };
  room.units.push(m);
  return m;
}

/**
 * Attach a persistent-tracked half to the player's active state, mirroring
 * what disposePlayerCards does after the half is performed. We use the real
 * `collectTriggerSteps` from src/room.ts so the trigger payload exactly
 * matches production.
 */
export function attachTracked(player: PlayerEntry, card: Card, which: 'top' | 'bottom'): void {
  const half = which === 'top' ? card.top : card.bottom;
  if (half.disposition !== 'persistent-tracked') {
    throw new Error(`expected persistent-tracked, got ${half.disposition} for ${card.id}.${which}`);
  }
  if (typeof half.trackedUses !== 'number') {
    throw new Error(`${card.id}.${which} missing trackedUses`);
  }
  if (!half.persistentTrigger) {
    throw new Error(`${card.id}.${which} missing persistentTrigger`);
  }
  player.active.push(card);
  player.activeTracked.push({
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

/**
 * Drive the Room into a state where it's `playerId`'s turn — phase set, turn
 * order populated, currentTurn opened. The player's hand is filled with the
 * given cards and a selection is set so disposePlayerCards has something to
 * work with later. Returns helpers for the engaged turn.
 */
export function startTurn(
  room: Room,
  fx: { player: PlayerEntry; unit: Unit },
  cards: { leading: Card; second: Card },
): void {
  fx.player.hand = [cards.leading, cards.second];
  // PlayerEntry.selection is typed as `null` in our test mirror; the real
  // type is CardSelection|null. Force-set via cast so disposePlayerCards has
  // a selection to walk.
  (fx.player as unknown as { selection: { kind: 'cards'; leadingId: string; secondId: string } }).selection = {
    kind: 'cards',
    leadingId: cards.leading.id,
    secondId: cards.second.id,
  };
  // Cast through unknown — the Room internals expect their own (unexported)
  // PlayerEntry/CurrentTurn shapes; ours are structurally compatible.
  const r = room as unknown as {
    phase: string;
    turnOrder: Array<{
      kind: 'player';
      playerId: string;
      unitId: string;
      initiative: number;
      leadingCardId: string | null;
      done: boolean;
    }>;
    activeTurnIndex: number;
    currentTurn: unknown;
  };
  r.phase = 'turn_resolution';
  r.turnOrder = [
    {
      kind: 'player',
      playerId: fx.player.playerId,
      unitId: fx.unit.id,
      initiative: 10,
      leadingCardId: cards.leading.id,
      done: false,
    },
  ];
  r.activeTurnIndex = 0;
  r.currentTurn = {
    unitId: fx.unit.id,
    topSlot: { status: 'unlocked', cardId: null, useBasic: false, actions: [], performedCount: 0 },
    bottomSlot: { status: 'unlocked', cardId: null, useBasic: false, actions: [], performedCount: 0 },
    activeSlot: null,
    lastModifierDraws: [],
    hexesMovedThisTurn: 0,
    damageDealtThisTurn: 0,
    turnStartElementBoard: freshElementBoard(),
    pendingInfusions: [],
    consumedThisTurn: [],
    jumpAllMoves: false,
    pierceCharge: null,
    poisonCharge: null,
    advantageCharge: null,
    performedLostAction: false,
  };
}

/** Reach into Room and invoke the private disposePlayerCards (end-of-turn routing). */
export function disposePlayerCards(room: Room, player: PlayerEntry): void {
  (
    room as unknown as { disposePlayerCards: (p: PlayerEntry) => void }
  ).disposePlayerCards(player);
}

/**
 * Drive a single monster attack against a target unit to completion. Seeds the
 * shared monster modifier deck with a deterministic +0 card so the drawn
 * modifier never misses, then drains the private `resolveMonsterAttackOnTarget`
 * generator. There are no reactive items in the fixture, so the generator never
 * yields an 'await-prompt' — we just run it dry.
 */
export function resolveMonsterAttack(
  room: Room,
  attacker: Unit,
  target: Unit,
  damage: number,
): void {
  const r = room as unknown as {
    monsterModifierDeck: ModifierCardInstance[];
    monsterModifierDiscard: ModifierCardInstance[];
    resolveMonsterAttackOnTarget: (
      m: Unit,
      tgtUnit: Unit,
      attack: { damage: number; effects: readonly unknown[] },
      range: number,
      setId: string,
      abilityCardName: string,
    ) => Generator<unknown, void, unknown>;
  };
  // Deterministic +0 draw — enough copies that disadvantage (two draws) is safe.
  r.monsterModifierDeck = [
    { id: 'mm-0a', card: { kind: 'flat', amount: 0 } },
    { id: 'mm-0b', card: { kind: 'flat', amount: 0 } },
  ];
  r.monsterModifierDiscard = [];
  const gen = r.resolveMonsterAttackOnTarget(
    attacker,
    target,
    { damage, effects: [] },
    1,
    'test-set',
    'Test Attack',
  );
  let step = gen.next();
  while (!step.done) step = gen.next();
}

/** Reach into Room and invoke the private trigger dispatcher. */
export function fireTrigger(
  room: Room,
  player: PlayerEntry,
  kind: PersistentTrigger['kind'],
): { damageNegated: boolean } {
  return (
    room as unknown as {
      fireTrackedTrigger: (
        p: PlayerEntry,
        k: PersistentTrigger['kind'],
      ) => { damageNegated: boolean };
    }
  ).fireTrackedTrigger(player, kind);
}

/** Reach into Room and run the private retaliate denormalization onto units. */
export function syncUnitRetaliate(room: Room): void {
  (room as unknown as { syncUnitRetaliate: () => void }).syncUnitRetaliate();
}

/** Reach into Room and invoke the private XP-award walk for a finished half. */
export function awardHalfXp(
  room: Room,
  player: PlayerEntry,
  card: Card,
  which: 'top' | 'bottom',
): void {
  const half = which === 'top' ? card.top : card.bottom;
  (
    room as unknown as {
      awardHalfXp: (p: PlayerEntry, h: unknown, actions: unknown[], name: string) => void;
    }
  ).awardHalfXp(player, half, [], card.name);
}

/** Reach into Room and advance to the next round (expires round-scoped state). */
export function advanceToNextRound(room: Room): void {
  (room as unknown as { advanceToNextRound: () => void }).advanceToNextRound();
}

/** Reach into Room and invoke the attack-time conditional trigger dispatcher. */
export function fireAttackConditional(
  room: Room,
  player: PlayerEntry,
  attacker: Unit,
  target: Unit,
  attackKind: 'melee' | 'ranged',
): void {
  (
    room as unknown as {
      fireAttackConditionalTriggers: (
        p: PlayerEntry,
        a: Unit,
        t: Unit,
        k: 'melee' | 'ranged',
      ) => void;
    }
  ).fireAttackConditionalTriggers(player, attacker, target, attackKind);
}
