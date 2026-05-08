import type { Card } from '../types.js';
import { backstab } from './backstab.js';
import { flankingStrike } from './flanking-strike.js';
import { practicedReflexes } from './practiced-reflexes.js';
import { quickHands } from './quick-hands.js';
import { singleOut } from './single-out.js';
import { sinisterOpportunity } from './sinister-opportunity.js';
import { smokeBomb } from './smoke-bomb.js';
import { specialMixture } from './special-mixture.js';
import { swiftBow } from './swift-bow.js';
import { throwingKnives } from './throwing-knives.js';
import { trickstersReversal } from './tricksters-reversal.js';
import { venomShiv } from './venom-shiv.js';

export const silentKnifeCards: readonly Card[] = [
  flankingStrike,
  practicedReflexes,
  quickHands,
  singleOut,
  sinisterOpportunity,
  specialMixture,
  swiftBow,
  throwingKnives,
  venomShiv,
  backstab,
  smokeBomb,
  trickstersReversal,
];
