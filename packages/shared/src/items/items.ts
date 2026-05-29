import type { Item, ShopStock } from './types.js';

export const leatherBoots: Item = {
  id: 'leather-boots',
  name: 'Leather Boots',
  cost: 15,
  slot: 'feet',
  usage: { kind: 'spent' },
  effect: { kind: 'move-bonus', amount: 1 },
  description: 'During your move ability, add +1 to movement.',
};

export const wingedShoes: Item = {
  id: 'winged-shoes',
  name: 'Winged Shoes',
  cost: 15,
  slot: 'feet',
  usage: { kind: 'spent' },
  effect: { kind: 'jump-this-turn' },
  description: 'During your turn, add Jump to all of your move abilities.',
};

export const hideArmor: Item = {
  id: 'hide-armor',
  name: 'Hide Armor',
  cost: 10,
  slot: 'body',
  usage: { kind: 'spent' },
  effect: { kind: 'shield-on-attack', amount: 1, uses: 2 },
  negativeModifierCount: 2,
  description:
    'On the next two attacks targeting you, gain Shield 1 for that attack. Persistent: 2 uses. Adds two −1 attack modifier cards.',
};

export const leatherArmor: Item = {
  id: 'leather-armor',
  name: 'Leather Armor',
  cost: 10,
  slot: 'body',
  usage: { kind: 'spent' },
  effect: { kind: 'disadvantage-when-attacked' },
  description:
    'When you are attacked, before drawing an attack modifier card, the attacker gains Disadvantage on the attack.',
};

export const scoutingLens: Item = {
  id: 'scouting-lens',
  name: 'Scouting Lens',
  cost: 10,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'pierce-one-attack', amount: 1 },
  description: 'During your attack ability, add Pierce 1 to one attack.',
};

export const amuletOfLife: Item = {
  id: 'amulet-of-life',
  name: 'Amulet of Life',
  cost: 15,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'heal-self', amount: 1 },
  description: 'During your turn, perform: Heal 1 (self).',
};

export const poisonDagger: Item = {
  id: 'poison-dagger',
  name: 'Poison Dagger',
  cost: 15,
  slot: 'one-hand',
  usage: { kind: 'spent' },
  effect: { kind: 'poison-one-attack' },
  description: 'During your melee attack ability, add Poison to one attack.',
};

export const heaterShield: Item = {
  id: 'heater-shield',
  name: 'Heater Shield',
  cost: 15,
  slot: 'one-hand',
  usage: { kind: 'spent' },
  effect: { kind: 'shield-when-attacked', amount: 1 },
  description:
    'When you suffer damage from an attack, gain 1 Shield for the attack.',
};

export const focusingRod: Item = {
  id: 'focusing-rod',
  name: 'Focusing Rod',
  cost: 10,
  slot: 'one-hand',
  usage: { kind: 'spent' },
  effect: { kind: 'heal-after-lost', amount: 1, range: 3 },
  description:
    "During your turn, if you've performed an action with Lost, perform: Heal 1, Range 3.",
};

export const simpleBow: Item = {
  id: 'simple-bow',
  name: 'Simple Bow',
  cost: 15,
  slot: 'two-hands',
  usage: { kind: 'spent' },
  effect: { kind: 'advantage-one-attack' },
  description: 'During your ranged attack ability, gain advantage on one attack.',
};

export const staminaPotion: Item = {
  id: 'stamina-potion',
  name: 'Stamina Potion',
  cost: 10,
  slot: 'small',
  usage: { kind: 'permanently-lost' },
  effect: { kind: 'retrieve-discarded-card', cardLevel: 1 },
  isPotion: true,
  description: 'During your turn, retrieve one Level 1 card from the Discard Pile.',
};

export const healingPotion: Item = {
  id: 'healing-potion',
  name: 'Healing Potion',
  cost: 10,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'heal-self', amount: 3 },
  isPotion: true,
  description: 'During your turn, perform: Heal 3 (self).',
};

export const elementPotion: Item = {
  id: 'element-potion',
  name: 'Element Potion',
  cost: 10,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'infuse-element' },
  isPotion: true,
  description: 'During your turn, infuse any element.',
};

/** All items in the game, indexed by id. */
export const ALL_ITEMS: Readonly<Record<string, Item>> = {
  [leatherBoots.id]: leatherBoots,
  [wingedShoes.id]: wingedShoes,
  [hideArmor.id]: hideArmor,
  [leatherArmor.id]: leatherArmor,
  [scoutingLens.id]: scoutingLens,
  [amuletOfLife.id]: amuletOfLife,
  [poisonDagger.id]: poisonDagger,
  [heaterShield.id]: heaterShield,
  [focusingRod.id]: focusingRod,
  [simpleBow.id]: simpleBow,
  [staminaPotion.id]: staminaPotion,
  [healingPotion.id]: healingPotion,
  [elementPotion.id]: elementPotion,
};

export function getItem(id: string): Item | undefined {
  return ALL_ITEMS[id];
}

/** Default starting stock for a new campaign's shop. */
export const DEFAULT_SHOP_STOCK: readonly ShopStock[] = [
  { itemId: leatherBoots.id, remaining: 2 },
  { itemId: wingedShoes.id, remaining: 2 },
  { itemId: hideArmor.id, remaining: 2 },
  { itemId: leatherArmor.id, remaining: 2 },
  { itemId: scoutingLens.id, remaining: 2 },
  { itemId: amuletOfLife.id, remaining: 2 },
  { itemId: poisonDagger.id, remaining: 2 },
  { itemId: heaterShield.id, remaining: 2 },
  { itemId: focusingRod.id, remaining: 2 },
  { itemId: simpleBow.id, remaining: 2 },
  { itemId: staminaPotion.id, remaining: 4 },
  { itemId: healingPotion.id, remaining: 4 },
  { itemId: elementPotion.id, remaining: 4 },
];
