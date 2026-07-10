// Thin client over the relay WebSocket. Handles the room lifecycle (host/join),
// the pre-game lobby exchange (each peer announces its chosen character + ready
// state), the host-authoritative start handshake (seed / difficulty / level /
// both characters), and in-game gameplay frames (input, sync) which it just
// hands to listeners. It never touches the sim — LockstepDriver does that.
//
// Transport is injectable (opts.WebSocket + opts.url) so the same code runs in
// the browser (global WebSocket) and headlessly in Node (the `ws` package).

// Relay endpoint resolution, in priority order:
//   1. VITE_RELAY_URL (set at build/deploy time, e.g. wss://myrelay.up.railway.app)
//   2. localStorage 'relayUrl' (handy for quick testing without a rebuild)
//   3. localhost:8090 for local dev
// The relay is a separate process (server/relay.js) — deploy it and point here.
function resolveRelayUrl() {
  try {
    const env = import.meta.env?.VITE_RELAY_URL;
    if (env) return env;
  } catch { /* import.meta.env unavailable (e.g. Node) */ }
  try {
    const ls = typeof localStorage !== 'undefined' && localStorage.getItem('relayUrl');
    if (ls) return ls;
  } catch { /* ignore */ }
  return 'ws://localhost:8090';
}

export const DEFAULT_RELAY_URL = resolveRelayUrl();

export class NetClient {
  constructor(opts = {}) {
    this.url = opts.url || DEFAULT_RELAY_URL;
    this.WS = opts.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!this.WS) throw new Error('No WebSocket implementation available');
    this.ws = null;
    this.slot = -1;          // 0 = host, 1 = guest
    this.code = null;
    this.peerPresent = false;
    this._handlers = new Map();
    // The peer's seeded input/sync frames can arrive *before* the local driver
    // has subscribed (start message still in flight). Buffer such frames and
    // replay them when a listener appears, so no early ticks are ever lost.
    this._pending = [];
  }

  get isHost() { return this.slot === 0; }
  get connected() { return this.ws && this.ws.readyState === 1; }

  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    // flush any frames of this type that arrived before a listener existed
    if (this._pending.length) {
      const still = [];
      for (const m of this._pending) { if (m.t === type) fn(m); else still.push(m); }
      this._pending = still;
    }
    return () => this._handlers.get(type)?.delete(fn);
  }

  _emit(type, payload) {
    const set = this._handlers.get(type);
    if (set && set.size) { for (const fn of set) fn(payload); return; }
    // no listener yet: buffer gameplay frames so the driver can replay them
    if (type === 'input' || type === 'sync') {
      this._pending.push(payload);
      if (this._pending.length > 512) this._pending.shift();
    }
  }

  // Open the socket. Resolves once the connection is established.
  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new this.WS(this.url); } catch (e) { return reject(e); }
      this.ws = ws;
      const onOpen = () => { cleanup(); resolve(); };
      const onErr = (e) => { cleanup(); reject(e instanceof Error ? e : new Error('connect failed')); };
      const cleanup = () => {
        ws.removeEventListener?.('open', onOpen);
        ws.removeEventListener?.('error', onErr);
      };
      // browser uses addEventListener; node `ws` also supports it
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onErr);
      ws.addEventListener('message', (ev) => this._onMessage(ev.data));
      ws.addEventListener('close', () => { this.peerPresent = false; this._emit('close'); });
    });
  }

  _onMessage(data) {
    let msg;
    try { msg = JSON.parse(typeof data === 'string' ? data : data.toString()); } catch { return; }
    switch (msg.t) {
      case 'hosted': this.slot = 0; this.code = msg.code; this._emit('hosted', msg); break;
      case 'joined': this.slot = 1; this.code = msg.code; this.peerPresent = true; this._emit('joined', msg); break;
      case 'peerjoined': this.peerPresent = true; this._emit('peerjoined', msg); break;
      case 'peerleft': this.peerPresent = false; this._emit('peerleft', msg); break;
      case 'error': this._emit('error', msg); break;
      // app-level relayed frames
      case 'lobby': this._emit('lobby', msg); break;
      case 'start': this._emit('start', msg); break;
      case 'input': this._emit('input', msg); break;
      case 'sync': this._emit('sync', msg); break;
      default: break;
    }
  }

  _send(obj) { if (this.connected) this.ws.send(JSON.stringify(obj)); }

  // --- room control ---
  host() { this._send({ t: 'host' }); }
  join(code) { this._send({ t: 'join', code: String(code).toUpperCase().trim() }); }
  leave() { this._send({ t: 'bye' }); }
  close() { try { this.ws?.close(); } catch { /* ignore */ } }

  // --- lobby ---
  sendLobby(char, ready) { this._send({ t: 'lobby', char, ready }); }
  // host only: lock in the match parameters and kick both clients into the game
  sendStart({ seed, diff, level, chars }) { this._send({ t: 'start', seed, diff, level, chars }); }

  // --- gameplay --- (epoch isolates each level's lockstep session on the
  // persistent connection, so stray frames from a finished level are ignored)
  sendInput(tick, mask, epoch = 0) { this._send({ t: 'input', tick, mask, epoch }); }
  sendSync(tick, sum, epoch = 0) { this._send({ t: 'sync', tick, sum, epoch }); }
}
