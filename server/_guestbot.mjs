// Manual test helper (not shipped): a headless online GUEST that joins a room by
// code, picks a character, readies up, waits for the host to start, then plays
// the level via the real lockstep driver with scripted input. Lets us test the
// browser HOST against a real remote peer without a second browser.
// Usage: node server/_guestbot.mjs <CODE> [charIndex]
import { WebSocket } from 'ws';
import { NetClient } from '../src/net/netclient.js';
import { LockstepDriver, simChecksum } from '../src/net/lockstep.js';
import { createSim } from '../src/sim/sim.js';
import { level1 } from '../src/levels/level1.js';
import { ROSTER } from '../src/characters/index.js';
import { BTN } from '../src/engine/input.js';

const CODE = (process.argv[2] || '').toUpperCase();
const CHAR = Number(process.argv[3] ?? 1);
if (CODE.length !== 4) { console.error('need a 4-letter code'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// wander + fire so the host visibly sees the remote player moving
function scripted() {
  let s = 0x1234567;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    let m = BTN.FIRE;
    const ph = (s >>> 8) & 0xff;
    if (ph < 80) m |= BTN.LEFT; else if (ph < 160) m |= BTN.RIGHT;
    if ((s & 3) === 0) m |= BTN.UP; else if ((s & 3) === 1) m |= BTN.DOWN;
    return m;
  };
}

const net = new NetClient({ url: 'ws://localhost:8090', WebSocket });
let started = null;
net.on('start', (m) => { started = m; });
net.on('error', (m) => console.log('guest error:', m.msg));
net.on('peerleft', () => console.log('guest: host left'));

await net.connect();
console.log('guest connected, joining', CODE);
net.join(CODE);
await sleep(300);
net.sendLobby(ROSTER[CHAR].id, true);   // pick char + ready immediately
console.log('guest ready as', ROSTER[CHAR].name);

// wait for host to start (up to 60s)
for (let i = 0; i < 600 && !started; i++) await sleep(100);
if (!started) { console.log('guest: no start received, exiting'); process.exit(0); }
console.log('guest: START received, chars =', started.chars);

const sim = createSim(0xc0ffee, started.chars.map((id) => ROSTER.find((c) => c.id === id)), null, 0, started.diff ?? 1);
let desync = -1;
const driver = new LockstepDriver({
  net, sim, stage: level1, localSlot: 1, epoch: 0,
  sampleLocal: scripted(), onDesync: (t) => { desync = t; },
});

const FRAME = 1000 / 60;
let last = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  driver.advance(now - last);
  last = now;
  if (sim.tick % 60 === 0) console.log(`guest tick=${sim.tick} score=${sim.score} sum=${simChecksum(sim)} stall=${driver.stalled}`);
  if (desync >= 0) { console.log('guest DESYNC at', desync); clearInterval(timer); process.exit(1); }
  if (sim.tick > 1400 || sim.gameOver || sim.levelComplete) {
    console.log(`guest done tick=${sim.tick} score=${sim.score} sum=${simChecksum(sim)} over=${sim.gameOver} complete=${sim.levelComplete}`);
    clearInterval(timer); net.close(); process.exit(0);
  }
}, FRAME);
