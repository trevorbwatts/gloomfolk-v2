import type { Item, ShopStock } from './types.js';

export const weatheredBoots: Item = {
  id: 'weathered-boots',
  name: 'Weathered Boots',
  printedNumber: 1,
  cost: 15,
  slot: 'feet',
  usage: { kind: 'spent' },
  effect: { kind: 'move-bonus', amount: 1 },
  description: 'During your move ability, add +1 to movement.',
};

export const wingedShoes: Item = {
  id: 'winged-shoes',
  name: 'Winged Shoes',
  printedNumber: 2,
  cost: 15,
  slot: 'feet',
  usage: { kind: 'spent' },
  effect: { kind: 'jump-this-turn' },
  description: 'During your turn, add Jump to all of your move abilities.',
};

export const hideArmor: Item = {
  id: 'hide-armor',
  name: 'Hide Armor',
  printedNumber: 3,
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
  printedNumber: 4,
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
  printedNumber: 5,
  cost: 10,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'pierce-one-attack', amount: 1 },
  description: 'During your attack ability, add Pierce 1 to one attack.',
};

export const amuletOfLife: Item = {
  id: 'amulet-of-life',
  name: 'Amulet of Life',
  printedNumber: 6,
  cost: 15,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'heal-self', amount: 1 },
  description: 'During your turn, perform: Heal 1 (self).',
};

export const poisonDagger: Item = {
  id: 'poison-dagger',
  name: 'Poison Dagger',
  printedNumber: 7,
  cost: 15,
  slot: 'one-hand',
  usage: { kind: 'spent' },
  effect: { kind: 'poison-one-attack' },
  description: 'During your melee attack ability, add Poison to one attack.',
};

export const heaterShield: Item = {
  id: 'heater-shield',
  name: 'Heater Shield',
  printedNumber: 8,
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
  printedNumber: 9,
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
  printedNumber: 10,
  cost: 15,
  slot: 'two-hands',
  usage: { kind: 'spent' },
  effect: { kind: 'advantage-one-attack' },
  description: 'During your ranged attack ability, gain advantage on one attack.',
};

export const staminaPotion: Item = {
  id: 'stamina-potion',
  name: 'Stamina Potion',
  printedNumber: 12,
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
  printedNumber: 11,
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
  printedNumber: 13,
  cost: 10,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'infuse-element' },
  isPotion: true,
  description: 'During your turn, infuse any element.',
};

export const studdedLeather: Item = {
  id: 'studded-leather',
  name: 'Studded Leather',
  printedNumber: 14,
  cost: 20,
  reputationRequirement: { faction: 'military', amount: 3 },
  copies: 2,
  slot: 'body',
  usage: { kind: 'spent' },
  effect: { kind: 'disadvantage-and-shield-when-attacked', amount: 1 },
  description:
    'When you are attacked, before drawing an attack modifier card, the ' +
    'attacker gains disadvantage on the attack and you gain Shield 1 for ' +
    'the attack.',
};

export const eagleEyeGoggles: Item = {
  id: 'eagle-eye-goggles',
  name: 'Eagle-Eye Goggles',
  printedNumber: 26,
  cost: 30,
  copies: 2,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'advantage-all-attacks' },
  description: 'During your attack ability, gain advantage on all attacks.',
};

export const moonEarring: Item = {
  id: 'moon-earring',
  name: 'Moon Earring',
  printedNumber: 36,
  cost: 20,
  copies: 2,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'refresh-spent-items', count: 3 },
  description: 'When you short rest, refresh up to three of your spent items.',
};

export const heavyMace: Item = {
  id: 'heavy-mace',
  name: 'Heavy Mace',
  printedNumber: 51,
  cost: 20,
  copies: 2,
  slot: 'one-hand',
  usage: { kind: 'spent' },
  effect: { kind: 'counter-attack', amount: 1 },
  negativeModifierCount: 2,
  description:
    'After you are attacked by an adjacent enemy, perform: Attack 1 ' +
    'targeting the enemy that attacked you. This attack is unaffected by ' +
    'Retaliate. Adds two −1 attack modifier cards.',
};

