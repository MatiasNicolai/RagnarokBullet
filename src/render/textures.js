// Procedural placeholder textures shared across scenes.
import { Graphics } from 'pixi.js';

export function makeGrassTexture(renderer) {
  const g = new Graphics();
  g.rect(0, 0, 64, 64).fill(0x2e6b30);
  g.rect(0, 0, 64, 32).fill(0x2f7033);
  for (let i = 0; i < 14; i++) {
    const x = (i * 37) % 64, y = (i * 23) % 64;
    g.rect(x, y, 3, 3).fill(i % 3 ? 0x3a8040 : 0x275c2a);
  }
  return renderer.generateTexture(g);
}

// Danmaku enemy bullet. Readability is critical: bullets must pop against busy
// map art AND against falling loot (which shares warm/cool color families).
// The recipe (glow → DARK contrast ring → saturated body → bright inner →
// white-hot center) is the standard danmaku trick — the dark ring separates the
// bullet from anything behind it, and the white center reads instantly as
// "danger", so bullets never blend into potions/gems/zeny.
const BULLET_COLORS = {
  red: [0xff3040, 0xffc0c6],
  cyan: [0x1fd0ff, 0xd6f6ff],
  orange: [0xff8c1a, 0xffe6bc],
  purple: [0xc84dff, 0xeecbff],
};
const BULLET_EDGE = 0x0a0c16; // near-black contrast ring

export function makeBulletTextures(renderer) {
  const out = {};
  for (const [name, [rim, core]] of Object.entries(BULLET_COLORS)) {
    const g = new Graphics();
    g.circle(12, 12, 12).fill({ color: rim, alpha: 0.30 });      // soft colored glow
    g.circle(12, 12, 10).fill({ color: BULLET_EDGE, alpha: 0.9 }); // dark contrast ring
    g.circle(12, 12, 8).fill(rim);                                // saturated body
    g.circle(12, 12, 5).fill(core);                               // bright inner
    g.circle(12, 12, 2.6).fill(0xffffff);                         // white-hot center
    out[name] = renderer.generateTexture(g);
  }
  return out;
}

// Pickups: zeny coin / blue gemstone / red potion.
export function makeItemTextures(renderer) {
  const zeny = new Graphics();
  zeny.circle(10, 10, 9).fill(0xf2c14e).stroke({ color: 0x8a6a2a, width: 2 });
  zeny.circle(10, 10, 5).stroke({ color: 0xbd8f30, width: 2 });

  const gem = new Graphics();
  gem.poly([10, 1, 19, 10, 10, 19, 1, 10]).fill(0x3f7fe0).stroke({ color: 0x1d3f78, width: 2 });
  gem.poly([10, 4, 15, 10, 10, 16, 5, 10]).fill(0x7fb3ff);

  const potion = new Graphics();
  potion.roundRect(7, 1, 6, 5, 1).fill(0xc9a06a);
  potion.circle(10, 13, 7).fill(0xd8353f).stroke({ color: 0x6a1a20, width: 2 });
  potion.circle(8, 11, 2).fill(0xf07a80);

  const chest = new Graphics();
  chest.roundRect(1, 8, 22, 12, 2).fill(0x9a6a30).stroke({ color: 0x5a3a10, width: 2 });
  chest.roundRect(1, 2, 22, 9, 3).fill(0xb5834a).stroke({ color: 0x5a3a10, width: 2 });
  chest.rect(10, 2, 4, 18).fill(0xf2c14e);
  chest.circle(12, 12, 2.5).fill(0x5a3a10);

  const leaf = new Graphics();
  leaf.ellipse(10, 11, 8, 5).fill(0x6fce5a).stroke({ color: 0x2e6b30, width: 2 });
  leaf.rect(9, 3, 2, 8).fill(0x2e6b30);

  // awakening potion — yellow flask
  const awakening = new Graphics();
  awakening.roundRect(7, 1, 6, 5, 1).fill(0xc9a06a);
  awakening.circle(10, 13, 7).fill(0xf2d24a).stroke({ color: 0x8a6a1a, width: 2 });
  awakening.circle(8, 11, 2).fill(0xfff0a0);

  // speed potion — green flask
  const speed = new Graphics();
  speed.roundRect(7, 1, 6, 5, 1).fill(0xc9a06a);
  speed.circle(10, 13, 7).fill(0x4ad06a).stroke({ color: 0x1a6a2a, width: 2 });
  speed.circle(8, 11, 2).fill(0xa0f0b0);

  // kafra guard — blue shield
  const kafra = new Graphics();
  kafra.poly([10, 1, 19, 5, 17, 15, 10, 19, 3, 15, 1, 5]).fill(0x3f7fe0).stroke({ color: 0x1d3f78, width: 2 });
  kafra.poly([10, 5, 14, 7, 13, 13, 10, 15, 7, 13, 6, 7]).fill(0x9fc0ff);

  // monster card — RO card frame
  const card = new Graphics();
  card.roundRect(3, 1, 14, 18, 2).fill(0x2a3a6a).stroke({ color: 0xf2c14e, width: 2 });
  card.rect(6, 4, 8, 8).fill(0x1a2444);
  card.circle(10, 8, 2.5).fill(0xff6a8a);
  card.rect(6, 14, 8, 2).fill(0xf2c14e);

  return {
    zeny: renderer.generateTexture(zeny),
    gem: renderer.generateTexture(gem),
    potion: renderer.generateTexture(potion),
    chest: renderer.generateTexture(chest),
    leaf: renderer.generateTexture(leaf),
    awakening: renderer.generateTexture(awakening),
    speed: renderer.generateTexture(speed),
    kafra: renderer.generateTexture(kafra),
    card: renderer.generateTexture(card),
  };
}

