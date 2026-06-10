import type {
  AbilityStep,
  AmountRef,
  Card,
  Element,
  ElementBoardState,
  ElementSelector,
  NegativeCondition,
  PersistentTrigger,
  TargetCondition,
  TargetConditionalBonus,
} from './cards/types.js';
import type { CampaignSheet, FactionId } from './campaign/sheet.js';
import type { MonsterRank } from './monsters/types.js';
import type { Hex } from './hex.js';
import type { ModifierCard, ModifierCardInstance } from './modifiers/index.js';
import type { NarrativeEntry, Scenario, SceneDecoration, Tile } from './scenarios/types.js';

export type Role = 'host' | 'player';

export type UnitKind = 'player' | 'monster';

export interface ConditionInstance {
  kind: NegativeCondition;
  /** True if applied during this figure's own current turn (so it survives the
   * upcoming end-of-turn tick and is cleaned at the end of the *next* turn). */
  appliedThisTurn: boolean;
}

/** One Retaliate band on a Unit: total retaliate `amount` that reaches an
 *  attacker within `range` hexes. Sources sharing a range are summed into one
 *  band. */
export interface RetaliateBand {
  amount: number;
  range: number;
}

export interface Unit {
  id: string;
  kind: UnitKind;
  /** characterId for players, monsterId for monsters */
  defId: string;
  name: string;
  hp: number;
  hpMax: number;
  hex: Hex;
  /** Active Shield value, soaks incoming attack damage. Cleared at round end. */
  shield: number;
  /** Active Retaliate, aggregated into bands by range: amounts that share a
   *  range are summed, and bands are sorted by ascending range. Empty when no
   *  retaliate is active. This is a denormalized view for UI display (status
   *  chips); the source of truth and resolution live on the server's
   *  PlayerEntry.activeEffects. Most retaliate is range 1, so this is usually a
   *  single band, but the shape supports mixed-range sources. */
  retaliate: RetaliateBand[];
  /** Active negative conditions (stun/immobilize/disarm/muddle/etc.). */
  conditions: ConditionInstance[];
  /** Invisible (positive condition). When true, the figure cannot be targeted
   *  by enemy attacks/abilities. Cleared at end of this figure's NEXT turn
   *  (mirrors negative-condition ticking via `invisibleAppliedThisTurn`). */
  invisible?: boolean;
  invisibleAppliedThisTurn?: boolean;
  /** For monsters: the standee number (1..type's standeeCount), drawn at random
   *  on placement and unique per type this scenario. Identifies the figure and
   *  breaks acting-order ties within a rank. Undefined for players and when a
   *  type's standee pool was exhausted at placement. */
  standeeNumber?: number;
  /** For monsters: normal / elite / named. Drives stat block, acting order
   *  (named → elite → normal), and rank-targeting predicates. Undefined for
   *  players. */
  rank?: MonsterRank;
  /** For player units: links to the controlling player. */
  ownerPlayerId?: string;
  /** For player units: money tokens looted during this scenario.
   *  Converted to gold at end-of-scenario. */
  moneyTokensHeld?: number;
}

export interface MoneyToken {
  id: string;
  hex: Hex;
}

export interface CharacterInstance {
  id: string;
  classId: string;
  name: string;
  level: number;
  xp: number;
  perksUnlocked: number[];
  pool: string[];
  claimedByPlayerId: string | null;
  /** Persistent gold held by the character across scenarios. Earned by
   *  looting money tokens in-scenario and converting them at end-of-scenario
   *  using the scenario-level gold-conversion rate. */
  gold: number;
  /** Chosen scenario loadout: which `class.handSize` cards from `pool` the
   *  player is taking into the next scenario. Null until the player locks
   *  one in; the server falls back to the class's default loadout. */
  loadout: string[] | null;
  /** True once the player has finished their pre-scenario shopping trip and
   *  tapped "Done shopping" to ready up. The host can't start the scenario
   *  until every claimed character is both loadout-locked and shoppingDone.
   *  A brand-new character starts false; returning characters keep their
   *  prior value (like `loadout`, this persists across scenarios). */
  shoppingDone: boolean;
  /** Items the character owns (purchased or looted). Persistent across scenarios. */
  ownedItemIds: string[];
  /** Items the character is bringing into the next scenario. Subset of
   *  ownedItemIds; must satisfy slot limits. Persistent across scenarios. */
  broughtItemIds: string[];
  /** Items bought during the current pre-scenario shopping session. Purchases
   *  here can be undone (refund gold, restock) until the scenario starts, at
   *  which point this clears — items bought on a previous shopping trip are no
   *  longer undoable. */
  sessionPurchasedItemIds: string[];
  /** Items that have been used this scenario. Cleared when a new scenario
   *  starts. Long-rest recovery not yet implemented. */
  spentItemIds: string[];
  /** Persistent active-area items in effect this scenario, with uses left
   *  (e.g. Hide Armor's shield charges). Cleared when a new scenario starts;
   *  an entry drops off once its uses hit 0 (and the item becomes spent). */
  activeItems: { itemId: string; usesRemaining: number }[];
  /** Lifetime battle-goal checkmarks earned across all scenarios. Every three
   *  grant one extra perk mark (capped at +6 perk marks / 18 checkmarks). */
  battleGoalCheckmarks: number;
}

/** A single entry in the campaign's shop: which item and how many remain. */
export interface ShopEntry {
  itemId: string;
  remaining: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scenarioId: string | null;
  characterNames: string[];
}

