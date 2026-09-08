// Per-level background themes: 3 biome ground tiles, decorative props (draw
// functions on a Graphics), which props appear per biome, evolving light tint,
// and optional weather. Consumed by LivingBackground. Purely cosmetic.
import { Graphics } from 'pixi.js';

// --- Level 1: Campos de Prontera → Aldea Orc ---
export const level1Theme = {
  tiles: [
    { base: 0x2e6b30, mid: 0x2f7033, specks: [0x3a8040, 0x275c2a] },
    { base: 0x5a4a2e, mid: 0x6a5636, specks: [0x7a663e, 0x4a3a22] },
    { base: 0x4a3a28, mid: 0x574632, specks: [0x6a5232, 0x3a2c1c] },
  ],
  light: [0xffffff, 0xfff0d8, 0xffd8c0],
  weather: 'none',
  biomeProps: [
    ['tree', 'tree', 'bush', 'rock', 'house'],
    ['tree', 'bush', 'fence', 'fence', 'rock'],
    ['tent', 'totem', 'tent', 'fence', 'rock'],
  ],
  props: {
    tree(g) {
      g.rect(20, 40, 8, 20).fill(0x5a3a1a);
      g.circle(24, 30, 20).fill(0x2f6b34); g.circle(14, 34, 12).fill(0x357a3c);
      g.circle(34, 34, 12).fill(0x357a3c); g.circle(24, 22, 13).fill(0x3f8a44);
    },
    bush(g) { g.circle(14, 22, 10).fill(0x2f6b34); g.circle(26, 20, 12).fill(0x3f8a44); g.circle(36, 23, 9).fill(0x357a3c); },
    rock(g) { g.ellipse(20, 26, 18, 12).fill(0x7a7268); g.ellipse(16, 22, 10, 7).fill(0x938a7e); },
    house(g) {
      g.rect(6, 34, 60, 44).fill(0xe8ddc4).stroke({ color: 0x8a7a5a, width: 2 });
      g.poly([0, 36, 36, 8, 72, 36]).fill(0xb5443a).stroke({ color: 0x7a2a24, width: 2 });
      g.rect(28, 54, 16, 24).fill(0x6a4a2a);
      g.rect(12, 44, 12, 12).fill(0x8fb5d8); g.rect(48, 44, 12, 12).fill(0x8fb5d8);
    },
    fence(g) { g.rect(2, 14, 44, 5).fill(0x8a6a3a); for (const x of [6, 20, 34]) g.rect(x, 6, 6, 26).fill(0xa07a44).stroke({ color: 0x6a4a20, width: 1 }); },
    tent(g) {
      g.poly([4, 66, 40, 10, 76, 66]).fill(0x6a4428).stroke({ color: 0x3a2414, width: 3 });
      g.poly([28, 66, 40, 40, 52, 66]).fill(0x2a1a0e);
      g.rect(38, 6, 4, 16).fill(0x3a2414); g.poly([42, 8, 58, 12, 42, 18]).fill(0xb5443a);
    },
    totem(g) {
      g.rect(16, 10, 12, 54).fill(0x5a3a1a).stroke({ color: 0x3a2414, width: 2 });
      g.poly([12, 12, 22, 2, 32, 12]).fill(0x6a4428);
      g.circle(22, 24, 5).fill(0xf2c14e); g.rect(10, 34, 24, 4).fill(0x8a5a2a);
    },
  },
};

