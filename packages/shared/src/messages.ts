import type {
  AbilityStep,
  AmountRef,
  Card,
  Element,
  ElementBoardState,
  ElementSelector,
  NegativeCondition,
  PersistentTrigger,
} from './cards/types.js';
import type { Hex } from './hex.js';
import type { ModifierCard, ModifierCardInstance } from './modifiers/index.js';
import type { Tile } from './scenarios/types.js';

export type Role = 'host' | 'player';

export type UnitKind = 'player' | 'monster';

export interface ConditionInstance {
  kind: NegativeCondition;
  /** True if applied during this figure's own current turn (so it survives the
   * upcoming end-of-turn tick and is cleaned at the end of the *next* turn). */
  appliedThisTurn: boolean;
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
  /** Aggregate Retaliate amount currently active on this figure (sum across
   *  all retaliate sources). Range and per-source detail are tracked on the
   *  server's PlayerEntry.activeEffects; this field is a denormalized view
   *  for UI display. 0 when no retaliate is active. */
  retaliate: number;
  /** Active negative conditions (stun/immobilize/disarm/muddle/etc.). */
  conditions: ConditionInstance[];
  /** Invisible (positive condition). When true, the figure cannot be targeted
   *  by enemy attacks/abilities. Cleared at end of this figure's NEXT turn
   *  (mirrors negative-condition ticking via `invisibleAppliedThisTurn`). */
  invisible?: boolean;
  invisibleAppliedThisTurn?: boolean;
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
}

export interface CampaignSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  scenarioId: string | null;
  characterNames: string[];
}

export interface LobbyPlayer {
  playerId: string;
  name: string;
  characterId: string | null;
  connected: boolean;
  /** True if this player has locked in a card selection (or long rest) for the current round. */
  submitted: boolean;
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

export interface PublicGameState {
  campaignId: string;
  campaignName: string;
  phase: 'lobby' | 'card_select' | 'turn_resolution' | 'victory' | 'defeat';
  round: number;
  characters: CharacterInstance[];
  players: LobbyPlayer[];
  scenarioId: string | null;
  scenarioName: string | null;
  tiles: Tile[];
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
  /** The six-element board state. Each element is `strong`, `waning`, or
   *  `inert`. End-of-round wanes every element one column left; end-of-turn
   *  pending infusions land in `strong`; consumption pushes to `inert`. */
  elementBoard: ElementBoardState;
  /** An outstanding party/actor decision blocking turn flow — e.g. a
   *  wild/mixed element selector that needs a concrete element picked
   *  before infusion or consumption can resolve. */
  pendingElementChoice: PendingElementChoice | null;
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
}

/** Per-step view-state for the currently-resolving monster group turn.
 *  The server advances `phase` on a fixed cadence (default ~800ms/step)
 *  and rebroadcasts after each transition. */
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
  } | null;
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
      done: boolean;
    }
  | { id: string; type: 'heal'; amount: number; range: number; selfOnly: boolean; done: boolean }
  | { id: string; type: 'shield'; amount: number; done: boolean }
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
      type: 'modify-future-move';
      amount: number;
      expires: 'end-round' | 'end-scenario';
      done: boolean;
    }
  | {
      id: string;
      type: 'modify-future-attack';
      amount: number;
      pierceBonus: number;
      /** When true, the attack value is doubled before flat `amount` bonus
       *  is added. See cards/types.ts modify-future-attack.doubleAttack. */
      doubleAttack?: boolean;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
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
      pierceBonus: number;
      /** When true, the attack value is doubled before flat `amount` is added.
       *  Stacks via OR across all matching attack-bonus effects on a single
       *  attack — one doubling flag doubles, more doublings don't multi-double. */
      doubleAttack?: boolean;
      expires: 'next-attack' | 'end-round' | 'end-scenario';
      attackKind?: 'melee' | 'ranged';
    }
  | {
      id: string;
      sourceCardId: string;
      kind: 'retaliate';
      amount: number;
      range: number;
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
}

export type ClientToServer =
  | { type: 'host_hello' }
  | { type: 'host_list_campaigns' }
  | { type: 'host_create_campaign'; name: string }
  | { type: 'host_load_campaign'; campaignId: string }
  | { type: 'host_leave_campaign' }
  | { type: 'host_delete_campaign'; campaignId: string }
  | { type: 'player_join'; campaignId: string; playerId?: string }
  | { type: 'player_create_character'; classId: string; name: string }
  | { type: 'player_claim_character'; characterInstanceId: string }
  | { type: 'player_pick_character'; characterId: string }
  | { type: 'player_unclaim_character' }
  | { type: 'player_set_loadout'; cardIds: string[] }
  | { type: 'host_start_scenario'; scenarioId: string }
  | { type: 'player_select_cards'; leadingId: string; secondId: string }
  | { type: 'player_long_rest' }
  | { type: 'player_short_rest' }
  | { type: 'player_short_rest_reroll' }
  | { type: 'player_short_rest_accept' }
  | { type: 'player_unsubmit' }
  | { type: 'end_turn' }
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
  | { type: 'player_engage_half'; slot: 'top' | 'bottom'; cardId: string; useBasic: boolean }
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
  | { type: 'hello'; serverVersion: string }
  | { type: 'campaign_list'; campaigns: CampaignSummary[] }
  | { type: 'joined'; role: Role; playerId: string; campaignId: string }
  | { type: 'state'; state: PublicGameState; you?: PrivatePlayerState }
  | { type: 'cursor'; playerId: string; px: { x: number; y: number } }
  | { type: 'pending_move'; playerId: string; hex: Hex | null }
  | { type: 'error'; message: string }
  | { type: 'pong' };