/** A character's secret battle-goal hand for the current scenario: the three
 *  dealt cards and which one they kept. Lives in PrivatePlayerState — only the
 *  owner sees it during the scenario. */
export interface BattleGoalHand {
  dealtGoalIds: string[];
  chosenGoalId: string | null;
  /** Live status of the chosen goal, recomputed from the in-progress event log
   *  each broadcast (null until one is chosen):
   *   - 'achieved' — currently satisfied (would score if the scenario ended now)
   *   - 'failed'   — was satisfiable at the start but has been broken (a "never…"
   *                  goal you've violated); can no longer be met
   *   - 'pending'  — not yet met but still achievable
   *  Server-derived; not persisted. */
  chosenGoalStatus?: 'achieved' | 'failed' | 'pending' | null;
}

/** A revealed battle-goal outcome at scenario end. Public (goals are no longer
 *  secret once the scenario is over). */
export interface BattleGoalScenarioResult {
  characterId: string;
  goalId: string;
  title: string;
  description: string;
  achieved: boolean;
  /** Checkmarks awarded — 0 if not achieved or the scenario was lost. */
  checkmarks: number;
}

export interface LobbyPlayer {
  playerId: string;
  name: string;
  characterId: string | null;
  connected: boolean;
  /** True if this player has locked in a card selection (or long rest) for the current round. */
  submitted: boolean;
  /** During the `placement` phase: true once this player has placed their
   *  figure on a starting hex and tapped Ready. The host can't begin the
   *  scenario until every connected character-player is placed and ready. */
  placementReady: boolean;
}

export type CardSelection =
  | { kind: 'cards'; leadingId: string; secondId: string }
  | { kind: 'long_rest' };

export type TurnOrderEntry =
  | {
      kind: 'player';
      playerId: string;
      unitId: string;
      initiative: number;
      /** null when the player chose Long Rest (initiative 99). */
      leadingCardId: string | null;
      done: boolean;
    }
  | {
      kind: 'monster-group';
      /** Stat-card setId, e.g. 'archer' / 'scout'. All monsters of this set act together. */
      setId: string;
      /** The drawn ability card for this round. */
      abilityCardId: string;
      abilityCardName: string;
      initiative: number;
      done: boolean;
    };

/** A tile's background artwork plus where it sits on the board, so any client
 *  can paint the same image the builder shows behind the hex grid. Sent with a
 *  custom (builder-authored) scenario and echoed back in PublicGameState. */
export interface PlacedTileArt {
  /** Map-tile side id, e.g. "G04-C" (matches the tile's `room`). */
  tileSideId: string;
  /** Placement origin in axial coords. */
  origin: Hex;
  /** Placement rotation in 60° steps (0–5). */
  rotation: number;
  /** Compressed image data URL of the artwork. */
  dataUrl: string;
  /** How the image is panned / scaled / rotated inside the footprint box. */
  transform: { offsetX: number; offsetY: number; scale: number; rotation: number };
}

