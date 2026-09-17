// Encode the music masters in Music/ into the runtime tracks the game serves
// from public/assets/music/. Derived, reproducible output: the masters are the
// source of truth and are never modified.
//
// The masters are 166-207 kbps 48 kHz stereo and were previously shipped as
// straight copies (47 MB, a third of the deployed build). Looping background
// music does not need that headroom, so the runtime copies are re-encoded at
// 128 kbps. To go back to master-quality tracks, raise BITRATE and re-run.
//
// Run: node tools/encode-music.mjs    (needs ffmpeg on PATH)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'Music');
const OUT = path.join(ROOT, 'public/assets/music');
const BITRATE = '128k';

// master file -> runtime track name used by src/engine/music.js (MP3_TRACKS).
const TRACKS = {
  'Prontera map 001.mp3': 'prontera.mp3',
  'Geffen map 001.mp3': 'geffen.mp3',
  'Glast heim 001.mp3': 'glastheim.mp3',
  'Juperos 001.mp3': 'juperos.mp3',
  'Biolab 001.mp3': 'biolab.mp3',
  'Sunken Sun Temple 001.mp3': 'pyramid.mp3',
  'Niflheim map 001.mp3': 'niflheim.mp3',
  'Intro Menu 001.mp3': 'menu.mp3',
};

const mb = (n) => (n / 1e6).toFixed(2);
const duration = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
], { encoding: 'utf8' }).trim());

let before = 0, after = 0, failed = 0;
for (const [master, out] of Object.entries(TRACKS)) {
  const src = path.join(SRC, master);
  const dst = path.join(OUT, out);
  if (!fs.existsSync(src)) {
    console.error(`MISSING MASTER: Music/${master} (kept ${out} as-is)`);
    failed++;
    continue;
  }
  // -map_metadata -1 drops tags/timestamps so re-runs are byte-stable.
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', src,
    '-c:a', 'libmp3lame', '-b:a', BITRATE, '-map_metadata', '-1', dst,
  ]);
  const dSrc = duration(src), dDst = duration(dst);
  if (Math.abs(dSrc - dDst) > 0.25) {
    console.error(`LENGTH DRIFT: ${out} is ${dDst.toFixed(1)}s, master is ${dSrc.toFixed(1)}s`);
    failed++;
  }
  const bSrc = fs.statSync(src).size, bDst = fs.statSync(dst).size;
  before += bSrc;
  after += bDst;
  console.log(`${out.padEnd(15)} ${mb(bSrc)} MB -> ${mb(bDst)} MB  (${dDst.toFixed(1)}s)`);
}
console.log(`\ntotal ${mb(before)} MB -> ${mb(after)} MB (${(100 * (1 - after / before)).toFixed(0)}% smaller) at ${BITRATE}`);
if (failed) {
  console.error(`\n${failed} track(s) failed`);
  process.exit(1);
}
