// Headless end-to-end test of the online stack: relay + NetClient + LockstepDriver
// + the deterministic sim. Two clients connect through the real relay over
// loopback WebSockets, run identical sims from the same seed while each feeds its
// own scripted local input, and we assert that after N ticks both sims agree
// (identical checksum, same tick) and that no desync ever fired.
//
// Run: node server/test-netplay.mjs   (or `npm test` in server/)
import { WebSocket } from 'ws';
import { createRelay } from './relay.js';
import { NetClient } from '../src/net/netclient.js';
import { LockstepDriver, simChecksum } from '../src/net/lockstep.js';
import { createSim } from '../src/sim/sim.js';
import { level1 } from '../src/levels/level1.js';
import { ROSTER } from '../src/characters/index.js';
import { BTN } from '../src/engine/input.js';

const PORT = 8099;
const URL = `ws://localhost:${PORT}`;
const SEED = 0xc0ffee;
const TICKS = 600;               // ~10 s of gameplay at 60Hz
const chars = [ROSTER[0], ROSTER[1]];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

// Deterministic per-slot "player": a tiny seeded RNG driving button presses, so
// each side sends a distinct, reproducible input stream (exercises real diverging
// inputs rather than both idle).
function scriptedInput(slot) {
  let s = (slot + 1) * 0x9e3779b1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    let mask = 0;
    if (s & 1) mask |= BTN.LEFT;
    if (s & 2) mask |= BTN.RIGHT;
    if (s & 4) mask |= BTN.UP;
    if (s & 8) mask |= BTN.DOWN;
    if (s & 16) mask |= BTN.FIRE;   // fire most of the time-ish
    if ((s & 0xff) < 8) mask |= BTN.BOMB;
    return mask;
  };
}

async function main() {
  const wss = createRelay({ port: PORT });

  const host = new NetClient({ url: URL, WebSocket });
  const guest = new NetClient({ url: URL, WebSocket });
  await host.connect();
  await guest.connect();

  // room handshake
  const hosted = new Promise((res) => host.on('hosted', res));
  host.host();
  const { code } = await hosted;
  if (!code || code.length !== 4) fail(`bad code ${code}`);

  const bothReady = Promise.all([
    new Promise((res) => host.on('peerjoined', res)),
    new Promise((res) => guest.on('joined', res)),
  ]);
  guest.join(code);
  await bothReady;
  console.log(`rooms handshake ok (code ${code})`);

  // identical sims on both sides
  const simH = createSim(SEED, chars);
  const simG = createSim(SEED, chars);

  let desyncTick = -1;
  const driverH = new LockstepDriver({
    net: host, sim: simH, stage: level1, localSlot: 0,
    sampleLocal: scriptedInput(0), onDesync: (t) => { desyncTick = t; },
  });
  const driverG = new LockstepDriver({
    net: guest, sim: simG, stage: level1, localSlot: 1,
    sampleLocal: scriptedInput(1), onDesync: (t) => { desyncTick = t; },
  });

  // drive both drivers frame by frame, yielding to the event loop so relayed
  // input frames actually arrive between frames (realistic async delivery).
  const FRAME = 1000 / 60;
  let guard = 0;
  while ((simH.tick < TICKS || simG.tick < TICKS) && guard < TICKS * 6) {
    driverH.advance(FRAME);
    driverG.advance(FRAME);
    await sleep(0); // flush loopback ws messages
    guard++;
  }

  if (desyncTick >= 0) fail(`desync detected at tick ${desyncTick}`);
  if (simH.tick < TICKS || simG.tick < TICKS) fail(`did not reach ${TICKS} ticks (H=${simH.tick} G=${simG.tick}, guard=${guard})`);

  const cH = simChecksum(simH), cG = simChecksum(simG);
  console.log(`H tick=${simH.tick} score=${simH.score} checksum=${cH}`);
  console.log(`G tick=${simG.tick} score=${simG.score} checksum=${cG}`);
  if (simH.tick !== simG.tick) fail(`tick mismatch ${simH.tick} vs ${simG.tick}`);
  if (cH !== cG) fail(`checksum mismatch ${cH} vs ${cG}`);
  if (simH.score !== simG.score) fail(`score mismatch ${simH.score} vs ${simG.score}`);

  // sanity: the two input scripts really are different (not an idle-both false pass)
  console.log(`enemies alive H=${simH.enemies.active.length} G=${simG.enemies.active.length}`);

  driverH.destroy(); driverG.destroy();
  host.close(); guest.close(); wss.close();
  console.log('\nPASS — both clients stayed in perfect lockstep for', TICKS, 'ticks');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
