// Slices "Character assets full.png" into an atlas manifest using projection
// profiles. Layout: 3 rows x 2 cols of character blocks. Each block:
//   pose labels / 7 DOWN sprites / labels / 7 UP sprites (back view) /
//   "PROJECTILE EXAMPLE" label / projectile sprites / name banner.
// Output: public/assets/sheet.png (background keyed out) + manifest.json
//         + tools/debug-slices.png overlay.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'Character assets full.png');
const ALPHA_MIN = 24;
const POSES_DOWN = ['idle', 'moveL', 'moveR', 'bankL', 'bankR', 'hit', 'attack'];
const POSES_UP = ['upIdle', 'upMoveL', 'upMoveR', 'upBankL', 'upBankR', 'upHit', 'upAttack'];
const CHARACTERS = [
  ['aramir', 'zeos'],
  ['eric', 'viri'],
  ['dposada', 'chel_snip'],
];

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// The sheet has a baked-in white/light-gray checkerboard background (fully opaque).
// Pass 1: strict flood fill from the border over bright neutral pixels.
// Pass 2: grow the background over faint glow halos (bright, slightly tinted)
//         so sprite glows don't bleed light rectangles into the dark game world.
// Interior whites (dresses, halos) stay sealed off by dark outlines.
const bg = new Uint8Array(W * H);
function flood(isBgColored, fromBorder) {
  const queue = new Uint32Array(W * H);
  let head = 0, tail = 0;
  const push = (x, y) => {
    const p = y * W + x;
    if (bg[p] || !isBgColored(p * 4)) return;
    bg[p] = 1;
    queue[tail++] = p;
  };
  if (fromBorder) {
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  } else {
    // Seed from the current background frontier.
    for (let p = 0; p < W * H; p++) {
      if (!bg[p]) continue;
      const x = p % W, y = (p / W) | 0;
      if (x > 0) push(x - 1, y);
      if (x < W - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < H - 1) push(x, y + 1);
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
}
const neutral = (i, maxDelta, minVal) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) < maxDelta && Math.min(r, g, b) > minVal;
};
flood((i) => neutral(i, 14, 222), true);
flood((i) => neutral(i, 30, 226), false);
for (let p = 0; p < W * H; p++) if (bg[p]) data[p * 4 + 3] = 0;

const alphaAt = (x, y) => data[(y * W + x) * 4 + 3];

// --- projection profiles (opaque-pixel counts) ---

function rowCounts(x0, x1, y0 = 0, y1 = H - 1) {
  const p = new Array(H).fill(0);
  for (let y = y0; y <= y1; y++) {
    let n = 0;
    for (let x = x0; x < x1; x++) if (alphaAt(x, y) > ALPHA_MIN) n++;
    p[y] = n;
  }
  return p;
}

function colCounts(y0, y1, x0, x1) {
  const p = new Array(x1 - x0).fill(0);
  for (let x = x0; x < x1; x++) {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (alphaAt(x, y) > ALPHA_MIN) n++;
    p[x - x0] = n;
  }
  return p;
}

// Contiguous runs where counts >= threshold, merging gaps <= mergeGap,
// dropping runs shorter than minLen.
function runs(counts, threshold, mergeGap, minLen) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] >= threshold;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] - 1 <= mergeGap) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.filter(([a, b]) => b - a + 1 >= minLen);
}

// Vertical crawl: starting from a seed y-range, grow up/down inside the column
// x-range while rows keep content, tolerating up to `skip` blank rows (catches
// detached sparkles without jumping across real gaps to labels/neighbors).
function crawlY(xa, xb, seedY0, seedY1, loY, hiY, skip = 2) {
  const rowHas = (y) => {
    for (let x = xa; x <= xb; x++) if (alphaAt(x, y) > ALPHA_MIN) return true;
    return false;
  };
  let y0 = seedY0, y1 = seedY1, blanks;
  for (let y = seedY0 - 1, blanksLeft = skip; y >= loY && blanksLeft >= 0; y--) {
    if (rowHas(y)) { y0 = y; blanksLeft = skip; } else blanksLeft--;
  }
  for (let y = seedY1 + 1, blanksLeft = skip; y <= hiY && blanksLeft >= 0; y++) {
    if (rowHas(y)) { y1 = y; blanksLeft = skip; } else blanksLeft--;
  }
  return [y0, y1];
}

