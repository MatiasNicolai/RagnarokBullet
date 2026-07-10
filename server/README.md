# Ragnarok Bullet Hell — online relay

A tiny WebSocket relay that pairs two players into a room and forwards their
per-tick input bytes. It never simulates the game (the client sim is
deterministic and lockstepped), so it stays trivial and cheap.

## Run locally

```bash
cd server
npm install
npm start          # listens on :8090 (override with PORT)
```

The web client defaults to `ws://localhost:8090` in dev, so with `npm run dev`
(from the project root) and the relay running, "CO-OP ONLINE" works on the same
machine. To test two clients locally, open the game in two browser tabs (one
hosts and shares its 4-letter code, the other joins).

## Tests

```bash
npm test           # headless: relay + lockstep + determinism (checksums must match)
```

`_guestbot.mjs` is a manual helper — a headless guest that joins a room by code
and plays with scripted input, useful for testing a real browser host against a
remote peer:

```bash
node _guestbot.mjs <ROOM_CODE> [charIndex]
```

## Deploy (Railway or similar)

The relay is a standard Node service:

- Start command: `npm start`
- It binds `process.env.PORT` (Railway sets this automatically).
- No env vars required.

After deploying, point the client at the relay by setting `VITE_RELAY_URL` at
build time, e.g.:

```bash
VITE_RELAY_URL=wss://your-relay.up.railway.app npm run build
```

(or, for a quick test without rebuilding, run
`localStorage.setItem('relayUrl','wss://…')` in the browser console).
