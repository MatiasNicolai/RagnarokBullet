// Deterministic lockstep driver. Both clients run the exact same sim from the
// same seed and only exchange per-tick input bitmasks. A tick is simulated only
// once BOTH players' inputs for it are known, so the two sims can never diverge
// from missing input — the cost is latency, hidden by a fixed input delay D:
// input sampled now is applied D ticks in the future, giving the network D ticks
// (~D*16ms) of slack to deliver it before the sim has to stall and wait.
//
// A periodic state checksum is exchanged to catch any *logic* desync (a bug that
// breaks determinism) early rather than letting the two games silently drift.
import { tickSim } from '../sim/sim.js';
import { TICK_RATE } from '../sim/constants.js';

const TICK_MS = 1000 / TICK_RATE;
export const INPUT_DELAY = 3;         // ticks of buffered latency (~50ms @60Hz)
const CHECKSUM_INTERVAL = 30;         // exchange a state hash every N ticks
const MAX_LEAD = INPUT_DELAY + 8;     // stop sampling if this far ahead of sim

// Cheap, order-independent 32-bit hash of the deterministic sim state. Enough to
// flag a divergence within a few frames of it happening.
export function simChecksum(sim) {
  let h = 2166136261 ^ sim.tick;
  const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  mix(sim.score);
  for (const p of sim.players) {
    if (!p) { mix(0xdead); continue; }
    mix(p.x * 8); mix(p.y * 8); mix(p.lives); mix(p.bombs); mix(p.down ? 1 : 0); mix(p.meter);
  }
  if (sim.boss) { mix(sim.boss.hp); mix(sim.boss.cardIndex ?? 0); mix(sim.boss.x * 8); mix(sim.boss.y * 8); }
  let e = 0;
  for (const en of sim.enemies.active) e = (e + (en.x | 0) * 31 + (en.y | 0) * 17 + (en.hp | 0)) >>> 0;
  mix(e); mix(sim.enemies.active.length);
  let b = 0;
  for (const bl of sim.enemyBullets.active) b = (b + (bl.x | 0) * 13 + (bl.y | 0) * 7) >>> 0;
  mix(b); mix(sim.enemyBullets.active.length);
  return h >>> 0;
}

export class LockstepDriver {
  // net: NetClient (already in a room, both peers present)
  // sim: created identically on both sides; stage: level script
  // localSlot: this client's player index (0 host / 1 guest)
  // sampleLocal: () => mask for the local player this frame
  constructor({ net, sim, stage, localSlot, sampleLocal, onStall, onDesync, epoch = 0 }) {
    this.net = net;
    this.sim = sim;
    this.stage = stage;
    this.localSlot = localSlot;
    this.remoteSlot = localSlot ^ 1;
    this.sampleLocal = sampleLocal;
    this.onStall = onStall || (() => {});
    this.onDesync = onDesync || (() => {});
    this.epoch = epoch;         // level session id (ignore frames from other levels)

    this.local = new Map();     // tick -> local player's mask
    this.remote = new Map();    // tick -> remote player's mask
    this.ourChecks = new Map();   // tick -> our checksum, awaiting peer's
    this.peerChecks = new Map();  // tick -> peer's checksum, awaiting ours
    this.simTick = 0;           // number of ticks already simulated
    this.inputTick = 0;         // next tick we'll assign sampled local input to
    this.acc = 0;
    this.stalled = false;
    this.desynced = false;

    // Seed the first D ticks with neutral input and send them. Both peers do
    // this, so each receives the other's ticks 0..D-1 and can start immediately.
    for (let t = 0; t < INPUT_DELAY; t++) { this.local.set(t, 0); this.net.sendInput(t, 0, epoch); }
    this.inputTick = INPUT_DELAY;

    this._offInput = net.on('input', (m) => { if ((m.epoch | 0) === this.epoch) this.remote.set(m.tick, m.mask | 0); });
    this._offSync = net.on('sync', (m) => { if ((m.epoch | 0) === this.epoch) this._peerSync(m.tick, m.sum >>> 0); });
  }

  _peerSync(tick, sum) {
    const ours = this.ourChecks.get(tick);
    if (ours === undefined) { this.peerChecks.set(tick, sum); return; } // arrived before we simulated it
    if (ours !== sum && !this.desynced) { this.desynced = true; this.onDesync(tick); }
    this.ourChecks.delete(tick);
  }

  // Advance real time; sample+send local input at the tick rate and simulate
  // every tick for which both inputs are now available.
  advance(dtMs) {
    if (this.desynced) return;
    this.acc = Math.min(this.acc + dtMs, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      // produce one local input for a future tick (bounded lead so a stalled
      // peer can't make us buffer unboundedly)
      if (this.inputTick - this.simTick <= MAX_LEAD) {
        const mask = this.sampleLocal() | 0;
        this.local.set(this.inputTick, mask);
        this.net.sendInput(this.inputTick, mask, this.epoch);
        this.inputTick++;
      }
    }
    // catch simulation up to whatever inputs we have from both sides
    let ranAny = false;
    while (this.local.has(this.simTick) && this.remote.has(this.simTick)) {
      const inputs = [];
      inputs[this.localSlot] = this.local.get(this.simTick);
      inputs[this.remoteSlot] = this.remote.get(this.simTick);
      tickSim(this.sim, inputs, this.stage);
      // periodic checksum exchange
      if (this.simTick % CHECKSUM_INTERVAL === 0) {
        const sum = simChecksum(this.sim);
        this.net.sendSync(this.simTick, sum, this.epoch);
        const peer = this.peerChecks.get(this.simTick);
        if (peer !== undefined) {
          if (peer !== sum && !this.desynced) { this.desynced = true; this.onDesync(this.simTick); }
          this.peerChecks.delete(this.simTick);
        } else {
          this.ourChecks.set(this.simTick, sum);
        }
      }
      this.local.delete(this.simTick);
      this.remote.delete(this.simTick);
      this.simTick++;
      ranAny = true;
    }
    // stalled = we have local input queued but are waiting on the peer's
    const waiting = this.local.has(this.simTick) && !this.remote.has(this.simTick);
    if (waiting !== this.stalled) { this.stalled = waiting; this.onStall(waiting); }
    return ranAny;
  }

  destroy() { this._offInput?.(); this._offSync?.(); }
}
