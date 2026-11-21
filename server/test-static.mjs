// Static + sim-level tests: determinism guard, dual-boss practice, lockstep
// epoch isolation, and asset-manifest inventory.
//
// Run: node server/test-static.mjs   (or `npm test` in server/)
// Needs no browser, no relay port, no PixiJS: only the deterministic sim,
// the lockstep driver (with a stub net), and the filesystem.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

let passed = 0;
const ok = (name) => { passed++; console.log(`ok - ${name}`); };

// --- 1. determinism guard: the sim may never read wall-clock or Math.random ---
// (render/audio code may; anything the lockstep sim touches may not).
const SIM_DIRS = ['src/sim', 'src/levels', 'src/characters', 'src/data'];
const SIM_FILES = ['src/net/lockstep.js'];
const FORBIDDEN = [/Math\.random/, /Date\.now/, /performance\.now/, /new Date\(/];

function jsFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(dir, f));
}

function stripComments(src) {
  // block comments first, then full-line // comments (header docs mention
  // Math.random/Date.now precisely to forbid them — those must not trip us).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ln) => !ln.trimStart().startsWith('//'))
    .join('\n');
}

{
  const files = [...SIM_DIRS.flatMap(jsFiles), ...SIM_FILES];
  assert.ok(files.length > 10, `expected sim files, found ${files.length}`);
  for (const f of files) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const re of FORBIDDEN) {
      assert.ok(!re.test(code), `${f} must not use ${re} (breaks lockstep determinism)`);
    }
  }
  ok(`determinism guard (${files.length} sim files clean)`);
}

// --- 2. dual-boss practice: Seyren & Magaleta spawn, die, and clear the level ---
{
  const { createSim } = await import('../src/sim/sim.js');
  const { spawnBosses, damageBoss, stepBoss } = await import('../src/sim/boss.js');
  const { ROSTER } = await import('../src/characters/index.js');
  const { seyren, magaleta } = await import('../src/sim/boss.js');

  const sim = createSim(0xc0ffee, [ROSTER[0]]);
  spawnBosses(sim, [seyren, magaleta]);
  assert.equal(sim.bosses.length, 2, 'dual spawn must create two bosses');
  assert.ok(sim.bosses.every((b) => b.def.cards.length === 2), 'each dual boss has 2 cards');

  // grind through every card/transition/death deterministically (no stage ticks)
  let guard = 5000;
  while (!sim.levelComplete && guard-- > 0) {
    for (const b of [...sim.bosses]) damageBoss(sim, 1e6, b);
    stepBoss(sim);
    sim.events.length = 0;
  }
  assert.ok(sim.levelComplete, 'killing both bosses must complete the level');
  assert.equal(sim.bosses.length, 0, 'dead bosses must be reaped');
  assert.ok(sim.events.length === 0, 'events drained each step');
  ok('dual-boss practice sim (spawn -> cards -> levelClear)');
}

// --- 3. epoch isolation: stale frames from another level must be ignored ---
{
  const { LockstepDriver } = await import('../src/net/lockstep.js');
  const { createSim } = await import('../src/sim/sim.js');
  const { ROSTER } = await import('../src/characters/index.js');

  const handlers = new Map();
  const stubNet = {
    sent: [],
    sendInput(tick, mask, epoch) { this.sent.push({ tick, mask, epoch }); },
    sendSync() {},
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
      return () => {};
    },
  };
  const sim = createSim(0xc0ffee, [ROSTER[0], ROSTER[1]]);
  const driver = new LockstepDriver({
    net: stubNet, sim, stage: null, localSlot: 0, epoch: 7,
    sampleLocal: () => 0,
  });
  const emit = (type, m) => { for (const fn of handlers.get(type) ?? []) fn(m); };

  emit('input', { t: 'input', tick: 0, mask: 3, epoch: 999 }); // previous level's frame
  assert.equal(driver.remote.size, 0, 'wrong-epoch input must be dropped');
  emit('input', { t: 'input', tick: 0, mask: 3, epoch: 7 });
  assert.equal(driver.remote.get(0), 3, 'current-epoch input must be accepted');
  emit('sync', { t: 'sync', tick: 0, sum: 1234, epoch: 999 });
  assert.equal(driver.peerChecks.size, 0, 'wrong-epoch checksum must be dropped');
  assert.ok(stubNet.sent.length >= 3, 'seed inputs are sent on construction');
  assert.ok(stubNet.sent.every((s) => s.epoch === 7), 'seed inputs carry our epoch');
  driver.destroy();
  ok('lockstep epoch isolation (stale level frames ignored)');
}

// --- 4. asset inventory: every sheet the atlas loads must exist on disk ---
// (monsters5/monsters7 are JSON-only: they share bosses.png / bosses2.png.)
{
  const A = (...p) => path.join(ROOT, 'public', 'assets', ...p);
  const mustFile = (p) => assert.ok(fs.existsSync(A(p)), `missing asset: public/assets/${p}`);
  for (const n of ['manifest.json', 'sheet.png']) mustFile(n);
  for (const n of ['monsters', 'monsters2', 'monsters3', 'monsters4', 'monsters6', 'monsters8']) {
    mustFile(`${n}.json`); mustFile(`${n}.png`);
  }
  for (const n of ['monsters5', 'monsters7']) mustFile(`${n}.json`);
  for (const n of ['bosses', 'bosses2', 'bosses3']) { mustFile(`${n}.json`); mustFile(`${n}.png`); }
  for (const n of ['skills', 'items', 'items2', 'bombsfx']) { mustFile(`${n}.json`); mustFile(`${n}.png`); }
  mustFile('images/startmenu.png');
  for (const [set, files] of Object.entries({
    prontera: ['prontera001', 'prontera002', 'prontera003', 'prontera004', 'pronteraNewA', 'pronteraNewB', 'prontera005'],
    geffen: ['geffen001', 'geffen002', 'geffen003', 'geffen004', 'geffenNewA', 'geffenNewB', 'geffen005'],
    glastheim: ['glastheim001', 'glastheim002', 'glastheim003', 'glastheim004', 'glastheimNewA', 'glastheimNewB', 'glastheim005'],
    juperos: ['juperos001', 'juperos002', 'juperos003', 'juperos004', 'juperos005', 'juperos006', 'juperos007'],
    biolab: ['biolab001', 'biolab002', 'biolab003', 'biolab004', 'biolab005', 'biolab006', 'biolab007'],
  })) {
    for (const f of files) mustFile(`maps/${f}.png`);
    void set;
  }
  for (const m of ['menu', 'prontera', 'geffen', 'glastheim', 'juperos', 'biolab', 'pyramid', 'niflheim', 'thanatos']) {
    mustFile(`music/${m}.mp3`);
  }
  ok('asset inventory (sheets, maps, music all present)');
}

// --- 5. Clean-Art Geffen V2.1 preview set (?art=v2): files + IDs/rects ---
// (boss sheets live in assets-v2/bosses since the bosses phase; covered in 6)
{
  const P = (...p) => path.join(ROOT, 'public', 'assets-v2', 'geffen', ...p);
  for (const f of ['monsters3.clean.png', 'monsters3.clean.json']) {
    assert.ok(fs.existsSync(P(f)), `missing preview asset: assets-v2/geffen/${f}`);
  }
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const o3 = read(path.join(ROOT, 'public', 'assets', 'monsters3.json'));
  const c3 = read(P('monsters3.clean.json'));
  assert.deepEqual(Object.keys(c3.monsters), Object.keys(o3.monsters));
  for (const k of Object.keys(o3.monsters)) assert.deepEqual(c3.monsters[k], o3.monsters[k]);
  ok('v2.1 preview set present, Geffen IDs/rects identical');
}

// --- 6. Clean-Art bosses V2.1 preview set: presence + exact manifest compat ---
// (bosses/monsters5 now resolve to assets-v2/bosses, not the Geffen dir.)
{
  const A = (...p) => path.join(ROOT, 'public', 'assets', ...p);
  const P = (...p) => path.join(ROOT, 'public', 'assets-v2', 'bosses', ...p);
  for (const f of ['monsters2.clean.png', 'monsters2.clean.json',
                   'bosses.clean.png', 'bosses.clean.json',
                   'monsters5.clean.json', 'bosses2.clean.png',
                   'bosses2.clean.json', 'monsters7.clean.json',
                   'monsters8.clean.png', 'monsters8.clean.json',
                   'bosses3.clean.png', 'bosses3.clean.json']) {
    assert.ok(fs.existsSync(P(f)), `missing boss preview: assets-v2/bosses/${f}`);
  }
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  // whole-manifest deep equality (roommates like lunatic included), except
  // the sheet filename which must point at the cleaned sheet.
  const pairs = [
    ['monsters2.json', 'monsters2.clean.json', 'monsters2.clean.png'],
    ['bosses.json', 'bosses.clean.json', 'bosses.clean.png'],
    ['monsters5.json', 'monsters5.clean.json', 'bosses.clean.png'],
    ['bosses2.json', 'bosses2.clean.json', 'bosses2.clean.png'],
    ['monsters7.json', 'monsters7.clean.json', 'bosses2.clean.png'],
    ['monsters8.json', 'monsters8.clean.json', 'monsters8.clean.png'],
    ['bosses3.json', 'bosses3.clean.json', 'bosses3.clean.png'],
  ];
  for (const [src, dst, sheet] of pairs) {
    const a = read(A(src)), b = read(P(dst));
    assert.equal(b.sheet, sheet, `${dst} sheet field`);
    const { sheet: _s1, ...ra } = a, { sheet: _s2, ...rb } = b;
    assert.deepEqual(rb, ra, `${dst} rects/IDs identical`);
  }
  // every boss/midboss encounter skin resolves to a cleaned manifest entry
  const skins = { mastering: 'monsters2.clean.json', doppelganger: 'monsters5.clean.json',
    bapho_jr_giant: 'monsters5.clean.json', archdam: 'monsters7.clean.json',
    failedexp: 'monsters8.clean.json' };
  for (const [skin, file] of Object.entries(skins)) {
    const m = read(P(file));
    assert.ok(m.monsters[skin], `${file} must contain ${skin}`);
  }
  for (const b of ['orcHero', 'darkLord', 'baphomet']) {
    assert.ok(read(P('bosses.clean.json')).bosses[b], `bosses.clean.json: ${b}`);
  }
  assert.ok(read(P('bosses2.clean.json')).bosses.vesper, 'bosses2.clean.json: vesper');
  for (const b of ['seyren', 'magaleta']) {
    assert.ok(read(P('bosses3.clean.json')).bosses[b], `bosses3.clean.json: ${b}`);
  }
  ok('bosses V2.1 preview set present, manifests exactly compatible');
}

// --- 7. Art Lab (?artlab=1): route wiring, scene hygiene, clean routes ---
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  assert.ok(fs.existsSync(path.join(ROOT, 'src/scenes/artlab.js')), 'artlab scene file');
  const art = src('src/scenes/artlab.js');
  for (const sym of ['export async function loadCleanTables', 'export function buildCatalog',
                     'export class ArtLabScene', 'REVIEW_STATES', 'sin versión clean',
                     "removeEventListener('keydown'", 'goToTitle', 'localStorage']) {
    assert.ok(art.includes(sym), `artlab.js must contain: ${sym}`);
  }
  // no new dependencies: only pixi.js imports
  const imports = [...art.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((m) => m === 'pixi.js'), `artlab imports only pixi.js, got: ${imports}`);
  // scene never writes reviews anywhere except localStorage + download
  assert.ok(!/fetch\(.*(POST|PUT)/.test(art), 'artlab must not POST reviews anywhere');
  const main = src('src/main.js');
  assert.ok(main.includes('artlab') && main.includes('goToArtLab'), 'main.js artlab branch');
  assert.ok(main.includes('ctx.goToTitle()'), 'normal boot path preserved');
  assert.ok(fs.existsSync(path.join(ROOT, 'ARTLAB.md')), 'ARTLAB.md docs');
  const docs = src('ARTLAB.md');
  assert.ok(docs.includes('?artlab=1'), 'docs document the URL');
  // every clean manifest the lab can request exists on disk
  for (const [dir, files] of [['geffen', ['monsters3.clean.json']],
                              ['bosses', ['monsters2.clean.json', 'monsters8.clean.json',
                                          'bosses.clean.json', 'bosses2.clean.json',
                                          'bosses3.clean.json', 'monsters5.clean.json',
                                          'monsters7.clean.json']]]) {
    for (const f of files) {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets-v2', dir, f), 'utf8'));
      assert.ok(m.sheet && (m.monsters || m.bosses), `${dir}/${f} is a valid atlas manifest`);
    }
  }
  ok('art lab wiring, hygiene, docs, clean routes');
}

