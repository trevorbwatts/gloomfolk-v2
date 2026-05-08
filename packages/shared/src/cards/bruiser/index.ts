import type { Card } from '../types.js';
import { balancedMeasure } from './balanced-measure.js';
import { defensiveTactics } from './defensive-tactics.js';
import { eyeForAnEye } from './eye-for-an-eye.js';
import { fearsomeTaunt } from './fearsome-taunt.js';
import { grabAndGo } from './grab-and-go.js';
import { hookAndChain } from './hook-and-chain.js';
import { intimidatingGrowl } from './intimidating-growl.js';
import { juggernaut } from './juggernaut.js';
import { leapingCleave } from './leaping-cleave.js';
import { overwhelmingAssault } from './overwhelming-assault.js';
import { provokingRoar } from './provoking-roar.js';
import { pushThrough } from './push-through.js';
import { shieldBash } from './shield-bash.js';
import { skewer } from './skewer.js';
import { skirmishingManeuver } from './skirmishing-maneuver.js';
import { spareDagger } from './spare-dagger.js';
import { sweepingBlow } from './sweeping-blow.js';
import { trample } from './trample.js';
import { unstoppableCharge } from './unstoppable-charge.js';
import { wardingStrength } from './warding-strength.js';
import { whirlwind } from './whirlwind.js';

export const bruiserCards: readonly Card[] = [
  balancedMeasure,
  eyeForAnEye,
  grabAndGo,
  leapingCleave,
  overwhelmingAssault,
  shieldBash,
  skewer,
  spareDagger,
  trample,
  wardingStrength,
  fearsomeTaunt,
  provokingRoar,
  sweepingBlow,
  intimidatingGrowl,
  juggernaut,
  hookAndChain,
  unstoppableCharge,
  pushThrough,
  whirlwind,
  defensiveTactics,
  skirmishingManeuver,
];