export function makePoringTexture(renderer) {
  const g = new Graphics();
  g.ellipse(24, 26, 22, 18).fill(0xff9eb5);
  g.ellipse(24, 30, 18, 12).fill(0xffb8c9);
  g.ellipse(17, 22, 3, 4).fill(0x40232b);
  g.ellipse(31, 22, 3, 4).fill(0x40232b);
  g.ellipse(20, 14, 6, 3).fill(0xffd3de);
  return renderer.generateTexture(g);
}

// Distinct placeholder chibi mobs (48px) — clear silhouette + palette each,
// to be swapped for the user's monster sheet via the manifest later.
function eyes(g, cx, y, dx = 6) {
  g.ellipse(cx - dx, y, 2.6, 3.4).fill(0x2a1a20);
  g.ellipse(cx + dx, y, 2.6, 3.4).fill(0x2a1a20);
  g.circle(cx - dx - 0.8, y - 1, 1).fill(0xffffff);
  g.circle(cx + dx - 0.8, y - 1, 1).fill(0xffffff);
}

export function makeEnemyTextures(renderer) {
  const T = (g) => renderer.generateTexture(g);
  const out = {};

  // poring — pink jelly
  { const g = new Graphics();
    g.ellipse(24, 27, 22, 18).fill(0xff9eb5); g.ellipse(24, 31, 18, 12).fill(0xffb8c9);
    eyes(g, 24, 24); g.ellipse(19, 16, 6, 3).fill(0xffd3de); out.poring = T(g); }

  // drops — orange jelly with a droplet highlight
  { const g = new Graphics();
    g.ellipse(24, 27, 22, 18).fill(0xff9a3c); g.ellipse(24, 31, 18, 12).fill(0xffb866);
    eyes(g, 24, 24); g.ellipse(19, 16, 6, 3).fill(0xffe0b0); out.drops = T(g); }

  // picky — little yellow chick with beak
  { const g = new Graphics();
    g.ellipse(24, 28, 15, 15).fill(0xffe14a); g.circle(24, 18, 10).fill(0xffec7a);
    g.poly([24, 18, 33, 21, 24, 24]).fill(0xff8a2a); eyes(g, 24, 16, 4);
    g.ellipse(13, 32, 5, 3).fill(0xffb84a); out.picky = T(g); }

  // chonchon — green fly with wings
  { const g = new Graphics();
    g.ellipse(11, 20, 9, 6).fill({ color: 0xcfeaff, alpha: 0.8 });
    g.ellipse(37, 20, 9, 6).fill({ color: 0xcfeaff, alpha: 0.8 });
    g.ellipse(24, 26, 13, 15).fill(0x5aa844); g.circle(24, 18, 8).fill(0x6fce5a);
    eyes(g, 24, 17, 4); out.chonchon = T(g); }

  // pupa — brown cocoon
  { const g = new Graphics();
    g.ellipse(24, 26, 14, 20).fill(0x9a6a3a); g.ellipse(24, 26, 10, 16).fill(0xb5834a);
    for (let i = -2; i <= 2; i++) g.moveTo(12, 26 + i * 7).lineTo(36, 26 + i * 7).stroke({ color: 0x6a4a20, width: 1.5 });
    eyes(g, 24, 20, 4); out.pupa = T(g); }

  // fabre — green segmented caterpillar
  { const g = new Graphics();
    for (let i = 0; i < 4; i++) g.circle(14 + i * 6, 30 - i * 2, 8 - i).fill(i === 0 ? 0x8fd070 : 0x6fb84a);
    g.circle(12, 30, 9).fill(0x9fe080); eyes(g, 10, 28, 3.5);
    g.moveTo(9, 22).lineTo(7, 16).stroke({ color: 0x4a7a2a, width: 1.5 });
    g.moveTo(14, 22).lineTo(16, 16).stroke({ color: 0x4a7a2a, width: 1.5 }); out.fabre = T(g); }

  // lunatic — pink bunny with long ears
  { const g = new Graphics();
    g.ellipse(18, 10, 4, 11).fill(0xffc9d6); g.ellipse(30, 10, 4, 11).fill(0xffc9d6);
    g.ellipse(24, 28, 16, 15).fill(0xffd9e2); g.circle(24, 22, 11).fill(0xffe6ec);
    eyes(g, 24, 22, 5); g.ellipse(24, 27, 2.4, 1.6).fill(0xff6a8a); out.lunatic = T(g); }

  // orcbaby — green orc head with tusks
  { const g = new Graphics();
    g.ellipse(24, 26, 16, 16).fill(0x5a8a3a); g.circle(24, 20, 11).fill(0x6f9e48);
    eyes(g, 24, 19, 5);
    g.poly([19, 27, 21, 33, 22, 27]).fill(0xf0ead0);
    g.poly([29, 27, 27, 33, 26, 27]).fill(0xf0ead0);
    g.rect(16, 12, 16, 4).fill(0x8a5a2a); out.orcbaby = T(g); }

  // mastering — big crowned poring (mid-boss)
  { const g = new Graphics();
    g.ellipse(40, 44, 38, 32).fill(0xff8fb0); g.ellipse(40, 50, 30, 20).fill(0xffb0c8);
    eyes(g, 40, 40, 11);
    g.ellipse(30, 26, 10, 5).fill(0xffd3de);
    g.poly([22, 18, 28, 6, 34, 16, 40, 4, 46, 16, 52, 6, 58, 18]).fill(0xf2c14e).stroke({ color: 0x8a6a2a, width: 2 });
    g.circle(40, 12, 3).fill(0xd8353f); out.mastering = T(g); }

  // --- Level 2 (Geffen / Geffenia) ---
  // willow — walking tree stump, tanky
  { const g = new Graphics();
    g.rect(14, 24, 20, 24).fill(0x6a4a2a).stroke({ color: 0x3a2814, width: 2 });
    g.ellipse(24, 20, 16, 10).fill(0x3f8a44); g.ellipse(24, 16, 12, 7).fill(0x4f9a54);
    eyes(g, 24, 30, 5); out.willow = T(g); }
  // zombie — rotting green humanoid
  { const g = new Graphics();
    g.roundRect(15, 22, 18, 24, 4).fill(0x6a7a4a); g.circle(24, 18, 10).fill(0x7a8a55);
    g.ellipse(21, 18, 2.4, 3).fill(0x1a1a10); g.ellipse(28, 18, 2.4, 3).fill(0x1a1a10);
    g.rect(19, 24, 10, 2).fill(0x3a2a1a); out.zombie = T(g); }
  // munak — hopping chinese ghost (blue talisman hat)
  { const g = new Graphics();
    g.roundRect(14, 24, 20, 22, 4).fill(0x2a3a6a); g.circle(24, 18, 10).fill(0xe8e0d0);
    eyes(g, 24, 18, 4); g.rect(17, 6, 14, 8).fill(0xf0e8d8).stroke({ color: 0xb03030, width: 1 });
    g.rect(23, 7, 2, 6).fill(0xb03030); out.munak = T(g); }
  // bongun — red-hat hopping ghost
  { const g = new Graphics();
    g.roundRect(14, 24, 20, 22, 4).fill(0x6a2a2a); g.circle(24, 18, 10).fill(0xe8e0d0);
    eyes(g, 24, 18, 4); g.rect(15, 8, 18, 7).fill(0x8a2a2a); g.rect(19, 3, 10, 6).fill(0x8a2a2a);
    out.bongun = T(g); }
  // ninetails — orange fox with tails
  { const g = new Graphics();
    for (let i = 0; i < 5; i++) g.ellipse(10 + i * 7, 34, 4, 12).fill(0xff8a3a);
    g.ellipse(30, 28, 14, 13).fill(0xffa04a); g.poly([20, 18, 24, 8, 28, 18]).fill(0xff8a3a);
    g.poly([32, 18, 36, 8, 40, 18]).fill(0xff8a3a); eyes(g, 30, 26, 5); out.ninetails = T(g); }
  // deviruchi — little purple imp with horns
  { const g = new Graphics();
    g.circle(24, 26, 14).fill(0x6a4a8a); g.poly([12, 18, 8, 6, 18, 14]).fill(0x4a2a6a);
    g.poly([36, 18, 40, 6, 30, 14]).fill(0x4a2a6a); eyes(g, 24, 24, 5);
    g.ellipse(18, 30, 6, 4).fill({ color: 0xc9b8ff, alpha: 0.6 }); g.ellipse(30, 30, 6, 4).fill({ color: 0xc9b8ff, alpha: 0.6 });
    out.deviruchi = T(g); }
  // marionette — hanging puppet on strings
  { const g = new Graphics();
    g.moveTo(12, 0).lineTo(16, 18).stroke({ color: 0xd0d0d0, width: 1 });
    g.moveTo(36, 0).lineTo(32, 18).stroke({ color: 0xd0d0d0, width: 1 });
    g.circle(24, 22, 10).fill(0xe8d8c0); eyes(g, 24, 22, 4);
    g.roundRect(16, 30, 16, 16, 3).fill(0x8a3a6a); out.marionette = T(g); }
  // wraith — floating dark spectre
  { const g = new Graphics();
    g.poly([24, 6, 40, 44, 24, 36, 8, 44]).fill({ color: 0x3a3450, alpha: 0.9 });
    g.circle(24, 22, 11).fill({ color: 0x2a2438, alpha: 0.95 });
    g.circle(20, 22, 2.4).fill(0x9f8aff); g.circle(28, 22, 2.4).fill(0x9f8aff); out.wraith = T(g); }

  // --- Level 3 (Glast Heim) ---
  // evildruid — hooded undead caster
  { const g = new Graphics();
    g.poly([10, 46, 24, 8, 38, 46]).fill(0x4a4658).stroke({ color: 0x2a2838, width: 2 });
    g.circle(24, 22, 8).fill(0x1a1824); g.circle(21, 22, 2).fill(0x7fd0ff); g.circle(27, 22, 2).fill(0x7fd0ff);
    out.evildruid = T(g); }
  // darkpriest — red-robed caster
  { const g = new Graphics();
    g.poly([10, 46, 24, 10, 38, 46]).fill(0x7a2a3a).stroke({ color: 0x3a1420, width: 2 });
    g.circle(24, 22, 8).fill(0x1a1014); eyes(g, 24, 22, 3.5);
    g.circle(24, 12, 3).fill(0xf2c14e); out.darkpriest = T(g); }
  // raydric — armored knight with cape
  { const g = new Graphics();
    g.ellipse(24, 30, 18, 20).fill(0x5a1e24); g.roundRect(15, 22, 18, 24, 4).fill(0x4a4a58);
    g.circle(24, 18, 9).fill(0x3a3a48); g.rect(17, 16, 14, 4).fill(0x6a6a7a);
    g.circle(21, 19, 1.8).fill(0xff4a4a); g.circle(27, 19, 1.8).fill(0xff4a4a); out.raydric = T(g); }
  // khalitzburg — big shielded knight
  { const g = new Graphics();
    g.roundRect(12, 18, 24, 30, 5).fill(0x6a6a7a).stroke({ color: 0x2a2a38, width: 2 });
    g.circle(24, 16, 9).fill(0x50505f); g.rect(18, 14, 12, 4).fill(0x8a8a9a);
    g.roundRect(4, 20, 10, 24, 3).fill(0x8a7a3a).stroke({ color: 0x5a4a20, width: 2 }); // shield
    out.khalitzburg = T(g); }
  // gargoyle — grey winged demon
  { const g = new Graphics();
    g.poly([6, 16, 20, 28, 8, 34].map(Number)).fill(0x585c66);
    g.poly([42, 16, 28, 28, 40, 34]).fill(0x585c66);
    g.circle(24, 26, 12).fill(0x6a6e78); g.poly([16, 16, 14, 8, 20, 14]).fill(0x4a4e58);
    g.poly([32, 16, 34, 8, 28, 14]).fill(0x4a4e58); g.circle(20, 25, 2).fill(0xffb04a); g.circle(28, 25, 2).fill(0xffb04a);
    out.gargoyle = T(g); }
  // ghoul — pale shambling undead
  { const g = new Graphics();
    g.roundRect(15, 22, 18, 24, 4).fill(0x8a8a70); g.circle(24, 18, 10).fill(0x9a9a80);
    g.ellipse(21, 18, 2.6, 3).fill(0x2a2a1a); g.ellipse(28, 18, 2.6, 3).fill(0x2a2a1a);
    g.rect(18, 25, 12, 2).fill(0x3a3a2a); out.ghoul = T(g); }
  // whisper — floating white ghost with big mouth
  { const g = new Graphics();
    g.ellipse(24, 24, 15, 18).fill({ color: 0xe8f0f8, alpha: 0.85 });
    g.ellipse(20, 20, 2.4, 4).fill(0x2a2a3a); g.ellipse(28, 20, 2.4, 4).fill(0x2a2a3a);
    g.ellipse(24, 30, 5, 6).fill(0x2a2a3a); out.whisper = T(g); }
  // bapho_jr — small baphomet (goat demon), also giant mid-boss when scaled
  { const g = new Graphics();
    g.circle(24, 26, 13).fill(0x5a3a5a); g.poly([12, 20, 4, 8, 16, 16]).fill(0x2a1a2a);
    g.poly([36, 20, 44, 8, 32, 16]).fill(0x2a1a2a); g.circle(20, 25, 2.4).fill(0xff4a4a);
    g.circle(28, 25, 2.4).fill(0xff4a4a); g.poly([20, 32, 24, 40, 28, 32]).fill(0xf0ead0);
    out.bapho_jr = T(g); }
  // doppelganger — shadowy mirror figure (mid-boss)
  { const g = new Graphics();
    g.ellipse(40, 48, 30, 40).fill({ color: 0x1a1428, alpha: 0.92 });
    g.circle(40, 30, 20).fill({ color: 0x241c38, alpha: 0.95 });
    g.circle(32, 30, 4).fill(0x9f6aff); g.circle(48, 30, 4).fill(0x9f6aff);
    g.poly([20, 24, 12, 6, 28, 18]).fill(0x1a1428); g.poly([60, 24, 68, 6, 52, 18]).fill(0x1a1428);
    out.doppelganger = T(g); }

  return out;
}

