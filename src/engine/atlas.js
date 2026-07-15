// Loads the sprite sheet + manifest and exposes named PIXI textures.
// All game art resolves through here (manifest-driven), so swapping
// placeholder art for final art never touches game code.
import { Assets, Rectangle, Texture } from 'pixi.js';

// Asset base: '/' in dev, '/RagnarokBullet/' on GitHub Pages. Runtime asset URLs
// must include it so they resolve under any deploy subpath (Vite only rewrites
// asset paths it processes at build time, not these hardcoded fetch strings).
const BASE = import.meta.env.BASE_URL;

// A themed level's scrolling backdrop tiles, in scroll order (first = start /
// bottom, last = boss arena / top). Prontera inserts two extra "royal approach"
// screens between the avenue (004) and the plaza arena (005) so the level runs
// longer after the mid-boss. Loaded lazily so first paint isn't blocked on maps.
const MAP_FILES = {
  prontera: ['prontera001', 'prontera002', 'prontera003', 'prontera004', 'pronteraNewA', 'pronteraNewB', 'prontera005'],
  geffen: ['geffen001', 'geffen002', 'geffen003', 'geffen004', 'geffenNewA', 'geffenNewB', 'geffen005'],
  glastheim: ['glastheim001', 'glastheim002', 'glastheim003', 'glastheim004', 'glastheimNewA', 'glastheimNewB', 'glastheim005'],
};
const loadMapSet = (name) =>
  Promise.all((MAP_FILES[name] ?? []).map((f) => Assets.load(`${BASE}assets/maps/${f}.png`).catch(() => null)))
    .then((set) => set.filter(Boolean));

export async function loadAtlas() {
  const monJson = (n) => fetch(`${BASE}assets/${n}.json`).then((r) => r.json()).catch(() => null);
  const monPng = (n) => Assets.load(`${BASE}assets/${n}.png`).catch(() => null);
  const [
    manifest, base,
    monManifest, monBase, mon2Manifest, mon2Base, mon3Manifest, mon3Base, mon4Manifest, mon4Base,
    prontera,
  ] = await Promise.all([
    fetch(`${BASE}assets/manifest.json`).then((r) => r.json()),
    Assets.load(`${BASE}assets/sheet.png`),
    monJson('monsters'), monPng('monsters'),
    monJson('monsters2'), monPng('monsters2'),
    monJson('monsters3'), monPng('monsters3'),
    monJson('monsters4'), monPng('monsters4'),
    loadMapSet('prontera'),        // only level 1's maps up front; rest lazy
  ]);
  const startMenu = await Assets.load(`${BASE}assets/images/startmenu.png`).catch(() => null);
  const [bossManifest, bossBase, mon5Manifest, skillManifest, skillBase, itemManifest, itemBase] = await Promise.all([
    monJson('bosses'), monPng('bosses'),
    monJson('monsters5'), // mid-bosses (Doppelganger, Giant Baphomet Jr.) — shares bosses.png as its sheet
    monJson('skills'), monPng('skills'), // per-character skill icons (6 chars x 4 skills)
    monJson('items'), monPng('items'),   // animated pickups: card / zeny / gem
  ]);
  const [item2Manifest, item2Base] = await Promise.all([
    monJson('items2'), monPng('items2'), // potion / chest / leaf / awakening / speed / kafra / bomb
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
      };
    }
  };
  addMonsters(monManifest, monBase);   // Poring, Pupa, Picky, Chonchon, Orc Baby
  addMonsters(mon2Manifest, mon2Base); // Mastering, Lunatic
  addMonsters(mon3Manifest, mon3Base); // Geffen: Willow, Zombie, Munak, Bongun, Nine Tails, Deviruchi, Marionette, Wraith
  addMonsters(mon4Manifest, mon4Base); // Glast Heim: Evil Druid, Dark Priest, Raydric, Khalitzburg, Gargoyle, Ghoul, Whisper, Baphomet Jr.
  addMonsters(mon5Manifest, bossBase); // mid-bosses: Doppelganger, Giant Baphomet Jr. (rects live in bosses.png)

  // map backdrops keyed by set. Level 1 (prontera) is preloaded; geffen and
  // glastheim load lazily via ensureMapSet (kicked off in the background after
  // boot) so the title appears without waiting on 44 MB of maps.
  const maps = { prontera, geffen: null, glastheim: null };
  const ensureMapSet = async (name) => {
    if (maps[name]) return maps[name];
    maps[name] = await loadMapSet(name);
    return maps[name];
  };

  // real boss sprites (Orc Hero, Dark Lord, Baphomet). Each pose is an ARRAY of
  // animation frame textures (idle/move carry 2-3 frames; hit/attack a single).
  const bosses = {};
  if (bossManifest && bossBase) {
    const poseSet = (side) => Object.fromEntries(
      Object.entries(side).map(([k, frames]) => [k, frames.map((r) => sub(bossBase, r))]),
    );
    for (const [name, m] of Object.entries(bossManifest.bosses)) {
      bosses[name] = { down: poseSet(m.down), up: poseSet(m.up) };
    }
  }

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

  return { characters, monsters, maps, startMenu, bosses, skills, items, ensureMapSet };
}
