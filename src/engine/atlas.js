// Loads the sprite sheet + manifest and exposes named PIXI textures.
// All game art resolves through here (manifest-driven), so swapping
// placeholder art for final art never touches game code.
import { Assets, Rectangle, Texture } from 'pixi.js';
import { mapTileFiles, mapTileDir, missingMapTiles } from './mapsets.js';

// Asset base: '/' in dev, '/RagnarokBullet/' on GitHub Pages. Runtime asset URLs
// must include it so they resolve under any deploy subpath (Vite only rewrites
// asset paths it processes at build time, not these hardcoded fetch strings).
const BASE = import.meta.env.BASE_URL;

// Tile inventory lives in mapsets.js (single source of truth, shared with
// the node-testable selection logic).
const loadMapSet = (name, warn) => {
  const files = mapTileFiles(name);
  const dir = mapTileDir(name);
  if (!files.length || !dir) return Promise.resolve(null);
  return Promise.all(files.map((f) => Assets.load(`${BASE}${dir}/${f}.png`).catch(() => null)))
    .then((set) => {
      // Diagnose every failed tile by filename, then fall back ATOMICALLY:
      // a partial set never renders (it would show missing/reordered
      // progression) — callers use the procedural theme instead.
      const missing = missingMapTiles(name, set);
      for (const f of missing) warn(`missing map tile: ${dir}/${f}.png`);
      if (missing.length) {
        warn(`map set '${name}' incomplete (${set.length - missing.length}/${files.length}); procedural theme fallback`);
        return null;
      }
      return set;
    });
};

