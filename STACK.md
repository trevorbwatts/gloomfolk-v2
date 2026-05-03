# Tech Stack (decided, not yet implemented)

## Workspace
- npm workspaces monorepo: `shared`, `server`, `client`
- TypeScript ~5.6, ESM everywhere
- `tsc -b` for project-references typecheck

## Shared (`packages/shared`)
- Pure TypeScript rules engine — no DOM, no Node-only APIs
- Owns: hex math, combat, conditions, elements, modifier decks, persistents, AI, scenario setup
- Tests: `node:test` + `tsx` (no Jest, no Vitest)

## Server (`packages/server`)
- Node + WebSockets via `ws`
- `Room` class owns game state, dispatches `ClientToServer` messages
- No HTTP framework, no database — in-memory per room

## Client (`packages/client`)
- React (hooks) + Zustand + Vite
- Custom `GameSocket` wrapping WebSocket
- Messages typed end-to-end via shared `ClientToServer` / `ServerToClient` unions
- Hex rendering: custom pointy-top axial layout, touchpad-driven cursor (no canvas/WebGL lib)

## Cross-cutting
- All wire types in `shared/src/messages.ts` — single protocol source of truth
- Axial `{q, r}` coords throughout; rules never touch pixels, rendering never touches hex math directly

## Summary
TypeScript + React + Zustand + Vite (client), Node + `ws` (server), pure-TS shared rules lib, `node:test`. No game engine, no ORM, no auth. Complexity concentrated in the rules library.
