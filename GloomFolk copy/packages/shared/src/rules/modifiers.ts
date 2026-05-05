import type { AttackModifierCard, ModifierDeck } from '../types.js';

// ─── Deck Construction ────────────────────────────────────────────────────────

// Standard 20-card deck: 6×+0, 5×-1, 5×+1, 1×-2, 1×+2, 1×null(shuffle), 1×2x(shuffle)
export function buildStandardDeck(): AttackModifierCard[] {
  const cards: AttackModifierCard[] = [];
  for (let i = 0; i < 6; i++) cards.push(card(`+0_${i}`, 0));
  for (let i = 0; i < 5; i++) cards.push(card(`-1_${i}`, -1));
  for (let i = 0; i < 5; i++) cards.push(card(`+1_${i}`, 1));
  cards.push(card('-2_0', -2));
  cards.push(card('+2_0', 2));
  cards.push(card('null_0', 'null', { shuffle: true }));
  cards.push(card('2x_0', '2x', { shuffle: true }));
  return cards;
}

export function buildBlessCard(id: string): AttackModifierCard {
  return card(id, '2x', { returnToSupply: true });
}

export function buildCurseCard(id: string): AttackModifierCard {
  return card(id, 'null', { returnToSupply: true });
}

export function buildBlessSupply(): AttackModifierCard[] {
  return Array.from({ length: 10 }, (_, i) => buildBlessCard(`bless_${i}`));
}

// 10 for character/ally decks (star icon), 10 for monster deck (monster icon)
export function buildCharacterCurseSupply(): AttackModifierCard[] {
  return Array.from({ length: 10 }, (_, i) => buildCurseCard(`curse_char_${i}`));
}

export function buildMonsterCurseSupply(): AttackModifierCard[] {
  return Array.from({ length: 10 }, (_, i) => buildCurseCard(`curse_mon_${i}`));
}