// --- 8. Pyramid (level 6): assets, registry, dialogue, boss, full run ---
{
  const P = (...p) => path.join(ROOT, 'public', 'assets-v2', 'pyramid', ...p);
  for (const f of ['monsters9.png', 'monsters9.json', 'monsters10.json',
                   'bosses4.png', 'bosses4.json',
                   ...[1, 2, 3, 4, 5, 6, 7].map((i) => `maps/pyramid00${i}.png`)]) {
    assert.ok(fs.existsSync(P(f)), `missing pyramid asset: assets-v2/pyramid/${f}`);
  }
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const m9 = read(P('monsters9.json'));
  assert.deepEqual(Object.keys(m9.monsters).sort(),
    ['ancient', 'archer', 'familiar', 'isis', 'matyr', 'mummy', 'soldier', 'verit']);
  for (const [name, e] of Object.entries(m9.monsters)) {
    for (const side of ['down', 'up']) {
      assert.deepEqual(Object.keys(e[side]).sort(), ['attack', 'hit', 'idle', 'moveL', 'moveR'], `${name}.${side} poses`);
      for (const r of Object.values(e[side])) {
        assert.ok(r.w > 0 && r.h > 0 && r.x + r.w <= m9.size.w && r.y + r.h <= m9.size.h, `${name} rect in-bounds`);
      }
    }
  }
  const m10 = read(P('monsters10.json'));
  assert.equal(m10.sheet, 'bosses4.png');
  assert.deepEqual(Object.keys(m10.monsters), ['osiris']);
  const b4 = read(P('bosses4.json'));
  assert.equal(b4.sheet, 'bosses4.png');
  assert.deepEqual(Object.keys(b4.bosses), ['amonRa']);
  for (const [file, sec, name] of [[m10, 'monsters', 'osiris'], [b4, 'bosses', 'amonRa']]) {
    for (const side of ['down', 'up']) {
      const poses = file[sec][name][side];
      assert.deepEqual(Object.keys(poses).sort(), ['attack', 'hit', 'idle', 'moveL', 'moveR']);
      for (const pose of ['idle', 'moveL', 'moveR']) {
        assert.ok(Array.isArray(poses[pose]) && poses[pose].length >= 1, `${name}.${side}.${pose} frames`);
      }
      // attack holds 3 individual frames (never a merged full-row crop),
      // hit holds the single isolated figure.
      assert.equal(poses.attack.length, 3, `${name}.${side}.attack is 3 frames`);
      for (const r of poses.attack) assert.ok(r.w < 300, `${name}.${side}.attack frame not row-wide`);
      assert.equal(poses.hit.length, 1, `${name}.${side}.hit is 1 figure`);
      assert.ok(poses.hit[0].w < 300, `${name}.${side}.hit not row-wide`);
    }
  }
  for (const [name, e] of Object.entries(m9.monsters)) {
    for (const side of ['down', 'up']) {
      for (const [pose, r] of Object.entries(e[side])) {
        assert.ok(r.w >= 20 && r.w <= 120, `${name}.${side}.${pose} plausible width (w=${r.w})`);
      }
    }
  }
  ok('pyramid assets + manifest IDs/rects');

  // registry + wiring (source-text: these files import PixiJS, skip node import)
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  assert.ok(src('src/levels/index.js').includes("mapSet: 'pyramid'"), 'LEVELS has pyramid entry');
  assert.ok(src('src/scenes/game.js').includes('0x9a7d51'), 'LEVEL_SEEDS has level 6 seed');
  assert.ok(src('src/scenes/practice.js').includes('amonRa'), 'practice has Amon-Ra');
  assert.ok(src('src/render/renderer.js').includes("'Amon-Ra': 'amonRa'"), 'BOSS_TEX has Amon-Ra');
  assert.ok(src('src/render/themes.js').includes('level6Theme'), 'level6Theme exists');
  assert.ok(src('src/engine/atlas.js').includes('monsters9') && src('src/engine/atlas.js').includes('bosses4'), 'atlas loads pyramid sheets');
  assert.ok(src('src/engine/music.js').includes('level6:'), 'music has level6 track');
  // Pyramid map music: approved recording wired as the runtime MP3, with the
  // level6 chiptune retained strictly as missing/corrupt-file fallback.
  const musicSrc = src('src/engine/music.js');
  assert.ok(musicSrc.includes('level6: `${BASE}assets/music/pyramid.mp3`'),
    'MP3_TRACKS wires the Pyramid recording for level6');
  assert.ok(!musicSrc.includes('no recorded track approved for this level'),
    'stale no-recording comment is gone');
  assert.ok(musicSrc.includes("name === 'boss' && this.mp3El"),
    'recorded stage track keeps playing through midboss/final boss');
  assert.ok(src('src/scenes/game.js').includes('`level${this.levelIndex + 1}`'),
    'campaign and direct-level runs request the per-level track');
  ok('pyramid registry wiring');

  const { DIALOGUE } = await import('../src/data/dialogue.js');
  for (const boss of ['Osiris', 'Amon-Ra']) {
    for (const c of ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri']) {
      assert.ok(DIALOGUE[boss]?.[c]?.p && DIALOGUE[boss]?.[c]?.b, `dialogue ${boss}/${c}`);
    }
  }
  ok('pyramid dialogue (2 bosses x 6 chars)');

  // Amon-Ra def: 3 cards, spawns, dies, clears (solo, like the dual test)
  const { createSim, tickSim } = await import('../src/sim/sim.js');
  const { spawnBoss, damageBoss, stepBoss } = await import('../src/sim/boss.js');
  const { amonRa } = await import('../src/sim/boss.js');
  const { ROSTER } = await import('../src/characters/index.js');
  const { level6 } = await import('../src/levels/level6.js');
  assert.deepEqual(amonRa.cards.map((c) => c.name), ['Corona Solar', 'Eclipse', 'Ira del Santuario']);
  {
    const sim = createSim(0x9a7d51, [ROSTER[0]]);
    spawnBoss(sim, amonRa);
    assert.equal(sim.bosses[0].name, 'Amon-Ra');
    let guard = 20000;
    while (!sim.levelComplete && guard-- > 0) {
      for (const b of [...sim.bosses]) damageBoss(sim, 1e6, b);
      stepBoss(sim);
      sim.events.length = 0;
    }
    assert.ok(sim.levelComplete, 'Amon-Ra kill must complete the level');
    ok('amonRa boss def (spawn -> 3 cards -> levelClear)');
  }

  // Amon-Ra Eclipse telegraph lifecycle: tele arms, ticks down deterministically,
  // expires, and only then does the volley fire (same idiom as enemy e.tele).
  {
    const sim = createSim(0x9a7d51, [ROSTER[0]]);
    spawnBoss(sim, amonRa);
    const b = sim.bosses[0];
    let guard = 500;
    while ((b.intro || b.introHold > 0) && guard-- > 0) stepBoss(sim);
    assert.ok(!b.intro && b.introHold === 0, 'Amon-Ra leaves intro');
    assert.equal(b.tele, 0, 'no telegraph during intro');
    damageBoss(sim, 901, b); // burn Corona Solar -> transition into Eclipse
    assert.equal(b.cardIndex, 1, 'advanced to Eclipse');
    guard = 200;
    while (b.transition > 0 && guard-- > 0) stepBoss(sim);
    assert.equal(b.t, 0, 'Eclipse starts at b.t=0');
    const teles = [];
    const bullets = [];
    for (let k = 0; k < 120; k++) {
      stepBoss(sim);
      teles.push(b.tele);
      bullets.push(sim.enemyBullets.active.length);
    }
    const peak = teles.indexOf(20);
    assert.ok(peak >= 0, 'telegraph arms to 20');
    for (let k = 1; k <= 20; k++) assert.equal(teles[peak + k], 20 - k, `tele ticks down to ${20 - k}`);
    assert.ok(teles.slice(peak + 21, peak + 41).every((v) => v === 0), 'telegraph expires to 0');
    assert.ok(bullets[peak + 22] > bullets[peak], 'volley fires after the telegraph');
    ok('amonRa Eclipse telegraph lifecycle (arm -> decay -> volley)');
  }

  // full headless campaign run: constant fire (brief releases let arcade
  // continues trigger on a fresh FIRE press), through Osiris to Amon-Ra.
  {
    const sim = createSim(0x9a7d51, [ROSTER[0]]);
    const seen = new Set();
    // NOTE: the mask runs on the loop counter, not sim.tick — tick freezes
    // while gameOver, which would otherwise lock the release windows shut and
    // starve the continue-on-fresh-FIRE edge forever.
    assert.equal(sim.biome, 0, 'biome starts at 0');
    let guard = 60000, i = 0, maxBiome = 0, finiteBiome = true;
    while (!sim.levelComplete && guard-- > 0) {
      const mask = (i++ % 600 < 590) ? 16 : 0; // FIRE, with release windows
      tickSim(sim, [mask], level6);
      if (!Number.isFinite(sim.biome)) finiteBiome = false;
      if (sim.biome > maxBiome) maxBiome = sim.biome;
      for (const e of sim.events) {
        if (e.type === 'bossWarning' || e.type === 'warning') seen.add(e.name);
      }
      sim.events.length = 0;
    }
    assert.ok(seen.has('Osiris'), `midboss warning seen (got: ${[...seen]})`);
    assert.ok(seen.has('Amon-Ra'), `final warning seen (got: ${[...seen]})`);
    assert.ok(sim.levelComplete, `level 6 completes (tick=${sim.tick} over=${sim.gameOver})`);
    assert.ok(finiteBiome, 'sim.biome stays finite through the full run');
    assert.ok(maxBiome > 0.3, `sim.biome advances with level progress (max=${maxBiome})`);
    ok(`pyramid full run (tick=${sim.tick} score=${sim.score} biome=${maxBiome.toFixed(3)})`);
  }

  // Level 6 script timeline: pre-increment clock pins spawn cadence, edge
  // spawns enter symmetrically, and every phase boundary lands on time
  // (oasis 1300 / entrance 1400 / descent 1300 / midboss kill / tomb 1500 /
  // approach 150 -> Amon-Ra warning).
  {
    const { FIELD_W } = await import('../src/sim/constants.js');
    const sim = createSim(0x9a7d51, [ROSTER[0]]);
    sim.players[0].lives = 999; // deaths never stall the script via gameOver
    const step = (n) => {
      for (let k = 0; k < n; k++) tickSim(sim, [16], level6);
      sim.events.length = 0;
    };
    const phase = () => sim.level.phase;
    step(99);
    assert.ok(!sim.enemies.active.some((e) => e.t === 1), 'nothing spawns before t=100');
    step(1); // oasis t=100: first familiar, right edge
    let fam = sim.enemies.active.find((e) => e.skin === 'familiar' && e.t === 1);
    assert.ok(fam, 'familiar spawns at t=100');
    assert.ok(fam.vx < 0 && fam.x > FIELD_W - 100, 'right-edge familiar heads inward');
    step(100); // oasis t=200: second familiar, left edge
    fam = sim.enemies.active.find((e) => e.skin === 'familiar' && e.t === 1);
    assert.ok(fam, 'second familiar spawns at t=200');
    assert.ok(fam.vx > 0 && fam.x < 100, 'left-edge familiar heads inward');
    step(1100); // oasis t=1300
    assert.equal(phase(), 'entrance', 'oasis -> entrance at t=1300');
    step(20); // entrance t=20: verit, left edge
    const ver = sim.enemies.active.find((e) => e.skin === 'verit' && e.t === 1);
    assert.ok(ver, 'verit spawns at entrance t=20');
    assert.ok(ver.vx > 0 && ver.x < 100, 'left-edge verit heads inward');
    step(1380); // entrance t=1400
    assert.equal(phase(), 'descent', 'entrance -> descent at t=1400');
    step(1300); // descent t=1300
    assert.equal(phase(), 'midboss', 'descent -> midboss at t=1300');
    step(100); // let Osiris arrive, then fell it like a player would
    const os = sim.enemies.active.find((e) => e.skin === 'osiris');
    if (os) os.hp = 0; // reaped next tick; player fire may have done it already
    step(61); // reap + pass the t>60 gate
    assert.equal(phase(), 'tomb', 'midboss -> tomb after the kill');
    step(1441); // tomb t=1500
    assert.equal(phase(), 'approach', 'tomb -> approach at t=1500');
    const seen = new Set();
    for (let k = 0; k < 160 && phase() !== 'boss'; k++) {
      tickSim(sim, [16], level6);
      for (const e of sim.events) if (e.type === 'bossWarning') seen.add(e.name);
      sim.events.length = 0;
    }
    assert.equal(phase(), 'boss', 'approach -> boss at t=150');
    assert.ok(seen.has('Amon-Ra'), 'Amon-Ra warning fires');
    ok('level6 timeline (clock, edge entry, phase boundaries)');
  }

  // Level 6 replay determinism: two sims, same seed + inputs, identical
  // checksums at the entrance and midboss phase transitions.
  {
    const checksum = (sim) => {
      const r3 = (n) => Math.round(n * 1000);
      const parts = [sim.tick, sim.score, r3(sim.biome), sim.level.phase, sim.level.t,
        ...sim.players.flatMap((p) => (p ? [r3(p.x), r3(p.y), p.lives, p.power, p.bombs] : ['x'])),
        sim.enemies.active.length,
        ...sim.enemies.active.flatMap((e) => [e.skin, r3(e.x), r3(e.y), Math.round(e.hp * 1000), e.t]),
        sim.bullets.active.length, sim.enemyBullets.active.length,
        ...sim.bullets.active.flatMap((b) => [r3(b.x), r3(b.y)]),
        ...sim.enemyBullets.active.flatMap((b) => [r3(b.x), r3(b.y), b.color])];
      const s = JSON.stringify(parts);
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16);
    };
    const runTo = (ticks) => {
      const sim = createSim(0x9a7d51, [ROSTER[0]]);
      sim.players[0].lives = 999;
      const marks = [];
      for (let k = 0; k < ticks; k++) {
        tickSim(sim, [16], level6);
        if (k + 1 === 1300 || k + 1 === 4000) marks.push(checksum(sim));
        sim.events.length = 0;
      }
      return marks;
    };
    const [a, b] = [runTo(4100), runTo(4100)];
    assert.equal(a.length, 2, 'both transitions marked');
    assert.deepEqual(a, b, 'level 6 replays bit-identically through midboss');
    ok('level6 replay checksum (two sims, phase transitions)');
  }
}

// --- 9. Pyramid map readiness: inventory, atomic selection, warmup flow ---
{
  const mapsets = await import('../src/engine/mapsets.js');
  assert.deepEqual(mapsets.mapTileFiles('pyramid'),
    ['pyramid001', 'pyramid002', 'pyramid003', 'pyramid004', 'pyramid005', 'pyramid006', 'pyramid007']);
  assert.equal(mapsets.mapTileDir('pyramid'), 'assets-v2/pyramid/maps');
  assert.deepEqual(mapsets.missingMapTiles('pyramid', [1, 1, null, 1, 1, 1, 1]), ['pyramid003']);
  assert.deepEqual(mapsets.missingMapTiles('pyramid', [1, 1, 1, 1, 1, 1, 1]), []);
  const full = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
  assert.equal(mapsets.selectMapTextures(null, 'pyramid'), null, 'no maps -> procedural');
  assert.equal(mapsets.selectMapTextures({}, 'pyramid'), null, 'set missing -> procedural');
  assert.equal(mapsets.selectMapTextures({ pyramid: ['t1', 't2', 't3', 't4', 't5'] }, 'pyramid'), null, 'partial set rejected');
  assert.equal(mapsets.selectMapTextures({ pyramid: ['t1', 't2', 't3', 't4', 't5', 't6', null] }, 'pyramid'), null, 'holed set rejected');
  assert.equal(mapsets.selectMapTextures({ pyramid: full }, 'pyramid'), full, 'complete set selected');
  assert.equal(mapsets.selectMapTextures({ pyramid: full }, 'nope'), null, 'unknown set rejected');
  // readiness flow against a fake atlas (same shape as the real atlas object):
  // still-warming -> warmed complete, and partial loads fall back atomically.
  const fake = { maps: { pyramid: null }, ensureMapSet: async (n) => (fake.maps[n] = full) };
  assert.equal(await mapsets.resolveLevelMaps(fake, 'pyramid'), full, 'warmed set resolves');
  fake.maps.pyramid = ['t1', 't2', 't3'];
  fake.ensureMapSet = async (n) => fake.maps[n];
  assert.equal(await mapsets.resolveLevelMaps(fake, 'pyramid'), null, 'partial load falls back atomically');
  let warmed = false;
  const fake2 = { maps: { pyramid: full }, ensureMapSet: async () => { warmed = true; return full; } };
  assert.equal(await mapsets.resolveLevelMaps(fake2, 'pyramid'), full, 'ready set resolves');
  assert.ok(!warmed, 'ready set never re-warms');
  ok('pyramid map selection + readiness (atomic, no partial sets)');
}

// --- 10. Level select (direct-level review mode): title wiring, LEVELS choices,
// exact campaign payload, and completion/non-advance/non-score behavior ---
// (scene files import PixiJS, so UI wiring is asserted via source text like
// test 7; ROSTER is headless-safe and imported for real.)
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const { ROSTER } = await import('../src/characters/index.js');
  assert.equal(ROSTER.length, 6, 'review roster holds six characters');

  // LEVELS is the single source of truth: six entries, no duplicate registry.
  const levelsSrc = src('src/levels/index.js');
  assert.deepEqual([...levelsSrc.matchAll(/title: '(Nivel \d)'/g)].map((m) => m[1]),
    ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5', 'Nivel 6', 'Nivel 7', 'Nivel 8']);
  assert.ok(fs.existsSync(path.join(ROOT, 'src/scenes/levelselect.js')), 'levelselect scene file');
  const sel = src('src/scenes/levelselect.js');
  assert.ok(sel.includes('export class LevelSelectScene'), 'levelselect exports LevelSelectScene');
  assert.ok(sel.includes('LEVELS'), 'level choices read LEVELS');
  assert.ok(sel.includes('LEVELS.length'), 'six choices derive from LEVELS length');
  assert.ok(!/mapSet:\s*'/.test(sel), 'no duplicate six-level registry in levelselect');
  assert.ok(sel.includes('LEVELS[this.li].title') && sel.includes('LEVELS[this.li].name'),
    'cards show the level number and name from LEVELS');
  assert.ok(sel.includes('ELEGIR NIVEL'), 'levelselect heading');
  assert.ok(sel.includes('startDirectLevel([ROSTER[this.ci]], this.li)'),
    'confirm starts the exact chosen character + level');
  for (const k of ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'Enter', 'KeyJ', 'Escape']) {
    assert.ok(sel.includes(k), `levelselect handles ${k}`);
  }
  assert.ok(sel.includes('goToTitle'), 'levelselect escapes back to the title');
  const imports = [...sel.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((m) => m === 'pixi.js' || m.startsWith('../')),
    `levelselect imports only pixi.js + relatives, got: ${imports}`);
  ok('level select scene (LEVELS-derived six choices, no duplicate registry)');

  // title: ELEGIR NIVEL joins the menu in visual Y order with a readable
  // overlay plate; keyboard/WASD navigation and difficulty switching intact.
  const title = src('src/scenes/title.js');
  const acts = [...title.matchAll(/act: \(ctx\) => ctx\.(goTo\w+)\(\)/g)].map((m) => m[1]);
  assert.deepEqual(acts,
    ['goToSelect', 'goToPractice', 'goToRecords', 'goToLevelSelect', 'goToOnline'],
    'menu nav order matches visual Y order');
  assert.ok(title.includes('ELEGIR NIVEL'), 'title overlays ELEGIR NIVEL text');
  assert.ok(title.indexOf('ELEGIR NIVEL') < title.indexOf('CO-OP ONLINE'),
    'ELEGIR NIVEL plate sits above CO-OP ONLINE');
  assert.equal((title.match(/optY\.push/g) || []).length, 2, 'five navigable options');
  for (const k of ['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA',
                   'ArrowRight', 'KeyD', 'Enter', 'KeyJ']) {
    assert.ok(title.includes(`'${k}'`), `title still handles ${k}`);
  }
  ok('title menu wiring (ELEGIR NIVEL in Y order, nav + difficulty intact)');

  // main.js: selector route + exact direct-run campaign payload — the full
  // real level from its start, fresh score/carry, current difficulty, and a
  // review marker. Never boss practice.
  const main = src('src/main.js');
  assert.ok(main.includes('LevelSelectScene') && main.includes('goToLevelSelect'),
    'main.js routes the level selector');
  const m = main.match(/startDirectLevel: \(chars, levelIndex\) => setScene\(\(\) => new GameScene\(ctx, \{([^}]*)\}\)\)/);
  assert.ok(m, 'startDirectLevel builds a GameScene campaign');
  for (const kv of ['chars', 'levelIndex', 'score: 0', 'carry: null',
                    'difficulty: ctx.difficulty', 'direct: true']) {
    assert.ok(m[1].includes(kv), `direct payload carries ${kv}`);
  }
  assert.ok(!m[1].includes('practice'), 'direct run is not boss practice');
  ok('direct-run campaign payload (exact level, fresh score/carry, review marker)');

  // game.js: a direct run completes on the results screen but Enter returns
  // to the selector (never the next campaign level); game over / endRun
  // returns to the selector before any high-score check (never submitted).
  const game = src('src/scenes/game.js');
  const showBlock = game.slice(game.indexOf('showResults()'), game.indexOf('nextCampaign()'));
  assert.ok(showBlock.includes('if (this.direct)'), 'results handles direct runs');
  const branch = showBlock.slice(showBlock.indexOf('if (this.direct)'),
    showBlock.indexOf('if (this.direct)') + 600);
  assert.ok(branch.includes('goToLevelSelect'), 'direct results return to the selector');
  assert.ok(!branch.includes('nextCampaign'), 'direct completion never advances the campaign');
  const endBlock = game.slice(game.indexOf('endRun(cleared)'), game.indexOf('showNameEntry'));
  assert.ok(endBlock.includes('this.direct'), 'endRun handles direct runs');
  assert.ok(endBlock.includes('goToLevelSelect'), 'direct game over returns to the selector');
  assert.ok(endBlock.indexOf('this.direct') < endBlock.indexOf('qualifies('),
    'direct path exits before any high-score check');
  assert.ok(!/qualifies\(this\.sim\.score\)[\s\S]*?this\.direct/.test(endBlock),
    'no score submission reachable on the direct path');
  ok('direct-run completion/non-advance/non-score behavior');
}

