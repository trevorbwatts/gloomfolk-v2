import {
  ArrowLeftFromLine,
  ArrowRightToLine,
  BadgeQuestionMark,
  BicepsFlexed,
  BowArrow,
  ChevronsRight,
  CircleDashed,
  Coins,
  Cross,
  Droplet,
  Feather,
  Footprints,
  Hand,
  HandFist,
  OctagonX,
  Redo,
  Shield,
  ShieldCog,
  ShieldHalf,
  Skull,
  Sparkle,
  SportShoe,
  Sword,
  Target,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Condition } from '@gloomfolk/shared';

export type IconKey =
  | Condition
  | 'attack'
  | 'move'
  | 'heal'
  | 'shield'
  | 'retaliate'
  | 'fly'
  | 'jump'
  | 'pierce'
  | 'push'
  | 'pull'
  | 'range'
  | 'target'
  | 'loot';

const ICONS: Record<IconKey, LucideIcon> = {
  wound: Droplet,
  poison: Skull,
  disarm: Hand,
  heal: Cross,
  attack: Sword,
  move: Footprints,
  shield: Shield,
  fly: Feather,
  retaliate: HandFist,
  jump: Redo,
  pierce: ChevronsRight,
  push: ArrowRightToLine,
  pull: ArrowLeftFromLine,
  range: BowArrow,
  target: Target,
  loot: Coins,
  safeguard: ShieldCog,
  ward: ShieldHalf,
  invisible: CircleDashed,
  strengthen: BicepsFlexed,
  bless: Sparkle,
  immobilize: SportShoe,
  stun: OctagonX,
  muddle: BadgeQuestionMark,
  curse: Zap,
};

export function GameIcon({
  kind,
  size = 18,
  color,
}: {
  kind: IconKey;
  size?: number;
  color?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      color={color}
      style={{ verticalAlign: '-0.18em', flex: '0 0 auto' }}
    />
  );
}