export interface PublicGameState {
  campaignId: string;
  campaignName: string;
  phase: 'lobby' | 'placement' | 'card_select' | 'turn_resolution' | 'victory' | 'defeat';
  round: number;
  characters: CharacterInstance[];
  players: LobbyPlayer[];
  scenarioId: string | null;
  scenarioName: string | null;
  /** The active scenario's victory condition / objective, shown to players.
   *  Synced from the scenario so it works for builder-authored scenarios too. */
  scenarioObjective?: string;
  tiles: Tile[];
  /** Background artwork for builder-authored scenarios, keyed implicitly by the
   *  tile's `room`. Empty/absent for the hand-written campaign scenarios. */
  tileArt?: PlacedTileArt[];
  /** Purely-visual decorative props (logs, scenery) for the current scenario,
   *  filtered to revealed rooms. Absent when the scenario has none. */
  decorations?: SceneDecoration[];
  units: Unit[];
  /** Money tokens dropped on the map by monster deaths, awaiting pickup. */
  moneyTokens: MoneyToken[];
  /** Lifetime money-token placement count for the scenario. Caps at 25 —
   *  see rulebook: once 25 have been placed, no more are dropped. */
  moneyTokensPlaced: number;
  /** Scenario level, 0–7. Drives monster stats, trap/hazard damage,
   *  gold conversion rate, and bonus XP. Defaults to 0 for now. */
  scenarioLevel: number;
  turnOrder: TurnOrderEntry[];
  activeTurnIndex: number;
  /** Campaign-wide shop stock. Decrements when a character buys an item. */
  shop: ShopEntry[];
  /** The campaign sheet: faction reputation, inspiration, prosperity, Great
   *  Oak / imbuement tracks, retirements, unlocked classes. Host-adjusted. */
  sheet: CampaignSheet;
  /** The six-element board state. Each element is `strong`, `waning`, or
   *  `inert`. End-of-round wanes every element one column left; end-of-turn
   *  pending infusions land in `strong`; consumption pushes to `inert`. */
  elementBoard: ElementBoardState;
  /** An outstanding party/actor decision blocking turn flow — e.g. a
   *  wild/mixed element selector that needs a concrete element picked
   *  before infusion or consumption can resolve. */
  pendingElementChoice: PendingElementChoice | null;
  /** An outstanding spring-or-bypass decision for a trap the active unit just
   *  entered during a move (cards with `mayBypassTraps`). Blocks turn flow
   *  until resolved via `player_resolve_trap_choice`. */
  pendingTrapChoice: PendingTrapChoice | null;
  /** A reactive item prompt blocking an in-progress monster attack — the
   *  target may spend it (e.g. Leather Armor) before the modifier is drawn.
   *  The monster animation is paused while this is set. */
  pendingReactiveItem: PendingReactiveItem | null;
  /** Live state for the current actor's turn. Null between turns / outside turn_resolution. */
  currentTurn: CurrentTurn | null;
  /** Most recent narration events (oldest first). Capped server-side. */
  events: GameEvent[];
  /** Most recent unit slide. Clients animate the token along `path` (which
   *  includes the starting hex as path[0] and the destination as the last
   *  entry) once per new `id`. Null until the first move of the session. */
  lastMove: MoveAnimation | null;
  /** Live preview of the active player's chosen push/pull destination. The
   *  desktop renders the path so the party can plan together; the player
   *  can re-tap to re-stage. Cleared when the action resolves, the player
   *  picks a different action, or the turn ends. */
  pendingForcedMove: PendingForcedMove | null;
  /** Shared monster attack-modifier deck — cards still face-down. All monsters
   *  draw from this single deck. Order is the draw order (index 0 = next). */
  monsterModifierDeck: ModifierCardInstance[];
  /** Cards drawn from the monster deck since the last reshuffle. */
  monsterModifierDiscard: ModifierCardInstance[];
  /** True if a Null or ×2 was drawn from the monster deck this round —
   *  reshuffles at end of round. */
  monsterModifierNeedsReshuffle: boolean;
  /** Step-by-step animation state for the currently-resolving monster group
   *  turn. Null when no monster turn is in progress. Clients use this to
   *  spotlight the acting monster, draw an arrow to its target, and show
   *  the modifier card it drew. */
  monsterTurnAnim: MonsterTurnAnim | null;
  /** Revealed battle-goal outcomes, populated only once the scenario ends
   *  (victory or defeat). Null/empty during play, since goals are secret. */
  battleGoalResults: BattleGoalScenarioResult[] | null;
  /** Story text currently demanding the players' attention (scenario intro,
   *  a door's section text, victory text). Shown as a modal on each player's
   *  screen (not the host). Every player dismisses their own copy
   *  (`PrivatePlayerState.narrativeDismissed`); the block only advances to the
   *  next once all connected players have. Null when nothing is queued. */
  narrative: NarrativeEntry | null;
  /** Doors the party can open right now (unlock condition met, not yet opened,
   *  and their near room is visible). Drives the "Open door" affordance. */
  openableDoors: OpenableDoor[];
  /** Visible, unopened doors on the map (with their token numbers), so the
   *  board can draw a door icon + numbered token on each. */
  doors: DoorView[];
  /** Available starting hexes for the `placement` phase — every player-start
   *  overlay in the revealed starting room. Players each claim a distinct one
   *  before play begins. Empty outside the placement phase. Occupancy is
   *  derived from player units' hexes. */
  startingPositions: Hex[];
}

/** A door the party may currently open. */
export interface OpenableDoor {
  id: string;
  hex: Hex;
}

/** A visible, not-yet-opened door on the map — drives the door icon + numbered
 *  token the board draws on its hex. A player opens it by moving onto the hex
 *  once `openable` is true. */
export interface DoorView {
  id: string;
  hex: Hex;
  /** 1-based token number shown on the door (①, ②, …). */
  number: number;
  /** True once its unlock condition is met (e.g. its room is cleared) — the
   *  board highlights it to invite a player to step onto it. */
  openable: boolean;
}

/** Per-step view-state for the currently-resolving monster group turn.
 *  The server advances `phase` on a fixed cadence (default ~800ms/step)
 *  and rebroadcasts after each transition. */
/**
 * Both attack-modifier cards revealed by a two-card draw (Advantage or
 * Disadvantage). The parent's `card` field is the one actually used; this lets
 * the UI show both cards being pulled and highlight the winner.
 */
export interface AdvantageDraw {
  /** 'advantage' keeps the better result, 'disadvantage' the worse. */
  mode: 'advantage' | 'disadvantage';
  /** The two cards in draw order. Length 2. */
  cards: readonly ModifierCard[];
  /** Index into `cards` of the one actually used (0 = first, 1 = second). */
  usedIndex: number;
}

export interface MonsterTurnAnim {
  setId: string;
  abilityCardName: string;
  /** The monster currently taking its action. Null between members or before
   *  the first one starts. */
  activeMonsterId: string | null;
  /** The unit the active monster is focusing on (player). Null when no
   *  valid focus exists this turn. */
  targetUnitId: string | null;
  /** Current visible step within the active monster's mini-turn. */
  phase: 'focus' | 'move' | 'modifier-draw' | 'damage' | 'idle';
  /** Modifier card revealed by the active monster's attack. Set when the
   *  attack-draw phase begins; cleared when the monster's turn ends. */
  modifierDraw: {
    card: ModifierCard;
    baseAmount: number;
    finalAmount: number;
    /** Damage actually dealt after shield/pierce. Null during the flip
     *  reveal step (before damage is applied) and set during 'damage'. */
    damageDealt: number | null;
    targetUnitId: string;
    targetName: string;
    /** Present when this attack was drawn with Disadvantage (two cards, worse
     *  result used) — e.g. the target spent Leather Armor. Carries both cards
     *  so the UI can show the pull. */
    advantageDraw?: AdvantageDraw;
  } | null;
}

