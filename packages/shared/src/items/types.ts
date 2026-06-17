/**
 * Item data model — Gloomhaven 2E shape.
 *
 * Items are equipped by characters and used during scenarios. Each item has a
 * slot (Head/Body/Feet/One-Hand/Two-Hands/Small), a usage rule (spent / lost /
 * multi-use), and an effect (what the item actually does).
 *
 * See docs/rules/items.md for the underlying rulebook text.
 */

import type { FactionId } from '../campaign/sheet.js';
import type { PositiveCondition } from '../cards/types.js';

export type ItemSlot =
  | 'head'
  | 'body'
  | 'feet'
  | 'one-hand'
  | 'two-hands'
  | 'small';

/** What happens to the item after it has been used.
 *  - `spent`: single-use this scenario; recovered on long rest (recovery deferred).
 *  - `lost`: single-use, not recoverable for the rest of the scenario.
 *  - `multi-use`: usable a fixed number of times before becoming spent or lost. */
export type ItemUsage =
  | { readonly kind: 'spent' }
  | { readonly kind: 'lost' }
  /** Like `lost` for this scenario (not recovered on a long rest; returns next
   *  scenario), but additionally CANNOT be recovered mid-scenario by any
   *  "recover a lost item/card" effect. */
  | { readonly kind: 'permanently-lost' }
  | {
      readonly kind: 'multi-use';
      readonly uses: number;
      readonly thenUsage: 'spent' | 'lost';
    };

/** What the item actually does. Discriminated union so new effect shapes can
 *  be added as more items are introduced. */
export type ItemEffect =
  /** Use during one of your move abilities; add `amount` to that move's distance. */
  | { readonly kind: 'move-bonus'; readonly amount: number }
  /** Use during your turn; every move ability you perform this turn gains the
   *  Jump trait (ignore figures in pass-through hexes). */
  | { readonly kind: 'jump-this-turn' }
  /** Activate to place in your active area. Each of the next `uses` attacks
   *  targeting you automatically gains Shield `amount` for that attack. The
   *  item is spent once all uses are consumed. */
  | { readonly kind: 'shield-on-attack'; readonly amount: number; readonly uses: number }
  /** Reactive. When you are attacked, you may spend the item (before the
   *  attack modifier is drawn) to give the attacker Disadvantage on that one
   *  attack. Single use. */
  | { readonly kind: 'disadvantage-when-attacked' }
  /** Use during your attack ability; designate one target so that exactly one
   *  attack against it gains Pierce `amount` (ignore that much of its shield).
   *  Single use. */
  | { readonly kind: 'pierce-one-attack'; readonly amount: number }
  /** Use anytime during your turn to restore `amount` HP to yourself (capped
   *  at your maximum). Single use. */
  | { readonly kind: 'heal-self'; readonly amount: number }
  /** Use during your melee attack ability; designate one enemy so that exactly
   *  one attack against it also applies the Poison condition. Single use. */
  | { readonly kind: 'poison-one-attack' }
  /** Reactive. When an attack would deal you damage, you may spend the item
   *  (after the modifier is drawn) to gain Shield `amount` against that one
   *  attack. Single use. */
  | { readonly kind: 'shield-when-attacked'; readonly amount: number }
  /** Reactive. When you are attacked, you may spend the item (before the
   *  modifier is drawn) to give the attacker Disadvantage AND gain Shield
   *  `amount` for that one attack. Single use. */
  | {
      readonly kind: 'disadvantage-and-shield-when-attacked';
      readonly amount: number;
    }
  /** Use during your turn, but only after you've performed an action from a
   *  card with the Lost disposition this turn. Restores `amount` HP to one
   *  figure — yourself or an ally — within `range` hexes. Single use. */
  | { readonly kind: 'heal-after-lost'; readonly amount: number; readonly range: number }
  /** Use during your ranged attack ability; designate one target so that
   *  exactly one attack against it gains Advantage (draw two attack-modifier
   *  cards and use the better). Single use. */
  | { readonly kind: 'advantage-one-attack' }
  /** Use during your attack ability; every attack of that ability gains
   *  Advantage. Single use. */
  | { readonly kind: 'advantage-all-attacks' }
  /** Use during your turn to return one discarded card of printed level
   *  `cardLevel` from your discard pile to your hand. Single use. */
  | { readonly kind: 'retrieve-discarded-card'; readonly cardLevel: number }
  /** Use during your turn to infuse one element of your choice (becomes Strong
   *  at end of turn, like a card's create-element). Single use. */
  | { readonly kind: 'infuse-element' }
  /** Use when you short rest; refresh up to `count` of your spent items
   *  (they become usable again). Single use. */
  | { readonly kind: 'refresh-spent-items'; readonly count: number }
  /** Reactive. After you are attacked by an adjacent enemy, you may
   *  spend the item to perform Attack `amount` targeting that enemy.
   *  The counter-attack is unaffected by Retaliate. Single use. */
  | { readonly kind: 'counter-attack'; readonly amount: number }
  /** Use during your turn; every ranged attack you perform this turn
   *  (a printed-range attack, i.e. Range 2+) gains +`amount` Range.
   *  Melee attacks are unaffected. Turn-scoped, single use. */
  | { readonly kind: 'ranged-range-bonus'; readonly amount: number }
  /** Use during your turn; grant the Strengthen positive condition to
   *  yourself and every ally within `range` hexes. A Strengthened figure
   *  gains Advantage on all its attacks until the end of its next turn.
   *  Single use. */
  | { readonly kind: 'strengthen-allies'; readonly range: number }
  /** Use during your turn; destroy one trap within `range` hexes. If an enemy
   *  is adjacent to that trap, you may instead spring it and apply the trap's
   *  effects (its damage) to that enemy. Single use. */
  | { readonly kind: 'destroy-or-spring-trap'; readonly range: number }
  /** Use during your turn; pay a cost to make one enemy within `range` hexes
   *  suffer `damage`. The cost is to suffer `selfDamage` yourself (or, per the
   *  card, destroy an adjacent obstacle — not yet modelled at runtime, so only
   *  the self-damage cost is offered today). Single use. */
  | {
      readonly kind: 'pay-to-damage-enemy';
      readonly range: number;
      readonly damage: number;
      readonly selfDamage: number;
    }
  /** Use during your turn; grant the listed positive conditions to yourself.
   *  (e.g. Amberhollow: Strengthen + Bless self.) Single use. */
  | { readonly kind: 'grant-self-conditions'; readonly conditions: readonly PositiveCondition[] };