export const telescopicLens: Item = {
  id: 'telescopic-lens',
  name: 'Telescopic Lens',
  printedNumber: 59,
  cost: 35,
  copies: 2,
  slot: 'head',
  usage: { kind: 'spent' },
  effect: { kind: 'ranged-range-bonus', amount: 2 },
  description: 'During your turn, add +2 Range to all your ranged attacks.',
};

export const steelRing: Item = {
  id: 'steel-ring',
  name: 'Steel Ring',
  printedNumber: 102,
  cost: 15,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  // Same reactive mechanic as Heater Shield, Shield 4 instead of 1.
  effect: { kind: 'shield-when-attacked', amount: 4 },
  description:
    'When you suffer damage from an attack, gain Shield 4 for the attack.',
};

export const luckyEye: Item = {
  id: 'lucky-eye',
  name: 'Lucky Eye',
  printedNumber: 105,
  cost: 40,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'strengthen-allies', range: 1 },
  description:
    'During your turn, perform: grant Strengthen to all allies (and ' +
    'yourself) within Range 1. A Strengthened figure gains Advantage on ' +
    'all its attacks until the end of its next turn.',
};

export const curiousGear: Item = {
  id: 'curious-gear',
  name: 'Curious Gear',
  printedNumber: 112,
  cost: 20,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'destroy-or-spring-trap', range: 3 },
  description:
    'During your turn, destroy one trap within Range 3. If an enemy is ' +
    'adjacent to that trap, you may instead spring the trap and apply its ' +
    'effects to that enemy.',
};

export const resonantCrystal: Item = {
  id: 'resonant-crystal',
  name: 'Resonant Crystal',
  printedNumber: 135,
  cost: 20,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'pay-to-damage-enemy', range: 3, damage: 4, selfDamage: 4 },
  description:
    'During your turn, suffer 4 damage or destroy an adjacent obstacle to ' +
    'have an enemy within Range 3 suffer 4 damage.',
};

export const amberhollow: Item = {
  id: 'amberhollow',
  name: 'Amberhollow',
  printedNumber: 146,
  // No gold cost printed — a special reward item, not bought from the shop.
  cost: 0,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  effect: { kind: 'grant-self-conditions', conditions: ['strengthen', 'bless'] },
  description:
    'This item must be brought into the scenario and is returned to the ' +
    'unavailable item supply at the end of the scenario. During your turn, ' +
    'perform: grant yourself Strengthen and Bless.',
};

export const aestherSpyglass: Item = {
  id: 'aesther-spyglass',
  name: 'Aesther Spyglass',
  printedNumber: 149,
  cost: 0,
  copies: 1,
  slot: 'small',
  usage: { kind: 'lost' },
  requiresAdjacentObstacle: true,
  effect: { kind: 'grant-self-conditions', conditions: ['bless'] },
  description:
    'This item may only be used if you are adjacent to at least one ' +
    'obstacle. During your turn, perform: grant yourself Bless.',
};

/** All items in the game, indexed by id. */
export const ALL_ITEMS: Readonly<Record<string, Item>> = {
  [weatheredBoots.id]: weatheredBoots,
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
  [studdedLeather.id]: studdedLeather,
  [eagleEyeGoggles.id]: eagleEyeGoggles,
  [moonEarring.id]: moonEarring,
  [heavyMace.id]: heavyMace,
  [telescopicLens.id]: telescopicLens,
  [steelRing.id]: steelRing,
  [luckyEye.id]: luckyEye,
  [curiousGear.id]: curiousGear,
  [resonantCrystal.id]: resonantCrystal,
  [amberhollow.id]: amberhollow,
  [aestherSpyglass.id]: aestherSpyglass,
};

export function getItem(id: string): Item | undefined {
  return ALL_ITEMS[id];
}

/** Default starting stock for a new campaign's shop. */
export const DEFAULT_SHOP_STOCK: readonly ShopStock[] = [
  { itemId: weatheredBoots.id, remaining: 2 },
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