export async function loadAtlas() {
  // Missing files fall back to procedural art (renderers check for null), but
  // that used to be completely silent — warn once per file so a broken/renamed
  // asset shows up in the console instead of a mysterious visual regression.
  const warn = (m) => { try { console.warn(`[atlas] ${m}`); } catch { /* ignore */ } };
  // Clean-Art V2.1 preview (opt-in): ?art=v2 loads the cleaned sheets from
  // public/assets-v2/ (geffen/ for Geffen mobs, bosses/ for all bosses and
  // midbosses) instead of public/assets/. Redirected: monsters3, monsters2,
  // monsters8, bosses, bosses2, bosses3, monsters5, monsters7; everything
  // else loads normally. Back to normal: open the game without ?art=v2 (or
  // ?art= with any other value). No gameplay impact: cleaned manifests keep
  // identical IDs/rects, only the sheet file differs.
  const ART_V2 = (() => {
    try { return new URLSearchParams(window.location.search).get('art') === 'v2'; } catch { return false; }
  })();
  if (ART_V2) warn('preview: Clean-Art V2.1 sheets (?art=v2)');
  const V2_REMAP = {
    monsters3: ['geffen', 'monsters3.clean'],
    monsters2: ['bosses', 'monsters2.clean'],
    monsters8: ['bosses', 'monsters8.clean'],
    bosses: ['bosses', 'bosses.clean'],
    bosses2: ['bosses', 'bosses2.clean'],
    bosses3: ['bosses', 'bosses3.clean'],
    monsters5: ['bosses', 'monsters5.clean'],
    monsters7: ['bosses', 'monsters7.clean'],
  };
  const v2url = (n, ext) => (ART_V2 && V2_REMAP[n])
    ? `${BASE}assets-v2/${V2_REMAP[n][0]}/${V2_REMAP[n][1]}.${ext}`
    : `${BASE}assets/${n}.${ext}`;
  const baseUrl = (n, ext) => `${BASE}assets/${n}.${ext}`;
  // A remapped preview asset that is missing falls back to the ORIGINAL sheet
  // before giving up on procedural art. Production builds prune the
  // preview-only trees (see vite.config.js), so opening the deployed game with
  // ?art=v2 shows normal art with a console note instead of procedural blobs.
  const previewMiss = (n, ext) => {
    warn(`preview asset absent: ${v2url(n, ext)} -> using assets/${n}.${ext}`);
    return true;
  };
  const monJson = (n) => fetch(v2url(n, 'json'))
    .then((r) => r.json())
    .catch(() => (ART_V2 && V2_REMAP[n] && previewMiss(n, 'json')
      ? fetch(baseUrl(n, 'json')).then((r) => r.json())
      : Promise.reject()))
    .catch(() => { warn(`missing manifest: ${baseUrl(n, 'json')} (procedural fallback)`); return null; });
  const monPng = (n) => Assets.load(v2url(n, 'png'))
    .catch(() => (ART_V2 && V2_REMAP[n] && previewMiss(n, 'png')
      ? Assets.load(baseUrl(n, 'png'))
      : Promise.reject()))
    .catch(() => { warn(`missing sheet: ${baseUrl(n, 'png')} (procedural fallback)`); return null; });
  const [
    manifest, base,
    monManifest, monBase, mon2Manifest, mon2Base, mon3Manifest, mon3Base, mon4Manifest, mon4Base,
    mon6Manifest, mon6Base,
    prontera,
  ] = await Promise.all([
    fetch(`${BASE}assets/manifest.json`).then((r) => r.json()).catch((e) => { warn(`CRITICAL: assets/manifest.json failed (${e?.message ?? e})`); throw e; }),
    Assets.load(`${BASE}assets/sheet.png`).catch((e) => { warn(`CRITICAL: assets/sheet.png failed (${e?.message ?? e})`); throw e; }),
    monJson('monsters'), monPng('monsters'),
    monJson('monsters2'), monPng('monsters2'),
    monJson('monsters3'), monPng('monsters3'),
    monJson('monsters4'), monPng('monsters4'),
    monJson('monsters6'), monPng('monsters6'), // Juperos mobs
    loadMapSet('prontera', warn), // only level 1's maps up front; rest lazy
  ]);
  const startMenu = await Assets.load(`${BASE}assets/images/startmenu.png`).catch(() => { warn('missing art: assets/images/startmenu.png (plain title fallback)'); return null; });
  const [bossManifest, bossBase, mon5Manifest, skillManifest, skillBase, itemManifest, itemBase] = await Promise.all([
    monJson('bosses'), monPng('bosses'),
    monJson('monsters5'), // mid-bosses (Doppelganger, Giant Baphomet Jr.) — shares bosses.png as its sheet
    monJson('skills'), monPng('skills'), // per-character skill icons (6 chars x 4 skills)
    monJson('items'), monPng('items'),   // animated pickups: card / zeny / gem
  ]);
  const [item2Manifest, item2Base, boss2Manifest, boss2Base, mon7Manifest,
    mon8Manifest, mon8Base, boss3Manifest, boss3Base, bombManifest, bombBase] = await Promise.all([
    monJson('items2'), monPng('items2'), // potion / chest / leaf / awakening / speed / kafra / bomb
    monJson('bosses2'), monPng('bosses2'), // Juperos: Vesper (boss)
    monJson('monsters7'), // Juperos: Archdam (mid-boss) — shares bosses2.png
    monJson('monsters8'), monPng('monsters8'), // Biolab mobs
    monJson('bosses3'), monPng('bosses3'),     // Biolab: Seyren + Magaleta (dual bosses)
    monJson('bombsfx'), monPng('bombsfx'),     // per-class bomb FX (4-frame strips, additive)
  ]);
  // Pyramid of the Sun (level 6): new content, no originals to fall back to —
  // always served from assets-v2/pyramid (see tools/slice-pyramid.py). The
  // monJson/monPng null-fallbacks keep this safe: a missing pyramid file just
  // means procedural fallbacks, never a boot crash.
  const pyrDir = `${BASE}assets-v2/pyramid`;
  const pyrJson = (n) => fetch(`${pyrDir}/${n}.json`).then((r) => r.json()).catch(() => { warn(`missing pyramid manifest: assets-v2/pyramid/${n}.json`); return null; });
  const pyrPng = (n) => Assets.load(`${pyrDir}/${n}.png`).catch(() => { warn(`missing pyramid sheet: assets-v2/pyramid/${n}.png`); return null; });
  const [mon9Manifest, mon9Base, mon10Manifest, boss4Manifest, boss4Base] = await Promise.all([
    pyrJson('monsters9'), pyrPng('monsters9'), // Pyramid mobs (8)
    pyrJson('monsters10'), // Pyramid mid-boss Osiris (rects live in bosses4.png)
    pyrJson('bosses4'), pyrPng('bosses4'),     // Pyramid final boss Amon-Ra
  ]);
  // Niflheim (level 7): new content, no originals to fall back to — always
  // served from assets-v2/niflheim (see tools/slice-niflheim.py). Same
  // null-safe loaders: missing files mean procedural fallbacks, never a
  // boot crash.
  const nijDir = `${BASE}assets-v2/niflheim`;
  const nijJson = (n) => fetch(`${nijDir}/${n}.json`).then((r) => r.json()).catch(() => { warn(`missing niflheim manifest: assets-v2/niflheim/${n}.json`); return null; });
  const nijPng = (n) => Assets.load(`${nijDir}/${n}.png`).catch(() => { warn(`missing niflheim sheet: assets-v2/niflheim/${n}.png`); return null; });
  const [mon11Manifest, mon11Base, mon12Manifest, boss5Manifest, boss5Base] = await Promise.all([
    nijJson('monsters11'), nijPng('monsters11'), // Niflheim mobs (6)
    nijJson('monsters12'), // Niflheim mid-boss Loli Ruri (rects live in bosses5.png)
    nijJson('bosses5'), nijPng('bosses5'),     // Niflheim bosses: Loli Ruri + Lord of Death
  ]);
  // Thanatos Tower (level 8): same null-safe loaders, served from
  // assets-v2/thanatos (see tools/slice-thanatos.py).
  const thaDir = `${BASE}assets-v2/thanatos`;
  const thaJson = (n) => fetch(`${thaDir}/${n}.json`).then((r) => r.json()).catch(() => { warn(`missing thanatos manifest: assets-v2/thanatos/${n}.json`); return null; });
  const thaPng = (n) => Assets.load(`${thaDir}/${n}.png`).catch(() => { warn(`missing thanatos sheet: assets-v2/thanatos/${n}.png`); return null; });
  const [mon13Manifest, mon13Base, mon14Manifest, mon14Base, mon15Manifest,
    boss6Manifest, boss6Base, boss7Manifest, boss7Base] = await Promise.all([
    thaJson('monsters13'), thaPng('monsters13'), // Thanatos: the four angel ladies
    thaJson('monsters14'), thaPng('monsters14'), // Thanatos: emotion-room mobs
    thaJson('monsters15'),                       // fragments as inline elites (rects in bosses6.png)
    thaJson('bosses6'), thaPng('bosses6'),       // fragments as practice bosses
    thaJson('bosses7'), thaPng('bosses7'),       // Thanatos, form I + form II
  ]);

  // Prontera V3 (default override, NOT ?art=v2-gated): approved GPT sheet
  // extracted by tools/slice-prontera-v3.py, served from assets-v2/prontera.
  // Merged after base monsters so these six IDs override only Prontera mobs
  // (V3 Lunatic wins over monsters2). Missing files fall back to base
  // monsters.json + procedural Lunatic, never a boot crash.
  const v3Dir = `${BASE}assets-v2/prontera`;
  const v3Json = (n) => fetch(`${v3Dir}/${n}.json`).then((r) => r.json()).catch(() => { warn(`missing V3 manifest: assets-v2/prontera/${n}.json`); return null; });
  const v3Png = (n) => Assets.load(`${v3Dir}/${n}.png`).catch(() => { warn(`missing V3 sheet: assets-v2/prontera/${n}.png`); return null; });
  const [monV3Manifest, monV3Base] = await Promise.all([
    v3Json('monsters-v3'), v3Png('monsters-v3'),
  ]);
  // Bosses V3 (default override, like Prontera V3): Orc Hero, Dark Lord and
  // Baphomet redrawn at the Thanatos standard (tools/slice-bosses-v3.py).
  // Same atlas keys as bosses.json, merged after it; a missing file keeps the
  // original sheet, never a boot crash.
  const bv3Dir = `${BASE}assets-v2/bosses-v3`;
  // monsters16 is the level 2 mid-boss Doppelganger (an inline elite, so a
  // monsters manifest), merged after monsters5 the same way.
  const bv3Json = (n) => fetch(`${bv3Dir}/${n}.json`).then((r) => r.json()).catch(() => { warn(`missing Bosses V3 manifest: assets-v2/bosses-v3/${n}.json (original art kept)`); return null; });
  const bv3Png = (n) => Assets.load(`${bv3Dir}/${n}.png`).catch(() => { warn(`missing Bosses V3 sheet: assets-v2/bosses-v3/${n}.png (original art kept)`); return null; });
  // Second batch: bosses9 (Vesper, Seyren, Magaleta, Amon-Ra) and monsters17
  // (the level 1 mid-boss Mastering), same override scheme.
  const [bossV3Manifest, bossV3Base, mon16Manifest, mon16Base,
    boss9Manifest, boss9Base, mon17Manifest, mon17Base] = await Promise.all([
    bv3Json('bosses8'), bv3Png('bosses8'),
    bv3Json('monsters16'), bv3Png('monsters16'),
    bv3Json('bosses9'), bv3Png('bosses9'),
    bv3Json('monsters17'), bv3Png('monsters17'),
  ]);

  const sub = (src, r) => new Texture({ source: src.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });

  const characters = {};
  for (const [name, c] of Object.entries(manifest.characters)) {
    characters[name] = {
      poses: Object.fromEntries(Object.entries(c.poses).map(([k, r]) => [k, sub(base, r)])),
      projectiles: c.projectiles.map((r) => sub(base, r)),
      banner: sub(base, c.banner),
    };
  }

  // real animated monster sprites, merged from all monster sheets. A pose value
  // is either a single rect (static mob) or an array of rects (animated frames,
  // used by the mid-bosses) — the renderer cycles arrays and uses singles as-is.
  const monsters = {};
  const addMonsters = (mf, src) => {
    if (!mf || !src) return;
    const toTex = (v) => (Array.isArray(v) ? v.map((r) => sub(src, r)) : sub(src, v));
    for (const [name, m] of Object.entries(mf.monsters)) {
      monsters[name] = {
        down: Object.fromEntries(Object.entries(m.down).map(([k, v]) => [k, toTex(v)])),
        up: Object.fromEntries(Object.entries(m.up).map(([k, v]) => [k, toTex(v)])),
        displayH: m.displayH ?? null, // optional on-screen height (Bosses V3 art)
      };
    }
  };
  addMonsters(monManifest, monBase);   // Poring, Pupa, Picky, Chonchon, Orc Baby
  addMonsters(mon2Manifest, mon2Base); // Mastering, Lunatic
  addMonsters(mon3Manifest, mon3Base); // Geffen: Willow, Zombie, Munak, Bongun, Nine Tails, Deviruchi, Marionette, Wraith
  addMonsters(mon4Manifest, mon4Base); // Glast Heim: Evil Druid, Dark Priest, Raydric, Khalitzburg, Gargoyle, Ghoul, Whisper, Baphomet Jr.
  addMonsters(mon5Manifest, bossBase); // mid-bosses: Doppelganger, Giant Baphomet Jr. (rects live in bosses.png)
  addMonsters(mon6Manifest, mon6Base); // Juperos: Dimik, Venatu, Cell, Sentry, Plasma Wisp, Guardian, Repair Drone, Spark Beetle
  addMonsters(mon7Manifest, boss2Base); // Juperos mid-boss: Archdam (rects live in bosses2.png)
  addMonsters(mon8Manifest, mon8Base); // Biolab: Failed Experiment, Remover, Lab Drone, Test Subject, Spore Cloud, Mutant Hound, Serum Turret, Bio-Sludge
  addMonsters(mon9Manifest, mon9Base); // Pyramid: Familiar, Soldier/Archer Skeleton, Mummy, Verit, Matyr, Isis, Ancient Mummy
  addMonsters(mon10Manifest, boss4Base); // Pyramid mid-boss: Osiris (rects live in bosses4.png)
  addMonsters(mon11Manifest, mon11Base); // Niflheim: Lude, Quve, Heirozoist, Gibbet, Dullahan, Bloody Murderer
  addMonsters(mon12Manifest, boss5Base); // Niflheim mid-boss: Loli Ruri (rects live in bosses5.png)
  addMonsters(mon13Manifest, mon13Base); // Thanatos: Sentinel, Retribution, Shelter, Solace
  addMonsters(mon14Manifest, mon14Base); // Thanatos: Book of Death, Anger, Void Mimic, Crow Duke
  addMonsters(mon15Manifest, boss6Base); // Thanatos fragments: Odium, Despero, Maero, Dolor (rects live in bosses6.png)
  addMonsters(mon16Manifest, mon16Base); // Bosses V3: overrides the Doppelganger mid-boss (after monsters5)
  addMonsters(mon17Manifest, mon17Base); // Bosses V3: overrides the Mastering mid-boss (after monsters2)
  addMonsters(monV3Manifest, monV3Base); // Prontera V3: Poring, Pupa, Picky, Chonchon, Orc Baby, Lunatic (default override; null-safe fallback)

  // map backdrops keyed by set. Level 1 (prontera) is preloaded; geffen and
  // glastheim load lazily via ensureMapSet (kicked off in the background after
  // boot) so the title appears without waiting on 44 MB of maps.
  const maps = { prontera, geffen: null, glastheim: null, juperos: null, biolab: null, pyramid: null, niflheim: null, thanatos: null };
  const ensureMapSet = async (name) => {
    if (maps[name]) return maps[name];
    maps[name] = await loadMapSet(name, warn);
    if (!maps[name] || maps[name].length === 0) warn(`map set '${name}' failed to load (procedural theme fallback)`);
    return maps[name];
  };

  // real boss sprites (Orc Hero, Dark Lord, Baphomet, Vesper). Each pose is an
  // ARRAY of animation frame textures (idle/move carry 2-3 frames; hit/attack a
  // single). Merged from both boss sheets.
  const bosses = {};
  const addBosses = (mf, src) => {
    if (!mf || !src) return;
    const poseSet = (side) => Object.fromEntries(
      Object.entries(side).map(([k, frames]) => [k, frames.map((r) => sub(src, r))]),
    );
    // displayH (optional): on-screen height for art whose proportions differ
    // from the default r-based scale (Bosses V3)
    for (const [name, m] of Object.entries(mf.bosses)) bosses[name] = { down: poseSet(m.down), up: poseSet(m.up), displayH: m.displayH ?? null };
  };
  addBosses(bossManifest, bossBase);   // Orc Hero, Dark Lord, Baphomet
  addBosses(boss2Manifest, boss2Base); // Vesper (Juperos)
  addBosses(boss3Manifest, boss3Base); // Seyren + Magaleta (Biolab)
  addBosses(boss4Manifest, boss4Base); // Amon-Ra (Pyramid; null-safe when missing)
  addBosses(boss5Manifest, boss5Base); // Loli Ruri + Lord of Death (Niflheim; null-safe when missing)
  addBosses(boss6Manifest, boss6Base); // Thanatos fragments (practice duels)
  addBosses(boss7Manifest, boss7Base); // Thanatos: 'thanatos' (form I) + 'thanatosAwake' (form II)
  addBosses(bossV3Manifest, bossV3Base); // Bosses V3: overrides orcHero / darkLord / baphomet (after bosses.json)
  addBosses(boss9Manifest, boss9Base);   // Bosses V3: overrides vesper / seyren / magaleta / amonRa (after bosses2-4)

  // per-character skill icons: skills[charId] = [shot, focus, bomb, special]
  const skills = {};
  if (skillManifest && skillBase) {
    for (const [id, boxes] of Object.entries(skillManifest.skills)) {
      skills[id] = boxes.map((r) => sub(skillBase, r));
    }
  }

  // animated item pickups: items[kind] = [frame textures], merged from both item
  // sheets. Any kind present here overrides the procedural item texture.
  const items = {};
  const addItems = (mf, src) => {
    if (!mf || !src) return;
    for (const [kind, frames] of Object.entries(mf.items)) items[kind] = frames.map((r) => sub(src, r));
  };
  addItems(itemManifest, itemBase);   // card / zeny / gem
  addItems(item2Manifest, item2Base); // potion / chest / leaf / awakening / speed / kafra / bomb

  // per-class bomb FX: bombs[key] = [4 frame textures]. Rendered additively.
  const bombs = {};
  if (bombManifest && bombBase) {
    for (const [key, rects] of Object.entries(bombManifest.frames)) {
      bombs[key] = rects.map((r) => sub(bombBase, r));
    }
  }

  return { characters, monsters, maps, startMenu, bosses, skills, items, bombs, ensureMapSet };
}