// Greedily merge adjacent runs across their smallest gaps until `target` remain.
function mergeToCount(rs, target) {
  rs = rs.map((r) => [...r]);
  while (rs.length > target) {
    let best = -1, bestGap = Infinity;
    for (let i = 0; i + 1 < rs.length; i++) {
      const gap = rs[i + 1][0] - rs[i][1];
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    rs[best][1] = rs[best + 1][1];
    rs.splice(best + 1, 1);
  }
  return rs;
}

// Split fused runs at their weakest interior column until `target` remain
// (sprites whose glows touch have a thin bridge — cut at the local minimum).
function splitToCount(rs, counts, offset, target) {
  rs = rs.map((r) => [...r]);
  while (rs.length < target) {
    let widest = 0;
    for (let i = 1; i < rs.length; i++) {
      if (rs[i][1] - rs[i][0] > rs[widest][1] - rs[widest][0]) widest = i;
    }
    const [a, b] = rs[widest];
    const margin = Math.max(8, ((b - a) * 0.15) | 0);
    let cut = -1, cutVal = Infinity;
    for (let x = a + margin; x <= b - margin; x++) {
      if (counts[x - offset] < cutVal) { cutVal = counts[x - offset]; cut = x; }
    }
    if (cut < 0) break;
    rs.splice(widest, 1, [a, cut - 1], [cut + 1, b]);
    rs.sort((p, q) => p[0] - q[0]);
  }
  return rs;
}

// Tight bbox of opaque pixels inside a cell.
function bbox(x0, y0, x1, y1) {
  let minX = x1, maxX = x0, minY = y1, maxY = y0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (alphaAt(x, y) > ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const manifest = { sheet: 'sheet.png', size: { w: W, h: H }, characters: {} };
const debugRects = [];

for (let half = 0; half < 2; half++) {
  const x0 = half === 0 ? 0 : Math.floor(W / 2);
  const x1 = half === 0 ? Math.floor(W / 2) : W;
  const blocks = mergeToCount(runs(rowCounts(x0, x1), 6, 25, 40), 3);
  if (blocks.length !== 3) {
    console.warn(`half ${half}: expected 3 blocks, got ${blocks.length}`);
    continue;
  }
  for (let ci = 0; ci < 3; ci++) {
    const name = CHARACTERS[ci][half];
    const entry = { poses: {}, projectiles: [], banner: null };
    const [blockY0, blockY1] = blocks[ci];
    const counts = rowCounts(x0, x1, blockY0, blockY1);

    // Dense core bands (labels are thin and filtered out by min length 16).
    // Layout top-to-bottom: DOWN sprites, UP sprites, projectiles, banner.
    // Sprite rows are the tall bands (>=60 px); of the remaining bands the
    // LAST is the banner and the ones between it and the sprites are
    // projectiles (threshold-free, robust to narrow/decorated banners).
    const cores = runs(counts, 95, 2, 16);
    const spriteBands = cores.filter(([a, b]) => b - a + 1 >= 60);
    if (spriteBands.length < 2) {
      console.warn(`${name}: expected 2 sprite rows (down/up), got ${spriteBands.length}`);
      if (!spriteBands.length) continue;
    }
    const rows = [
      { band: spriteBands[0], names: POSES_DOWN },
      spriteBands[1] ? { band: spriteBands[1], names: POSES_UP } : null,
    ].filter(Boolean);
    const lastSprite = rows[rows.length - 1].band;
    const below = cores.filter(([a]) => a > lastSprite[1]);
    const bannerBand = below.length ? below[below.length - 1] : null;
    const [bannerY0, bannerY1] = bannerBand ?? [blockY1 - 20, blockY1];
    if (!bannerBand) console.warn(`${name}: no banner band found`);

    // Projectiles live in the gap between the UP sprites and the banner, below
    // the "PROJECTILE EXAMPLE" label. Some sets (thin arrows) don't reach the
    // sprite threshold, so scan the gap with a lenient threshold and take the
    // last band (the label sits above it).
    let projBand = null;
    if (bannerBand) {
      const gap = rowCounts(x0, x1, lastSprite[1] + 3, bannerY0 - 3);
      const gapBands = runs(gap, 30, 3, 8);
      if (gapBands.length) projBand = gapBands[gapBands.length - 1];
    }
    if (!projBand) console.warn(`${name}: no projectile band separable from sprites`);

    rows.forEach(({ band, names }, rowIdx) => {
      const colCountsRow = colCounts(band[0], band[1], x0, x1);
      let poseCols = mergeToCount(runs(colCountsRow, 10, 2, 4), 7);
      poseCols = splitToCount(poseCols, colCountsRow, 0, 7);
      if (poseCols.length !== 7) console.warn(`${name} row ${rowIdx}: only ${poseCols.length} pose columns`);
      const loY = rowIdx === 0 ? blockY0 : rows[0].band[1] + 3;
      const hiY = (rowIdx < rows.length - 1
        ? rows[rowIdx + 1].band[0]
        : (projBand ? projBand[0] : bannerY0)) - 4;
      poseCols.forEach(([a, b], i) => {
        const [ya, yb] = crawlY(a + x0, b + x0, band[0], band[1], loY, hiY);
        const r = bbox(a + x0, ya, b + x0, yb);
        entry.poses[names[i] ?? `extra${rowIdx}_${i}`] = r;
        debugRects.push(r);
      });
    });

    if (projBand) {
      const projCols = runs(colCounts(projBand[0], projBand[1], x0, x1), 3, 6, 4);
      for (const [a, b] of projCols) {
        const [ya, yb] = crawlY(a + x0, b + x0, projBand[0], projBand[1],
          lastSprite[1] + 3, bannerY0 - 2);
        const r = bbox(a + x0, ya, b + x0, yb);
        entry.projectiles.push(r);
        debugRects.push(r);
      }
    }

    entry.banner = bbox(x0, bannerY0, x1 - 1, bannerY1);
    debugRects.push(entry.banner);
    manifest.characters[name] = entry;
  }
}

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sheet.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Debug overlay: red rect borders on the keyed sheet.
const put = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
};
for (const r of debugRects) {
  for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); }
  for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); }
}
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-slices.png'), PNG.sync.write(png));

for (const [name, e] of Object.entries(manifest.characters)) {
  console.log(`${name}: ${Object.keys(e.poses).length} poses, ${e.projectiles.length} projectiles, banner ${e.banner.w}x${e.banner.h}`);
}
console.log('wrote public/assets/manifest.json + tools/debug-slices.png');