// --- 11. Pyramid Isis regression harness: a parked Isis must cast a
// telegraphed spiral BURST cadence (not a bullet every tick), and the
// descent/tomb phases must stay far below the layered-spiral spike.
// Baselines measured 2026-09-08 on the every-tick build: single Isis 240
// cyan/240 ticks (60/sec, never silent, never telegraphed); phase peak 2460
// live enemy bullets (2150 cyan) with 14 concurrent Isis (tomb, tick 8343).
{
  const { createSim: mkSim, tickSim: stepSim } = await import('../src/sim/sim.js');
  const { ROSTER: ROS } = await import('../src/characters/index.js');
  const { level6: lv6 } = await import('../src/levels/level6.js');

  // Isolate one parked Isis (kill everything else, no player fire) and count
  // its cyan production over 240 ticks via the spawn funnel. Deterministic:
  // two fresh runs must agree exactly.
  const measureIsis = () => {
    const sim = mkSim(0x9a7d51, [ROS[0]]);
    sim.players[0].lives = 999; // deaths never freeze the clock mid-harness
    let target = null, guard = 20000;
    while (guard-- > 0 && !target) {
      stepSim(sim, [16], lv6);
      sim.events.length = 0;
      target = sim.enemies.active.find((e) => e.skin === 'isis' && e.vy === 0 && e.y > 200);
    }
    assert.ok(target, 'an Isis parks overhead');
    for (const e of sim.enemies.active) if (e !== target) e.hp = 0;
    stepSim(sim, [0], lv6);
    sim.events.length = 0;
    assert.equal(sim.enemies.active.length, 1, 'harness isolates one Isis');
    let cyan = 0, teleMax = 0;
    const per = [];
    const fire = sim.spawnEnemyBullet.bind(sim);
    sim.spawnEnemyBullet = (props) => {
      if (props.color === 'cyan') cyan++;
      return fire(props);
    };
    for (let k = 0; k < 240; k++) {
      const c0 = cyan;
      stepSim(sim, [0], lv6);
      sim.events.length = 0;
      per.push(cyan - c0);
      if (target.tele > teleMax) teleMax = target.tele;
    }
    let run = 0, silence = 0;
    for (const n of per) { run = n === 0 ? run + 1 : 0; if (run > silence) silence = run; }
    return { total: cyan, silence, teleMax };
  };
  const a = measureIsis(), b = measureIsis();
  assert.deepEqual(a, b, 'single-Isis measurement is deterministic');
  assert.ok(a.total <= 80, `single Isis cyan <= 80 per 240 ticks (<=20/sec, got ${a.total})`);
  assert.ok(a.silence >= 30, `spiral bursts have recovery gaps (longest silence ${a.silence})`);
  assert.ok(a.teleMax > 0, 'spiral bursts are telegraphed (e.tele raised)');
  ok('isis spiral cadence (burst rate, gaps, telegraph)');

  // Full headless run on the exact campaign recipe: peak live enemy-bullet
  // count across the descent/tomb phases plus peak concurrent Isis.
  {
    const sim = mkSim(0x9a7d51, [ROS[0]]);
    let guard = 60000, i = 0, peak = 0, maxIsis = 0;
    while (!sim.levelComplete && guard-- > 0) {
      const mask = (i++ % 600 < 590) ? 16 : 0;
      stepSim(sim, [mask], lv6);
      if (sim.level.phase === 'descent' || sim.level.phase === 'tomb') {
        if (sim.enemyBullets.active.length > peak) peak = sim.enemyBullets.active.length;
        let ni = 0;
        for (const e of sim.enemies.active) if (e.skin === 'isis') ni++;
        if (ni > maxIsis) maxIsis = ni;
      }
      sim.events.length = 0;
    }
    assert.ok(sim.levelComplete, 'density harness run completes the level');
    assert.ok(peak <= 1353, `descent/tomb peak ${peak} <= 1353 (45% below baseline 2460)`);
    assert.ok(maxIsis <= 2, `isis concurrency bounded by safeguard (peak ${maxIsis})`);
    ok('pyramid isis density bound (phase peak, concurrency)');
  }
}

// --- 12. Prontera V3 monster atlas: approved six-monster sheet extracted to a
// versioned runtime atlas (60 rects), wired as the default Prontera override
// with fallback to base monsters.json + procedural Lunatic when V3 is absent.
{
  const V3PNG = path.join(ROOT, 'public/assets-v2/prontera/monsters-v3.png');
  const V3JSON = path.join(ROOT, 'public/assets-v2/prontera/monsters-v3.json');
  assert.ok(fs.existsSync(V3PNG), 'V3 runtime sheet exists');
  assert.ok(fs.existsSync(V3JSON), 'V3 runtime manifest exists');
  const v3 = JSON.parse(fs.readFileSync(V3JSON, 'utf8'));
  assert.deepEqual(Object.keys(v3.monsters),
    ['poring', 'pupa', 'picky', 'chonchon', 'orcbaby', 'lunatic'],
    'V3 holds exactly the six Prontera IDs in order (nothing else)');
  const POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
  let rects = 0;
  const heights = {};
  for (const [id, m] of Object.entries(v3.monsters)) {
    for (const side of ['down', 'up']) {
      assert.deepEqual(Object.keys(m[side]), POSES, `${id}.${side} has five poses`);
      heights[`${id}.${side}`] = [];
      for (const p of POSES) {
        const r = m[side][p];
        assert.deepEqual(Object.keys(r).sort(), ['h', 'w', 'x', 'y'], `${id}.${side}.${p} is a plain rect`);
        for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(r[k]), `${id}.${side}.${p}.${k} is int`);
        assert.ok(r.w >= 20 && r.h >= 20, `${id}.${side}.${p} is no sliver (${r.w}x${r.h})`);
        assert.ok(r.w <= 260 && r.h <= 260, `${id}.${side}.${p} is no fused crop (${r.w}x${r.h})`);
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= v3.size.w && r.y + r.h <= v3.size.h,
          `${id}.${side}.${p} inside the sheet`);
        heights[`${id}.${side}`].push(r.h);
        rects++;
      }
    }
  }
  assert.equal(rects, 60, 'V3 holds exactly 60 runtime rects');
  for (const [k, hs] of Object.entries(heights)) {
    assert.ok(Math.max(...hs) / Math.min(...hs) <= 2.0, `${k} heights stay consistent (no jitter/shrink)`);
  }
  ok('prontera V3 manifest (six IDs, 60 rects, schema, anchors)');

  // The sheet is real RGBA with the gray matte keyed out (not an opaque
  // rectangle) and real art preserved (not an empty sheet).
  const { inflateSync } = await import('node:zlib');
  const d = fs.readFileSync(V3PNG);
  const W = d.readUInt32BE(16), H = d.readUInt32BE(20);
  assert.equal(d[24], 8, 'V3 sheet is 8-bit');
  assert.equal(d[25], 6, 'V3 sheet is RGBA (matte keyed to alpha)');
  let pos = 8; const parts = [];
  while (pos < d.length) {
    const len = d.readUInt32BE(pos), typ = d.toString('ascii', pos + 4, pos + 8);
    if (typ === 'IDAT') parts.push(d.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const px = inflateSync(Buffer.concat(parts));
  const stride = W * 4;
  let prev = Buffer.alloc(stride), transparent = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < H; y++) {
    const f = px[y * (stride + 1)];
    const line = Buffer.from(px.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
    }
    for (let x = 3; x < stride; x += 4) if (line[x] < 128) transparent++;
    prev = line;
  }
  const frac = transparent / (W * H);
  assert.ok(frac > 0.3 && frac < 0.99, `V3 matte keyed out, art kept (transparent ${frac.toFixed(2)})`);
  ok('prontera V3 sheet alpha (matte removed, silhouettes kept)');

  // QA artifacts: labeled contact sheet plus metrics report.
  const qaPng = path.join(ROOT, 'art-clean/prontera-gpt/qa/contact-prontera-v3.png');
  const qaJson = path.join(ROOT, 'art-clean/prontera-gpt/qa/report-v3.json');
  assert.ok(fs.existsSync(qaPng), 'V3 contact sheet exists');
  const rep = JSON.parse(fs.readFileSync(qaJson, 'utf8'));
  assert.equal(rep.rects.length, 60, 'V3 report covers 60 rects');
  ok('prontera V3 QA artifacts (contact sheet, metrics report)');

  // atlas.js merges V3 after monsters2 (so V3 Lunatic wins) but after nothing
  // else it could disturb; missing V3 files fall back to base + procedural.
  const atlas = fs.readFileSync(path.join(ROOT, 'src/engine/atlas.js'), 'utf8');
  assert.ok(atlas.includes('monsters-v3'), 'atlas loads the V3 atlas');
  const iBase = atlas.indexOf("addMonsters(monManifest, monBase)");
  const iMon2 = atlas.indexOf('addMonsters(mon2Manifest, mon2Base)');
  const iV3 = atlas.indexOf('addMonsters(monV3Manifest, monV3Base)');
  assert.ok(iBase >= 0 && iMon2 > iBase && iV3 > iMon2, 'V3 merges after base and monsters2');
  const rend = fs.readFileSync(path.join(ROOT, 'src/render/renderer.js'), 'utf8');
  assert.ok(rend.includes('this.enemyTex[e.skin] ?? this.enemyTex.poring'),
    'procedural Lunatic fallback intact');
  ok('prontera V3 atlas wiring (default override, fallback intact)');
}

