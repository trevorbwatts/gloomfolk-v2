import type { Card } from '../cards/types.js';
import {
  // Bruiser
  trample,
  spareDagger,
  eyeForAnEye,
  skewer,
  overwhelmingAssault,
  balancedMeasure,
  grabAndGo,
  wardingStrength,
  shieldBash,
  leapingCleave,
  provokingRoar,
  fearsomeTaunt,
  sweepingBlow,
  juggernaut,
  intimidatingGrowl,
  hookAndChain,
  unstoppableCharge,
  whirlwind,
  pushThrough,
  skirmishingManeuver,
  defensiveTactics,
  // Silent Knife
  sinisterOpportunity,
  venomShiv,
  throwingKnives,
  singleOut,
  flankingStrike,
  quickHands,
  swiftBow,
  practicedReflexes,
  specialMixture,
  trickstersReversal,
  smokeBomb,
  backstab,
} from '../cards/index.js';

const ALL_BRUISER: Card[] = [
  trample, spareDagger, eyeForAnEye, skewer, overwhelmingAssault,
  balancedMeasure, grabAndGo, wardingStrength, shieldBash, leapingCleave,
  provokingRoar, fearsomeTaunt, sweepingBlow, juggernaut, intimidatingGrowl,
  hookAndChain, unstoppableCharge, whirlwind, pushThrough, skirmishingManeuver,
  defensiveTactics,
];

const ALL_SILENT_KNIFE: Card[] = [
  sinisterOpportunity, venomShiv, throwingKnives, singleOut, flankingStrike,
  quickHands, swiftBow, practicedReflexes, specialMixture, trickstersReversal,
  smokeBomb, backstab,
];

/** Starting deck: all level-1 and level-X cards for the class. */
function startingDeck(all: Card[]): Card[] {
  return all.filter((c) => c.level === 1 || c.level === 'X');
}

const STARTING: Record<string, Card[]> = {
  bruiser: startingDeck(ALL_BRUISER),
  'silent-knife': startingDeck(ALL_SILENT_KNIFE),
};

export function startingHandFor(characterId: string): Card[] {
  return STARTING[characterId] ?? [];
}
