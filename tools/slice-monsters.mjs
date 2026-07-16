// Slices the Prontera monster sheets into atlas PNGs + manifests.
// Each sheet has decorated panels; a panel = title banner + DOWN row (5 poses)
// + UP row (5 poses) + an effect row. A light checkerboard / white background
// is baked in (and sealed inside panel frames), so it's keyed out by removing
// large connected regions of bright-neutral pixels (small sprite highlights
// survive). Sprite rows are told apart from the banner/effect row by counting
// sprite-width columns.
// Outputs: public/assets/monsters.png + monsters.json (5 base mobs),
//          public/assets/monsters2.png + monsters2.json (Mastering, Lunatic),
//          tools/debug-monsters*.png overlays.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ALPHA_MIN = 24;
const POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack'];

function processSheet({ sheet, panels, outPng, outJson, debugPng }) {
const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, sheet)));
const { width: W, height: H, data } = png;

// --- key out the baked checkerboard / solid background ---
const isBright = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return Math.min(r, g, b) > 224 && Math.max(r, g, b) - Math.min(r, g, b) < 14;
};
{
  const seen = new Uint8Array(W * H);
  const q = new Uint32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !isBright(start * 4)) continue;
    // BFS the connected bright-neutral region
    let head = 0, tail = 0;
    q[tail++] = start; seen[start] = 1;
    const region = [];
    while (head < tail) {
      const p = q[head++];
      region.push(p);
      const x = p % W, y = (p / W) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < W - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - W);
      if (y < H - 1) nb.push(p + W);
      for (const n of nb) if (!seen[n] && isBright(n * 4)) { seen[n] = 1; q[tail++] = n; }
    }
    // large regions are background; wipe them to transparency
    if (region.length > 300) for (const p of region) data[p * 4 + 3] = 0;
  }
}

const alphaAt = (x, y) => data[(y * W + x) * 4 + 3];