// --- 13. Prontera V3 semantic panels: the approved sheet is two columns
// split at the grid half (x=561, left: poring/picky/orcbaby, right:
// pupa/chonchon/lunatic). No rect may cross that boundary (the slicer once
// aliased picky.attack into chonchon.down.idle at x439), left/right rects of
// a row must not overlap, and every chonchon crop holds exactly one body
// (attack keeps only its compact orb, hit only its stars).
{
  const COL = 561;
  const v3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets-v2/prontera/monsters-v3.json'), 'utf8'));
  const LEFT_IDS = ['poring', 'picky', 'orcbaby'];
  const RIGHT_IDS = ['pupa', 'chonchon', 'lunatic'];
  assert.deepEqual(Object.keys(v3.monsters),
    ['poring', 'pupa', 'picky', 'chonchon', 'orcbaby', 'lunatic'],
    'V3 ID order unchanged (row pairs align with columns)');
  const rectsOf = (id) => Object.values(v3.monsters[id].down).concat(Object.values(v3.monsters[id].up));
  for (const id of LEFT_IDS)
    for (const r of rectsOf(id))
      assert.ok(r.x + r.w <= COL, `${id} rect stays left of the column split (x+w=${r.x + r.w} <= ${COL})`);
  ok('prontera V3 left-column rects stay left of x=561');
  for (const id of RIGHT_IDS)
    for (const r of rectsOf(id))
      assert.ok(r.x >= COL, `${id} rect stays right of the column split (x=${r.x} >= ${COL})`);
  ok('prontera V3 right-column rects stay right of x=561');
  const pairs = [['poring', 'pupa'], ['picky', 'chonchon'], ['orcbaby', 'lunatic']];
  for (const [l, rgt] of pairs)
    for (const a of rectsOf(l))
      for (const b of rectsOf(rgt)) {
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${l} rect never overlaps ${rgt} rect (no cross-panel crop)`);
      }
  ok('prontera V3 row pairs never overlap across panels');

  // chonchon widths stay near their median (a fused double body reads ~2x).
  const cw = [];
  for (const [id, m] of Object.entries(v3.monsters))
    if (id === 'chonchon')
      for (const side of ['down', 'up'])
        for (const p of ['idle', 'moveL', 'moveR', 'hit', 'attack']) cw.push(m[side][p].w);
  assert.equal(cw.length, 10, 'ten chonchon crops');
  const cmed = [...cw].sort((a, b) => a - b)[5];
  for (const wdt of cw) {
    assert.ok(wdt <= 1.65 * cmed, `chonchon width ${wdt} within 1.65x median ${cmed} (no fused double body)`);
    assert.ok(wdt >= 0.5 * cmed, `chonchon width ${wdt} within 0.5x median ${cmed} (no sliver)`);
  }
  ok('prontera V3 chonchon widths near median (no fusion, no slivers)');

  // each chonchon crop holds exactly one body: decode the sheet and count
  // large opaque components per rect (hit stars and orb bits stay small).
  const { inflateSync } = await import('node:zlib');
  const d = fs.readFileSync(path.join(ROOT, 'public/assets-v2/prontera/monsters-v3.png'));
  const W = d.readUInt32BE(16), H = d.readUInt32BE(20);
  let pos = 8; const parts = [];
  while (pos < d.length) {
    const len = d.readUInt32BE(pos), typ = d.toString('ascii', pos + 4, pos + 8);
    if (typ === 'IDAT') parts.push(d.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const rawPx = inflateSync(Buffer.concat(parts));
  const stride = W * 4;
  const alpha = Buffer.alloc(W * H);
  let prev = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < H; y++) {
    const f = rawPx[y * (stride + 1)];
    const line = Buffer.from(rawPx.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255;
      else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
    }
    for (let x = 0; x < W; x++) alpha[y * W + x] = line[x * 4 + 3] > 128 ? 1 : 0;
    prev = line;
  }
  const bigComps = (r) => {
    const seen = new Uint8Array(r.w * r.h);
    let big = 0;
    for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx++) {
      if (!alpha[(r.y + yy) * W + r.x + xx] || seen[yy * r.w + xx]) continue;
      let n = 0; const st = [yy * r.w + xx]; seen[yy * r.w + xx] = 1;
      while (st.length) {
        const c = st.pop(); n++;
        const cx = c % r.w, cy = (c / r.w) | 0;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= r.w || ny >= r.h || seen[ny * r.w + nx]) continue;
          if (!alpha[(r.y + ny) * W + r.x + nx]) continue;
          seen[ny * r.w + nx] = 1; st.push(ny * r.w + nx);
        }
      }
      if (n >= 2500) big++;
    }
    return big;
  };
  for (const side of ['down', 'up'])
    for (const p of ['idle', 'moveL', 'moveR', 'hit', 'attack']) {
      const r = v3.monsters.chonchon[side][p];
      assert.equal(bigComps(r), 1, `chonchon.${side}.${p} holds exactly one body`);
    }
  ok('prontera V3 chonchon crops each hold one body (orb/stars stay small)');
}

// --- 14. Niflheim (level 7): approved sheets sliced to versioned runtime
// atlases (6 mobs + Loli Ruri + Lord of Death + 7 map tiles), wired as the
// seventh campaign level with the approved Niflheim recording wired as the
// runtime MP3 (level7 chiptune retained strictly as fallback).
{
  const N = (...p) => path.join(ROOT, 'public', 'assets-v2', 'niflheim', ...p);
  for (const f of ['monsters11.png', 'monsters11.json', 'monsters12.json',
                   'bosses5.png', 'bosses5.json',
                   ...[1, 2, 3, 4, 5, 6, 7].map((i) => `maps/niflheim00${i}.png`)]) {
    assert.ok(fs.existsSync(N(f)), `missing niflheim asset: assets-v2/niflheim/${f}`);
  }
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  // exact asset IDs + pose inventory: 6 mobs x down/up x 5 poses.
  const m11 = read(N('monsters11.json'));
  assert.equal(m11.sheet, 'monsters11.png');
  assert.deepEqual(Object.keys(m11.monsters).sort(),
    ['dullahan', 'gibbet', 'heirozoist', 'lude', 'murderer', 'quve']);
  const seenRects = new Set();
  for (const [name, e] of Object.entries(m11.monsters)) {
    for (const side of ['down', 'up']) {
      assert.deepEqual(Object.keys(e[side]).sort(), ['attack', 'hit', 'idle', 'moveL', 'moveR'], `${name}.${side} poses`);
      for (const [pose, r] of Object.entries(e[side])) {
        assert.ok(r.w >= 20 && r.h >= 30 && r.x >= 0 && r.y >= 0 &&
          r.x + r.w <= m11.size.w && r.y + r.h <= m11.size.h, `${name}.${side}.${pose} in-bounds, non-degenerate`);
        const key = `${r.x},${r.y},${r.w},${r.h}`;
        assert.ok(!seenRects.has(key), `${name}.${side}.${pose} rect unique`);
        seenRects.add(key);
      }
    }
  }
  assert.equal(seenRects.size, 60, '60 unique mob rects');
  // semantic panel ownership: 2 columns split at the sheet half (x=768);
  // left column dullahan/gibbet/lude, right column heirozoist/quve/murderer.
  const COL = 768;
  for (const id of ['dullahan', 'gibbet', 'lude'])
    for (const side of ['down', 'up']) for (const r of Object.values(m11.monsters[id][side]))
      assert.ok(r.x + r.w <= COL, `${id} rect stays left of the column split`);
  for (const id of ['heirozoist', 'quve', 'murderer'])
    for (const side of ['down', 'up']) for (const r of Object.values(m11.monsters[id][side]))
      assert.ok(r.x >= COL, `${id} rect stays right of the column split`);
  for (const [l, rgt] of [['dullahan', 'heirozoist'], ['gibbet', 'quve'], ['lude', 'murderer']])
    for (const s of ['down', 'up']) for (const a of Object.values(m11.monsters[l][s]))
      for (const b of Object.values(m11.monsters[rgt][s])) {
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${l} rect never overlaps ${rgt} rect`);
      }
  ok('niflheim mob assets + IDs + semantic panels (60 unique rects)');

  // Loli Ruri shares the boss sheet (mob-shape manifest, like Osiris).
  const m12 = read(N('monsters12.json'));
  assert.equal(m12.sheet, 'bosses5.png');
  assert.deepEqual(Object.keys(m12.monsters), ['loliruri']);
  // Bosses: pose arrays for the renderer cycler; hit is one isolated figure.
  const b5 = read(N('bosses5.json'));
  assert.equal(b5.sheet, 'bosses5.png');
  assert.deepEqual(Object.keys(b5.bosses).sort(), ['loliRuri', 'lordOfDeath']);
  for (const name of ['loliRuri', 'lordOfDeath']) {
    const e = b5.bosses[name];
    for (const side of ['down', 'up']) {
      assert.deepEqual(Object.keys(e[side]).sort(), ['attack', 'hit', 'idle', 'moveL', 'moveR'], `${name}.${side} poses`);
      for (const pose of ['idle', 'moveL', 'moveR', 'hit', 'attack']) {
        const v = e[side][pose];
        assert.ok(Array.isArray(v) && v.length >= 1 && v.length <= 3, `${name}.${side}.${pose} frames 1..3`);
        for (const r of v)
          assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= b5.size.w && r.y + r.h <= b5.size.h, `${name}.${side}.${pose} in-bounds`);
      }
      assert.equal(e[side].hit.length, 1, `${name}.${side}.hit is 1 figure`);
    }
  }
  // boss sheet halves: Loli Ruri left, Lord of Death right. The semantic
  // split is the measured inter-boss gutter (x813-838), not the arithmetic
  // half: LoD idle legitimately starts at x830 (its own scythe), Loli's
  // attack burst ends at x824 — 6px apart, never overlapping.
  const loliAll = [], lodAll = [];
  for (const side of ['down', 'up']) {
    for (const v of Object.values(b5.bosses.loliRuri[side])) for (const r of v) {
      assert.ok(r.x + r.w <= 830, 'loliRuri stays in the left boss half');
      loliAll.push(r);
    }
    for (const v of Object.values(b5.bosses.lordOfDeath[side])) for (const r of v) {
      assert.ok(r.x >= 824, 'lordOfDeath stays in the right boss half');
      lodAll.push(r);
    }
  }
  for (const a of loliAll) for (const b of lodAll) {
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.ok(!overlap, 'loliRuri rect never overlaps lordOfDeath rect');
  }
  ok('niflheim boss assets + halves (loliRuri left, lordOfDeath right)');

  // QA report: slicer metrics, gates summary, deterministic inputs.
  const rep = read(path.join(ROOT, 'art-clean', 'niflheim-gpt', 'qa', 'report-niflheim.json'));
  assert.equal(rep.counts.mobs, 6, 'report covers 6 mobs');
  assert.equal(rep.counts.mob_poses, 60, 'report covers 60 mob poses');
  assert.equal(rep.counts.map_tiles, 7, 'report covers 7 map tiles');
  assert.ok(rep.worst_bn <= 0.16, `report worst bright-neutral ${rep.worst_bn} <= 0.16`);
  assert.ok(rep.worst_edge <= 100, `report worst edge mass ${rep.worst_edge} <= 100px`);
  assert.ok(Array.isArray(rep.warnings), 'report warnings list');
  for (const f of ['contact-niflheim-mobs.png', 'contact-niflheim-bosses.png'])
    assert.ok(fs.existsSync(path.join(ROOT, 'art-clean', 'niflheim-gpt', 'qa', f)), `QA sheet ${f} exists`);
  ok('niflheim QA report + contact sheets');

  // alpha: keyed sheets are real RGBA with matte removed, art preserved.
  const { inflateSync } = await import('node:zlib');
  const alphaFrac = (p) => {
    const d = fs.readFileSync(p);
    const W = d.readUInt32BE(16), H = d.readUInt32BE(20);
    assert.equal(d[25], 6, `${p} is RGBA`);
    let pos = 8; const parts = [];
    while (pos < d.length) {
      const len = d.readUInt32BE(pos), typ = d.toString('ascii', pos + 4, pos + 8);
      if (typ === 'IDAT') parts.push(d.subarray(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    const px = inflateSync(Buffer.concat(parts));
    const stride = W * 4;
    let prev = Buffer.alloc(stride), transparent = 0;
    const paeth = (a, b, c) => {
      const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
      return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < H; y++) {
      const f = px[y * (stride + 1)];
      const line = Buffer.from(px.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        if (f === 1) line[i] = (line[i] + a) & 255;
        else if (f === 2) line[i] = (line[i] + b) & 255;
        else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
        else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
      }
      for (let x = 3; x < stride; x += 4) if (line[x] < 128) transparent++;
      prev = line;
    }
    return transparent / (W * H);
  };
  for (const f of ['monsters11.png', 'bosses5.png']) {
    const frac = alphaFrac(N(f));
    assert.ok(frac > 0.2 && frac < 0.99, `${f} matte keyed out, art kept (transparent ${frac.toFixed(2)})`);
  }
  ok('niflheim sheet alpha (matte removed, silhouettes kept)');

  // registry + wiring (source-text: these files import PixiJS, skip node import)
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  assert.ok(src('src/levels/index.js').includes("mapSet: 'niflheim'"), 'LEVELS has niflheim entry');
  assert.ok(src('src/levels/index.js').includes("title: 'Nivel 7'"), 'LEVELS has Nivel 7');
  assert.ok(src('src/scenes/game.js').includes('0x51f47e'), 'LEVEL_SEEDS has level 7 seed');
  assert.ok(src('src/scenes/practice.js').includes('loliRuri'), 'practice has Loli Ruri');
  assert.ok(src('src/scenes/practice.js').includes('lordOfDeath'), 'practice has Lord of Death');
  assert.ok(src('src/render/renderer.js').includes("'Loli Ruri': 'loliRuri'"), 'BOSS_TEX has Loli Ruri');
  assert.ok(src('src/render/renderer.js').includes("'Lord of Death': 'lordOfDeath'"), 'BOSS_TEX has Lord of Death');
  assert.ok(src('src/render/themes.js').includes('level7Theme'), 'level7Theme exists');
  assert.ok(src('src/engine/atlas.js').includes('monsters11') && src('src/engine/atlas.js').includes('bosses5'), 'atlas loads niflheim sheets');
  assert.ok(src('src/engine/atlas.js').includes('niflheim'), 'atlas loads niflheim maps');
  const musicSrc = src('src/engine/music.js');
  assert.ok(musicSrc.includes('level7:'), 'music has level7 chiptune track');
  // Niflheim map music: approved recording wired as the runtime MP3, with the
  // level7 chiptune retained strictly as missing/corrupt-file fallback.
  assert.ok(musicSrc.includes('level7: `${BASE}assets/music/niflheim.mp3`'),
    'MP3_TRACKS wires the Niflheim recording for level7');
  assert.ok(!musicSrc.includes('No MP3 was supplied for this stage'),
    'stale no-recording comment is gone');
  assert.ok(musicSrc.includes("name === 'boss' && this.mp3El"),
    'recorded stage track keeps playing through midboss/final boss');
  ok('niflheim registry wiring (7th level, practice, theme, atlas, recording)');

  // dialogue: both bosses x 6 characters.
  const { DIALOGUE } = await import('../src/data/dialogue.js');
  for (const boss of ['Loli Ruri', 'Lord of Death']) {
    for (const c of ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri']) {
      assert.ok(DIALOGUE[boss]?.[c]?.p && DIALOGUE[boss]?.[c]?.b, `dialogue ${boss}/${c}`);
    }
  }
  ok('niflheim dialogue (2 bosses x 6 chars)');

  // boss defs: Loli Ruri midboss cards, Lord of Death 3 phases; solo kill
  // completes the level (practice shape), cards advance deterministically.
  const { createSim, tickSim } = await import('../src/sim/sim.js');
  const { spawnBoss, damageBoss, stepBoss, loliRuri, lordOfDeath } = await import('../src/sim/boss.js');
  const { ROSTER } = await import('../src/characters/index.js');
  const { level7 } = await import('../src/levels/level7.js');
  assert.deepEqual(loliRuri.cards.map((c) => c.name), ['Alas de Murciélago', 'Hechizo de Rosas']);
  assert.deepEqual(lordOfDeath.cards.map((c) => c.name), ['Guadaña Espectral', 'Rito Nigromante', 'Eclipse Final']);
  {
    const sim = createSim(0x51f47e, [ROSTER[0]]);
    spawnBoss(sim, lordOfDeath);
    assert.equal(sim.bosses[0].name, 'Lord of Death');
    let guard = 30000, phases = 0;
    while (!sim.levelComplete && guard-- > 0) {
      for (const b of [...sim.bosses]) damageBoss(sim, 1e6, b);
      if (sim.bosses[0]) phases = Math.max(phases, sim.bosses[0].cardIndex);
      stepBoss(sim);
      sim.events.length = 0;
    }
    assert.ok(sim.levelComplete, 'Lord of Death kill must complete the level');
    assert.equal(phases, 2, 'all three phases advance');
    ok('lordOfDeath boss def (spawn -> 3 cards -> levelClear)');
  }

  // level 7 timeline: phase boundaries land on time, edge spawns symmetric,
  // midboss gates on the kill, approach spawns the final boss.
  {
    const { FIELD_W } = await import('../src/sim/constants.js');
    const sim = createSim(0x51f47e, [ROSTER[0]]);
    sim.players[0].lives = 999;
    const step = (n) => {
      for (let k = 0; k < n; k++) tickSim(sim, [16], level7);
      sim.events.length = 0;
    };
    const phase = () => sim.level.phase;
    step(99);
    assert.ok(!sim.enemies.active.some((e) => e.t === 1), 'nothing spawns before its first tick');
    step(111); // gyoll t=210: first right-edge quve (t=70 spawns left)
    let qv = sim.enemies.active.find((e) => e.skin === 'quve' && e.t === 1);
    assert.ok(qv, 'quve spawns at t=210');
    assert.ok(qv.vx < 0 && qv.x > FIELD_W - 100, 'right-edge quve heads inward');
    step(1090); // gyoll t=1300
    assert.equal(phase(), 'forest', 'gyoll -> forest at t=1300');
    step(1400); // forest t=1400
    assert.equal(phase(), 'lanes', 'forest -> lanes at t=1400');
    step(1300); // lanes t=1300
    assert.equal(phase(), 'square', 'lanes -> square at t=1300');
    step(1400); // square t=1400
    assert.equal(phase(), 'midboss', 'square -> midboss at t=1400');
    step(100); // let Loli Ruri arrive, then fell her like a player would
    const loli = sim.enemies.active.find((e) => e.skin === 'loliruri');
    assert.ok(loli, 'Loli Ruri elite holds the arena');
    loli.hp = 0;
    step(61); // reap + pass the t>60 gate
    assert.equal(phase(), 'fortress', 'midboss -> fortress after the kill');
    step(1400); // fortress t=1400
    assert.equal(phase(), 'approach', 'fortress -> approach at t=1400');
    const seen = new Set();
    for (let k = 0; k < 200 && phase() !== 'boss'; k++) {
      tickSim(sim, [16], level7);
      for (const e of sim.events) if (e.type === 'bossWarning') seen.add(e.name);
      sim.events.length = 0;
    }
    assert.equal(phase(), 'boss', 'approach -> boss at t=150');
    assert.ok(seen.has('Lord of Death'), 'Lord of Death warning fires');
    ok('level7 timeline (clock, edge entry, phase boundaries, both bosses)');
  }

  // level 7 replay determinism: two sims, same seed + inputs, identical
  // checksums at two phase transitions.
  {
    const checksum = (sim) => {
      const r3 = (n) => Math.round(n * 1000);
      const parts = [sim.tick, sim.score, r3(sim.biome), sim.level.phase, sim.level.t,
        ...sim.players.flatMap((p) => (p ? [r3(p.x), r3(p.y), p.lives, p.power, p.bombs] : ['x'])),
        sim.enemies.active.length,
        ...sim.enemies.active.flatMap((e) => [e.skin, r3(e.x), r3(e.y), Math.round(e.hp * 1000), e.t]),
        sim.bullets.active.length, sim.enemyBullets.active.length,
        ...sim.bullets.active.flatMap((b) => [r3(b.x), r3(b.y)]),
        ...sim.enemyBullets.active.flatMap((b) => [r3(b.x), r3(b.y), b.color])];
      const s = JSON.stringify(parts);
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16);
    };
    const runTo = (ticks) => {
      const sim = createSim(0x51f47e, [ROSTER[0]]);
      sim.players[0].lives = 999;
      const marks = [];
      for (let k = 0; k < ticks; k++) {
        tickSim(sim, [16], level7);
        if (k + 1 === 1300 || k + 1 === 4100) marks.push(checksum(sim));
        sim.events.length = 0;
      }
      return marks;
    };
    const [a, b] = [runTo(4200), runTo(4200)];
    assert.equal(a.length, 2, 'both transitions marked');
    assert.deepEqual(a, b, 'level 7 replays bit-identically');
    ok('level7 replay checksum (two sims, phase transitions)');
  }

  // bounded pressure: full headless run on the campaign recipe; peak live
  // enemy bullets and per-skin concurrency stay capped (no per-tick spam,
  // high-pressure elites gated like the Isis pair rule).
  {
    const sim = createSim(0x51f47e, [ROSTER[0]]);
    sim.players[0].lives = 999;
    const seen = new Set();
    let guard = 60000, i = 0, peak = 0, finiteBiome = true, maxBiome = 0;
    const conc = {};
    while (!sim.levelComplete && guard-- > 0) {
      const mask = (i++ % 600 < 590) ? 16 : 0;
      tickSim(sim, [16], level7);
      if (!Number.isFinite(sim.biome)) finiteBiome = false;
      if (sim.biome > maxBiome) maxBiome = sim.biome;
      if (sim.enemyBullets.active.length > peak) peak = sim.enemyBullets.active.length;
      const per = {};
      for (const e of sim.enemies.active) per[e.skin] = (per[e.skin] || 0) + 1;
      for (const [k, v] of Object.entries(per)) conc[k] = Math.max(conc[k] || 0, v);
      for (const e of sim.events) {
        if (e.type === 'bossWarning' || e.type === 'warning') seen.add(e.name);
      }
      sim.events.length = 0;
    }
    assert.ok(seen.has('Loli Ruri'), `midboss warning seen (got: ${[...seen]})`);
    assert.ok(seen.has('Lord of Death'), `final warning seen (got: ${[...seen]})`);
    assert.ok(sim.levelComplete, `level 7 completes (tick=${sim.tick} over=${sim.gameOver})`);
    assert.ok(finiteBiome, 'sim.biome stays finite through the full run');
    assert.ok(maxBiome > 0.3, `sim.biome advances (max=${maxBiome})`);
    assert.ok(peak <= 1200, `full-run bullet peak ${peak} <= 1200`);
    for (const [skin, cap] of [['heirozoist', 2], ['dullahan', 2], ['quve', 3], ['murderer', 2], ['gibbet', 3], ['lude', 4]]) {
      assert.ok((conc[skin] || 0) <= cap, `${skin} concurrency ${(conc[skin] || 0)} <= ${cap}`);
    }
    ok(`niflheim full run (tick=${sim.tick} score=${sim.score} peak=${peak} biome=${maxBiome.toFixed(3)})`);
  }

  // Niflheim hardening: pacifist Lude bound, Gibbet pooling hygiene, Loli
  // phase coverage at controlled HP, finite positions, both warning types.
  {
    // pacifist Lude bound: no player fire, drifters still cap at 4.
    {
      const sim = createSim(0x51f47e, [ROSTER[0]]);
      sim.players[0].lives = 999;
      let maxLude = 0;
      for (let k = 0; k < 3000; k++) {
        tickSim(sim, [0], level7);
        let n = 0;
        for (const e of sim.enemies.active) if (e.skin === 'lude') n++;
        if (n > maxLude) maxLude = n;
        sim.events.length = 0;
      }
      assert.ok(maxLude <= 4, `pacifist lude concurrency ${maxLude} <= 4`);
      ok('niflheim pacifist lude bound (no-fire drift stays <= 4)');
    }

    // Gibbet pooling: fresh spawn starts unrooted with finite laneX, reuse
    // cannot leak rooted/laneX, and every bullet stays finite.
    {
      const sim = createSim(0x51f47e, [ROSTER[0]]);
      sim.players[0].lives = 999;
      sim.level = { phase: 'forest', t: 79, midAlive: false };
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      const g0 = sim.enemies.active.find((e) => e.skin === 'gibbet');
      assert.ok(g0, 'forest spawns a gibbet');
      assert.equal(g0.rooted, false, 'fresh gibbet starts unrooted');
      assert.ok(Number.isFinite(g0.laneX), 'fresh gibbet laneX finite');
      g0.y = 200; g0.vy = 0;
      for (let k = 0; k < 160; k++) { tickSim(sim, [0], level7); sim.events.length = 0; }
      assert.equal(g0.rooted, true, 'gibbet roots after parking');
      sim.level = { phase: 'approach', t: 0, midAlive: false };
      for (const e of sim.enemies.active) e.hp = 0;
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      assert.ok(!sim.enemies.active.some((e) => e.skin === 'gibbet'), 'rooted gibbet reaped');
      sim.level = { phase: 'forest', t: 79, midAlive: false };
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      const g1 = sim.enemies.active.find((e) => e.skin === 'gibbet' && e.y < 50);
      assert.ok(g1, 'a reused gibbet spawns');
      assert.equal(g1.rooted, false, 'reused gibbet starts unrooted (no pool leak)');
      assert.ok(Number.isFinite(g1.laneX), 'reused gibbet laneX finite (no pool leak)');
      for (let k = 0; k < 400; k++) {
        tickSim(sim, [0], level7);
        for (const b of sim.enemyBullets.active) {
          assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), 'gibbet bullet finite');
        }
        sim.events.length = 0;
      }
      ok('niflheim gibbet pooling (rooted/laneX init, reuse, finite bullets)');
    }

    // Loli: pooled spawn carries maxhp 750 + deterministic phase; reaches
    // y=200; emits all three shared phase patterns at controlled HP; both
    // warning types fire; kill-gate advances only after the kill.
    {
      const sim = createSim(0x51f47e, [ROSTER[0]]);
      sim.players[0].lives = 999;
      // poison the enemy pool so leaked maxhp/phase would stick to Loli.
      const d = sim.spawnEnemy({ skin: 'dummy', x: 300, y: 300, hp: 1 });
      d.maxhp = 5; d.phase = 99; d.rooted = true; d.laneX = NaN;
      d.hp = 0;
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      sim.level = { phase: 'midboss', t: 0, midAlive: false };
      const seen = new Set();
      for (let k = 0; k < 40; k++) {
        tickSim(sim, [0], level7);
        for (const e of sim.events) if (e.name === 'Loli Ruri') seen.add(e.type);
        sim.events.length = 0;
      }
      assert.ok(seen.has('warning'), 'Loli warning banner fires');
      assert.ok(seen.has('bossWarning'), 'Loli bossWarning fires (dialogue path)');
      const loli = sim.enemies.active.find((e) => e.skin === 'loliruri');
      assert.ok(loli, 'Loli Ruri elite holds the arena');
      assert.equal(loli.maxhp, 750, 'campaign Loli maxhp 750 (no pool leak)');
      assert.equal(loli.phase, 1, 'campaign Loli deterministic phase init');
      let guard = 600;
      while (loli.y < 200 && guard-- > 0) { tickSim(sim, [0], level7); sim.events.length = 0; }
      assert.ok(loli.y >= 200, `Loli reaches y=200 (y=${loli.y})`);
      const fire = sim.spawnEnemyBullet.bind(sim);
      for (const [hp, want] of [[750, 1], [400, 2], [150, 3]]) {
        loli.hp = hp;
        let made = 0, teleMax = loli.tele;
        sim.spawnEnemyBullet = (props) => { made++; return fire(props); };
        for (let k = 0; k < 120; k++) {
          tickSim(sim, [0], level7);
          if (loli.tele > teleMax) teleMax = loli.tele;
          sim.events.length = 0;
        }
        sim.spawnEnemyBullet = fire;
        assert.equal(loli.phase, want, `Loli phase ${want} at hp=${hp} (maxhp 750)`);
        assert.ok(made > 0, `Loli phase ${want} produces shared-pattern bullets (made=${made})`);
        if (want > 1) assert.ok(teleMax > 0, `Loli phase ${want} change is telegraphed`);
      }
      assert.equal(sim.level.phase, 'midboss', 'kill-gate holds before the kill');
      loli.hp = 0;
      for (let k = 0; k < 61; k++) { tickSim(sim, [0], level7); sim.events.length = 0; }
      assert.equal(sim.level.phase, 'fortress', 'kill-gate advances after the kill');
      ok('niflheim loli phases (y=200, 3 shared patterns, warnings, kill-gate)');
    }

    // full run: every enemy/bullet position stays finite; both warning
    // event types fire for Loli plus the final bossWarning.
    {
      const sim = createSim(0x51f47e, [ROSTER[0]]);
      sim.players[0].lives = 999;
      const seen = new Set();
      let guard = 60000, i = 0;
      while (!sim.levelComplete && guard-- > 0) {
        const mask = (i++ % 600 < 590) ? 16 : 0;
        tickSim(sim, [mask], level7);
        for (const e of sim.enemies.active) {
          assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy position finite');
        }
        for (const b of sim.enemyBullets.active) {
          assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), 'bullet position finite');
        }
        for (const e of sim.events) {
          if ((e.type === 'warning' || e.type === 'bossWarning') && e.name) seen.add(`${e.type}:${e.name}`);
        }
        sim.events.length = 0;
      }
      assert.ok(sim.levelComplete, 'finite full run completes level 7');
      assert.ok(seen.has('warning:Loli Ruri'), 'full run sees Loli warning');
      assert.ok(seen.has('bossWarning:Loli Ruri'), 'full run sees Loli bossWarning');
      assert.ok(seen.has('bossWarning:Lord of Death'), 'full run sees Lord of Death bossWarning');
      ok('niflheim finite full run (positions finite, both warning types)');
    }
  }

  // direct review: Nivel 7 is reachable through the same generic payload
  // (exact character + level index, fresh score/carry, review marker) — the
  // payload and no-advance/no-score behavior are level-index-generic (§10),
  // so reaching Nivel 7 is exactly its index in the LEVELS registry.
  {
    const titles = [...src('src/levels/index.js').matchAll(/title: '(Nivel \d)'/g)].map((m) => m[1]);
    assert.equal(titles[6], 'Nivel 7', 'selector reaches Nivel 7 by index');
    assert.ok(src('src/scenes/levelselect.js').includes('LEVELS.length'), 'choices still derive from LEVELS length');
    ok('niflheim direct review (Nivel 7 indexed in LEVELS)');
  }
}