export interface Item {
  readonly id: string;
  readonly name: string;
  /** Reference number printed on the physical item card (36 = †036).
   *  Event cards and storybook sections refer to items by this number. */
  readonly printedNumber: number;
  /** Gold cost when purchased from the shop. */
  readonly cost: number;
  /** Optional reputation gate (per items.md): the item can only be
   *  purchased while the named faction's reputation is at least
   *  `amount` (the shield badge on the card, e.g. Military 3). Omitted
   *  = no requirement. */
  readonly reputationRequirement?: {
    readonly faction: FactionId;
    readonly amount: number;
  };
  /** Total copies of this item in the game — the quantity badge's
   *  denominator ("1/2" = 2 copies exist). */
  readonly copies?: number;
  readonly slot: ItemSlot;
  readonly usage: ItemUsage;
  readonly effect: ItemEffect;
  /** True for consumable potions. Rules that single out potions (e.g. the
   *  Prohibitionist battle goal) key off this tag rather than the item id. */
  readonly isPotion?: boolean;
  /** Number of -1 attack modifier cards added to the user's deck while this
   *  item is brought into a scenario. Cards are added at scenario start and
   *  removed (deck rebuilt) at the next scenario start. */
  readonly negativeModifierCount?: number;
  /** When true, the item may only be used while the user is adjacent to an
   *  obstacle (e.g. Aesther Spyglass). Obstacles aren't modelled as distinct
   *  from walls at runtime, so adjacency to a wall tile is used as the proxy. */
  readonly requiresAdjacentObstacle?: boolean;
  /** Plain-language description shown on the card face. */
  readonly description: string;
}

/** A single entry in the shop catalog. */
export interface ShopStock {
  readonly itemId: string;
  /** Copies of the item available to purchase. Decrements on each buy. */
  readonly remaining: number;
}
