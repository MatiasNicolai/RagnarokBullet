// Loads the sprite sheet + manifest and exposes named PIXI textures.
// All game art resolves through here (manifest-driven), so swapping
// placeholder art for final art never touches game code.
import { Assets, Rectangle, Texture } from 'pixi.js';

export async function loadAtlas() {
  // scrolling map backdrops, one set per themed level
  const MAP_SETS = { prontera: 'prontera', geffen: 'geffen', glastheim: 'glastheim' };
  const loadMapSet = (base2) =>
    Promise.all([1, 2, 3, 4, 5].map((n) => Assets.load(`/assets/maps/${base2}00${n}.png`).catch(() => null)));

  const monJson = (n) => fetch(`/assets/${n}.json`).then((r) => r.json()).catch(() => null);
  const monPng = (n) => Assets.load(`/assets/${n}.png`).catch(() => null);
  const [
    manifest, base,
    monManifest, monBase, mon2Manifest, mon2Base, mon3Manifest, mon3Base, mon4Manifest, mon4Base,
    prontera, geffen, glastheim,
  ] = await Promise.all([
    fetch('/assets/manifest.json').then((r) => r.json()),
    Assets.load('/assets/sheet.png'),
    monJson('monsters'), monPng('monsters'),
    monJson('monsters2'), monPng('monsters2'),
    monJson('monsters3'), monPng('monsters3'),
    monJson('monsters4'), monPng('monsters4'),
    loadMapSet(MAP_SETS.prontera),
    loadMapSet(MAP_SETS.geffen),
    loadMapSet(MAP_SETS.glastheim),
  ]);
  const startMenu = await Assets.load('/assets/images/startmenu.png').catch(() => null);
  const [bossManifest, bossBase, mon5Manifest, skillManifest, skillBase] = await Promise.all([
    monJson('bosses'), monPng('bosses'),
    monJson('monsters5'), // mid-bosses (Doppelganger, Giant Baphomet Jr.) — shares bosses.png as its sheet
    monJson('skills'), monPng('skills'), // per-character skill icons (6 chars x 4 skills)
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

  // real animated monster sprites, merged from all monster sheets
  const monsters = {};
  const addMonsters = (mf, src) => {
    if (!mf || !src) return;
    for (const [name, m] of Object.entries(mf.monsters)) {
      monsters[name] = {
        down: Object.fromEntries(Object.entries(m.down).map(([k, r]) => [k, sub(src, r)])),
        up: Object.fromEntries(Object.entries(m.up).map(([k, r]) => [k, sub(src, r)])),
      };
    }
  };
  addMonsters(monManifest, monBase);   // Poring, Pupa, Picky, Chonchon, Orc Baby
  addMonsters(mon2Manifest, mon2Base); // Mastering, Lunatic
  addMonsters(mon3Manifest, mon3Base); // Geffen: Willow, Zombie, Munak, Bongun, Nine Tails, Deviruchi, Marionette, Wraith
  addMonsters(mon4Manifest, mon4Base); // Glast Heim: Evil Druid, Dark Priest, Raydric, Khalitzburg, Gargoyle, Ghoul, Whisper, Baphomet Jr.
  addMonsters(mon5Manifest, bossBase); // mid-bosses: Doppelganger, Giant Baphomet Jr. (rects live in bosses.png)

  // map backdrops keyed by set (level 1 = prontera, level 2 = geffen, level 3 = glastheim)
  const maps = {
    prontera: prontera.filter(Boolean),
    geffen: geffen.filter(Boolean),
    glastheim: glastheim.filter(Boolean),
  };

  // real boss sprites (Orc Hero, Dark Lord, Baphomet), down/up pose sets
  const bosses = {};
  if (bossManifest && bossBase) {
    for (const [name, m] of Object.entries(bossManifest.bosses)) {
      bosses[name] = {
        down: Object.fromEntries(Object.entries(m.down).map(([k, r]) => [k, sub(bossBase, r)])),
        up: Object.fromEntries(Object.entries(m.up).map(([k, r]) => [k, sub(bossBase, r)])),
      };
    }
  }

  // per-character skill icons: skills[charId] = [shot, focus, bomb, special]
  const skills = {};
  if (skillManifest && skillBase) {
    for (const [id, boxes] of Object.entries(skillManifest.skills)) {
      skills[id] = boxes.map((r) => sub(skillBase, r));
    }
  }

  return { characters, monsters, maps, startMenu, bosses, skills };
}