/**
 * A reactive item the target may spend in response to an incoming attack,
 * resolved before the attack modifier is drawn. The monster turn pauses while
 * this is set; the owning player answers spend/decline and the turn resumes.
 */
export interface PendingReactiveItem {
  playerId: string;
  itemId: string;
  attackerName: string;
  targetUnitId: string;
  /** Free-text prompt shown to the player. */
  prompt: string;
}

export interface PendingForcedMove {
  playerId: string;
  targetUnitId: string;
  /** Path from the target's current hex to the destination, excluding the
   *  starting hex. Length equals the number of steps the target will slide. */
  path: Hex[];
  direction: 'push' | 'pull';
}

export interface MoveAnimation {
  id: number;
  unitId: string;
  path: Hex[];
}

/**
 * An outstanding wild/mixed element selector that must be resolved before
 * turn flow can continue. Owner is whichever screen should display the
 * prompt; for monster sets the rulebook says "party decides", so we route
 * to the host.
 */
export interface PendingElementChoice {
  id: string;
  context:
    | { kind: 'create-element'; playerId: string }
    /** Player opted into a wild rider on an attack. */
    | { kind: 'consume-rider'; playerId: string }
    | { kind: 'monster-infuse'; setId: string }
    | { kind: 'monster-consume'; setId: string };
  /** Options the chooser may pick from. */
  options: readonly Element[];
  /** Free-text hint to show in the UI ("Whirlwind: pick an element to infuse"). */
  prompt: string;
}

/**
 * An outstanding "you may choose not to spring this trap" decision. Raised when
 * the active unit enters a trap hex during a move ability that allows bypassing.
 * The player answers spring (take the damage, remove the trap) or bypass (leave
 * the trap; the hex becomes eligible for a later destroy-trap).
 */
export interface PendingTrapChoice {
  id: string;
  /** The unit standing on / having entered the trap. */
  unitId: string;
  /** The trap hex being decided. */
  hex: Hex;
  /** Free-text hint for the UI. */
  prompt: string;
}

/**
 * One offered consume on the current attack action — surfaces an opt-in
 * button on the player's UI. The player chooses to apply or skip; chosen
 * consumes mark elements inert and apply the rider's bonuses to the
 * outgoing attack.
 */
export interface AttackConsumeOffer {
  riderIndex: number;
  /** Concrete elements that will be consumed if the player opts in. For
   *  the common single-element rider this is one entry; for an `all`
   *  bundle, multiple. */
  consumes: readonly Element[];
  attackBonus: number;
  pierceBonus: number;
  gainExp: number;
}

export interface GameEvent {
  id: number;
  text: string;
}

/**
 * A single resolvable action extracted from a card half (or basic substitution).
 * The player performs each action in the queue (or skips it). Some actions
 * need a target; others apply immediately on perform.
 */