// --- Level 2: Torre de Geffen → Geffenia ---
export const level2Theme = {
  tiles: [
    { base: 0x3a3a4a, mid: 0x44445a, specks: [0x55556e, 0x2e2e3c] },      // stone tower floor
    { base: 0x2e2c46, mid: 0x383455, specks: [0x4a4470, 0x241f38] },      // arcane floor
    { base: 0x241b3a, mid: 0x2e2348, specks: [0x3f2f66, 0x1a1330] },      // geffenia marble
  ],
  light: [0xd8d8ff, 0xc8b8ff, 0xb090e0],
  weather: 'none',
  biomeProps: [
    ['shelf', 'pillar', 'shelf', 'rune', 'pillar'],
    ['pillar', 'rune', 'crystal', 'rune', 'shelf'],
    ['crystal', 'crystal', 'rune', 'pillar', 'crystal'],
  ],
  props: {
    shelf(g) {
      g.rect(4, 10, 42, 60).fill(0x4a3626).stroke({ color: 0x2a1e14, width: 2 });
      for (let i = 0; i < 4; i++) { g.rect(6, 14 + i * 15, 38, 3).fill(0x2a1e14); for (let b = 0; b < 5; b++) g.rect(8 + b * 7, 17 + i * 15, 5, 10).fill([0x8a3a3a, 0x3a5a8a, 0x5a8a3a, 0x8a7a3a][b % 4]); }
    },
    pillar(g) {
      g.rect(10, 4, 24, 66).fill(0x6a6a80).stroke({ color: 0x3a3a4a, width: 2 });
      g.rect(6, 2, 32, 8).fill(0x7a7a90); g.rect(6, 62, 32, 8).fill(0x7a7a90);
      g.rect(16, 10, 4, 54).fill(0x50505f);
    },
    rune(g) {
      g.circle(24, 24, 20).stroke({ color: 0x7f6aff, width: 2 });
      g.circle(24, 24, 13).stroke({ color: 0x9f8aff, width: 1.5 });
      g.poly([24, 8, 38, 32, 10, 32]).stroke({ color: 0x9f8aff, width: 1.5 });
      g.poly([24, 40, 38, 16, 10, 16]).stroke({ color: 0x7f6aff, width: 1.5 });
    },
    crystal(g) {
      g.poly([20, 2, 34, 26, 20, 54, 6, 26]).fill({ color: 0x7f6aff, alpha: 0.85 }).stroke({ color: 0xc9b8ff, width: 2 });
      g.poly([20, 10, 28, 26, 20, 44, 12, 26]).fill(0xa88fff);
    },
  },
};

// --- Level 3: Glast Heim (rain) ---
export const level3Theme = {
  tiles: [
    { base: 0x30323a, mid: 0x393c46, specks: [0x484c58, 0x24262c] },      // cracked stone
    { base: 0x2c3230, mid: 0x353d38, specks: [0x445046, 0x222824] },      // mossy stone
    { base: 0x2a2228, mid: 0x342a30, specks: [0x463640, 0x1e181c] },      // blood tile
  ],
  light: [0x9aa0b8, 0x8890a8, 0x707890],
  weather: 'rain',
  biomeProps: [
    ['statue', 'pillar', 'torch', 'grave', 'pillar'],
    ['pillar', 'grave', 'deadtree', 'torch', 'statue'],
    ['statue', 'deadtree', 'grave', 'torch', 'statue'],
  ],
  props: {
    statue(g) {
      g.rect(10, 40, 28, 30).fill(0x565a66).stroke({ color: 0x2e3238, width: 2 });
      g.circle(24, 30, 12).fill(0x646977); g.rect(16, 40, 16, 8).fill(0x565a66);
      g.rect(20, 8, 8, 24).fill(0x646977); // broken wing/arm
    },
    pillar(g) {
      g.rect(10, 14, 24, 56).fill(0x50535e).stroke({ color: 0x2a2c34, width: 2 });
      g.rect(6, 10, 32, 8).fill(0x5c5f6a); g.poly([10, 14, 34, 14, 30, 4, 14, 4]).fill(0x44464e);
    },
    torch(g) {
      g.rect(18, 20, 6, 50).fill(0x3a2c1e);
      g.circle(21, 16, 7).fill(0xff8a2a); g.circle(21, 12, 5).fill(0xffd24a); g.circle(21, 9, 3).fill(0xfff2b0);
    },
    grave(g) {
      g.roundRect(8, 20, 30, 46, 6).fill(0x565a66).stroke({ color: 0x2e3238, width: 2 });
      g.rect(20, 26, 6, 20).fill(0x3e424a); g.rect(14, 32, 18, 6).fill(0x3e424a);
    },
    deadtree(g) {
      g.rect(20, 34, 7, 34).fill(0x3a3028);
      g.moveTo(23, 40).lineTo(10, 22).stroke({ color: 0x3a3028, width: 4 });
      g.moveTo(23, 44).lineTo(38, 26).stroke({ color: 0x3a3028, width: 4 });
      g.moveTo(23, 34).lineTo(24, 10).stroke({ color: 0x3a3028, width: 4 });
    },
  },
};