// Dark Lord — level 2 boss: caped dark knight wreathed in shadow (~150px).
export function makeDarkLordTexture(renderer) {
  const g = new Graphics();
  g.ellipse(75, 96, 52, 44).fill({ color: 0x1a1226, alpha: 0.92 }); // shadow cloak
  g.roundRect(48, 60, 54, 66, 10).fill(0x2a2238).stroke({ color: 0x120c1c, width: 3 });
  g.circle(40, 80, 15).fill(0x3a2e50); g.circle(110, 80, 15).fill(0x3a2e50);
  g.circle(75, 42, 30).fill(0x241c38); g.circle(75, 40, 24).fill(0x2e2444);
  g.circle(63, 40, 5).fill(0xc94aff); g.circle(87, 40, 5).fill(0xc94aff);
  // horned helm
  g.poly([50, 30, 40, 6, 60, 22]).fill(0x1a1226); g.poly([100, 30, 110, 6, 90, 22]).fill(0x1a1226);
  g.rect(58, 24, 34, 5).fill(0x4a3a6a);
  // greatsword
  g.rect(112, 16, 7, 96).fill(0x50505f);
  g.poly([106, 20, 125, 20, 115, 116]).fill(0x7a6a9a).stroke({ color: 0x9f8aff, width: 2 });
  return renderer.generateTexture(g);
}

