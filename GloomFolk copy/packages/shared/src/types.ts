export type Hex = { q: number; r: number };

export type UnitKind = 'player' | 'enemy';

// ─── Conditions ──────────────────────────────────────────────────────────────
// Bless and Curse are NOT tracked here — they go directly into modifier decks.
export type ConditionId =
  | 'wound'        // suffer 1 damage at start of turn; removed when healed
  | 'poison'       // attacks targeting this figure gain +1; removed when healed (heal blocked)
  | 'immobilize'   // cannot perform move abilities; removed end of next turn
  | 'disarm'       // cannot perform attack abilities; removed end of next turn
  | 'stun'         // cannot perform any abilities or use items; removed end of next turn
  | 'muddle'       // disadvantage on all attacks; removed end of next turn
  | 'safeguard'    // next negative condition is prevented; then removed
  | 'ward'         // next damage suffered is halved (rounded down); then removed
  | 'invisible'    // cannot be focused or targeted by enemies; removed end of next turn
  | 'strengthen';  // advantage on all attacks; removed end of next turn

// Conditions removed at end of the figure's next turn
export const END_OF_TURN_CONDITIONS: readonly ConditionId[] = [
  'immobilize', 'disarm', 'stun', 'muddle', 'invisible', 'strengthen',
];

// Conditions that are negative (can be blocked by safeguard)
export const NEGATIVE_CONDITIONS: readonly ConditionId[] = [
  'wound', 'poison', 'immobilize', 'disarm', 'stun', 'muddle',
];

// ─── Elements ─────────────────────────────────────────────────────────────────
export type ElementId = 'fire' | 'ice' | 'air' | 'earth' | 'light' | 'dark';

export type ElementStrength = 'inert' | 'waning' | 'strong';

export type ElementBoard = Record<ElementId, ElementStrength>;

// ─── Attack Modifier Cards ────────────────────────────────────────────────────
export type ModifierValue = number | 'null' | '2x';

export type AttackModifierCard = {
  id: string;
  value: ModifierValue;       // numeric delta, 'null' (miss), or '2x' (double)
  rolling: boolean;           // draw another modifier before resolving
  shuffle: boolean;           // drawing this triggers discard shuffle at round end
  addedEffects: string[];     // e.g. 'fire', 'muddle', '+1target'
  returnToSupply: boolean;    // bless and curse cards return to supply, not discard
};

export type ModifierDeck = {
  drawPile: AttackModifierCard[];
  discardPile: AttackModifierCard[];
  needsShuffleAtRoundEnd: boolean;
};

// ─── Units ────────────────────────────────────────────────────────────────────
export type Unit = {
  id: string;
  kind: UnitKind;
  archetype: string;
  hp: number;
  maxHp: number;
  pos: Hex;
  exhausted: boolean;
  conditions: ConditionId[];  // active conditions
  shieldBonus: number;        // current active shield value (from active bonuses)
  retaliateBonus: number;     // current active retaliate damage
  retaliateRange: number;     // 0 = melee (adjacent) only; > 0 = ranged retaliate
  nextAttackBonus: number;    // round bonus: applies to every hit of the next attack ability this round
};

// ─── Ability Cards ────────────────────────────────────────────────────────────
// AoE pattern: hex offsets relative to the primary target hex (target = {q:0, r:0}).
// Include {q:0, r:0} if the primary target hex itself is hit.
export type AoePattern = { hexes: Hex[] };

// Persistent effects sit on a player and tick down on triggers.
// `lostWhenEmpty: true` → card goes to lost pile; otherwise → discard.
// Some persistents reset their charges each round (e.g. reactive triggers).
export type PersistentEffect =
  | { kind: 'negate-damage'; charges: number; lostWhenEmpty: true }
  | { kind: 'bonus-move'; bonus: number; charges: number; lostWhenEmpty: false }
  | {
      kind: 'react-shield-retaliate';
      // Triggers the first time per round the player gains shield/retaliate from
      // an ability or modifier. Grants +1 shield and +1 retaliate for the round.
      // The card itself stays in play across rounds — `lostWhenEmpty` is true so
      // it routes to lost when explicitly cleared (currently never; lasts forever).
      lostWhenEmpty: true;
    };