// --- 15. Niflheim slicer hardening: catastrophe row-exact restore + RGBA map tiling ---
{
  const { execFileSync } = await import('node:child_process');
  const SLICER = path.join(ROOT, 'tools', 'slice-niflheim.py');
  const runPy = (code) => execFileSync('python', ['-c', code], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  // 15a. catastrophe backstop: a rect spanning image strides restores
  // byte-exactly row by row when REMOVED_CAP triggers.
  const catPy = [
    'import importlib.util',
    `spec = importlib.util.spec_from_file_location("sn", ${JSON.stringify(SLICER)})`,
    'sn = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(sn)',
    'W,H = 10,6',
    'px = bytearray(W*H*4)',
    'def setpx(x,y,r,g,b,a):',
    '    i=(y*W+x)*4',
    '    px[i:i+4]=bytes((r,g,b,a))',
    'MAT=(50,60,70)',
    'for y in range(H):',
    '    for x in range(W):',
    '        setpx(x,y,(x*17+y*31)%256,(x*29+y*11+80)%256,(x*13+y*7+160)%256,255)',
    'R={"x":2,"y":2,"w":4,"h":3}',
    'for y in range(R["y"],R["y"]+R["h"]):',
    '    for x in range(R["x"],R["x"]+R["w"]):',
    '        setpx(x,y,MAT[0],MAT[1],MAT[2],255)',
    'setpx(0,0,MAT[0],MAT[1],MAT[2],0)',
    'setpx(7,3,MAT[0],MAT[1],MAT[2],0)',
    'img=sn.Img(W,H,px)',
    'exp=[bytes(img.px[(R["y"]+yy)*W*4+R["x"]*4:(R["y"]+yy)*W*4+(R["x"]+R["w"])*4]) for yy in range(R["h"])]',
    'errors=[]',
    'stats={"frames":{}}',
    'sn.decontaminate(img,[("t.rect",R)],"testtag",errors,stats)',
    'assert stats["frames"]["t.rect"].get("restored"), "catastrophe branch must trigger (removed>REMOVED_CAP)"',
    'assert any("restored" in e for e in errors), "restore must be reported"',
    'for yy in range(R["h"]):',
    '    got=bytes(img.px[(R["y"]+yy)*W*4+R["x"]*4:(R["y"]+yy)*W*4+(R["x"]+R["w"])*4])',
    '    assert got==exp[yy], f"row {yy} not byte-exact: got {got.hex()} want {exp[yy].hex()}"',
    'print("catastrophe row-exact restore OK")',
  ].join('\n');
  const catOut = runPy(catPy);
  assert.ok(catOut.includes('catastrophe row-exact restore OK'), 'catastrophe helper output');
  ok('niflheim slicer catastrophe restore (strided rect byte-exact)');

  // 15b. map tiling: synthetic RGBA map converts to RGB semantics before
  // three-channel row slicing; tiles run bottom (valley) -> top (fortress).
  const mapPy = [
    'import importlib.util',
    `spec = importlib.util.spec_from_file_location("sn", ${JSON.stringify(SLICER)})`,
    'sn = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(sn)',
    'mw,mh,mch=2,7,4',
    'mpx=bytearray()',
    'for y in range(mh):',
    '    for x in range(mw):',
    '        mpx+=bytes((y*10,y*10+1,y*10+2,255))',
    'tiles=sn.slice_map_tiles(mw,mh,mch,bytes(mpx))',
    'assert len(tiles)==7, f"want 7 tiles, got {len(tiles)}"',
    'assert [t[0] for t in tiles]==sn.MAP_TILES, "tile order follows MAP_TILES bottom->top"',
    'for i,t in enumerate(tiles):',
    '    name,w,h,px=t',
    '    assert w==mw and h==1, f"{name} size {w}x{h}, want 2x1"',
    '    srcrow=mh-1-i',
    '    want=bytes((srcrow*10,srcrow*10+1,srcrow*10+2))*mw',
    '    assert bytes(px)==want, f"{name} pixels {bytes(px).hex()} want {want.hex()} (source row {srcrow})"',
    'print("rgba map tiling OK")',
  ].join('\n');
  const mapOut = runPy(mapPy);
  assert.ok(mapOut.includes('rgba map tiling OK'), 'map tiling helper output');
  ok('niflheim slicer RGBA map tiling (pixels/order)');
}

// --- 16. Residual-sheet-matte gate (every V2 runtime sheet) ---
// Regression guard for the Amon-Ra "opaque parchment rectangle" bug: a frame
// whose sheet background was not keyed out renders as a filled rectangle of
// paper instead of a sprite. The tell is geometric, not chromatic - counting
// "bright neutral" pixels would flag legitimately pale art (skeleton bones,
// mummy wrappings, Loli Ruri's dress), so this gates the two things a real
// crop can never do: fill its whole box, and stay opaque all around its
// border. Worst case across the shipped sheets is 76% fill / 55% border, so
// the ceilings keep headroom while a re-matted frame (~100%/100%) trips.
{
  const { inflateSync } = await import('node:zlib');
  const MAX_FILL = 0.90;    // opaque pixels / rect area
  const MAX_BORDER = 0.75;  // opaque pixels along the rect perimeter

  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  // Minimal RGBA PNG decoder (same idiom as the sheet-alpha checks above).
  const decodePng = (file) => {
    const d = fs.readFileSync(file);
    const W = d.readUInt32BE(16), H = d.readUInt32BE(20);
    assert.equal(d[24], 8, `${path.basename(file)} is 8-bit`);
    assert.equal(d[25], 6, `${path.basename(file)} is RGBA (matte keyed to alpha)`);
    let pos = 8; const parts = [];
    while (pos < d.length) {
      const len = d.readUInt32BE(pos), typ = d.toString('ascii', pos + 4, pos + 8);
      if (typ === 'IDAT') parts.push(d.subarray(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(parts));
    const stride = W * 4, out = Buffer.alloc(W * H * 4);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < H; y++) {
      const f = raw[y * (stride + 1)];
      const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        if (f === 1) line[i] = (line[i] + a) & 255;
        else if (f === 2) line[i] = (line[i] + b) & 255;
        else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
        else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
      }
      line.copy(out, y * stride);
      prev = line;
    }
    return { W, H, px: out };
  };

  // Every {x,y,w,h} leaf under a manifest entry: single rects and frame arrays alike.
  const rectsOf = (node, acc = []) => {
    if (Array.isArray(node)) node.forEach((n) => rectsOf(n, acc));
    else if (node && typeof node === 'object') {
      if ('x' in node && 'w' in node) acc.push(node);
      else Object.values(node).forEach((n) => rectsOf(n, acc));
    }
    return acc;
  };

  const SHEETS = [
    ['public/assets-v2/pyramid/bosses4.png', 'public/assets-v2/pyramid/bosses4.json'],
    ['public/assets-v2/pyramid/bosses4.png', 'public/assets-v2/pyramid/monsters10.json'],
    ['public/assets-v2/pyramid/monsters9.png', 'public/assets-v2/pyramid/monsters9.json'],
    ['public/assets-v2/niflheim/bosses5.png', 'public/assets-v2/niflheim/bosses5.json'],
    ['public/assets-v2/niflheim/monsters11.png', 'public/assets-v2/niflheim/monsters11.json'],
    ['public/assets-v2/prontera/monsters-v3.png', 'public/assets-v2/prontera/monsters-v3.json'],
    ['public/assets-v2/mobs-v3/monsters19.png', 'public/assets-v2/mobs-v3/monsters19.json'],
    ['public/assets-v2/mobs-v3/monsters20.png', 'public/assets-v2/mobs-v3/monsters20.json'],
    ['public/assets-v2/mobs-v3/monsters21.png', 'public/assets-v2/mobs-v3/monsters21.json'],
    ['public/assets-v2/mobs-v3/monsters22.png', 'public/assets-v2/mobs-v3/monsters22.json'],
    ['public/assets-v2/mobs-v3/monsters23.png', 'public/assets-v2/mobs-v3/monsters23.json'],
    ['public/assets-v2/mobs-v3/monsters24.png', 'public/assets-v2/mobs-v3/monsters24.json'],
    ['public/assets-v2/mobs-v3/monsters25.png', 'public/assets-v2/mobs-v3/monsters25.json'],
    ['public/assets-v2/mobs-v3/monsters26.png', 'public/assets-v2/mobs-v3/monsters26.json'],
  ];
  let frames = 0;
  for (const [pngRel, jsonRel] of SHEETS) {
    const img = decodePng(path.join(ROOT, pngRel));
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, jsonRel), 'utf8'));
    const root = man.bosses ?? man.monsters;
    assert.ok(root, `${jsonRel} exposes a bosses/monsters table`);
    for (const [id, node] of Object.entries(root)) {
      for (const r of rectsOf(node)) {
        let opaque = 0, perim = 0, perimOpaque = 0;
        for (let y = r.y; y < r.y + r.h; y++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            const isOpaque = img.px[(y * img.W + x) * 4 + 3] >= 32;
            if (isOpaque) opaque++;
            if (x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1) {
              perim++;
              if (isOpaque) perimOpaque++;
            }
          }
        }
        const fill = opaque / (r.w * r.h), border = perimOpaque / perim;
        assert.ok(fill <= MAX_FILL,
          `${jsonRel} ${id} @${r.x},${r.y} is a sprite, not a filled sheet patch (fill ${(fill * 100).toFixed(1)}%)`);
        assert.ok(border <= MAX_BORDER,
          `${jsonRel} ${id} @${r.x},${r.y} keeps a transparent border (opaque border ${(border * 100).toFixed(1)}%)`);
        frames++;
      }
    }
  }
  assert.equal(frames, 592, 'gate covers every V2 runtime frame');
  ok(`V2 sheets: no residual opaque matte (${frames} frames, fill/border gated)`);
}

