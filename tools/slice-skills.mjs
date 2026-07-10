// Slices "Character Skills.png" (6 character rows x 4 skill icons) into a skill
// icon atlas. The sheet has a baked light background; we key it out via an
// edge-seeded flood fill (so enclosed bright cores like Holy Light survive),
// then bbox-tighten each icon cell. Rows map to ROSTER order.
// Output: public/assets/skills.png + skills.json + tools/debug-skills.png
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'Characters', 'Character Skills.png');
const ALPHA_MIN = 24;

const png = PNG.sync.read(fs.readFileSync(SHEET));
const { width: W, height: H, data } = png;

// key out the baked light background — flood fill from the image edges only, so
// bright regions enclosed by an icon's border (white spell cores) are preserved.
const isB = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 18; };
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

// icon cell windows (detected via non-background projection). 4 columns x 6 rows.
// row order = ROSTER order; each character's 4 icons = [shot, focus, bomb, special].
const COLS = [[240, 420], [447, 626], [652, 833], [858, 1039]];
const ROWS = [[24, 207], [263, 441], [496, 675], [730, 907], [960, 1133], [1180, 1349]];
const CHARS = ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri'];

const manifest = { sheet: 'skills.png', size: { w: W, h: H }, skills: {} };
const debug = [];
CHARS.forEach((id, r) => {
  const [y0, y1] = ROWS[r];
  manifest.skills[id] = COLS.map(([x0, x1]) => {
    const box = bbox(x0 - 3, y0 - 3, x1 + 3, y1 + 3) ?? { x: x0, y: y0, w: 4, h: 4 };
    debug.push(box);
    return box;
  });
});

const outDir = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'skills.png'), PNG.sync.write(png));
fs.writeFileSync(path.join(outDir, 'skills.json'), JSON.stringify(manifest, null, 2));

// debug overlay
const put = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = 255; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; };
for (const rct of debug) { for (let x = rct.x; x < rct.x + rct.w; x++) { put(x, rct.y); put(x, rct.y + rct.h - 1); } for (let y = rct.y; y < rct.y + rct.h; y++) { put(rct.x, y); put(rct.x + rct.w - 1, y); } }
fs.writeFileSync(path.join(ROOT, 'tools', 'debug-skills.png'), PNG.sync.write(png));

for (const [id, boxes] of Object.entries(manifest.skills)) console.log(`${id}: ${boxes.map((b) => `${b.w}x${b.h}`).join(' ')}`);
console.log('wrote public/assets/skills.png + skills.json');