export function buildModifierDeck(): ModifierDeck {
  const drawPile = buildStandardDeck();
  shuffleInPlace(drawPile);
  return { drawPile, discardPile: [], needsShuffleAtRoundEnd: false };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function card(
  id: string,
  value: AttackModifierCard['value'],
  opts?: Partial<Pick<AttackModifierCard, 'rolling' | 'shuffle' | 'returnToSupply' | 'addedEffects'>>,
): AttackModifierCard {
  return {
    id,
    value,
    rolling: opts?.rolling ?? false,
    shuffle: opts?.shuffle ?? false,
    addedEffects: opts?.addedEffects ?? [],
    returnToSupply: opts?.returnToSupply ?? false,
  };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

// Ensure the deck has at least one card to draw, reshuffling discard if needed.
function ensureDrawable(deck: ModifierDeck): void {
  if (deck.drawPile.length === 0) {
    deck.drawPile = [...deck.discardPile];
    deck.discardPile = [];
    shuffleInPlace(deck.drawPile);
    deck.needsShuffleAtRoundEnd = false;
  }
}

function drawOne(deck: ModifierDeck): AttackModifierCard {
  ensureDrawable(deck);
  const c = deck.drawPile.pop()!;
  if (c.shuffle) deck.needsShuffleAtRoundEnd = true;
  return c;
}

// Draw cards until a non-rolling card is reached. Returns [rolling..., finalNonRolling].
function drawRollingChain(deck: ModifierDeck): AttackModifierCard[] {
  const chain: AttackModifierCard[] = [];
  for (;;) {
    const c = drawOne(deck);
    chain.push(c);
    if (!c.rolling) break;
  }
  return chain;
}

function discardCards(deck: ModifierDeck, cards: AttackModifierCard[]): void {
  for (const c of cards) {
    if (!c.returnToSupply) deck.discardPile.push(c);
    // returnToSupply cards go back to the global supply — caller manages that
  }
}

// Apply rolling cards (numeric only) + final card to baseAttack.
// includeRolling = false for disadvantage (rolling cards are ignored).
function resolveCards(
  baseAttack: number,
  rollingCards: AttackModifierCard[],
  finalCard: AttackModifierCard,
  includeRolling: boolean,
): { damage: number; addedEffects: string[] } {
  let damage = baseAttack;
  const addedEffects: string[] = [];

  if (includeRolling) {
    for (const c of rollingCards) {
      if (typeof c.value === 'number') damage += c.value;
      addedEffects.push(...c.addedEffects);
    }
  }

  addedEffects.push(...finalCard.addedEffects);
  if (finalCard.value === 'null') {
    damage = 0;
  } else if (finalCard.value === '2x') {
    damage *= 2;
  } else {
    damage += finalCard.value;
  }

  return { damage: Math.max(0, damage), addedEffects };
}

// ─── Public Draw Functions ────────────────────────────────────────────────────

export type DrawResult = {
  finalDamage: number;
  addedEffects: string[];
  drawnCards: AttackModifierCard[];
  returnToSupplyCards: AttackModifierCard[];
};

export function drawNormal(deck: ModifierDeck, baseAttack: number): DrawResult {
  const chain = drawRollingChain(deck);
  const rolling = chain.slice(0, -1);
  const final = chain[chain.length - 1]!;
  const { damage, addedEffects } = resolveCards(baseAttack, rolling, final, true);
  const returnToSupplyCards = chain.filter((c) => c.returnToSupply);
  discardCards(deck, chain);
  return { finalDamage: damage, addedEffects, drawnCards: chain, returnToSupplyCards };
}

// Advantage: draw rolling chain + one extra card (ignoring its rolling icon).
// Use all rolling cards from chain 1 + the better of the two final cards.
// autoChooseBetter = true for monsters (always use better); false = also use better for now
// (character choice UI not yet implemented).
export function drawAdvantage(deck: ModifierDeck, baseAttack: number): DrawResult {
  const chain = drawRollingChain(deck);
  const rolling = chain.slice(0, -1);
  const final1 = chain[chain.length - 1]!;
  const final2 = drawOne(deck); // rolling icon on this card is ignored per rules

  const r1 = resolveCards(baseAttack, rolling, final1, true);
  const r2 = resolveCards(baseAttack, rolling, final2, true);

  // Higher damage wins. Ties: non-numeric effect on second = positive undefined, use second.
  // Otherwise first drawn wins on tie.
  const useSecond = r2.damage > r1.damage;
  const chosenFinal = useSecond ? final2 : final1;
  const discardedFinal = useSecond ? final1 : final2;

  const { damage, addedEffects } = resolveCards(baseAttack, rolling, chosenFinal, true);
  const allCards = [...chain, final2];
  const returnToSupplyCards = allCards.filter((c) => c.returnToSupply);
  discardCards(deck, allCards);

  return { finalDamage: damage, addedEffects, drawnCards: [...rolling, chosenFinal], returnToSupplyCards };
}

// Disadvantage: draw rolling chain + one extra card.
// Ignore all rolling cards. Use the worse of the two final cards against baseAttack.
// Ambiguity (equal damage): use the first drawn card.
export function drawDisadvantage(deck: ModifierDeck, baseAttack: number): DrawResult {
  const chain = drawRollingChain(deck);
  const rolling = chain.slice(0, -1);
  const final1 = chain[chain.length - 1]!;
  const final2 = drawOne(deck);

  // Rolling cards are ignored — compare only final cards applied directly to baseAttack.
  const r1 = resolveCards(baseAttack, [], final1, false);
  const r2 = resolveCards(baseAttack, [], final2, false);

  // Worse = lower damage. Ambiguity: use first drawn.
  const useSecond = r2.damage < r1.damage;
  const chosenFinal = useSecond ? final2 : final1;
  const discardedFinal = useSecond ? final1 : final2;
  void discardedFinal;

  const { damage, addedEffects } = resolveCards(baseAttack, [], chosenFinal, false);
  const allCards = [...chain, final2];
  const returnToSupplyCards = allCards.filter((c) => c.returnToSupply);
  discardCards(deck, allCards);

  return { finalDamage: damage, addedEffects, drawnCards: [chosenFinal], returnToSupplyCards };
}

// ─── End-of-Round Cleanup ─────────────────────────────────────────────────────

// If a shuffle-icon card was drawn this round, shuffle discard back into draw pile.
export function endRoundModifierCleanup(deck: ModifierDeck): void {
  if (deck.needsShuffleAtRoundEnd) {
    deck.drawPile = [...deck.drawPile, ...deck.discardPile];
    deck.discardPile = [];
    shuffleInPlace(deck.drawPile);
    deck.needsShuffleAtRoundEnd = false;
  }
}

// ─── Bless / Curse Injection ──────────────────────────────────────────────────

// Shuffle a bless card into the deck at a random position. Returns false if supply empty.
export function addBlessCard(deck: ModifierDeck, supply: AttackModifierCard[]): boolean {
  const c = supply.pop();
  if (!c) return false;
  const idx = Math.floor(Math.random() * (deck.drawPile.length + 1));
  deck.drawPile.splice(idx, 0, c);
  return true;
}

// Shuffle a curse card into the deck at a random position. Returns false if supply empty.
export function addCurseCard(deck: ModifierDeck, supply: AttackModifierCard[]): boolean {
  const c = supply.pop();
  if (!c) return false;
  const idx = Math.floor(Math.random() * (deck.drawPile.length + 1));
  deck.drawPile.splice(idx, 0, c);
  return true;
}
