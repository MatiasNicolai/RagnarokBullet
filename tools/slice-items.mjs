// Slices the light-background item sheets into animated item atlases. Each row
// is one item; frames are split by transparent column gaps after keying out the
// light background (edge-seeded flood fill preserves inner sparkles/sheen).
//   Items001 -> items.{png,json}:  card (8-frame flip) / zeny / gem (blue bottle)
//   Items002 -> items2.{png,json}: potion / chest / leaf / awakening / speed /
//                                   kafra / bomb  (4 frames each)
// The renderer cycles the frames; atlas.js merges both maps into atlas.items.
// Output also: tools/debug-<name>.png overlays.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ALPHA_MIN = 24;

const SHEETS = [
  { src: 'Images/Items001.png', out: 'items', items: ['card', 'zeny', 'gem'] },
  { src: 'Images/Items002.png', out: 'items2', items: ['potion', 'chest', 'leaf', 'awakening', 'speed', 'kafra', 'bomb'] },
];

function processSheet({ src, out, items }) {
  const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, src)));
  const { width: W, height: H, data } = png;

  // key the light background via edge-seeded flood fill
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
  const bbox = (x0, y0, x1, y1) => {
    let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > ALPHA_MIN) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
    return mxX < mnX ? null : { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
  };

  // rows (non-transparent bands)
  const rowHas = (y) => { for (let x = 0; x < W; x++) if (A(x, y) > ALPHA_MIN) return true; return false; };
  const rows = []; { let s = -1; for (let y = 0; y <= H; y++) { const on = y < H && rowHas(y); if (on) { if (s < 0) s = y; } else if (s >= 0) { if (y - 1 - s > 25) rows.push([s, y - 1]); s = -1; } } }

  // frames within a row (split by column gaps, tolerating small internal holes)
  const rowFrames = (y0, y1) => {
    const colHas = (x) => { for (let y = y0; y <= y1; y++) if (A(x, y) > ALPHA_MIN) return true; return false; };
    const frames = []; let s = -1, hole = 0;
    for (let x = 0; x <= W; x++) {
      const on = x < W && colHas(x);
      if (on) { if (s < 0) s = x; hole = 0; }
      else if (s >= 0 && ++hole > 6) { const b = bbox(s, y0, x - hole, y1); if (b) frames.push(b); s = -1; }
    }
    return frames;
  };

  const manifest = { sheet: `${out}.png`, size: { w: W, h: H }, items: {} };
  const debug = [];
  rows.forEach(([y0, y1], i) => { const name = items[i]; if (!name) return; const f = rowFrames(y0, y1); manifest.items[name] = f; debug.push(...f); });

  const outDir = path.join(ROOT, 'public', 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${out}.png`), PNG.sync.write(png));
  fs.writeFileSync(path.join(outDir, `${out}.json`), JSON.stringify(manifest, null, 2));

  const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
  for (const r of debug) { for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
  fs.writeFileSync(path.join(ROOT, 'tools', `debug-${out}.png`), PNG.sync.write(png));

  for (const [n, f] of Object.entries(manifest.items)) console.log(`  ${n}: ${f.length} frames`);
  console.log(`wrote public/assets/${out}.png + ${out}.json`);
}

for (const cfg of SHEETS) { console.log(cfg.src); processSheet(cfg); }