export type AbilityAction =
  | {
      kind: 'attack';
      range: number;
      damage: number;
      pierce?: number;             // reduce target shield by this amount for this attack
      push?: number;               // push target X hexes after attack
      pull?: number;               // pull target X hexes after attack
      appliedConditions?: ConditionId[];  // conditions inflicted on target
      aoe?: AoePattern;            // additional hexes hit relative to primary target
      aoeCenter?: 'target' | 'self';  // 'self' = AoE around attacker (no target picked)
      conditionalBonus?: {
        ifMovedThisTurn: {
          damage?: number;                       // bonus damage if condition met
          selfConditions?: ConditionId[];        // conditions gained by ATTACKER if met
        };
      };
      infuses?: ElementId;                       // infuse this element if at least one target was hit
      selfConditionsOnHit?: ConditionId[];       // attacker gains these if at least one target was hit
    }
  | { kind: 'heal'; range: number; amount: number }
  | { kind: 'trample'; damage: number }
  | { kind: 'charge'; range: number }            // move N (from CardHalf.move) in a straight line, then attack target with damage = hexes moved
  | { kind: 'push'; range: number; distance: number }
  | { kind: 'pull'; range: number; distance: number }
  | { kind: 'pull_multi'; range: number; distance: number; targetCount: number }
  | { kind: 'push_all'; range: number; distance: number }  // push every enemy within range, no target picked
  | { kind: 'shield'; value: number }
  | { kind: 'retaliate'; value: number; range?: number }
  | { kind: 'attack_bonus'; value: number }      // round bonus: +value damage to ALL hits of attacker's next attack ability this round
  | { kind: 'persistent'; effect: PersistentEffect }
  | { kind: 'none' };

// One active persistent effect on a player.
export type ActivePersistent = {
  instanceId: string;        // unique per activation
  cardId: string;            // source card; routed to lost or discard when consumed
  effect: PersistentEffect;
  remainingCharges: number;
  triggeredRound?: number;   // for per-round reactive triggers (e.g. react-shield-retaliate)
};

export type CardHalf = {
  move: number;
  // Ordered list of post-move actions performed when this half is used. May be
  // empty for move-only halves. The player chooses interleaving with the move
  // and the other half's components via TurnSteps.
  actions: AbilityAction[];
  lost?: boolean;            // playing this half routes the card to the lost pile (not discard)
  jump?: boolean;            // movement ignores other figures (still requires landing on empty hex)
  infusesOnPlay?: ElementId; // element infused unconditionally when this half is played
};

export type AbilityCard = {
  id: string;
  name: string;
  initiative: number;
  top: CardHalf;
  bottom: CardHalf;
};

// ─── Character / Enemy / Scenario Defs ───────────────────────────────────────
export type CharacterDef = {
  id: string;
  name: string;
  blurb: string;
  maxHp: number;
  cardIds: string[];
};

export type EnemyDef = {
  id: string;
  name: string;
  maxHp: number;
  initiative: number;
  move: number;
  attackRange: number;
  attackDamage: number;
};

export type ScenarioDef = {
  id: string;
  name: string;
  width: number;
  height: number;
  obstacles: Hex[];
  playerSpawns: Hex[];
  enemies: { defId: string; pos: Hex }[];
};

// ─── Player State ─────────────────────────────────────────────────────────────
export type PlayerState = {
  socketId: string;
  name: string;
  characterId: string;
  unitId: string;
  hand: string[];
  discard: string[];
  lost: string[];
  selectedCards: PlayerSelection;
  activePersistents: ActivePersistent[];
  movedThisTurn: boolean;  // reset at start of player turn; set true after a non-zero move resolves
};

// Per-round selection. A player either selects two cards (with one designated leading
// for initiative) or declares a long rest. `submitted` flips true once the player
// confirms the choice and is ready to advance to turn resolution.
export type PlayerSelection = {
  leading: string | null;
  second: string | null;
  longRest: boolean;
  submitted: boolean;
};

// ─── Phase / Game State ───────────────────────────────────────────────────────
export type Phase =
  | 'lobby'
  | 'card_select'
  | 'turn_resolution'
  | 'round_end'
  | 'victory'
  | 'defeat';

export type GameState = {
  phase: Phase;
  round: number;
  turnOrder: string[];
  activeTurn: number;
  units: Record<string, Unit>;
  players: Record<string, PlayerState>;
  obstacles: Hex[];
  scenarioId: string;
  width: number;
  height: number;
  log: string[];
  elementBoard: ElementBoard;
  modifierDecks: {
    monster: ModifierDeck;
    players: Record<string, ModifierDeck>;  // keyed by unit id
  };
  blessSupply: AttackModifierCard[];
  characterCurseSupply: AttackModifierCard[];
  monsterCurseSupply: AttackModifierCard[];
};
