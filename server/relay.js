// Minimal WebSocket relay for Ragnarok Bullet Hell online co-op.
//
// The relay is deliberately dumb: it pairs two players into a room by a
// 4-letter code, assigns each a slot (0 = host, 1 = guest), and forwards every
// message from one peer to the other verbatim. It NEVER parses gameplay or
// simulates anything — with a deterministic lockstep sim, only input bitmasks
// (a couple of bytes per tick) travel, so the relay stays trivial and cheap.
//
// Protocol (JSON text frames). Client -> server control messages:
//   { t:'host' }                       -> server: { t:'hosted', code, slot:0 }
//   { t:'join', code }                 -> server: { t:'joined', slot:1, code }
//                                         and both get { t:'peerjoined' }
//   { t:'bye' }                        -> leave room
// Any other message with a known room is relayed to the peer unchanged, with a
// `from` slot stamped on it. When a peer disconnects the other gets
//   { t:'peerleft' }.
// Errors: { t:'error', code:'ROOM_FULL'|'NO_ROOM'|'BAD_CODE'|'IN_ROOM', msg }.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8090;
// Unambiguous alphabet (no O/0, I/1) for spoken/typed 4-letter room codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

/** @type {Map<string, {code:string, clients:(import('ws').WebSocket|null)[]}>} */
const rooms = new Map();

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) {
    code += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  }
  return code;
}

function freshCode() {
  let code, tries = 0;
  do { code = randomCode(); } while (rooms.has(code) && ++tries < 50);
  return code;
}

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function leaveRoom(ws) {
  const room = ws._room;
  if (!room) return;
  ws._room = null;
  const slot = ws._slot;
  if (room.clients[slot] === ws) room.clients[slot] = null;
  const peer = room.clients[slot ^ 1];
  if (peer) send(peer, { t: 'peerleft' });
  // reclaim the room once empty
  if (!room.clients[0] && !room.clients[1]) rooms.delete(room.code);
}

export function createRelay({ port = PORT } = {}) {
  // Attach to a tiny HTTP server so platform health checks (a plain GET) get a
  // 200 while WebSocket upgrades are handled by ws on the same port.
  const http_server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ragnarok relay ok');
  });
  const wss = new WebSocketServer({ server: http_server });

  wss.on('connection', (ws) => {
    ws._room = null;
    ws._slot = -1;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'host') {
        if (ws._room) return send(ws, { t: 'error', code: 'IN_ROOM', msg: 'Already in a room' });
        const code = freshCode();
        const room = { code, clients: [ws, null] };
        rooms.set(code, room);
        ws._room = room; ws._slot = 0;
        return send(ws, { t: 'hosted', code, slot: 0 });
      }

      if (msg.t === 'join') {
        if (ws._room) return send(ws, { t: 'error', code: 'IN_ROOM', msg: 'Already in a room' });
        const code = String(msg.code || '').toUpperCase().trim();
        if (code.length !== CODE_LEN) return send(ws, { t: 'error', code: 'BAD_CODE', msg: 'Code must be 4 letters' });
        const room = rooms.get(code);
        if (!room) return send(ws, { t: 'error', code: 'NO_ROOM', msg: 'No room with that code' });
        if (room.clients[1]) return send(ws, { t: 'error', code: 'ROOM_FULL', msg: 'Room is full' });
        room.clients[1] = ws;
        ws._room = room; ws._slot = 1;
        send(ws, { t: 'joined', code, slot: 1 });
        send(room.clients[0], { t: 'peerjoined' });
        return;
      }

      if (msg.t === 'bye') { leaveRoom(ws); return; }

      // everything else is gameplay traffic → relay to the peer verbatim
      const room = ws._room;
      if (!room) return send(ws, { t: 'error', code: 'NO_ROOM', msg: 'Not in a room' });
      const peer = room.clients[ws._slot ^ 1];
      if (peer) { msg.from = ws._slot; send(peer, msg); }
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  http_server.listen(port);
  wss.httpServer = http_server;
  return wss;
}

// Run directly (node relay.js) rather than imported by the test harness.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('relay.js')) {
  createRelay();
  console.log(`Ragnarok relay listening on :${PORT}`);
}
