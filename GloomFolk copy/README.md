# GloomFolk

A tactical co-op web RPG. Hex-grid tactical combat, card-based abilities, played couch-style — host screen on a TV/laptop, players join from their phones.

Original IP, inspired by tactical board game mechanics.

## Quick start

```bash
npm install
npm run dev:server   # in one terminal — WebSocket game server on :8787
npm run dev:client   # in another — Vite dev server on :5173
```

Then open `http://localhost:5173/` on the host machine and `http://localhost:5173/p/<code>` on each player device. (For local dev with two browser tabs simulating phones, just use two extra tabs.)

## Layout

- `packages/shared` — pure game rules, types, content JSON. No DOM, no I/O.
- `packages/server` — Node + `ws`, authoritative game state, room registry.
- `packages/client` — Vite + React + PixiJS. Host route (`/`) and player route (`/p/:code`).

## Status

Vertical slice: 2 characters, 1 scenario, 2-player co-op.
