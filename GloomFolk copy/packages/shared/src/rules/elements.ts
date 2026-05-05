import type { ElementBoard, ElementId, GameState } from '../types.js';

const ALL_ELEMENTS: readonly ElementId[] = ['fire', 'ice', 'air', 'earth', 'light', 'dark'];

export function buildElementBoard(): ElementBoard {
  return { fire: 'inert', ice: 'inert', air: 'inert', earth: 'inert', light: 'inert', dark: 'inert' };
}

// Move element to Strong. Called at end of the infusing figure's turn.
export function infuseElement(state: GameState, element: ElementId): void {
  state.elementBoard[element] = 'strong';
}

// Returns true if the element can be consumed (Strong or Waning).
export function canConsumeElement(state: GameState, element: ElementId): boolean {
  const s = state.elementBoard[element];
  return s === 'strong' || s === 'waning';
}

// Consume an element (move to Inert). Returns false if not available.
// Elements infused this turn won't be available until the next turn since infusion
// happens at end of turn and consumption uses the state at start of turn.
export function consumeElement(state: GameState, element: ElementId): boolean {
  if (!canConsumeElement(state, element)) return false;
  state.elementBoard[element] = 'inert';
  return true;
}

// End-of-round: all elements wane one step (Strong → Waning, Waning → Inert).
export function waneElements(state: GameState): void {
  for (const el of ALL_ELEMENTS) {
    if (state.elementBoard[el] === 'strong') state.elementBoard[el] = 'waning';
    else if (state.elementBoard[el] === 'waning') state.elementBoard[el] = 'inert';
  }
}
