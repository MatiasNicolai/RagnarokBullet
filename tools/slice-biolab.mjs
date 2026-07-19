// Slices "Biolab bosses 001.png" (light bg, transposed 10 pose rows x 3 frames)
// into bosses3.{png,json}: Seyren Windsor + Magaleta — the two simultaneous
// final bosses (both in the boss namespace). idle/moveL/moveR keep their 3-frame
// strips; hit/attack stay single-frame. Per-pixel neutral-white keying (strict,
// to preserve Seyren's near-white hair), fixed 3-column division per row.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'Monsters', 'Biolab bosses 001.png');
const ALPHA_MIN = 24;
const POSE_KEYS = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
const ANIMATED = new Set(['idle', 'moveL', 'moveR']);

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// Per-pixel key: neutral near-white pixels are background (the checkerboard has
// two light-neutral shades — catch both). Loose enough to clear the backdrop,
// tight enough that Seyren's shaded/outlined white hair survives.
for (let p = 0; p < W * H; p++) {
  const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.min(r, g, b) >= 233 && Math.max(r, g, b) - Math.min(r, g, b) <= 10) data[i + 3] = 0;
}
const A = (x, y) => data[(y * W + x) * 4 + 3];
function bbox(x0, y0, x1, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > ALPHA_MIN) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
  return mxX < mnX ? null : { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
}

const ROW_Y = [133, 228, 325, 425, 519, 646, 742, 839, 931, 1036];
const HALF = 50;
const COLS = 3;
const PANELS = [
  { name: 'seyren', gx0: 125, gx1: 495 },
  { name: 'magaleta', gx0: 660, gx1: 1098 },
];

function rowCells(gx0, gx1, cy, count) {
  const y0 = cy - HALF, y1 = cy + HALF;
  const cellW = (gx1 - gx0) / COLS;
  const out = [];
  for (let f = 0; f < count; f++) {
    const cx0 = Math.round(gx0 + f * cellW) + 2;
    const cx1 = Math.round(gx0 + (f + 1) * cellW) - 2;
    out.push(bbox(cx0, y0, cx1, y1) ?? { x: cx0, y: cy - 20, w: 4, h: 4 });
  }
  return out;
}

const manifest = { sheet: 'bosses3.png', size: { w: W, h: H }, bosses: {} };
const debug = [];
for (const p of PANELS) {
  const entry = { down: {}, up: {} };
  ROW_Y.forEach((cy, r) => {
    const pose = POSE_KEYS[r % 5];
    const side = r < 5 ? entry.down : entry.up;
    side[pose] = rowCells(p.gx0, p.gx1, cy, ANIMATED.has(pose) ? COLS : 1);
    debug.push(...side[pose]);
  });
  manifest.bosses[p.name] = entry;
}

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bosses3.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'bosses3.json'), JSON.stringify(manifest, null, 2));

const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-biolab.png'), PNG.sync.write(png));

for (const [n, e] of Object.entries(manifest.bosses)) console.log(`${n}: ` + POSE_KEYS.map((k) => `${k}:${e.down[k].length}`).join(' '));
console.log('wrote bosses3.png + bosses3.json');
