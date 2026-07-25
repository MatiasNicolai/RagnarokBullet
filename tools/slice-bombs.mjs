// Slices the per-class bomb FX sheets (Characters/*.png) into a single packed
// atlas. Each source sheet is a 4-frame horizontal strip (small -> peak -> fade)
// on a PURE BLACK background. We do NOT key the black: these are glowing FX that
// render with additive blend in-engine, where black adds nothing (perfect free
// transparency, no keying artifacts). We just cut the 4 frames and box-downscale
// them into a grid.
// Output: public/assets/bombsfx.png + bombsfx.json
//   frames: { aramir:[{x,y,w,h}x4], chel_snip:[...], dposada:[...], viri:[...] }
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const S = 320;          // per-frame output size (square)
const PAD = 8;          // black gutter between frames so sampling can't bleed
const CELL = S + PAD * 2;
const FRAMES = 4;

// source sheet -> atlas key (Zeos reuses aramir's slash, tinted in-engine)
const SHEETS = [
  { file: 'Characters/Aramir bomb.png', key: 'aramir' },
  { file: 'Characters/Chel bomb.png', key: 'chel_snip' },
  { file: 'Characters/Dposada bommb.png', key: 'dposada' },
  { file: 'Characters/Viri bommb.png', key: 'viri' },
];

// Box-average downscale one src frame region into the atlas at (dx0, dy0).
function blit(src, sx0, sy0, sw, sh, dst, dx0, dy0) {
  const ax = sw / S, ay = sh / S;
  for (let oy = 0; oy < S; oy++) {
    for (let ox = 0; ox < S; ox++) {
      const bx0 = Math.floor(ox * ax), bx1 = Math.max(bx0 + 1, Math.floor((ox + 1) * ax));
      const by0 = Math.floor(oy * ay), by1 = Math.max(by0 + 1, Math.floor((oy + 1) * ay));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = by0; yy < by1; yy++) {
        for (let xx = bx0; xx < bx1; xx++) {
          const si = ((sy0 + yy) * src.width + (sx0 + xx)) * 4;
          r += src.data[si]; g += src.data[si + 1]; b += src.data[si + 2]; a += src.data[si + 3]; n++;
        }
      }
      const di = ((dy0 + oy) * dst.width + (dx0 + ox)) * 4;
      dst.data[di] = r / n; dst.data[di + 1] = g / n; dst.data[di + 2] = b / n;
      dst.data[di + 3] = a / n; // opaque source stays opaque; additive ignores it anyway
    }
  }
}

const out = new PNG({ width: CELL * FRAMES, height: CELL * SHEETS.length });
// background stays black (0,0,0,255); additive blend renders black as nothing,
// so the PAD gutter is invisible in-engine but stops any edge-sample bleed.
for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const frames = {};

SHEETS.forEach((sheet, row) => {
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, sheet.file)));
  const fw = Math.floor(src.width / FRAMES);   // 627
  const fh = src.height;                        // 627
  frames[sheet.key] = [];
  for (let f = 0; f < FRAMES; f++) {
    const dx = f * CELL + PAD, dy = row * CELL + PAD;   // inset by PAD inside the cell
    blit(src, f * fw, 0, fw, fh, out, dx, dy);
    frames[sheet.key].push({ x: dx, y: dy, w: S, h: S });
  }
  console.log(`sliced ${sheet.key}: ${FRAMES} frames from ${src.width}x${src.height}`);
});

fs.writeFileSync(path.join(ROOT, 'public/assets/bombsfx.png'), PNG.sync.write(out));
fs.writeFileSync(
  path.join(ROOT, 'public/assets/bombsfx.json'),
  JSON.stringify({ sheet: 'bombsfx.png', size: { w: out.width, h: out.height }, frames }, null, 0),
);
console.log('wrote public/assets/bombsfx.png + bombsfx.json', out.width + 'x' + out.height);