// --- 17. Deploy payload: runtime music is encoded, preview art is pruned ---
// The build used to ship 220 MB to GitHub Pages: 47 MB of it was the music
// masters copied verbatim, and 16 MB was art only reachable through the
// internal ?art=v2 / ?artlab=1 tools. Both are now handled; these checks keep
// them handled when a level 8 shows up.
{
  const musicSrc = fs.readFileSync(path.join(ROOT, 'src/engine/music.js'), 'utf8');
  const encoder = fs.readFileSync(path.join(ROOT, 'tools/encode-music.mjs'), 'utf8');
  const MUSIC_DIR = path.join(ROOT, 'public/assets/music');

  // Every stage the game can ask for has a runtime file, and the encoder knows
  // how to regenerate it (a new level whose track is only hand-copied fails).
  const wanted = [...musicSrc.matchAll(/assets\/music\/([\w-]+\.mp3)/g)].map((m) => m[1]);
  assert.ok(wanted.length >= 8, `MP3_TRACKS lists the stage tracks (${wanted.length})`);
  for (const track of wanted) {
    const file = path.join(MUSIC_DIR, track);
    assert.ok(fs.existsSync(file), `runtime track exists: assets/music/${track}`);
    assert.ok(encoder.includes(`'${track}'`), `tools/encode-music.mjs regenerates ${track}`);
  }

  // Encoded, not a master copy: at 128 kbps no track can reach the masters'
  // 166-207 kbps. Bytes/second is format-agnostic, so this needs no ffprobe;
  // 21 kB/s is ~168 kbps, comfortably above 128 and below every master.
  const MAX_BYTES_PER_SEC = 21000;
  const SECONDS = { // master durations, for the byte-rate bound
    'prontera.mp3': 265.0, 'geffen.mp3': 192.7, 'glastheim.mp3': 230.8,
    'juperos.mp3': 248.8, 'biolab.mp3': 376.3, 'pyramid.mp3': 219.0,
    'niflheim.mp3': 311.2, 'menu.mp3': 235.0, 'thanatos.mp3': 204.8,
  };
  let totalBytes = 0;
  for (const [track, secs] of Object.entries(SECONDS)) {
    const bytes = fs.statSync(path.join(MUSIC_DIR, track)).size;
    totalBytes += bytes;
    assert.ok(bytes / secs <= MAX_BYTES_PER_SEC,
      `${track} is encoded for the web, not a master copy (${Math.round(bytes / secs / 125)} kbps)`);
  }
  assert.ok(totalBytes < 40e6, `runtime music stays under 40 MB (${(totalBytes / 1e6).toFixed(1)} MB)`);
  ok(`runtime music encoded + regenerable (${wanted.length} tracks, ${(totalBytes / 1e6).toFixed(1)} MB)`);

  // The build prunes preview-only art, and those trees are still archived.
  const vite = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
  for (const rel of ['assets-v2/bosses', 'assets-v2/geffen']) {
    assert.ok(vite.includes(`'${rel}'`), `vite prunes ${rel} from the build`);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', rel)), `${rel} still available in dev`);
  }
  assert.ok(vite.includes('VITE_PREVIEW_ART'), 'preview art has a build-time escape hatch');
  for (const archive of ['art-clean/bosses-v2.1', 'art-clean/geffen-v2.1']) {
    assert.ok(fs.existsSync(path.join(ROOT, archive)), `clean-art archive kept: ${archive}`);
  }
  // ?art=v2 on a pruned build must fall back to the original sheets.
  const atlasSrc = fs.readFileSync(path.join(ROOT, 'src/engine/atlas.js'), 'utf8');
  assert.ok(atlasSrc.includes('preview asset absent'), 'atlas falls back to the original sheet');
  ok('deploy payload: preview art pruned from build, archived, safe fallback');
}

