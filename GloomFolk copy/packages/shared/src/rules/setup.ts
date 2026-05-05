import type { GameState, PlayerState, Unit } from '../types.js';
import { CARDS } from '../content/cards.js';
import { CHARACTERS } from '../content/characters.js';
import { ENEMIES } from '../content/enemies.js';
import { SCENARIOS } from '../content/scenarios.js';
import { buildElementBoard, waneElements } from './elements.js';
import {
  buildModifierDeck,
  buildBlessSupply,
  buildCharacterCurseSupply,
  buildMonsterCurseSupply,
  endRoundModifierCleanup,
} from './modifiers.js';
import { clearRoundBonuses } from './combat.js';

function freshUnit(fields: Pick<Unit, 'id' | 'kind' | 'archetype' | 'hp' | 'maxHp' | 'pos'>): Unit {
  return {
    ...fields,
    exhausted: false,
    conditions: [],
    shieldBonus: 0,
    retaliateBonus: 0,
    retaliateRange: 0,
    nextAttackBonus: 0,
  };
}

export function initialState(scenarioId: string): GameState {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`unknown scenario: ${scenarioId}`);
  return {
    phase: 'lobby',
    round: 0,
    turnOrder: [],
    activeTurn: 0,
    units: {},
    players: {},
    obstacles: scenario.obstacles.map((h) => ({ ...h })),
    scenarioId,
    width: scenario.width,
    height: scenario.height,
    log: [],
    elementBoard: buildElementBoard(),
    modifierDecks: {
      monster: buildModifierDeck(),
      players: {},
    },
    blessSupply: buildBlessSupply(),
    characterCurseSupply: buildCharacterCurseSupply(),
    monsterCurseSupply: buildMonsterCurseSupply(),
  };
}

export function spawnEnemies(state: GameState): void {
  const scenario = SCENARIOS[state.scenarioId];
  if (!scenario) return;
  scenario.enemies.forEach((spawn, i) => {
    const def = ENEMIES[spawn.defId];
    if (!def) return;
    const id = `e_${i}`;
    state.units[id] = freshUnit({
      id,
      kind: 'enemy',
      archetype: def.id,
      hp: def.maxHp,
      maxHp: def.maxHp,
      pos: { ...spawn.pos },
    });
  });
}

export function spawnPlayer(
  state: GameState,
  socketId: string,
  name: string,
  characterId: string,
): PlayerState | null {
  const character = CHARACTERS[characterId];
  if (!character) return null;
  const scenario = SCENARIOS[state.scenarioId];
  if (!scenario) return null;

  const usedSpawns = new Set(
    Object.values(state.players).map((p) => {
      const u = state.units[p.unitId];
      return u ? `${u.pos.q},${u.pos.r}` : '';
    }),
  );
  const spawn =
    scenario.playerSpawns.find((s) => !usedSpawns.has(`${s.q},${s.r}`)) ??
    scenario.playerSpawns[0]!;

  const unitId = `p_${socketId}`;
  state.units[unitId] = freshUnit({
    id: unitId,
    kind: 'player',
    archetype: character.id,
    hp: character.maxHp,
    maxHp: character.maxHp,
    pos: { ...spawn },
  });

  // Each player gets their own attack modifier deck.
  state.modifierDecks.players[unitId] = buildModifierDeck();

  const player: PlayerState = {
    socketId,
    name,
    characterId,
    unitId,
    hand: [...character.cardIds],
    discard: [],
    lost: [],
    selectedCards: { leading: null, second: null, longRest: false, submitted: false },
    activePersistents: [],
    movedThisTurn: false,
  };
  state.players[socketId] = player;
  return player;
}

export function startRound(state: GameState): void {
  state.round += 1;
  state.activeTurn = 0;
  state.phase = 'card_select';
  for (const p of Object.values(state.players)) {
    p.selectedCards = { leading: null, second: null, longRest: false, submitted: false };
    // Hand exhaustion: cannot play 2 cards and cannot long rest (long rest needs at
    // least one card in discard to lose, so discard >= 1 means rest is possible).
    const unit = state.units[p.unitId];
    if (!unit || unit.exhausted) continue;
    const canPlay = p.hand.length >= 2;
    const canRest = p.discard.length >= 1;
    if (!canPlay && !canRest) {
      unit.exhausted = true;
      state.log.push(`${unit.archetype} is exhausted (no playable cards)`);
    }
  }
}

// Build turn order: every active unit sorted by initiative ascending.
// Players use their leading card's initiative; long-rest = initiative 99 (acts last).
export function buildTurnOrder(state: GameState): void {
  const entries: { unitId: string; initiative: number; tiebreak: number }[] = [];
  for (const u of Object.values(state.units)) {
    if (u.exhausted) continue;
    if (u.kind === 'player') {
      const player = Object.values(state.players).find((p) => p.unitId === u.id);
      if (!player || !player.selectedCards.submitted) continue;
      const sel = player.selectedCards;
      let initiative: number;
      if (sel.longRest) {
        initiative = 99;
      } else {
        if (!sel.leading) continue;
        const card = CARDS[sel.leading];
        if (!card) continue;
        initiative = card.initiative;
      }
      entries.push({ unitId: u.id, initiative, tiebreak: 0 });
    } else {
      const def = ENEMIES[u.archetype];
      if (!def) continue;
      entries.push({ unitId: u.id, initiative: def.initiative, tiebreak: 1 });
    }
  }
  entries.sort((a, b) => a.initiative - b.initiative || a.tiebreak - b.tiebreak);
  state.turnOrder = entries.map((e) => e.unitId);
  state.phase = 'turn_resolution';
}

export function endRoundCleanup(state: GameState): void {
  // Move both selected cards to discard. Cards already routed elsewhere during
  // play (lost-on-play, persistent activation) have been removed from hand and
  // selectedCards entries cleared, so this only catches cards still in hand.
  for (const p of Object.values(state.players)) {
    for (const slot of ['leading', 'second'] as const) {
      const cardId = p.selectedCards[slot];
      if (cardId && p.hand.includes(cardId)) {
        p.discard.push(cardId);
        p.hand = p.hand.filter((c) => c !== cardId);
      }
    }
    p.selectedCards = { leading: null, second: null, longRest: false, submitted: false };
  }

  // Elements wane one step at end of round.
  waneElements(state);

  // Clear round-based active bonuses (shield, retaliate).
  clearRoundBonuses(state);

  // Shuffle modifier decks that drew a shuffle-icon card this round.
  endRoundModifierCleanup(state.modifierDecks.monster);
  for (const deck of Object.values(state.modifierDecks.players)) {
    endRoundModifierCleanup(deck);
  }

  state.turnOrder = [];
  state.activeTurn = 0;
  state.phase = 'round_end';
}

export function rest(state: GameState, socketId: string): void {
  const player = state.players[socketId];
  if (!player) return;
  player.hand = [...player.hand, ...player.discard];
  player.discard = [];
  const unit = state.units[player.unitId];
  if (unit) {
    unit.hp = Math.max(0, unit.hp - 1);
    if (unit.hp === 0) unit.exhausted = true;
  }
}
