// Slices "Juperos bosses 001.png" (light bg, transposed layout: 10 pose rows x
// 3 animation frames, labels on the left) into:
//   - bosses2.{png,json}: Vesper (final boss) — animated, boss namespace
//   - monsters7.json: Archdam (mid-boss) — animated, monsters namespace,
//     sharing bosses2.png as its sheet.
// idle/moveL/moveR keep their 3-frame strips; hit/attack stay single-frame
// (their extra cells carry muzzle/effect splatter). Same recipe as the main
// bosses, tuned for this sheet's grid.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'Monsters', 'Juperos bosses 001.png');
const ALPHA_MIN = 24;
const POSE_KEYS = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
const ANIMATED = new Set(['idle', 'moveL', 'moveR']);

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// Key the background per-pixel: the bosses are light *metallic* but their light
// pixels are tinted (gold/cyan, high channel spread), whereas the backdrop is a
// neutral near-white. A flood fill leaks through the light bodies, so classify
// each pixel directly — near-neutral-white → transparent, everything else (tinted
// or dark, incl. shadows) → kept.
{
  for (let p = 0; p < W * H; p++) {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) >= 235 && Math.max(r, g, b) - Math.min(r, g, b) <= 8) data[i + 3] = 0;
  }
}
const A = (x, y) => data[(y * W + x) * 4 + 3];
function bbox(x0, y0, x1, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > ALPHA_MIN) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
  return mxX < mnX ? null : { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
}

// pose-row centers (measured from the label tags; shared by both panels)
const ROW_Y = [142, 262, 374, 488, 600, 740, 851, 955, 1063, 1175];
const HALF = 52; // half the pose-row height
const COLS = 3;
const PANELS = [
  { name: 'archdam', gx0: 100, gx1: 515, out: 'monster' }, // mid-boss
  { name: 'vesper', gx0: 660, gx1: 1075, out: 'boss' },     // final boss
];

// Fixed even 3-column division per row (the grid is regular), each cell
// bbox-tightened. Returns `count` frames for the row.
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

const bossManifest = { sheet: 'bosses2.png', size: { w: W, h: H }, bosses: {} };
const midManifest = { sheet: 'bosses2.png', size: { w: W, h: H }, monsters: {} };
const debug = [];

for (const p of PANELS) {
  const entry = { down: {}, up: {} };
  ROW_Y.forEach((cy, r) => {
    const pose = POSE_KEYS[r % 5];
    const side = r < 5 ? entry.down : entry.up;
    side[pose] = rowCells(p.gx0, p.gx1, cy, ANIMATED.has(pose) ? COLS : 1);
    debug.push(...side[pose]);
  });
  if (p.out === 'boss') bossManifest.bosses[p.name] = entry;
  else midManifest.monsters[p.name] = entry;
}

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bosses2.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'bosses2.json'), JSON.stringify(bossManifest, null, 2));
fs.writeFileSync(path.join(outDir, 'monsters7.json'), JSON.stringify(midManifest, null, 2));

const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-juperos.png'), PNG.sync.write(png));

for (const [n, e] of Object.entries(bossManifest.bosses)) console.log(`boss ${n}: ` + POSE_KEYS.map((k) => `${k}:${e.down[k].length}`).join(' '));
for (const [n, e] of Object.entries(midManifest.monsters)) console.log(`mid ${n}: ` + POSE_KEYS.map((k) => `${k}:${e.down[k].length}`).join(' '));
console.log('wrote bosses2.png + bosses2.json + monsters7.json');