// Baphomet — level 3 final boss: giant goat demon with scythe (~180px).
export function makeBaphometTexture(renderer) {
  const g = new Graphics();
  g.ellipse(80, 104, 56, 46).fill(0x3a2438); // fur body
  g.roundRect(52, 66, 56, 62, 12).fill(0x4a2e44).stroke({ color: 0x1e1420, width: 3 });
  g.circle(44, 86, 16).fill(0x5a3a52); g.circle(116, 86, 16).fill(0x5a3a52);
  // head
  g.circle(80, 46, 34).fill(0x5a3a5a); g.circle(80, 44, 27).fill(0x6a4468);
  // big curved horns
  g.poly([50, 36, 20, 6, 30, 30, 44, 42]).fill(0x2a1a2a).stroke({ color: 0x140a14, width: 2 });
  g.poly([110, 36, 140, 6, 130, 30, 116, 42]).fill(0x2a1a2a).stroke({ color: 0x140a14, width: 2 });
  g.circle(68, 44, 5).fill(0xff3a3a); g.circle(92, 44, 5).fill(0xff3a3a);
  g.poly([72, 56, 80, 70, 88, 56]).fill(0xf0ead0); // goatee/fang
  // scythe
  g.rect(126, 10, 7, 120).fill(0x3a2a1a);
  g.poly([100, 16, 150, 22, 130, 46]).fill(0xb8c0c8).stroke({ color: 0x6a7078, width: 2 });
  return renderer.generateTexture(g);
}