// --- Level 4: Juperos (ancient buried machine civilization) ---
export const level4Theme = {
  tiles: [
    { base: 0x1c2630, mid: 0x24323e, specks: [0x2f4a52, 0x141c24] },      // dark metal deck
    { base: 0x1a2832, mid: 0x223a42, specks: [0x2a5560, 0x121e26] },      // energized plating
    { base: 0x14232e, mid: 0x1c3540, specks: [0x2f6672, 0x0e1820] },      // reactor core floor
  ],
  light: [0xbfe8ff, 0x8fd8f0, 0x5fd0e8],
  weather: 'none',
  biomeProps: [
    ['pipe', 'panel', 'conduit', 'pillar', 'panel'],
    ['conduit', 'core', 'pipe', 'panel', 'pillar'],
    ['core', 'core', 'conduit', 'pillar', 'core'],
  ],
  props: {
    pillar(g) {
      g.rect(10, 4, 24, 66).fill(0x3a444e).stroke({ color: 0x1c242c, width: 2 });
      g.rect(8, 2, 28, 8).fill(0x48545e); g.rect(8, 62, 28, 8).fill(0x48545e);
      g.rect(20, 12, 4, 50).fill({ color: 0x4fd0e8, alpha: 0.8 }); // energy vein
    },
    panel(g) {
      g.rect(4, 8, 44, 58).fill(0x2a343e).stroke({ color: 0x141c24, width: 2 });
      for (let i = 0; i < 3; i++) g.rect(10, 14 + i * 16, 32, 3).fill(0x3f8a9a);
      g.circle(38, 56, 4).fill(0x5fe0f0); g.circle(14, 20, 3).fill(0xffcf6a);
    },
    conduit(g) {
      g.rect(18, 2, 12, 66).fill(0x323c46).stroke({ color: 0x1a2028, width: 2 });
      g.rect(22, 6, 4, 58).fill({ color: 0x5fd0e8, alpha: 0.9 });
      g.circle(24, 16, 5).fill(0x8fe8ff); g.circle(24, 40, 5).fill(0x8fe8ff);
    },
    pipe(g) {
      g.rect(2, 20, 48, 12).fill(0x3a444e).stroke({ color: 0x1c242c, width: 2 });
      g.rect(2, 44, 48, 10).fill(0x323c46).stroke({ color: 0x1a2028, width: 2 });
      g.circle(10, 26, 3).fill(0x4fd0e8); g.circle(40, 49, 3).fill(0xffcf6a);
    },
    core(g) {
      g.poly([24, 2, 44, 24, 24, 60, 4, 24]).fill(0x223a42).stroke({ color: 0x1c2a30, width: 2 });
      g.circle(24, 28, 13).fill({ color: 0x2f6672, alpha: 0.9 }).stroke({ color: 0x7fe8ff, width: 2 });
      g.circle(24, 28, 6).fill(0xbfeeff);
    },
  },
};