// --- 18. Pause + exit confirmation ---
// ESC used to drop a live run straight to the title on the first press. It now
// opens a confirmation that defaults to NO, and P pauses offline runs. The
// transitions live in a PixiJS-free module, so these are real state
// transitions rather than source-string matches.
{
  const { createPauseState, pauseKey, isFrozen, MODE, CHOICES } =
    await import('../src/engine/pausecontrol.js');

  // P toggles the freeze offline.
  const st = createPauseState({});
  assert.equal(st.mode, MODE.PLAYING, 'a run starts unpaused');
  assert.equal(pauseKey(st, 'KeyP'), 'freeze', 'P pauses');
  assert.ok(isFrozen(st), 'paused means frozen');
  assert.equal(pauseKey(st, 'KeyP'), 'thaw', 'P resumes');
  assert.ok(!isFrozen(st), 'resumed means running');

  // ESC asks instead of leaving, and NO is preselected.
  assert.equal(pauseKey(st, 'Escape'), 'freeze', 'ESC opens the confirmation');
  assert.equal(st.mode, MODE.CONFIRM, 'confirmation is up');
  assert.equal(CHOICES[st.choice], 'no', 'NO is the default answer');
  assert.ok(isFrozen(st), 'the game is frozen while it asks');

  // A stray ENTER right after ESC must never drop the run.
  assert.equal(pauseKey(st, 'Enter'), 'thaw', 'ENTER on NO cancels');
  assert.equal(st.mode, MODE.PLAYING, 'cancelling returns to play');

  // Choosing SI leaves; arrows move, and NO cannot be walked off the left end.
  pauseKey(st, 'Escape');
  assert.equal(pauseKey(st, 'ArrowLeft'), 'none', 'NO is already leftmost');
  assert.equal(CHOICES[st.choice], 'no', 'left of NO stays NO');
  assert.equal(pauseKey(st, 'ArrowRight'), 'redraw', 'right selects SI');
  assert.equal(CHOICES[st.choice], 'si', 'SI selected');
  assert.equal(pauseKey(st, 'ArrowRight'), 'none', 'SI is already rightmost');
  assert.equal(pauseKey(st, 'Enter'), 'leave', 'ENTER on SI leaves');

  // ESC cancels the dialog too, and reopening always resets to NO.
  const st2 = createPauseState({});
  pauseKey(st2, 'Escape');
  pauseKey(st2, 'ArrowRight');
  assert.equal(pauseKey(st2, 'Escape'), 'thaw', 'ESC cancels the confirmation');
  assert.equal(st2.mode, MODE.PLAYING, 'ESC-cancel returns to play');
  pauseKey(st2, 'Escape');
  assert.equal(CHOICES[st2.choice], 'no', 'the dialog reopens on NO, not on the last answer');

  // Confirming from a paused game returns to PAUSED, not to a running game.
  const st3 = createPauseState({});
  pauseKey(st3, 'KeyP');
  assert.equal(pauseKey(st3, 'Escape'), 'redraw', 'already frozen, so no second freeze');
  assert.equal(st3.returnTo, MODE.PAUSED, 'remembers it came from pause');
  pauseKey(st3, 'Escape');
  assert.equal(st3.mode, MODE.PAUSED, 'cancelling goes back to PAUSED');
  assert.ok(isFrozen(st3), 'and stays frozen');
  assert.equal(pauseKey(st3, 'KeyP'), 'thaw', 'P still resumes from there');

  // Online: lockstep couples both clients, so a local freeze would stall the
  // peer. P is refused and the confirmation never freezes the sim.
  const net = createPauseState({ pausable: false });
  assert.equal(pauseKey(net, 'KeyP'), 'blocked', 'online runs refuse P');
  assert.equal(net.mode, MODE.PLAYING, 'and stay in play');
  assert.equal(pauseKey(net, 'Escape'), 'redraw', 'online ESC asks without freezing');
  assert.ok(!isFrozen(net), 'online never freezes the sim');
  assert.equal(pauseKey(net, 'KeyP'), 'none', 'P is ignored while the question is up');
  assert.equal(pauseKey(net, 'ArrowRight'), 'redraw', 'but the answer can still be changed');
  assert.equal(pauseKey(net, 'Enter'), 'leave', 'and leaving online still works');
  ok('pause state machine (P freeze, ESC confirm defaulting to NO, online guard)');

  // GameScene wiring: the machine drives the scene, and only offline is pausable.
  const scene = fs.readFileSync(path.join(ROOT, 'src/scenes/game.js'), 'utf8');
  assert.ok(scene.includes('createPauseState({ pausable: !campaign.net })'),
    'online runs are constructed non-pausable');
  assert.ok(scene.includes('if (this.frozen) return;'), 'a frozen scene advances nothing');
  assert.ok(/this\.frozen = freeze;\s*\n\s*music\.setPaused\(freeze\);/.test(scene),
    'freezing the sim freezes the music with it');
  assert.ok(scene.includes('this.acc = 0'), 'resuming drops the accumulator (no catch-up burst)');
  // The old handler opened with a bare ESC exit; now the first thing it does
  // during a live run is consult the machine.
  assert.ok(!/this\.onKey = \(e\) => \{\s*\n\s*if \(e\.code === 'Escape'\)/.test(scene),
    'ESC no longer leaves as the first thing the handler does');
  assert.ok(scene.includes('const effect = pauseKey(this.pause, e.code);'),
    'a live run routes keys through the pause machine first');
  // Results / game over own the screen with no run left to protect: ESC there
  // still leaves directly.
  assert.ok(scene.includes("} else if (e.code === 'Escape') { this.leaveToTitle(); return; }"),
    'ESC still exits directly from results / game over');
  const musicSrc2 = fs.readFileSync(path.join(ROOT, 'src/engine/music.js'), 'utf8');
  assert.ok(musicSrc2.includes('setPaused(v)'), 'music can freeze without losing its position');
  assert.ok(!musicSrc2.includes('setPaused(v) {\n    this.stop()'), 'pausing music is not a stop');
  ok('pause wiring (GameScene freeze, music freeze, results ESC unchanged)');
}

// --- 19. Thanatos Tower (level 8): assets, wiring, the 3x HP guard, the new
// boss mechanics (form switch, survival card, echoes, healer) and full runs ---
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const T = (...p) => path.join(ROOT, 'public', 'assets-v2', 'thanatos', ...p);
  const POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack'];

  // assets: every manifest the atlas loads exists, with complete pose sets
  // whose rects sit inside their sheet
  const sheetOf = (json) => JSON.parse(fs.readFileSync(T(json), 'utf8'));
  const inBounds = (r, size, tag) => {
    assert.ok(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= size.w && r.y + r.h <= size.h,
      `${tag} rect ${JSON.stringify(r)} inside ${size.w}x${size.h}`);
  };
  const expectMobs = {
    'monsters13.json': ['retribution', 'sentinel', 'shelter', 'solace'],
    'monsters14.json': ['anger', 'crowduke', 'deathbook', 'voidmimic'],
    'monsters15.json': ['despero', 'dolor', 'maero', 'odium'],
  };
  for (const [json, ids] of Object.entries(expectMobs)) {
    const m = sheetOf(json);
    assert.ok(fs.existsSync(T(m.sheet)), `${json} sheet ${m.sheet} exists`);
    assert.deepEqual(Object.keys(m.monsters).sort(), ids, `${json} ids`);
    for (const [id, e] of Object.entries(m.monsters)) {
      for (const side of ['down', 'up']) {
        assert.deepEqual(Object.keys(e[side]).sort(), [...POSES].sort(), `${json} ${id}.${side} poses`);
        for (const p of POSES) inBounds(e[side][p], m.size, `${id}.${side}.${p}`);
      }
    }
  }
  assert.equal(sheetOf('monsters15.json').sheet, 'bosses6.png', 'fragment elites share bosses6.png');
  for (const [json, ids] of Object.entries({ 'bosses6.json': expectMobs['monsters15.json'], 'bosses7.json': ['thanatos', 'thanatosAwake'] })) {
    const m = sheetOf(json);
    assert.ok(fs.existsSync(T(m.sheet)), `${json} sheet exists`);
    assert.deepEqual(Object.keys(m.bosses).sort(), ids, `${json} boss ids`);
    for (const [id, e] of Object.entries(m.bosses)) {
      for (const side of ['down', 'up']) {
        for (const p of POSES) {
          assert.ok(Array.isArray(e[side][p]) && e[side][p].length === 1, `${id}.${side}.${p} is a one-frame array`);
          inBounds(e[side][p][0], m.size, `${id}.${side}.${p}`);
        }
      }
    }
  }
  const b7 = sheetOf('bosses7.json');
  assert.deepEqual(b7.size, { w: 1536, h: 2048 }, 'bosses7 stacks both forms');
  assert.ok(b7.bosses.thanatos.down.idle[0].y < 1024 && b7.bosses.thanatosAwake.down.idle[0].y >= 1024,
    'form I lives in the top half, form II in the bottom half');
  for (let i = 1; i <= 7; i++) assert.ok(fs.existsSync(T('maps', `thanatos00${i}.png`)), `map tile thanatos00${i}`);
  // provenance: the runtime tree was sliced from exactly the approved sources
  const report = JSON.parse(src('art-clean/thanatos-gpt/qa/report-thanatos.json'));
  const { createHash } = await import('node:crypto');
  const sha = (p) => {
    const h = createHash('sha256'); h.update(fs.readFileSync(path.join(ROOT, p))); return h.digest('hex');
  };
  for (const inp of Object.values(report.inputs)) {
    assert.equal(sha(`art-clean/thanatos-gpt/${inp.file}`), inp.sha256, `approved source ${inp.file} unchanged since slicing`);
  }
  for (const [f, h] of Object.entries(report.outputs)) {
    assert.equal(sha(`public/assets-v2/thanatos/${f}`), h, `runtime ${f} matches the slicer report`);
  }
  ok('thanatos assets (13/14/15 mobs, fragment + 2-form boss sheets, 7 tiles, provenance)');

  // wiring: the eighth and final level, everywhere the game lists levels
  const { LEVELS } = await import('../src/levels/index.js');
  assert.equal(LEVELS.length, 8, 'eight campaign levels');
  assert.equal(LEVELS[7].title, 'Nivel 8');
  assert.equal(LEVELS[7].mapSet, 'thanatos');
  const { MAP_SETS } = await import('../src/engine/mapsets.js');
  assert.deepEqual(MAP_SETS.thanatos.files, [1, 2, 3, 4, 5, 6, 7].map((i) => `thanatos00${i}`), 'thanatos map set');
  assert.ok(src('src/scenes/game.js').includes('0x7a4a705'), 'LEVEL_SEEDS has the level 8 seed');
  assert.ok(src('src/scenes/game.js').includes("case 'bossForm'"), 'scene announces the transformation');
  const practice = src('src/scenes/practice.js');
  for (const k of ['thanatos', 'odiumBoss', 'desperoBoss', 'maeroBoss', 'dolorBoss']) assert.ok(practice.includes(k), `practice has ${k}`);
  const renderer = src('src/render/renderer.js');
  assert.ok(renderer.includes("'Thanatos': 'thanatos'"), 'BOSS_TEX has Thanatos');
  assert.ok(renderer.includes('.form ?? BOSS_TEX'), 'renderer honors card.form');
  assert.ok(renderer.includes('e.echo'), 'renderer draws echoes');
  const atlas = src('src/engine/atlas.js');
  for (const n of ['monsters13', 'monsters14', 'monsters15', 'bosses6', 'bosses7']) assert.ok(atlas.includes(`'${n}'`), `atlas loads ${n}`);
  assert.ok(src('src/render/themes.js').includes('export const level8Theme'), 'level8Theme fallback');
  const musicSrc = src('src/engine/music.js');
  const l8 = musicSrc.slice(musicSrc.indexOf('level8: {'), musicSrc.indexOf('boss: {'));
  assert.ok(l8.includes('lead:') && !/'[A-G]b\d'/.test(l8), 'level8 chiptune exists and uses no flat names (the NOTE table has none)');
  assert.ok(musicSrc.includes('level8: `${BASE}assets/music/thanatos.mp3`'), 'MP3_TRACKS wires the Thanatos Tower recording for level8');
  assert.ok(fs.existsSync(path.join(ROOT, 'Music', 'Thanatos Tower 001.mp3')), 'Thanatos Tower master kept in Music/');
  const { DIALOGUE } = await import('../src/data/dialogue.js');
  for (const c of ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri']) {
    assert.ok(DIALOGUE.Thanatos?.[c]?.p && DIALOGUE.Thanatos?.[c]?.b, `dialogue Thanatos/${c}`);
  }
  ok('thanatos registry wiring (8th and final level, practice, renderer, atlas, music, dialogue)');

  // the plan's hard requirement: Thanatos is at least 3x tougher than every
  // earlier final boss, across several phases and two forms
  const boss = await import('../src/sim/boss.js');
  const th = await import('../src/sim/thanatos.js');
  const hp = (d) => d.cards.reduce((s, c) => s + c.hp, 0);
  assert.equal(hp(th.thanatos), th.THANATOS_HP_TOTAL);
  for (const prev of ['orcHero', 'darkLord', 'baphomet', 'vesper', 'amonRa', 'lordOfDeath']) {
    assert.ok(hp(th.thanatos) >= 3 * hp(boss[prev]), `Thanatos ${hp(th.thanatos)} >= 3x ${prev} ${hp(boss[prev])}`);
  }
  assert.ok(th.thanatos.cards.length >= 6, 'several phases');
  assert.equal(th.thanatos.cards.filter((c) => c.survive).length, 1, 'one survival card');
  assert.deepEqual([...new Set(th.thanatos.cards.map((c) => c.form))], ['thanatos', 'thanatosAwake'], 'two forms, in order');
  for (const c of th.thanatos.cards) assert.ok(b7.bosses[c.form], `form ${c.form} has art`);
  ok(`thanatos HP guard (${hp(th.thanatos)} = ${(hp(th.thanatos) / hp(boss.lordOfDeath)).toFixed(2)}x Lord of Death, 7 cards, 2 forms)`);

  // mechanics: walk the boss through every card; the survival card ignores
  // damage and ends on time (Novice two thirds); the form switch fires once
  const { createSim, tickSim } = await import('../src/sim/sim.js');
  const { ROSTER } = await import('../src/characters/index.js');
  for (const [diff, clock] of [[1, 1800], [0, 1200]]) {
    const sim = createSim(0x7a4a705, [ROSTER[0]], null, 0, diff);
    boss.spawnBoss(sim, th.thanatos);
    const b = sim.boss;
    const forms = [];
    let guard = 40000;
    while (!sim.levelComplete && guard-- > 0) {
      tickSim(sim, [0], null);
      sim.players[0].lives = 9;
      if (!b.intro && b.introHold === 0 && b.transition === 0 && b.dying === 0) {
        if (b.surviveMax > 0) {
          const before = b.cardIndex, left = b.surviveLeft;
          assert.equal(b.surviveMax, clock, `survival clock on difficulty ${diff}`);
          boss.damageBoss(sim, 99999, b);
          assert.equal(b.cardIndex, before, 'survival card ignores damage');
          // run the clock out
          for (let k = 0; k < left + 2 && b.cardIndex === before; k++) tickSim(sim, [0], null);
          assert.equal(b.cardIndex, before + 1, 'survival card ends on time');
          assert.ok(b.transition > 0, 'next card starts with a break');
        } else {
          boss.damageBoss(sim, 400, b);
        }
      }
      for (const e of sim.events) if (e.type === 'bossForm') forms.push(e.form);
      sim.events.length = 0;
    }
    assert.ok(sim.levelComplete, `thanatos fight completes (difficulty ${diff})`);
    assert.deepEqual(forms, ['thanatosAwake'], 'one transformation event, into form II');
  }
  ok('thanatos card walk (survival 1800/1200 ticks ignores damage, one bossForm, levelClear)');

  // echoes: render-only `echo` key, dissolve by ttl without kill credit, and
  // a pooled object reused by a normal enemy never stays an echo
  {
    const sim = createSim(1, [ROSTER[0]]);
    const e = th.summonEcho(sim, 'baphomet', 150);
    assert.equal(e.echo, 'baphomet');
    assert.equal(th.echoesAlive(sim), 1);
    let fired = 0;
    for (let k = 0; k < th.ECHO_TTL + 5; k++) {
      const before = sim.enemyBullets.active.length;
      tickSim(sim, [0], null);
      sim.players[0].lives = 9;
      if (sim.enemyBullets.active.length > before) fired++;
    }
    assert.ok(fired > 0, 'the echo fires its signature pattern');
    assert.equal(th.echoesAlive(sim), 0, 'the echo dissolved');
    assert.equal(sim.stats.kills, 0, 'dissolving is not a kill');
    const n = sim.spawnEnemy({ x: 100, y: 100, hp: 5, skin: 'anger' });
    assert.equal(n.echo, null, 'pooled enemy does not inherit echo');
    assert.equal(n.ttl, 0, 'pooled enemy does not inherit ttl');
  }
  ok('thanatos echoes (fire, dissolve by ttl, no kill credit, pool-safe)');

  // playtest feedback (2026-11-16): he stood still under a focused beam and
  // the first form melted. Now he side-steps through every card and cards
  // 1-3 bring adds, which the transformation dismisses.
  {
    const sim = createSim(0x7a4a705, [ROSTER[0]]);
    boss.spawnBoss(sim, th.thanatos);
    const b = sim.boss;
    const xsByCard = {}, addsByCard = {};
    let addsAtSurvive = -1, guard = 30000;
    while (b.cardIndex < 4 && guard-- > 0) {
      tickSim(sim, [0], null);
      sim.players[0].lives = 9;
      if (b.intro || b.introHold > 0 || b.transition > 0) continue;
      (xsByCard[b.cardIndex] ??= []).push(b.x);
      const adds = sim.enemies.active.filter((e) => e.thanatosAdd).length;
      addsByCard[b.cardIndex] = Math.max(addsByCard[b.cardIndex] ?? 0, adds);
      if (b.surviveMax > 0 && addsAtSurvive < 0 && b.t > 60) {
        addsAtSurvive = sim.enemies.active.filter((e) => e.thanatosAdd || e.echo).length;
      }
      // ~25 s per HP card, then let the survival clock run out
      if (b.surviveMax === 0 && b.t >= 1500) boss.damageBoss(sim, b.cardHp, b);
    }
    for (const card of [0, 1, 2]) {
      const xs = xsByCard[card];
      const travel = xs.slice(1).reduce((s, x, k) => s + Math.abs(x - xs[k]), 0) / (xs.length / 60);
      assert.ok(Math.max(...xs) - Math.min(...xs) > 250, `card ${card + 1} roams the arena (range ${Math.round(Math.max(...xs) - Math.min(...xs))}px)`);
      assert.ok(travel > 80, `card ${card + 1} keeps moving (${Math.round(travel)} px/s)`);
      assert.ok(addsByCard[card] >= 1, `card ${card + 1} brings adds`);
      assert.ok(addsByCard[card] <= 4, `card ${card + 1} adds stay capped (${addsByCard[card]})`);
    }
    assert.equal(addsAtSurvive, 0, 'the transformation dismissed every add and echo');
    const n = sim.spawnEnemy({ x: 100, y: 100, hp: 5, skin: 'anger' });
    assert.equal(n.thanatosAdd, false, 'pooled enemy does not inherit thanatosAdd');
  }
  ok('thanatos side-steps (roams every card) + adds in cards 1-3, dismissed at the transformation');

  // healer: Lady Solace restores HP to wounded enemies in reach, capped at maxhp
  {
    const { level8 } = await import('../src/levels/level8.js');
    const sim = createSim(0x7a4a705, [ROSTER[0]]);
    sim.players[0].lives = 99;
    let heals = 0, solace = null;
    for (let k = 0; k < 2400 && !solace; k++) {
      tickSim(sim, [0], level8);
      solace = sim.enemies.active.find((e) => e.skin === 'solace' && e.vy === 0) ?? null;
      sim.events.length = 0;
    }
    assert.ok(solace, 'a Lady Solace parks during the abandoned space');
    const near = sim.spawnEnemy({ x: solace.x + 40, y: solace.y, vy: 0, hp: 10, maxhp: 50, skin: 'shelter' });
    const far = sim.spawnEnemy({ x: solace.x, y: solace.y + 400, vy: 0, hp: 10, maxhp: 50, skin: 'shelter' });
    for (let k = 0; k < 130; k++) {
      tickSim(sim, [0], level8);
      sim.players[0].lives = 99;
      for (const e of sim.events) if (e.type === 'heal') heals++;
      sim.events.length = 0;
    }
    assert.ok(heals >= 1 && near.hp > 10 && near.hp <= 50, `wounded neighbor healed (hp ${near.hp})`);
    assert.equal(far.hp, 10, 'enemy out of reach is not healed');
  }
  ok('thanatos healer (Lady Solace heals in reach, capped at maxhp)');

  // full runs: positions stay finite, both fragment pairs and Thanatos are
  // announced, the transformation fires, the level completes; two sims
  // with the same inputs stay checksum-identical (online lockstep safety)
  {
    const { level8 } = await import('../src/levels/level8.js');
    const { simChecksum } = await import('../src/net/lockstep.js');
    const a = createSim(0x7a4a705, [ROSTER[0]]);
    const c = createSim(0x7a4a705, [ROSTER[0]]);
    a.players[0].lives = 999; c.players[0].lives = 999;
    const seen = new Set();
    let guard = 160000, i = 0, peak = 0; // the fixed-position bot needs ~80k ticks since Thanatos side-steps
    while (!a.levelComplete && guard-- > 0) {
      const mask = (i++ % 600 < 590) ? 16 : 0;
      tickSim(a, [mask], level8);
      tickSim(c, [mask], level8);
      if (a.tick % 600 === 0) assert.equal(simChecksum(a), simChecksum(c), `replay checksum at tick ${a.tick}`);
      peak = Math.max(peak, a.enemyBullets.active.length);
      for (const e of a.enemies.active) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy position finite');
      for (const b of a.enemyBullets.active) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.vy), 'bullet finite');
      for (const e of a.events) {
        if (e.type === 'warning' || e.type === 'bossWarning') seen.add(`${e.type}:${e.name}`);
        if (e.type === 'bossForm') seen.add('bossForm');
      }
      a.events.length = 0; c.events.length = 0;
    }
    assert.ok(a.levelComplete, 'level 8 completes');
    assert.equal(simChecksum(a), simChecksum(c), 'final replay checksum');
    assert.ok(seen.has('warning:Odium of Thanatos\nDespero of Thanatos'), 'first fragment pair announced');
    assert.ok(seen.has('warning:Maero of Thanatos\nDolor of Thanatos'), 'second fragment pair announced');
    assert.ok(seen.has('bossWarning:Thanatos'), 'Thanatos announced (pre-boss dialogue)');
    assert.ok(![...seen].some((s) => s.startsWith('bossWarning:') && s !== 'bossWarning:Thanatos'),
      'fragments use warning only, so the dialogue stays reserved for Thanatos');
    assert.ok(seen.has('bossForm'), 'transformation seen in the campaign');
    assert.ok(peak < 600, `bullet peak bounded (${peak})`);
    ok(`level8 full run + replay checksum (ticks=${a.tick} peak=${peak})`);
  }

  // level select: eight cards fit one row at W=840 (same clamp as the game)
  {
    const sel = src('src/scenes/levelselect.js');
    const num = (re) => Number(sel.match(re)[1]);
    const gap = num(/levelGap\s*=\s*(\d+)/), margin = num(/levelMargin\s*=\s*(\d+)/);
    const max = num(/levelMax\s*=\s*(\d+)/), min = num(/levelMin\s*=\s*(\d+)/);
    const W = 840, n = LEVELS.length;
    const bw = Math.max(min, Math.min(max, Math.floor((W - margin * 2 - (n - 1) * gap) / n)));
    const total = n * bw + (n - 1) * gap, x0 = (W - total) / 2;
    assert.ok(x0 - 3 >= 0 && x0 + total + 3 <= W, `eight cards fit (bw=${bw})`);
    ok(`level select eight-card bounds at W=840 (bw=${bw})`);
  }
}

