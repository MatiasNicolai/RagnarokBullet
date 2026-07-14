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

// The extraction band overlaps the row above, so a frame can start with a WIDE
// strip of the neighbour sprite's feet/shadow before the boss's narrow head
// begins (occupancy profile: ~60% wide rows, sharp drop to horn tips, then the
// body widens again). Trim leading rows while they stay suspiciously wide.
function clipTopResidue(box, cy) {
  const wide = box.w * 0.38;
  let top = box.y;
  while (top < cy - 15) {
    let c = 0;
    for (let x = box.x; x < box.x + box.w; x++) if (A(x, top) > ALPHA_MIN) c++;
    if (c < wide) break;
    top++;
  }
  if (top === box.y) return box;
  return bbox(box.x, top, box.x + box.w - 1, box.y + box.h - 1) ?? box;
}

// Detect the animation frames of one pose row by the transparent gaps between
// the sprite copies (the art is packed tighter than an even 3-way division —
// fixed cells slice through capes). Runs of content columns are split at gaps,
// then size-filtered: some rows carry a lying weapon / detached slash effect as
// their last "frame" (Baphomet's scythe), which is wide-but-flat or huge — not
// a boss frame. Falls back to the even-division frame 0 if detection finds
// nothing sensible.
function rowFrames(gx0, gx1, cy, maxFrames = 3) {
  const y0 = cy - 32, y1 = cy + 30;
  const counts = new Array(gx1 - gx0 + 1).fill(0);
  for (let x = gx0; x <= gx1; x++) for (let y = y0; y <= y1; y++) if (A(x, y) > ALPHA_MIN) counts[x - gx0]++;
  // content runs, tolerating tiny holes (<=2 px)
  const runs = [];
  let start = -1, hole = 0;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] > 0;
    if (on) { if (start < 0) start = i; hole = 0; }
    else if (start >= 0 && ++hole > 2) { runs.push([start, i - hole]); start = -1; }
  }
  if (start >= 0) runs.push([start, counts.length - 1]);
  // A boss frame can fuse with its lying weapon via a thin handle (Baphomet's
  // scythe): inside over-wide runs, cut at the first sustained thin valley
  // (>=8 consecutive columns under 12 px of content) after real body columns,
  // and keep only the body segment.
  const split = [];
  for (const [a, b] of runs) {
    if (b - a + 1 <= 130) { split.push([a, b]); continue; }
    let body = 0, thin = 0, cut = -1;
    for (let i = a; i <= b; i++) {
      if (counts[i] >= 12) { body++; thin = 0; }
      else if (body >= 30 && ++thin >= 8) { cut = i - thin; break; }
    }
    if (cut > 0) split.push([a, cut]); else split.push([a, b]);
  }
  const frames = [];
  for (const [a, b] of split) {
    if (b - a < 30) continue;                       // specks / stray pixels
    let box = bbox(gx0 + a, y0, gx0 + b, y1);
    if (!box) continue;
    box = clipTopResidue(box, cy);
    if (box.h < 38) continue;                       // lying weapon strip, not a boss
    if (box.w > 130) continue;                      // fused slash effect spanning cells
    frames.push(box);
  }
  return frames.slice(0, maxFrames);
}

// Main bosses are ANIMATED on idle/move poses: the manifest stores an array of
// frames per pose. attack/hit keep a single (frame 0) rect — their extra cells
// hold detached slash effects that would flash badly if cycled.
const ANIMATED = new Set(['idle', 'moveL', 'moveR']);
for (const b of BOSSES) {
  const frame0 = sliceGrid(b.gx0, b.gx1, COLS, ROW_Y, FRAME);
  const entry = { down: {}, up: {} };
  for (let r = 0; r < ROW_Y.length; r++) {
    const pose = POSE_KEYS[r % 5];
    let frames;
    if (ANIMATED.has(pose)) {
      frames = rowFrames(b.gx0, b.gx1, ROW_Y[r]);
      if (frames.length < 2) frames = [frame0[r]];
    } else {
      frames = [frame0[r]];
    }
    (r < 5 ? entry.down : entry.up)[pose] = frames;
    debug.push(...frames);
  }
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
  // Doppelganger gx0 nudged right of 80 to clear the "MOVE L" label-tag arrow
  // that pokes into frame 0's left edge.
  { name: 'doppelganger', gx0: 98, gx1: 566, upKeys: ['idle', 'moveR', 'hit', 'attack'] },
  { name: 'bapho_jr_giant', gx0: 650, gx1: 1114, upKeys: ['idle', 'moveL', 'hit', 'attack'] },
];

// Mid-bosses are animated too. Unlike the packed main-boss art, their 4 frames
// sit on an EVEN 4-column grid — but the Doppelganger's afterimage/dash trails
// bleed a faint streak across the gaps, which defeats gap-run detection (it
// merges the whole row). So use fixed 4-column cells, bbox-tightened per cell
// with the top-residue clip; the minor trail bleed into a cell reads as motion.
// idle/moveL/moveR become frame arrays; hit/attack + up poses stay single.
const MID_ANIM = new Set(['idle', 'moveL', 'moveR']);
const midManifest = { sheet: 'bosses.png', size: { w: W, h: H }, monsters: {} };
for (const b of MID_BOSSES) {
  // 4 grid columns, but only the first 3 are character animation frames — the
  // 4th cell is an effect (Doppelganger's afterimage bar / Baphomet's lying
  // scythe), just like the main bosses' detached-weapon cells.
  const cells = [0, 1, 2].map((f) => sliceGrid(b.gx0, b.gx1, MID_COLS, MID_ROW_Y, f));
  const entry = { down: {}, up: {} };
  MID_ROW_Y.forEach((cy, r) => {
    const key = r < 5 ? MID_DOWN_KEYS[r] : b.upKeys[r - 5];
    const side = r < 5 ? entry.down : entry.up;
    const clip = (box) => (box.w > 8 ? clipTopResidue(box, cy) : box);
    if (r < 5 && MID_ANIM.has(key)) {
      const frames = cells.map((cell) => clip(cell[r])).filter((box) => box.w > 8 && box.h >= 24);
      side[key] = frames.length >= 2 ? frames : [clip(cells[0][r])];       // array
    } else {
      side[key] = clip(cells[0][r]);                                       // single rect
    }
    debug.push(...(Array.isArray(side[key]) ? side[key] : [side[key]]));
  });
  // Both mid-boss panels' ornate title banners dip into their DOWN IDLE row,
  // so that row extracts banner art. moveL is the next row down (clean) and
  // visually near-identical to idle — reuse its frame strip.
  entry.down.idle = entry.down.moveL;
  midManifest.monsters[b.name] = entry;
}
fs.writeFileSync(path.join(outDir, 'monsters5.json'), JSON.stringify(midManifest, null, 2));

// debug overlay
const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const r of debug) { if (!r) continue; for (let x = r.x; x < r.x + r.w; x++) { put(x, r.y); put(x, r.y + r.h - 1); } for (let y = r.y; y < r.y + r.h; y++) { put(r.x, y); put(r.x + r.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-bosses.png'), PNG.sync.write(png));

for (const [n, e] of Object.entries(manifest.bosses)) console.log(n, ['idle','moveL','moveR','hit','attack'].map(p=>p+':'+e.down[p].length).join(' '));
for (const [n, e] of Object.entries(midManifest.monsters)) console.log(`${n}: down ${Object.keys(e.down).length} up ${Object.keys(e.up).length}`);
console.log('wrote public/assets/bosses.png + bosses.json + monsters5.json (shares bosses.png as its sheet)');