// opaque-pixel row/col counts within a box
function rowCounts(x0, x1, y0, y1) {
  const p = new Array(y1 - y0 + 1).fill(0);
  for (let y = y0; y <= y1; y++) { let n = 0; for (let x = x0; x <= x1; x++) if (alphaAt(x, y) > ALPHA_MIN) n++; p[y - y0] = n; }
  return p;
}
function colCounts(y0, y1, x0, x1) {
  const p = new Array(x1 - x0 + 1).fill(0);
  for (let x = x0; x <= x1; x++) { let n = 0; for (let y = y0; y <= y1; y++) if (alphaAt(x, y) > ALPHA_MIN) n++; p[x - x0] = n; }
  return p;
}
function runs(counts, thr, mergeGap, minLen, off = 0) {
  const out = []; let s = -1;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] >= thr;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { out.push([s + off, i - 1 + off]); s = -1; }
  }
  const m = [];
  for (const r of out) { const l = m[m.length - 1]; if (l && r[0] - l[1] - 1 <= mergeGap) l[1] = r[1]; else m.push([...r]); }
  return m.filter(([a, b]) => b - a + 1 >= minLen);
}
function mergeToCount(rs, target) {
  rs = rs.map((r) => [...r]);
  while (rs.length > target) {
    let bi = 0, bg = Infinity;
    for (let i = 0; i + 1 < rs.length; i++) { const g = rs[i + 1][0] - rs[i][1]; if (g < bg) { bg = g; bi = i; } }
    rs[bi][1] = rs[bi + 1][1]; rs.splice(bi + 1, 1);
  }
  return rs;
}
function splitToCount(rs, counts, off, target) {
  rs = rs.map((r) => [...r]);
  while (rs.length < target) {
    let wi = 0; for (let i = 1; i < rs.length; i++) if (rs[i][1] - rs[i][0] > rs[wi][1] - rs[wi][0]) wi = i;
    const [a, b] = rs[wi]; const margin = Math.max(6, ((b - a) * 0.15) | 0);
    let cut = -1, cv = Infinity;
    for (let x = a + margin; x <= b - margin; x++) if (counts[x - off] < cv) { cv = counts[x - off]; cut = x; }
    if (cut < 0) break;
    rs.splice(wi, 1, [a, cut - 1], [cut + 1, b]); rs.sort((p, q2) => p[0] - q2[0]);
  }
  return rs;
}
function bbox(x0, y0, x1, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (alphaAt(x, y) > ALPHA_MIN) {
    if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y;
  }
  if (mxX < mnX) return { x: x0, y: y0, w: 1, h: 1 };
  return { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
}

// Count sprite-width columns (45..170px) in a band — this cleanly separates
// the two sprite rows (≈5 such columns) from the title banner (0: one huge
// mass) and the effect row (≈3: uneven small blobs).
function bigColCount(band, x0, x1) {
  const cc = colCounts(band[0], band[1], x0, x1);
  const r = runs(cc, 10, 2, 6, x0);
  return r.filter(([a, b]) => { const w = b - a + 1; return w >= 45 && w <= 210; }).length;
}

const manifest = { sheet: path.basename(outPng), size: { w: W, h: H }, monsters: {} };
const debug = [];

for (const panel of panels) {
  // Fixed-grid mode: for panels the auto-detector can't handle (a light/sparse
  // sprite like Lunatic, whose keyed rabbit rows fall below the density
  // threshold), slice the two given sprite bands into 5 even columns and
  // bbox-tighten each cell. panel.grid = { down:[y0,y1], up:[y0,y1] }.
  if (panel.grid) {
    const entry = { down: {}, up: {} };
    for (const key of ['down', 'up']) {
      const [gy0, gy1] = panel.grid[key];
      const cw = (panel.x1 - panel.x0 + 1) / 5;
      for (let i = 0; i < 5; i++) {
        const cx0 = Math.round(panel.x0 + i * cw) + 2;
        const cx1 = Math.round(panel.x0 + (i + 1) * cw) - 2;
        const r = bbox(cx0, gy0, cx1, gy1);
        entry[key][POSES[i]] = r;
        debug.push(r);
      }
    }
    manifest.monsters[panel.name] = entry;
    continue;
  }
  // sprite rows = tall bands that split into ~5 sprite-width columns. A high
  // row threshold (90) keeps thin decorations (puppet strings, chains) from
  // bridging the banner into the sprite rows.
  const rc = rowCounts(panel.x0, panel.x1, panel.y0, panel.y1);
  // sprite rows are ~40–120px tall; cap height to reject a banner+row or
  // row+effect merge (which would be much taller), and keep a small merge gap.
  const bands = runs(rc, 90, 3, 26, panel.y0).filter(([a, b]) => { const h = b - a + 1; return h >= 36 && h <= 130; });
  const spriteRows = bands.filter((band) => bigColCount(band, panel.x0, panel.x1) >= 4);
  if (spriteRows.length < 2) { console.warn(`${panel.name}: found ${spriteRows.length} sprite rows`, bands.map(([a, b]) => `${a}-${b}`).join(' ')); continue; }
  const rows = [{ band: spriteRows[0], key: 'down' }, { band: spriteRows[1], key: 'up' }];
  const entry = { down: {}, up: {} };
  for (const { band, key } of rows) {
    const cc = colCounts(band[0], band[1], panel.x0, panel.x1);
    // drop thin runs whose content is short (the "DOWN"/"UP" row label text, or
    // decorations) — real poses are tall; keeping the label as a column would
    // shift small-sprite mobs by one pose.
    const raw = runs(cc, 8, 3, 6, panel.x0).filter(([a, b]) => bbox(a, band[0], b, band[1]).h >= 24);
    let cols = mergeToCount(raw, 5);
    cols = splitToCount(cols, cc, panel.x0, 5);
    cols.forEach(([a, b], i) => {
      const r = bbox(a, band[0], b, band[1]);
      entry[key][POSES[i] ?? `x${i}`] = r;
      debug.push(r);
    });
  }
  manifest.monsters[panel.name] = entry;
}

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, outPng), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, outJson), JSON.stringify(manifest, null, 2));

// debug overlay
const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', debugPng), PNG.sync.write(png));

for (const [n, e] of Object.entries(manifest.monsters)) console.log(`${n}: down ${Object.keys(e.down).length} up ${Object.keys(e.up).length}`);
console.log(`wrote public/assets/${outPng} + ${outJson}`);
} // end processSheet

