// Slices "Images/Items001.png" (light-background sheet, 3 animated rows) into an
// item atlas: a flipping monster card (8 frames), a zeny coin bag (4), and a
// blue potion (4). Keys out the light background via an edge-seeded flood fill
// (so the potion's inner white sparkles survive), detects rows then frames by
// gaps, and bbox-tightens each frame.
// Output: public/assets/items.png + items.json + tools/debug-items.png
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'Images', 'Items001.png');
const ALPHA_MIN = 24;

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// key the light background — flood fill from the edges only so light details
// enclosed by an item (sparkles, coin sheen) are preserved.
const isB = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 16; };
{
  const seen = new Uint8Array(W * H), q = new Uint32Array(W * H);
  let t = 0;
  const push = (p) => { if (!seen[p] && isB(p * 4)) { seen[p] = 1; q[t++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  let h = 0;
  while (h < t) {
    const p = q[h++]; const x = p % W, y = (p / W) | 0;
    if (x > 0) push(p - 1); if (x < W - 1) push(p + 1);
    if (y > 0) push(p - W); if (y < H - 1) push(p + W);
  }
  for (let p = 0; p < W * H; p++) if (seen[p]) data[p * 4 + 3] = 0;
}
const A = (x, y) => data[(y * W + x) * 4 + 3];

function bbox(x0, y0, x1, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > ALPHA_MIN) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
  if (mxX < mnX) return null;
  return { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
}

// detect the 3 horizontal rows (non-transparent bands)
const rowHas = (y) => { for (let x = 0; x < W; x++) if (A(x, y) > ALPHA_MIN) return true; return false; };
const rows = [];
{ let s = -1; for (let y = 0; y <= H; y++) { const on = y < H && rowHas(y); if (on) { if (s < 0) s = y; } else if (s >= 0) { if (y - 1 - s > 25) rows.push([s, y - 1]); s = -1; } } }

// within a row band, split into frames by transparent column gaps (tolerating
// small holes so a sprite's internal gaps don't over-split)
function rowFrames(y0, y1) {
  const colHas = (x) => { for (let y = y0; y <= y1; y++) if (A(x, y) > ALPHA_MIN) return true; return false; };
  const frames = []; let s = -1, hole = 0;
  for (let x = 0; x <= W; x++) {
    const on = x < W && colHas(x);
    if (on) { if (s < 0) s = x; hole = 0; }
    else if (s >= 0 && ++hole > 6) { const b = bbox(s, y0, x - hole, y1); if (b) frames.push(b); s = -1; }
  }
  return frames;
}

const ITEMS = ['card', 'zeny', 'potion']; // row order in the sheet
const manifest = { sheet: 'items.png', size: { w: W, h: H }, items: {} };
const debug = [];
rows.forEach(([y0, y1], i) => {
  const name = ITEMS[i];
  if (!name) return;
  const frames = rowFrames(y0, y1);
  manifest.items[name] = frames;
  debug.push(...frames);
});

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'items.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(manifest, null, 2));

// debug overlay
const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-items.png'), PNG.sync.write(png));

for (const [n, f] of Object.entries(manifest.items)) console.log(`${n}: ${f.length} frames  [${f.map((b) => `${b.w}x${b.h}`).join(' ')}]`);
console.log('wrote public/assets/items.png + items.json');
