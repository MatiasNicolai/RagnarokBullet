// Slices "Bosses.png" (transposed layout: pose rows labelled on the left, 3
// animation frames per row) into a boss atlas. Projection fails here because
// frames/weapons bridge rows, so we divide each panel's sprite grid evenly
// (10 pose rows x 3 frame cols) and bbox-tighten the leftmost frame of each
// pose. Rows map to: down.idle/moveL/moveR/hit/attack, up.(same).
// Output: public/assets/bosses.png + bosses.json + tools/debug-bosses.png
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'monsters', 'Bosses.png');
const ALPHA_MIN = 24;
const POSE_KEYS = ['idle', 'moveL', 'moveR', 'hit', 'attack']; // per facing, in row order

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// key out the light background (large connected bright-neutral regions)
const isB = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 18; };
{
  const seen = new Uint8Array(W * H), q = new Uint32Array(W * H);
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || !isB(s0 * 4)) continue;
    let h = 0, t = 0; q[t++] = s0; seen[s0] = 1; const reg = [];
    while (h < t) { const p = q[h++]; reg.push(p); const x = p % W, y = (p / W) | 0; const nb = []; if (x > 0) nb.push(p - 1); if (x < W - 1) nb.push(p + 1); if (y > 0) nb.push(p - W); if (y < H - 1) nb.push(p + W); for (const n of nb) if (!seen[n] && isB(n * 4)) { seen[n] = 1; q[t++] = n; } }
    if (reg.length > 400) for (const p of reg) data[p * 4 + 3] = 0;
  }
}

// Expansion pass: some panel interiors shade from bright to MID-gray (e.g. Dark
// Lord's), so the bright-neutral pass only strips half the backdrop. Grow the
// transparency from already-keyed pixels into adjacent neutral grays; sprite
// outlines are dark/saturated, so the erosion stops at the character edge.
{
  const isGray = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 16;
  };
  const q = new Uint32Array(W * H);
  let t = 0;
  const inQ = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (data[p * 4 + 3] === 0) { q[t++] = p; inQ[p] = 1; }
  let h = 0;
  while (h < t) {
    const p = q[h++]; const x = p % W, y = (p / W) | 0;
    const nb = [];
    if (x > 0) nb.push(p - 1); if (x < W - 1) nb.push(p + 1);
    if (y > 0) nb.push(p - W); if (y < H - 1) nb.push(p + W);
    for (const n of nb) {
      if (inQ[n] || data[n * 4 + 3] === 0) continue;
      if (isGray(n * 4)) { data[n * 4 + 3] = 0; inQ[n] = 1; q[t++] = n; }
    }
  }
}
const A = (x, y) => data[(y * W + x) * 4 + 3];

function bbox(x0, y0, x1, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > ALPHA_MIN) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
  if (mxX < mnX) return null;
  return { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
}

// Pose-row centers (measured from the left label tags; consistent across the
// 3 top panels). Each boss: the frame-area x-range (after labels, panel width),
// split into 3 animation columns; we extract the leftmost frame per pose.
const ROW_Y = [130, 184, 236, 288, 341, 399, 451, 501, 552, 606];
const BOSSES = [
  { name: 'orcHero', gx0: 88, gx1: 368 },
  { name: 'darkLord', gx0: 470, gx1: 744 },
  { name: 'baphomet', gx0: 844, gx1: 1118 },
];
const COLS = 3, FRAME = 0;

const manifest = { sheet: 'bosses.png', size: { w: W, h: H }, bosses: {} };
const debug = [];

function sliceGrid(gx0, gx1, cols, rowY, frame = 0) {
  const cellW = (gx1 - gx0) / cols;
  const cx0 = Math.round(gx0 + frame * cellW) + 3;
  const cx1 = Math.round(gx0 + (frame + 1) * cellW) - 3;
  return rowY.map((cy) => bbox(cx0, cy - 32, cx1, cy + 30) ?? { x: cx0, y: cy - 20, w: 4, h: 4 });
}

for (const b of BOSSES) {
  const boxes = sliceGrid(b.gx0, b.gx1, COLS, ROW_Y, FRAME);
  const entry = { down: {}, up: {} };
  boxes.forEach((box, r) => { (r < 5 ? entry.down : entry.up)[POSE_KEYS[r % 5]] = box; debug.push(box); });
  manifest.bosses[b.name] = entry;
}

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bosses.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'bosses.json'), JSON.stringify(manifest, null, 2));

// --- Mid-bosses: Doppelganger + Giant Baphomet Jr. ---
// Same sheet, irregular layout: 9 pose rows x 4 anim-frame cols, each missing
// a *different* UP pose (verified by cropping each panel's label column —
// Doppelganger has no UP MOVE L; Giant Baphomet Jr. has no UP MOVE R).
// These are spawned as regular sim enemies (not sim.boss), so their sprites
// belong in the *monsters* atlas namespace, not the boss namespace.
const MID_ROW_Y = [824, 871, 919, 966, 1013, 1061, 1110, 1157, 1201];
const MID_DOWN_KEYS = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
const MID_COLS = 4;
const MID_BOSSES = [
  { name: 'doppelganger', gx0: 80, gx1: 566, upKeys: ['idle', 'moveR', 'hit', 'attack'] },
  { name: 'bapho_jr_giant', gx0: 650, gx1: 1114, upKeys: ['idle', 'moveL', 'hit', 'attack'] },
];

const midManifest = { sheet: 'bosses.png', size: { w: W, h: H }, monsters: {} };
for (const b of MID_BOSSES) {
  const boxes = sliceGrid(b.gx0, b.gx1, MID_COLS, MID_ROW_Y, 0);
  const entry = { down: {}, up: {} };
  boxes.forEach((box, r) => {
    if (r < 5) entry.down[MID_DOWN_KEYS[r]] = box;
    else entry.up[b.upKeys[r - 5]] = box;
    debug.push(box);
  });
  // bapho_jr_giant's panel has a tall title banner ("GIANT BAPHOMET JR.")
  // that opaquely occludes the down.idle row in the source art, so that
  // row's bbox picks up banner text instead of the character. moveL is the
  // next row down (clean) and visually near-identical to idle, so reuse it.
  if (b.name === 'bapho_jr_giant') entry.down.idle = { ...entry.down.moveL };
  midManifest.monsters[b.name] = entry;
}
fs.writeFileSync(path.join(outDir, 'monsters5.json'), JSON.stringify(midManifest, null, 2));

// debug overlay
const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { if (!r) continue; for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-bosses.png'), PNG.sync.write(png));

for (const [n, e] of Object.entries(manifest.bosses)) console.log(`${n}: down ${Object.keys(e.down).length} up ${Object.keys(e.up).length}`);
for (const [n, e] of Object.entries(midManifest.monsters)) console.log(`${n}: down ${Object.keys(e.down).length} up ${Object.keys(e.up).length}`);
console.log('wrote public/assets/bosses.png + bosses.json + monsters5.json (shares bosses.png as its sheet)');