// Lighthalzen Biolab — sterile lab turned toxic. Sickly green fluorescence,
// specimen tanks, biohazard plating. Fallback theme for the biolab map set.
export const level5Theme = {
  tiles: [
    { base: 0x14201a, mid: 0x1c2c22, specks: [0x2f5a3a, 0x0e1712] },       // lab floor tiling
    { base: 0x162418, mid: 0x203222, specks: [0x3a7a44, 0x101a12] },       // contaminated deck
    { base: 0x121e20, mid: 0x1a2e2c, specks: [0x2f6a66, 0x0c1616] },       // reactor / tank room
  ],
  light: [0xbfffcf, 0x8ff0b0, 0x6fe8d0],
  weather: 'none',
  biomeProps: [
    ['vat', 'panel', 'pipe', 'pillar', 'panel'],
    ['pipe', 'vat', 'panel', 'pillar', 'vat'],
    ['vat', 'vat', 'pipe', 'pillar', 'vat'],
  ],
  props: {
    pillar(g) {
      g.rect(10, 4, 24, 66).fill(0x2a3a30).stroke({ color: 0x141c18, width: 2 });
      g.rect(8, 2, 28, 8).fill(0x38504a); g.rect(8, 62, 28, 8).fill(0x38504a);
      g.rect(20, 12, 4, 50).fill({ color: 0x5fe8a0, alpha: 0.8 }); // bio vein
    },
    panel(g) {
      g.rect(4, 8, 44, 58).fill(0x22322a).stroke({ color: 0x121a14, width: 2 });
      for (let i = 0; i < 3; i++) g.rect(10, 14 + i * 16, 32, 3).fill(0x3f9a6a);
      g.circle(38, 56, 4).fill(0x5ff0a0); g.circle(14, 20, 3).fill(0xffcf6a);
    },
    vat(g) {
      // specimen tank: glass cylinder with glowing green fluid
      g.roundRect(12, 6, 24, 60, 8).fill(0x18261e).stroke({ color: 0x2a4a38, width: 2 });
      g.roundRect(15, 14, 18, 48, 6).fill({ color: 0x2f8a5a, alpha: 0.7 });
      g.circle(24, 30, 4).fill({ color: 0xbfffcf, alpha: 0.9 });
      g.circle(20, 46, 3).fill({ color: 0x8ff0b0, alpha: 0.8 });
    },
    pipe(g) {
      g.rect(2, 20, 48, 12).fill(0x2e3e34).stroke({ color: 0x141c18, width: 2 });
      g.rect(2, 44, 48, 10).fill(0x263630).stroke({ color: 0x121a14, width: 2 });
      g.circle(10, 26, 3).fill(0x4fe8a0); g.circle(40, 49, 3).fill(0xffcf6a);
    },
  },
};

// --- Level 6: Pyramid of the Sun — oasis approach, pyramid entrance, royal
// tomb. Sun-baked sand sinking into torch-lit gold; cobalt/teal accents for
// the oasis currents and braziers. Fallback theme for the pyramid map set.
export const level6Theme = {
  tiles: [
    { base: 0x8a6a3a, mid: 0x9a7844, specks: [0xaa8850, 0x6a4c26] },       // oasis sand
    { base: 0x6a5232, mid: 0x7a5f3a, specks: [0x8a6e42, 0x4e3a20] },       // entrance causeway
    { base: 0x4a3626, mid: 0x5a4230, specks: [0x2f6a72, 0x33241a] },       // tomb floor, teal inlay
  ],
  light: [0xfff2d8, 0xffdf9e, 0xffc46a],
  weather: 'none',
  biomeProps: [
    ['palm', 'vase', 'rock', 'palm', 'vase'],
    ['obelisk', 'statue', 'brazier', 'pillar', 'statue'],
    ['statue', 'brazier', 'pillar', 'brazier', 'sarcophagus'],
  ],
  props: {
    palm(g) {
      g.rect(20, 30, 8, 36).fill(0x6a4a22).stroke({ color: 0x4a3014, width: 1 });
      for (const [dx, dy] of [[-14, 8], [14, 8], [-8, 2], [8, 2], [0, 0]]) {
        g.ellipse(24 + dx, 26 + dy, 14, 5).fill(0x3f7a34);
      }
    },
    vase(g) {
      g.ellipse(24, 56, 14, 10).fill(0x2f6a72).stroke({ color: 0x1c4048, width: 2 });
      g.rect(18, 30, 12, 22).fill(0x37909c);
      g.ellipse(24, 30, 9, 5).fill(0x2f6a72).stroke({ color: 0x1c4048, width: 2 });
    },
    rock(g) { g.ellipse(24, 50, 20, 12).fill(0x9a7a4c); g.ellipse(18, 44, 11, 7).fill(0xaa8858); },
    obelisk(g) {
      g.poly([16, 66, 20, 10, 28, 10, 32, 66]).fill(0xb08a4a).stroke({ color: 0x6a4e22, width: 2 });
      g.poly([20, 10, 24, 2, 28, 10]).fill(0xd8a852);
      g.rect(22, 24, 4, 30).fill(0x2f6a72);
    },
    statue(g) {
      g.rect(14, 40, 20, 26).fill(0x5a5a6e).stroke({ color: 0x33333f, width: 2 });
      g.circle(24, 30, 11).fill(0x6a6a7e).stroke({ color: 0x33333f, width: 2 });
      g.circle(20, 29, 2).fill(0x7fe8ff); g.circle(28, 29, 2).fill(0x7fe8ff);
    },
    brazier(g) {
      g.rect(18, 44, 12, 22).fill(0x4a3626).stroke({ color: 0x2a1e14, width: 2 });
      g.ellipse(24, 42, 12, 6).fill(0x33333f);
      g.ellipse(24, 36, 7, 9).fill(0xff9a3a); g.ellipse(24, 38, 4, 6).fill(0xffe08a);
    },
    pillar(g) {
      g.rect(12, 6, 24, 60).fill(0x8a6a3a).stroke({ color: 0x5a421e, width: 2 });
      g.rect(8, 2, 32, 8).fill(0xa07c46); g.rect(8, 60, 32, 8).fill(0xa07c46);
      g.rect(22, 14, 4, 44).fill(0x2f6a72);
    },
    sarcophagus(g) {
      g.roundRect(8, 26, 32, 40, 6).fill(0xb08a4a).stroke({ color: 0x6a4e22, width: 2 });
      g.circle(24, 22, 10).fill(0xc09a52).stroke({ color: 0x6a4e22, width: 2 });
      g.rect(21, 36, 6, 20).fill(0x2f6a72);
    },
  },
};

