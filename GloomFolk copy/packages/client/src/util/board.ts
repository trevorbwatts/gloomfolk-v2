import { HexMath, type GameState, type Hex } from '@gloomfolk/shared';

export const HEX_SIZE = 40;

export function computeBoardPixelBounds(state: GameState) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let r = 0; r < state.height; r++) {
    for (let q = -Math.floor(r / 2); q < state.width - Math.floor(r / 2); q++) {
      const { x, y } = HexMath.hexToPixel({ q, r }, HEX_SIZE);
      if (x - HEX_SIZE < minX) minX = x - HEX_SIZE;
      if (y - HEX_SIZE < minY) minY = y - HEX_SIZE;
      if (x + HEX_SIZE > maxX) maxX = x + HEX_SIZE;
      if (y + HEX_SIZE > maxY) maxY = y + HEX_SIZE;
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function nearestHexFromPx(
  state: GameState,
  px: { x: number; y: number },
): Hex | null {
  let best: Hex | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < state.height; r++) {
    for (let q = -Math.floor(r / 2); q < state.width - Math.floor(r / 2); q++) {
      const { x, y } = HexMath.hexToPixel({ q, r }, HEX_SIZE);
      const dx = x - px.x;
      const dy = y - px.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { q, r };
      }
    }
  }
  return best;
}

export function nearestHexFromNorm(
  state: GameState,
  norm: { x: number; y: number },
): Hex | null {
  const bounds = computeBoardPixelBounds(state);
  return nearestHexFromPx(state, {
    x: bounds.minX + norm.x * bounds.width,
    y: bounds.minY + norm.y * bounds.height,
  });
}