// Sheet 1: the 5 base mobs (1122x1402 — 2x2 grid + centered bottom).
processSheet({
  sheet: 'monsters/Prontera Monsters 001.png',
  outPng: 'monsters.png', outJson: 'monsters.json', debugPng: 'debug-monsters.png',
  panels: [
    { name: 'poring', x0: 8, x1: 555, y0: 8, y1: 470 },
    { name: 'pupa', x0: 567, x1: 1114, y0: 8, y1: 470 },
    { name: 'picky', x0: 8, x1: 555, y0: 478, y1: 940 },
    { name: 'chonchon', x0: 567, x1: 1114, y0: 478, y1: 940 },
    { name: 'orcbaby', x0: 90, x1: 1032, y0: 950, y1: 1400 },
  ],
});

// Sheet 2: Mastering + Lunatic (1448x1086 — 2 side-by-side panels).
processSheet({
  sheet: 'monsters/Prontera Mastering Lunatic.png',
  outPng: 'monsters2.png', outJson: 'monsters2.json', debugPng: 'debug-monsters2.png',
  panels: [
    { name: 'mastering', x0: 8, x1: 716, y0: 8, y1: 1082 },
    // Lunatic is a white rabbit — auto row-detection can't find its sparse keyed
    // rows, so slice it on a fixed grid (measured DOWN/UP sprite bands).
    { name: 'lunatic', x0: 732, x1: 1440, y0: 8, y1: 1082, grid: { down: [210, 356], up: [460, 645] } },
  ],
});

// Sheet 3: the 8 Geffen mobs (1122x1402 — 4x2 grid).
processSheet({
  sheet: 'monsters/Geffen monsters 001.png',
  outPng: 'monsters3.png', outJson: 'monsters3.json', debugPng: 'debug-monsters3.png',
  panels: [
    { name: 'willow', x0: 8, x1: 555, y0: 4, y1: 348 },
    { name: 'zombie', x0: 567, x1: 1114, y0: 4, y1: 348 },
    { name: 'munak', x0: 8, x1: 555, y0: 352, y1: 700 },
    { name: 'bongun', x0: 567, x1: 1114, y0: 352, y1: 700 },
    { name: 'ninetails', x0: 8, x1: 555, y0: 704, y1: 1050 },
    { name: 'deviruchi', x0: 567, x1: 1114, y0: 704, y1: 1050 },
    { name: 'marionette', x0: 8, x1: 555, y0: 1054, y1: 1398 },
    { name: 'wraith', x0: 567, x1: 1114, y0: 1054, y1: 1398 },
  ],
});

// Sheet 4: the 8 Glast Heim mobs (1122x1402 — 4x2 grid, numbered panels).
processSheet({
  sheet: 'monsters/Glast heim monsters.png',
  outPng: 'monsters4.png', outJson: 'monsters4.json', debugPng: 'debug-monsters4.png',
  panels: [
    { name: 'evildruid', x0: 8, x1: 555, y0: 4, y1: 348 },
    { name: 'darkpriest', x0: 567, x1: 1114, y0: 4, y1: 348 },
    { name: 'raydric', x0: 8, x1: 555, y0: 352, y1: 700 },
    { name: 'khalitzburg', x0: 567, x1: 1114, y0: 352, y1: 700 },
    { name: 'gargoyle', x0: 8, x1: 555, y0: 704, y1: 1050 },
    { name: 'ghoul', x0: 567, x1: 1114, y0: 704, y1: 1050 },
    { name: 'whisper', x0: 8, x1: 555, y0: 1054, y1: 1398 },
    { name: 'bapho_jr', x0: 567, x1: 1114, y0: 1054, y1: 1398 },
  ],
});

// Sheet 5: the 8 Juperos mobs (1122x1402 — 4x2 grid).
processSheet({
  sheet: 'Monsters/Juperos monsters 001.png',
  outPng: 'monsters6.png', outJson: 'monsters6.json', debugPng: 'debug-monsters6.png',
  panels: [
    { name: 'dimik', x0: 8, x1: 555, y0: 4, y1: 348 },
    { name: 'venatu', x0: 567, x1: 1114, y0: 4, y1: 348 },
    { name: 'cell', x0: 8, x1: 555, y0: 352, y1: 700 },
    { name: 'sentry', x0: 567, x1: 1114, y0: 352, y1: 700 },
    { name: 'plasma', x0: 8, x1: 555, y0: 704, y1: 1050 },
    { name: 'guardian', x0: 567, x1: 1114, y0: 704, y1: 1050 },
    { name: 'repairdrone', x0: 8, x1: 555, y0: 1054, y1: 1398 },
    { name: 'sparkbeetle', x0: 567, x1: 1114, y0: 1054, y1: 1398 },
  ],
});