// Orc Hero boss — big green orc brandishing an axe (~150px placeholder).
export function makeOrcHeroTexture(renderer) {
  const g = new Graphics();
  // cape/back
  g.ellipse(75, 92, 46, 40).fill(0x6a3a1a);
  // body armor
  g.roundRect(48, 66, 54, 60, 10).fill(0x3a2a1a).stroke({ color: 0x1a120a, width: 3 });
  g.roundRect(54, 72, 42, 20, 6).fill(0x5a4a2a);
  // arms
  g.circle(40, 84, 15).fill(0x4a7a2a); g.circle(110, 84, 15).fill(0x4a7a2a);
  // head
  g.circle(75, 44, 30).fill(0x5a8a3a); g.circle(75, 40, 24).fill(0x6f9e48);
  eyes(g, 75, 40, 11);
  // brow + tusks
  g.rect(56, 30, 38, 5).fill(0x3a5a24);
  g.poly([64, 50, 68, 64, 70, 50]).fill(0xf0ead0);
  g.poly([86, 50, 82, 64, 80, 50]).fill(0xf0ead0);
  // axe
  g.rect(112, 20, 6, 90).fill(0x7a5a2a);
  g.poly([100, 24, 140, 34, 118, 54]).fill(0xb8c0c8).stroke({ color: 0x6a7078, width: 2 });
  g.poly([136, 26, 148, 40, 132, 46]).fill(0xd8e0e8);
  return renderer.generateTexture(g);
}