// --- 20. Bosses V3: Orc Hero, Dark Lord and Baphomet redrawn at the Thanatos
// standard and served as a default override with the original sheet as fallback ---
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const { createHash } = await import('node:crypto');
  const sha = (p) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
  const POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
  const v3 = JSON.parse(src('public/assets-v2/bosses-v3/bosses8.json'));
  const orig = JSON.parse(src('public/assets/bosses.json'));
  assert.deepEqual(v3.size, { w: 1536, h: 3072 }, 'three sheets stacked');
  assert.deepEqual(Object.keys(v3.bosses), ['orcHero', 'darkLord', 'baphomet'], 'V3 keys');
  for (const [i, key] of ['orcHero', 'darkLord', 'baphomet'].entries()) {
    assert.ok(orig.bosses[key], `${key} also exists in the original sheet (fallback)`);
    // tall V3 figures carry their own on-screen height; the old art does not,
    // so the fallback keeps its r-based scale
    assert.ok(v3.bosses[key].displayH >= 150 && v3.bosses[key].displayH <= 200, `${key} displayH ${v3.bosses[key].displayH}`);
    assert.equal(orig.bosses[key].displayH, undefined, `original ${key} has no displayH`);
    for (const side of ['down', 'up']) {
      for (const p of POSES) {
        const fr = v3.bosses[key][side][p];
        assert.ok(Array.isArray(fr) && fr.length === 1, `${key}.${side}.${p} one-frame array`);
        const r = fr[0];
        assert.ok(r.y >= i * 1024 && r.y + r.h <= (i + 1) * 1024 && r.x >= 0 && r.x + r.w <= 1536,
          `${key}.${side}.${p} inside its own third of the sheet`);
        // the whole point: far more pixels than the old ~65 px frames
        if (side === 'down' && p === 'idle') {
          const old = orig.bosses[key].down.idle[0];
          assert.ok(r.h >= 4 * old.h, `${key} idle is ${r.h}px tall vs ${old.h}px before`);
        }
      }
    }
  }
  const report = JSON.parse(src('art-clean/bosses-v3-gpt/qa/report-bosses-v3.json'));
  for (const inp of Object.values(report.inputs)) {
    assert.equal(sha(`art-clean/bosses-v3-gpt/${inp.file}`), inp.sha256, `approved source ${inp.file} unchanged since slicing`);
  }
  for (const [f, h] of Object.entries(report.outputs)) {
    assert.equal(sha(`public/assets-v2/bosses-v3/${f}`), h, `runtime ${f} matches the slicer report`);
  }
  // the level 2 mid-boss: an inline elite, so a monsters manifest
  const m16 = JSON.parse(src('public/assets-v2/bosses-v3/monsters16.json'));
  const m5 = JSON.parse(src('public/assets/monsters5.json'));
  assert.deepEqual(Object.keys(m16.monsters), ['doppelganger'], 'monsters16 holds the Doppelganger');
  assert.ok(m5.monsters.doppelganger, 'original Doppelganger kept as fallback');
  const dop = m16.monsters.doppelganger;
  assert.ok(dop.displayH >= 120 && dop.displayH <= 180, `doppelganger displayH ${dop.displayH}`);
  for (const side of ['down', 'up']) {
    for (const p of POSES) {
      const fr = dop[side][p];
      assert.ok(Array.isArray(fr) && fr.length === 1, `doppelganger.${side}.${p} one-frame array`);
      assert.ok(fr[0].x >= 0 && fr[0].y >= 0 && fr[0].x + fr[0].w <= m16.size.w && fr[0].y + fr[0].h <= m16.size.h, `doppelganger.${side}.${p} in bounds`);
    }
  }
  const oldDop = [].concat(m5.monsters.doppelganger.down.idle)[0];
  assert.ok(dop.down.idle[0].h >= 4 * oldDop.h, `doppelganger idle ${dop.down.idle[0].h}px vs ${oldDop.h}px before`);
  assert.ok(src('src/levels/level2.js').includes("skin: 'doppelganger'"), 'level 2 still spawns the doppelganger skin');

  // second batch (2026-11-17): Vesper, Seyren, Magaleta, Amon-Ra (bosses9)
  // and the level 1 mid-boss Mastering (monsters17)
  const b9 = JSON.parse(src('public/assets-v2/bosses-v3/bosses9.json'));
  const m17 = JSON.parse(src('public/assets-v2/bosses-v3/monsters17.json'));
  assert.deepEqual(b9.size, { w: 1536, h: 4096 }, 'bosses9 stacks four sheets');
  assert.deepEqual(Object.keys(b9.bosses), ['vesper', 'seyren', 'magaleta', 'amonRa'], 'bosses9 keys');
  assert.deepEqual(Object.keys(m17.monsters), ['mastering'], 'monsters17 holds Mastering');
  const oldB = {
    ...JSON.parse(src('public/assets/bosses2.json')).bosses,
    ...JSON.parse(src('public/assets/bosses3.json')).bosses,
    ...JSON.parse(src('public/assets-v2/pyramid/bosses4.json')).bosses,
  };
  for (const [i, key] of ['vesper', 'seyren', 'magaleta', 'amonRa'].entries()) {
    const e = b9.bosses[key];
    assert.ok(oldB[key], `previous ${key} art kept as fallback`);
    assert.ok(e.displayH >= 150 && e.displayH <= 200, `${key} displayH ${e.displayH}`);
    for (const side of ['down', 'up']) {
      for (const p of POSES) {
        const r = e[side][p][0];
        assert.ok(e[side][p].length === 1 && r.y >= i * 1024 && r.y + r.h <= (i + 1) * 1024, `${key}.${side}.${p} in its quarter`);
      }
    }
    assert.ok(e.down.idle[0].h >= 2.5 * oldB[key].down.idle[0].h, `${key} idle ${e.down.idle[0].h}px vs ${oldB[key].down.idle[0].h}px before`);
  }
  const mas = m17.monsters.mastering;
  const oldMas = [].concat(JSON.parse(src('public/assets/monsters2.json')).monsters.mastering.down.idle)[0];
  assert.ok(mas.displayH >= 80 && mas.displayH <= 140, `mastering displayH ${mas.displayH}`);
  assert.ok(mas.down.idle[0].h >= 2 * oldMas.h, `mastering idle ${mas.down.idle[0].h}px vs ${oldMas.h}px before`);
  assert.ok(mas.down.hit[0].h < mas.down.idle[0].h && mas.down.attack[0].h > mas.down.idle[0].h,
    'mastering squashes on hit and stretches on attack (kept by the one-scale rule)');
  assert.ok(src('src/levels/level1.js').includes("skin: 'mastering'"), 'level 1 still spawns the mastering skin');
  // third batch: the remaining mid-bosses (monsters18)
  const m18 = JSON.parse(src('public/assets-v2/bosses-v3/monsters18.json'));
  assert.deepEqual(m18.size, { w: 1536, h: 4096 }, 'monsters18 stacks four sheets');
  assert.deepEqual(Object.keys(m18.monsters), ['bapho_jr_giant', 'archdam', 'failedexp_alpha', 'osiris'], 'monsters18 keys');
  const oldMid = {
    bapho_jr_giant: JSON.parse(src('public/assets/monsters5.json')).monsters.bapho_jr_giant,
    archdam: JSON.parse(src('public/assets/monsters7.json')).monsters.archdam,
    failedexp_alpha: JSON.parse(src('public/assets/monsters8.json')).monsters.failedexp,
    osiris: JSON.parse(src('public/assets-v2/pyramid/monsters10.json')).monsters.osiris,
  };
  for (const [i, key] of Object.keys(m18.monsters).entries()) {
    const e = m18.monsters[key];
    assert.ok(e.displayH >= 110 && e.displayH <= 170, `${key} displayH ${e.displayH}`);
    for (const side of ['down', 'up']) {
      for (const p of POSES) {
        const r = e[side][p][0];
        assert.ok(e[side][p].length === 1 && r.y >= i * 1024 && r.y + r.h <= (i + 1) * 1024, `${key}.${side}.${p} in its quarter`);
      }
    }
    const old = [].concat(oldMid[key].down.idle)[0];
    assert.ok(e.down.idle[0].h >= 2.5 * old.h, `${key} idle ${e.down.idle[0].h}px vs ${old.h}px before`);
  }
  // the level 5 mid-boss has its own skin; the small common mobs keep theirs
  const l5 = src('src/levels/level5.js');
  assert.ok(l5.includes("skin: 'failedexp_alpha', score: 18000"), 'level 5 mid-boss uses failedexp_alpha');
  assert.ok(l5.includes("hp: 18, r: 15, skin: 'failedexp'"), 'level 5 common mob keeps failedexp');
  assert.ok(!m18.monsters.failedexp, 'monsters18 does not override the common failedexp mob');
  const atl = src('src/engine/atlas.js');
  const iM18 = atl.indexOf('addMonsters(mon18Manifest, mon18Base)');
  for (const prev of ['addMonsters(mon5Manifest, bossBase)', 'addMonsters(mon7Manifest, boss2Base)', 'addMonsters(mon10Manifest, boss4Base)']) {
    assert.ok(atl.indexOf(prev) > 0 && iM18 > atl.indexOf(prev), `monsters18 merges after ${prev}`);
  }
  assert.ok(atl.includes('monsters.failedexp_alpha = monsters.failedexp'), 'failedexp_alpha falls back to the original sprite');

  // the published first batch never changes when later batches are added
  for (const f of ['bosses8.json', 'bosses8.png', 'monsters16.json', 'monsters16.png']) {
    assert.ok(report.outputs[f], `${f} still listed in the slicer report`);
  }

  const atlas = src('src/engine/atlas.js');
  const iM5 = atlas.indexOf('addMonsters(mon5Manifest, bossBase)');
  const iM16 = atlas.indexOf('addMonsters(mon16Manifest, mon16Base)');
  assert.ok(iM5 > 0 && iM16 > iM5, 'V3 Doppelganger merges after monsters5 (override, fallback kept)');
  const iM2 = atlas.indexOf('addMonsters(mon2Manifest, mon2Base)'), iM17 = atlas.indexOf('addMonsters(mon17Manifest, mon17Base)');
  assert.ok(iM2 > 0 && iM17 > iM2, 'V3 Mastering merges after monsters2');
  const iB4 = atlas.indexOf('addBosses(boss4Manifest, boss4Base)'), iB9 = atlas.indexOf('addBosses(boss9Manifest, boss9Base)');
  assert.ok(iB4 > 0 && iB9 > iB4 && iB9 > atlas.indexOf('addBosses(boss3Manifest, boss3Base)'), 'bosses9 merges after bosses2-4');
  assert.ok(src('src/render/renderer.js').includes('mon.displayH ? mon.displayH / idleHeight(mon)'), 'renderer scales displayH enemies by their idle frame (one scale for every pose)');
  const iOrig = atlas.indexOf('addBosses(bossManifest, bossBase)');
  const iV3 = atlas.indexOf('addBosses(bossV3Manifest, bossV3Base)');
  assert.ok(iOrig > 0 && iV3 > iOrig, 'V3 bosses merge after the originals (override, original kept as fallback)');
  assert.ok(atlas.includes("assets-v2/bosses-v3"), 'atlas loads the V3 tree');
  assert.ok(atlas.includes('displayH: m.displayH ?? null'), 'atlas carries displayH');
  assert.ok(src('src/render/renderer.js').includes('art?.displayH ? art.displayH / idleHeight(art)'), 'renderer scales displayH bosses by their idle frame (one scale for every pose)');
  const vite = src('vite.config.js');
  assert.ok(!/'assets-v2\/bosses-v3'/.test(vite), 'the build does not prune Bosses V3');
  ok('bosses V3 (12 bosses/mid-bosses override: frames 2.5-6x taller, provenance, fallback order, one-scale displayH, own mid-boss skin)');
}

// --- 21. Mobs V3: the common mobs of levels 2-5 redrawn at the Thanatos
// standard (approved GPT sheets via the Codex CLI, tools/slice-mobs-v3.py) and
// served as a default override with the original sheets as fallback ---
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const { createHash } = await import('node:crypto');
  const sha = (p) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
  const POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack'];
  const BATCHES = [
    { level: 'src/levels/level2.js', orig: 'public/assets/monsters3.json', sheets: {
      monsters19: ['willow', 'zombie', 'munak', 'bongun'],
      monsters20: ['ninetails', 'deviruchi', 'marionette', 'wraith'] } },
    { level: 'src/levels/level3.js', orig: 'public/assets/monsters4.json', sheets: {
      monsters21: ['evildruid', 'darkpriest', 'raydric', 'khalitzburg'],
      monsters22: ['gargoyle', 'ghoul', 'whisper', 'bapho_jr'] } },
    { level: 'src/levels/level4.js', orig: 'public/assets/monsters6.json', sheets: {
      monsters23: ['dimik', 'venatu', 'plasma', 'guardian'],
      monsters24: ['cell', 'sentry', 'repairdrone', 'sparkbeetle'] } },
    // grow: false — the original Biolab rects were mis-cut slivers that also held
    // lasers and shadows (see the f7102d3 fix), so their heights don't measure the
    // figure and can't be compared; the absolute floor below still applies
    { level: 'src/levels/level5.js', orig: 'public/assets/monsters8.json', grow: false, sheets: {
      monsters25: ['failedexp', 'remover', 'labdrone', 'testsubject'],
      monsters26: ['sporecloud', 'mutanthound', 'serumturret', 'biosludge'] } },
  ];
  const report = JSON.parse(src('art-clean/mobs-v3-gpt/qa/report-mobs-v3.json'));
  for (const inp of Object.values(report.inputs)) {
    assert.equal(sha(`art-clean/mobs-v3-gpt/${inp.file}`), inp.sha256, `approved source ${inp.file} unchanged since slicing`);
  }
  for (const [f, h] of Object.entries(report.outputs)) {
    assert.equal(sha(`public/assets-v2/mobs-v3/${f}`), h, `runtime ${f} matches the slicer report`);
  }
  const atlas = src('src/engine/atlas.js');
  let n = 0;
  for (const b of BATCHES) {
    const orig = JSON.parse(src(b.orig)).monsters;
    const lvl = src(b.level);
    const iOrig = atlas.indexOf(`addMonsters(mon${b.orig.match(/monsters(\d+)/)[1]}Manifest`);
    for (const [key, names] of Object.entries(b.sheets)) {
      const m = JSON.parse(src(`public/assets-v2/mobs-v3/${key}.json`));
      assert.deepEqual(m.size, { w: 1536, h: 1024 }, `${key} is one 1536x1024 sheet`);
      assert.deepEqual(Object.keys(m.monsters).sort(), [...names].sort(), `${key} keys`);
      assert.ok(report.outputs[`${key}.png`] && report.outputs[`${key}.json`], `${key} listed in the slicer report`);
      const iNew = atlas.indexOf(`addMonsters(mon${key.slice(8)}Manifest, mon${key.slice(8)}Base)`);
      assert.ok(iOrig > 0 && iNew > iOrig, `${key} merges after ${b.orig} (override, original kept as fallback)`);
      for (const name of names) {
        assert.ok(orig[name], `original ${name} kept as fallback`);
        assert.ok(lvl.includes(`skin: '${name}'`), `${b.level} still spawns ${name}`);
        const e = m.monsters[name];
        assert.equal(e.displayH, undefined, `${name} scales like the other common mobs (no displayH)`);
        for (const side of ['down', 'up']) {
          for (const p of POSES) {
            const r = e[side][p];
            assert.ok(r && !Array.isArray(r) && r.x >= 0 && r.y >= 0 && r.x + r.w <= 1536 && r.y + r.h <= 1024, `${name}.${side}.${p} single rect in bounds`);
            n++;
          }
        }
        // every V3 idle frame carries real detail (smallest: Lab Drone, 76 px)
        assert.ok(e.down.idle.h >= 70, `${name} idle ${e.down.idle.h}px tall`);
        if (b.grow !== false) {
          const old = [].concat(orig[name].down.idle)[0];
          // 1.25x floor: Whisper is a tiny sheet ghost in RO too (66 -> 84 px) and
          // Repair Drone a small dome (71 -> 93); the rest grew 1.5-2.9x
          assert.ok(e.down.idle.h >= 1.25 * old.h, `${name} idle ${e.down.idle.h}px vs ${old.h}px before`);
        }
      }
    }
  }
  assert.ok(atlas.includes('assets-v2/mobs-v3'), 'atlas loads the Mobs V3 tree');
  assert.ok(!/'assets-v2\/mobs-v3'/.test(src('vite.config.js')), 'the build does not prune Mobs V3');
  ok(`mobs V3 (${n} frames override the original level 2-5 mobs: provenance, fallback order, larger frames)`);
}

console.log(`\nPASS — ${passed} static checks`);
process.exit(0);