export type PendingAction =
  | {
      id: string;
      type: 'move';
      amount: number;
      /** When set, the printed step uses "X"; `amount` is re-resolved live from
       *  this ref so the player sees the current value as the turn progresses. */
      amountRef?: AmountRef;
      /** Move has the Jump trait: enemies in pass-through hexes are ignored
       *  (walls still block; the destination hex must be empty). */
      jump?: boolean;
      /** Move may bypass traps: the player is prompted per entered trap hex
       *  whether to spring it. Without this, entered traps spring automatically. */
      mayBypassTraps?: boolean;
      done: boolean;
    }
  | {
      id: string;
      type: 'attack';
      amount: number;
      /** See PendingAction.move.amountRef. */
      amountRef?: AmountRef;
      range: number;
      pierce: number;
      /** Number of distinct targets this attack may hit (multi-target ranged). */
      targets: number;
      /** Targets still to pick. Decremented each time the player names one. */
      targetsRemaining: number;
      /** Number of enemies actually hit by this attack so far. Drives
       *  per-enemy-targeted XP triggers (whirlwind, trample, etc.). */
      hitsLanded: number;
      /** Ids of enemies already hit by this multi-target attack. Each shot of
       *  a `Target N` ability must land on a distinct enemy, so these are
       *  excluded from the remaining shots' valid targets. */
      hitTargetIds: readonly string[];
      /** Element-rider opt-ins the player may toggle before targeting.
       *  Empty when the printed step has no riders, or all rider elements
       *  are unavailable / already consumed this turn. Locked once the
       *  first sub-target is named (`consumesLocked`). */
      consumeOffers: readonly AttackConsumeOffer[];
      /** Indices into `consumeOffers` the player has elected to apply.
       *  Resolved into element-inert marks + attack bonuses the moment
       *  the first sub-target is named. */
      acceptedConsumeIndices: readonly number[];
      /** Final attack/pierce contribution from accepted consume offers,
       *  locked in when the first sub-target is named. Applies to every
       *  subsequent sub-target of this attack ability. */
      lockedRiderAttack: number;
      lockedRiderPierce: number;
      consumesLocked: boolean;
      /** Negative conditions printed below this attack with no target of their
       *  own ("ride on the prior attack"). Applied automatically to each enemy
       *  the attack hits — no separate targeting step. */
      riderConditions?: readonly NegativeCondition[];
      /** Printed per-target bonuses gated on a condition of the enemy hit
       *  (isolated / undamaged / adjacent-to-your-ally). Evaluated per target at
       *  resolution; non-matching targets get nothing. */
      targetConditionalBonuses?: readonly TargetConditionalBonus[];
      /** Net attack-modifier draw mode the server has precomputed for each enemy
       *  this attack could hit, keyed by target unit id. Only non-normal entries
       *  are present — a missing id means a plain single draw. Lets the client
       *  preview the real Advantage/Disadvantage of a staged target without
       *  re-deriving the rules (single source of truth on the server). */
      drawModeByTargetId?: Readonly<Record<string, 'advantage' | 'disadvantage'>>;
      /** The deterministic attack value (before the modifier-card draw) and total
       *  Pierce the server has precomputed for each enemy this attack could hit,
       *  keyed by target unit id. Folds in every target-dependent bonus —
       *  persistent "+X vs isolated" effects (Single Out), printed conditional
       *  bonuses, poison, item charges — so the target bar shows the real numbers
       *  before Confirm. A missing id falls back to the printed value. `bonuses`
       *  lists the attack-value boosts beyond the printed amount (persistent
       *  cards by name, printed conditional bonuses by condition) so the bar can
       *  show a pill explaining *why* the number is what it is. */
      previewByTargetId?: Readonly<
        Record<
          string,
          { damage: number; pierce: number; bonuses: { label: string; amount: number }[] }
        >
      >;
      done: boolean;
    }
  | {
      id: string;
      type: 'attack-aoe';
      amount: number;
      /** See PendingAction.move.amountRef. */
      amountRef?: AmountRef;
      pierce: number;
      /** Hex offsets relative to the actor. pattern[0] is the rotation anchor. */
      pattern: Hex[];
      /** Enemies actually hit by the AOE. */
      hitsLanded: number;
      consumeOffers: readonly AttackConsumeOffer[];
      acceptedConsumeIndices: readonly number[];
      lockedRiderAttack: number;
      lockedRiderPierce: number;
      consumesLocked: boolean;
      /** See PendingAction.attack.riderConditions. Applied to every enemy the
       *  AOE hits. */
      riderConditions?: readonly NegativeCondition[];
      /** See PendingAction.attack.targetConditionalBonuses. Evaluated per enemy
       *  the AOE hits. */
      targetConditionalBonuses?: readonly TargetConditionalBonus[];
      done: boolean;
    }
  | { id: string; type: 'heal'; amount: number; range: number; selfOnly: boolean; done: boolean }
  | { id: string; type: 'shield'; amount: number; done: boolean }
  | {
      id: string;
      type: 'loot';
      /** Pick up money tokens in your hex and all hexes within `range`. */
      range: number;
      done: boolean;
    }
  | { id: string; type: 'push'; amount: number; range: number; done: boolean }
  | { id: string; type: 'pull'; amount: number; range: number; done: boolean }
  | {
      id: string;
      type: 'apply-condition';
      condition: NegativeCondition;
      range: number;
      done: boolean;
    }
  | { id: string; type: 'become-invisible'; done: boolean }
  | {
      id: string;
      /** Arm a persistent negate (Trickster's Reversal bottom): the next damage
       *  the owner would suffer within `expires` is negated. */
      type: 'negate-damage';
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | {
      id: string;
      type: 'modify-future-move';
      amount: number;
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | {
      id: string;
      type: 'modify-future-attack';
      amount: number;
      /** When set, the bonus value is a turn-state reference resolved at attack
       *  time (e.g. Trickster's Reversal: X+2 where X is the target's Shield).
       *  Added on top of the flat `amount`. */
      amountRef?: AmountRef;
      /** When true, the bonus only applies while the attacker is Invisible
       *  (Smoke Bomb: "your next attack while you have Invisible"). */
      requiresInvisible?: boolean;
      pierceBonus: number;
      /** When true, the attack value is doubled before flat `amount` bonus
       *  is added. See cards/types.ts modify-future-attack.doubleAttack. */
      doubleAttack?: boolean;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
      /** When set, the bonus only applies to attacks against an enemy that
       *  satisfies this condition (e.g. Single Out's +3 vs isolated targets). */
      targetCondition?: TargetCondition;
      done: boolean;
    }
  | {
      id: string;
      type: 'grant-retaliate';
      amount: number;
      range: number;
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | {
      id: string;
      type: 'destroy-trap';
      /** XP granted when a trap is destroyed (0 if the card prints none). */
      gainExp: number;
      /** Trap hexes the actor entered (and bypassed) during this turn's move
       *  ability that still hold a trap — the hexes the player may tap to
       *  destroy. Recomputed on each broadcast; empty = nothing to destroy
       *  (the step may be skipped). */
      eligibleHexes: Hex[];
      done: boolean;
    }
  | { id: string; type: 'unsupported'; description: string; done: boolean };

/** A persistent self-effect granted by a performed half. */
export type ActiveEffect =
  | {
      id: string;
      sourceCardId: string;
      kind: 'move-bonus';
      amount: number;
      expires: 'end-round' | 'end-scenario';
    }
  | {
      id: string;
      sourceCardId: string;
      kind: 'attack-bonus';
      amount: number;
      /** Turn-state reference for the bonus value, resolved per target at attack
       *  time and added on top of `amount`. A `target-shield-value` ref only
       *  applies against a target that actually has Shield (Trickster's
       *  Reversal). */
      amountRef?: AmountRef;
      /** When true, the bonus only applies while the attacker is Invisible
       *  (Smoke Bomb). The effect is left unconsumed by attacks made without
       *  Invisible. */
      requiresInvisible?: boolean;
      pierceBonus: number;
      /** When true, the attack value is doubled before flat `amount` is added.
       *  Stacks via OR across all matching attack-bonus effects on a single
       *  attack — one doubling flag doubles, more doublings don't multi-double. */
      doubleAttack?: boolean;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
      /** When set, the bonus only applies to attacks against an enemy that
       *  satisfies this condition. Evaluated per target at attack time; the
       *  effect is not consumed by attacks against non-matching targets. */
      targetCondition?: TargetCondition;
    }
  | {
      id: string;
      sourceCardId: string;
      kind: 'retaliate';
      amount: number;
      range: number;
      expires: 'end-round' | 'end-scenario';
    }
  | {
      id: string;
      sourceCardId: string;
      /** Armed by a persistent negate-damage half (Trickster's Reversal bottom).
       *  Consumed by the next source of damage the owner would suffer, zeroing
       *  it. Expires unused at the scope bound. */
      kind: 'negate-next-damage';
      expires: 'end-round' | 'end-scenario';
    };

/**
 * One of the two action slots a player must fill on their turn — top or bottom.
 * - 'unlocked': no card committed yet
 * - 'engaged': a card is committed; player performs/skips actions in `actions`
 * - 'done': committed and all actions resolved (or slot was skipped)
 */
export interface HalfSlot {
  status: 'unlocked' | 'engaged' | 'done';
  /** Committed card id (one of the two selected cards). null while unlocked. */
  cardId: string | null;
  /** True if the basic action (Attack 2 / Move 2) was substituted for the printed half. */
  useBasic: boolean;
  /** Action queue. Empty when unlocked. */
  actions: PendingAction[];
  /** Count of actions actually performed (excluding skipped/unsupported).
   *  Drives whether persistent halves enter the active area on disposition. */
  performedCount: number;
}

/**
 * One revealed attack-modifier card from a player's deck. Emitted per attack
 * (per target on multi-target / AOE attacks). Cleared at the start of the
 * next attack action and at end-of-turn.
 */
export interface ModifierDrawResult {
  /** Stable id for this draw event (animation key). */
  id: string;
  card: ModifierCard;
  targetUnitId: string;
  targetName: string;
  /** Attack value before the modifier was applied (incl. active-effect bonuses). */
  baseAmount: number;
  /** Final attack value after the modifier (before shield/pierce). */
  finalAmount: number;
  /** Damage actually dealt after shield/pierce. */
  damageDealt: number;
  /** Present when this attack drew with Advantage (two cards, better result
   *  used) — e.g. Simple Bow. Carries both cards so the UI can show the pull. */
  advantageDraw?: AdvantageDraw;
}

export interface CurrentTurn {
  unitId: string;
  topSlot: HalfSlot;
  bottomSlot: HalfSlot;
  /** Slot the player is currently performing, if any. */
  activeSlot: 'top' | 'bottom' | null;
  /**
   * Modifier draws revealed by the most recent attack action. Replaced on the
   * next attack and cleared between turns. Used by the client to animate the
   * card flip(s).
   */
  lastModifierDraws: ModifierDrawResult[];
  /** Total hex distance this unit has moved during this turn (sum of all
   *  Move ability distances actually traveled). Drives "Attack X" / "Move X"
   *  cards where X = hexes moved this turn. */
  hexesMovedThisTurn: number;
  /** Trap hexes the unit entered during its most recent move ability and chose
   *  to bypass (so the trap is still on the board). These are the hexes a
   *  `destroy-trap` step may target. Reset at the start of each move action. */
  trapHexesEnteredThisMove: Hex[];
  /** Total damage actually dealt by this unit's attacks this turn (after
   *  modifier card, shield, pierce). Drives cards where X = damage dealt
   *  this turn (e.g. Balanced Measure bottom: Move X). */
  damageDealtThisTurn: number;
  /** Element board snapshot at turn-start. Consume eligibility ("strong or
   *  waning at start of turn") is evaluated against this, not live state. */
  turnStartElementBoard: ElementBoardState;
  /** Concrete elements this actor has queued for infusion at end-of-turn
   *  (from create-element steps). Wild/mixed resolved through
   *  pendingElementChoice before landing here. */
  pendingInfusions: readonly Element[];
  /** Elements consumed during this turn. Same-element-once-per-turn rule
   *  prevents a second consume. */
  consumedThisTurn: readonly Element[];
  /** True when a used item (e.g. Winged Shoes) has granted Jump to all of
   *  this turn's move abilities. Applied to move actions as they are built. */
  jumpAllMoves: boolean;
  /** Armed when a used item (e.g. Scouting Lens) grants Pierce to the next
   *  attack you perform this turn. Rides along with whatever target that
   *  attack hits; cleared once it's applied to a resolving attack. */
  pierceCharge: { amount: number } | null;
  /** Armed when a used item (e.g. Poison Dagger) grants Poison to the next
   *  melee attack you perform this turn. Cleared once that attack resolves. */
  poisonCharge: boolean;
  /** Armed when a used item (e.g. Simple Bow) grants Advantage to the next
   *  ranged attack you perform this turn. Cleared once that attack resolves. */
  advantageCharge: boolean;
  /** True once this turn the actor has performed an action from a card half
   *  with the Lost disposition. Gates items like Focusing Rod. */
  performedLostAction: boolean;
}

/**
 * Per-card state for a persistent-tracked half currently in the active area.
 * The card lives in `PrivatePlayerState.active`; this state is the parallel
 * use-slot bookkeeping (current slot, expiry destination, trigger).
 */
export interface TrackedHalfState {
  cardId: string;
  halfKind: 'top' | 'bottom';
  /** Current slot the use-token occupies, 1..trackedUses. Starts at 1. */
  currentSlot: number;
  trackedUses: number;
  persistentTrigger: PersistentTrigger;
  /** Snapshot of the half's `useSlotExp` (may be shorter than trackedUses). */
  useSlotExp: readonly (number | null)[];
  /** Where the card goes when its slots are exhausted. */
  finalPile: 'lost' | 'discard';
  /** Steps deferred from the half's active-bonus abilities (everything except
   *  oneShot abilities and sticky modify-future-* bonuses). These re-fire on
   *  each persistent trigger via fireTrackedTrigger. */
  triggerSteps: readonly AbilityStep[];
}

export interface PrivatePlayerState {
  playerId: string;
  hand: Card[];
  discard: Card[];
  lost: Card[];
  /** Cards in your active area (performed persistent halves still in effect). */
  active: Card[];
  /** Slot-bookkeeping for persistent-tracked halves currently in `active`.
   *  One entry per persistent-tracked card+half. */
  activeTracked: TrackedHalfState[];
  /** Live persistent effects granted by performed actions. */
  activeEffects: ActiveEffect[];
  selection: CardSelection | null;
  /** Cards still face-down in the attack-modifier deck. Order is the draw order
   *  (index 0 = next to be drawn). */
  modifierDeck: ModifierCardInstance[];
  /** Cards already drawn this round (or since last reshuffle). */
  modifierDiscard: ModifierCardInstance[];
  /** True if a Null or ×2 has been drawn this turn — deck reshuffles at end of turn. */
  modifierNeedsReshuffle: boolean;
  /** After a short rest, the lost-card pick can optionally be rerolled once for
   *  the cost of 1 damage. `rerollableCardIds` lists the cards that were just
   *  returned from discard to hand and are eligible to be lost instead. */
  shortRestPending?: { lostCardId: string; rerollableCardIds: readonly string[] } | null;
  /** Active long-rest turn. Set when the player's init-99 turn opens; cleared
   *  when they finish. `step` walks the player through the rulebook flow:
   *  pick a card to lose, then optionally heal / recover items, then finish.
   *  `candidateCardIds` is the effective-discard pool (discard ∪ qualifying
   *  active cards) eligible to be the lost card. */
  longRestPending?: {
    step: 'choose_lost' | 'choose_optional';
    candidateCardIds: readonly string[];
    healUsed: boolean;
  } | null;
  /** This player's secret battle-goal hand for the current scenario (dealt
   *  three, kept one). Null in the lobby / before a scenario deals them. */
  battleGoal?: BattleGoalHand | null;
  /** True once this player has dismissed the current narrative block (see
   *  `PublicGameState.narrative`). Each player dismisses their own copy; the
   *  shared block only advances once everyone has. Drives whether to keep
   *  showing the story modal on this player's screen. */
  narrativeDismissed: boolean;
}

export type ClientToServer =
  | { type: 'host_hello' }
  | { type: 'host_list_campaigns' }
  | { type: 'host_create_campaign'; name: string }
  | { type: 'host_load_campaign'; campaignId: string }
  | { type: 'host_leave_campaign' }
  | { type: 'host_delete_campaign'; campaignId: string }
  | { type: 'player_join'; campaignId: string; playerId?: string; deviceId?: string }
  /** Player leaves the campaign (e.g. tapped Back to the join screen). Drops an
   *  unclaimed lobby slot immediately instead of waiting for socket close. */
  | { type: 'player_leave' }
  | { type: 'player_create_character'; classId: string; name: string }
  | { type: 'player_claim_character'; characterInstanceId: string }
  | { type: 'player_pick_character'; characterId: string }
  | { type: 'player_unclaim_character' }
  | { type: 'player_set_loadout'; cardIds: string[] }
  /** Downtime level-up (lobby only): add `cardId` to the pool and spend the
   *  newly-earned perk mark on the perk at `perkIndex` in the class's perk
   *  list. Validated server-side against XP threshold and card/perk rules. */
  | { type: 'player_level_up'; cardId: string; perkIndex: number }
  | { type: 'player_buy_item'; itemId: string }
  /** Undo a purchase made during the current shopping session (refund + restock). */
  | { type: 'player_undo_buy_item'; itemId: string }
  | { type: 'player_set_item_loadout'; itemIds: string[] }
  /** Finish the pre-scenario shopping trip and ready up. Requires a locked
   *  loadout. */
  /** Donate 10 of this character's gold to the Great Oak (lobby only). Marks
   *  the next box on the sheet's track; every fifth box grants Gloomhaven
   *  +1 prosperity. Donations are not refundable. */
  | { type: 'player_donate_great_oak' }
  | { type: 'player_finish_shopping' }
  /** Re-open the shop after readying up (un-ready, back to shopping). */
  | { type: 'player_reopen_shopping' }
  | {
      type: 'player_use_item';
      itemId: string;
      /** Action context for items used during a specific action (e.g. a
       *  move-bonus item used on a move). Omitted for turn-scoped items. */
      slot?: 'top' | 'bottom';
      actionId?: string;
      /** Target unit to designate for items that point an effect at one figure
       *  (e.g. Scouting Lens Pierce). */
      targetUnitId?: string;
      /** Target card to designate for items that act on a card (e.g. Stamina
       *  Potion retrieving a discarded card). */
      targetCardId?: string;
    }
  /** Answer an outstanding pendingReactiveItem prompt during a monster attack. */
  | { type: 'player_respond_reactive_item'; spend: boolean }
  /** Start a scenario. `level` (0–7) overrides the recommended scenario level
   *  chosen by the host in the lobby; omitted falls back to the recommended
   *  value derived from the party's character levels. */
  | {
      type: 'host_start_scenario';
      scenarioId: string;
      level?: number;
      /** A builder-authored scenario compiled in the host's browser, sent with
       *  its tile artwork. When present the server plays this instead of a
       *  registry scenario (scenarioId is still used as its id/name). */
      custom?: { scenario: Scenario; tileArt: PlacedTileArt[] };
    }
  /** Placement phase: claim (or move to) a starting hex. Allowed only while the
   *  player hasn't tapped Ready. */
  /** Campaign-sheet adjustments (host only, docs/rules/campaign-sheet.md).
   *  Values are clamped server-side: reputation to [−10, cap], prosperity
   *  boxes never erase a numbered box, inspiration floors at 0. */
  | { type: 'host_adjust_reputation'; faction: FactionId; delta: number }
  | { type: 'host_adjust_inspiration'; delta: number }
  /** Delta is in prosperity *boxes* ("+X prosperity" marks X boxes). */
  | { type: 'host_adjust_prosperity'; delta: number }
  | { type: 'player_place'; hex: Hex }
  /** Placement phase: lock in (or unlock) this player's chosen starting hex. */
  | { type: 'player_set_placement_ready'; ready: boolean }
  /** Placement phase: host begins play once everyone is placed and ready. */
  | { type: 'host_begin_scenario' }
  /** Keep one of the three dealt battle goals for this scenario. */
  | { type: 'player_choose_battle_goal'; goalId: string }
  | { type: 'player_select_cards'; leadingId: string; secondId: string }
  | { type: 'player_long_rest' }
  | { type: 'player_long_rest_choose_lost'; cardId: string }
  | { type: 'player_long_rest_heal' }
  | { type: 'player_long_rest_finish' }
  | { type: 'player_short_rest' }
  | { type: 'player_short_rest_reroll' }
  | { type: 'player_short_rest_accept' }
  | { type: 'player_unsubmit' }
  | { type: 'end_turn' }
  | { type: 'player_open_door'; doorId: string }
  | { type: 'dismiss_narrative' }
  | { type: 'host_skip_monster_anim' }
  | {
      type: 'player_perform_action';
      slot: 'top' | 'bottom';
      actionId: string;
      target?: { hex?: Hex; unitId?: string; path?: Hex[] } | undefined;
    }
  | { type: 'player_skip_action'; slot: 'top' | 'bottom'; actionId: string }
  | {
      type: 'player_toggle_consume_rider';
      slot: 'top' | 'bottom';
      actionId: string;
      riderIndex: number;
    }
  | { type: 'player_resolve_element_choice'; choiceId: string; element: Element }
  /** Answer an outstanding trap spring-or-bypass prompt. `spring: true` springs
   *  the trap (take damage, remove it); `false` bypasses it. */
  | { type: 'player_resolve_trap_choice'; choiceId: string; spring: boolean }
  | { type: 'player_engage_half'; slot: 'top' | 'bottom'; cardId: string; useBasic: boolean }
  /** Reverse an engaged half before anything has been performed — refunds any
   *  required element cost and returns the slot to unlocked so the player can
   *  pick the other half/card. */
  | { type: 'player_unengage_half'; slot: 'top' | 'bottom' }
  | { type: 'player_skip_half'; slot: 'top' | 'bottom'; cardId: string }
  | { type: 'player_finish_half'; slot: 'top' | 'bottom' }
  /** Confirm a persistent (round/tracked/scenario) half whose engage queue is
   *  empty — i.e. all its meaningful steps are deferred to triggers. Credits
   *  the half as performed so disposePlayerCards routes it to the active pile
   *  and creates the activeTracked entry; then finishes the slot. The matching
   *  "skip" path is the existing player_finish_half (no credit → discard). */
  | { type: 'player_confirm_persistent_half'; slot: 'top' | 'bottom' }
  | { type: 'cursor'; px: { x: number; y: number } }
  | { type: 'pending_move'; hex: Hex | null }
  | {
      type: 'player_preview_forced_move';
      preview: { targetUnitId: string; destination: Hex } | null;
    }
  | { type: 'ping' };

export type ServerToClient =
  /** `lanHost` is the server's best-guess LAN IPv4 (e.g. "192.168.1.42"), so the
   *  host screen can show a join URL phones on the same network can reach.
   *  Absent when the server couldn't determine one. */
  | { type: 'hello'; serverVersion: string; lanHost?: string }
  | { type: 'campaign_list'; campaigns: CampaignSummary[] }
  | { type: 'joined'; role: Role; playerId: string; campaignId: string }
  | { type: 'state'; state: PublicGameState; you?: PrivatePlayerState }
  | { type: 'cursor'; playerId: string; px: { x: number; y: number } }
  | { type: 'pending_move'; playerId: string; hex: Hex | null }
  | { type: 'error'; message: string }
  | { type: 'pong' };