// Niflheim — mist drowned in indigo night; bone palisades, black ice,
// grave stones and dead trees. Fallback theme for the niflheim map set.
export const level7Theme = {
  tiles: [
    { base: 0x2a3348, mid: 0x35405a, specks: [0x46536e, 0x1c2233] },       // misty valley floor
    { base: 0x232b3d, mid: 0x2d3648, specks: [0x3b475c, 0x161b28] },       // haunted forest loam
    { base: 0x1e2434, mid: 0x28303f, specks: [0x8a94a8, 0x141824] },       // dead town lanes, bone chips
  ],
  light: [0xbdd0ff, 0x8fa4dd, 0x6a7dbb],
  weather: 'snow',
  biomeProps: [
    ['gravestone', 'deadtree', 'rock', 'gravestone', 'deadtree'],
    ['deadtree', 'lantern', 'gravestone', 'fence', 'lantern'],
    ['pillar', 'lantern', 'gravestone', 'tombstone', 'fence'],
  ],
  props: {
    gravestone(g) {
      g.roundRect(14, 36, 20, 30, 4).fill(0x8a94a8).stroke({ color: 0x4a5266, width: 2 });
      g.rect(20, 42, 8, 12).fill(0x4a5266);
    },
    deadtree(g) {
      g.rect(20, 26, 8, 40).fill(0x3a2f28).stroke({ color: 0x241c16, width: 1 });
      g.rect(8, 18, 12, 5).fill(0x3a2f28); g.rect(28, 12, 12, 5).fill(0x3a2f28);
      g.rect(14, 6, 10, 5).fill(0x3a2f28);
    },
    rock(g) { g.ellipse(24, 50, 20, 12).fill(0x5a6478); g.ellipse(18, 44, 11, 7).fill(0x6e7890); },
    lantern(g) {
      g.rect(21, 30, 6, 26).fill(0x2a2030);
      g.roundRect(14, 16, 20, 16, 3).fill(0x3a2c44).stroke({ color: 0x1c1420, width: 2 });
      g.circle(24, 24, 5).fill(0xc9a0ff); g.circle(24, 24, 2).fill(0xffffff);
    },
    fence(g) {
      g.rect(6, 30, 36, 5).fill(0x4a3a30); g.rect(6, 44, 36, 5).fill(0x4a3a30);
      for (const x of [8, 20, 32]) g.rect(x, 22, 5, 32).fill(0x5a4a3e);
    },
    pillar(g) {
      g.rect(12, 6, 24, 60).fill(0x6e7890).stroke({ color: 0x424a5e, width: 2 });
      g.rect(8, 2, 32, 8).fill(0x8a94a8); g.rect(8, 60, 32, 8).fill(0x8a94a8);
    },
    tombstone(g) {
      g.roundRect(10, 20, 28, 46, 10).fill(0x707a8e).stroke({ color: 0x3c4252, width: 2 });
      g.rect(21, 30, 6, 22).fill(0x3c4252);
    },
  },
};

export const THEMES = [level1Theme, level2Theme, level3Theme, level4Theme, level5Theme, level6Theme, level7Theme];
