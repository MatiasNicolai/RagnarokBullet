// Living background: scrolling multi-layer parallax whose biome crossfades as
// the level advances, decorated with side-band props and an evolving light
// tint, plus optional weather (rain + lightning). Theme-driven (see themes.js).
// Render-only and cosmetic — may use Math.random, never touches the sim.
import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';

function tileTexture(renderer, spec) {
  const g = new Graphics();
  g.rect(0, 0, 64, 64).fill(spec.base);
  g.rect(0, 0, 64, 32).fill(spec.mid);
  for (let i = 0; i < 16; i++) {
    const x = (i * 37) % 64, y = (i * 23) % 64;
    g.rect(x, y, 3, 3).fill(spec.specks[i % spec.specks.length]);
  }
  return renderer.generateTexture(g);
}

function propTextures(renderer, theme) {
  const out = {};
  for (const [name, draw] of Object.entries(theme.props)) {
    const g = new Graphics();
    draw(g);
    out[name] = renderer.generateTexture(g);
  }
  return out;
}

export class LivingBackground {
  constructor(app, parent, theme) {
    this.app = app;
    this.theme = theme;
    this.root = new Container();
    parent.addChild(this.root);
    const r = app.renderer;

    this.layers = theme.tiles.map((spec) =>
      new TilingSprite({ texture: tileTexture(r, spec), width: FIELD_W, height: FIELD_H }));
    for (const l of this.layers) this.root.addChild(l);

    this.propLayer = new Container();
    this.root.addChild(this.propLayer);

    this.light = new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill(0xffffff);
    this.light.blendMode = 'multiply';
    this.root.addChild(this.light);

    this.propTex = propTextures(r, theme);
    this.propNames = Object.keys(this.propTex);
    this.active = [];
    this.pool = [];
    this.scroll = 0;
    this.sinceSpawn = 0;

    // ambient motes
    this.motes = [];
    const mote = new Graphics().rect(0, 0, 3, 3).fill(0xffffff);
    this.moteTex = r.generateTexture(mote);
    for (let i = 0; i < 16; i++) {
      const s = new Sprite(this.moteTex);
      s.alpha = 0.22; s.x = Math.random() * FIELD_W; s.y = Math.random() * FIELD_H;
      s.vy = 0.6 + Math.random() * 0.9; s.vx = -0.3 + Math.random() * 0.6;
      this.root.addChild(s); this.motes.push(s);
    }

    // weather: rain overlay + lightning flash
    this.weather = theme.weather ?? 'none';
    if (this.weather === 'rain') {
      this.rain = [];
      const drop = new Graphics().rect(0, 0, 2, 12).fill(0xbcd0e8);
      this.dropTex = r.generateTexture(drop);
      for (let i = 0; i < 90; i++) {
        const s = new Sprite(this.dropTex);
        s.alpha = 0.35; s.x = Math.random() * FIELD_W; s.y = Math.random() * FIELD_H;
        s.vy = 14 + Math.random() * 8;
        this.root.addChild(s); this.rain.push(s);
      }
      this.flash = new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill(0xffffff);
      this.flash.alpha = 0; this.root.addChild(this.flash);
      this.flashT = 0; this.nextBolt = 120 + Math.random() * 240;
    }
  }

  biomeIndex(biome) { return Math.min(2, Math.floor(biome * 2 + 0.0001)); }

  spawnProp(biome) {
    const bi = this.biomeIndex(biome);
    const list = this.theme.biomeProps[bi];
    const kind = list[(Math.random() * list.length) | 0];
    const s = this.pool.pop() ?? new Sprite();
    s.texture = this.propTex[kind];
    s.anchor.set(0.5, 1);
    s.visible = true;
    const wide = kind === 'house' || kind === 'tent' || kind === 'shelf';
    const margin = wide ? 4 : 10;
    const left = Math.random() < 0.5;
    s.x = left ? margin + Math.random() * 70 : FIELD_W - margin - Math.random() * 70;
    s.y = -10;
    s.scale.set(0.8 + Math.random() * 0.5);
    if (!s.parent) this.propLayer.addChild(s);
    this.active.push(s);
  }

  update(biome, dt = 1) {
    const speed = 1.2 * dt;
    this.scroll += speed;
    for (const l of this.layers) l.tilePosition.y = this.scroll;

    const seg = biome * 2;
    this.layers[0].alpha = 1;
    this.layers[1].alpha = Math.max(0, Math.min(1, seg));
    this.layers[2].alpha = Math.max(0, Math.min(1, seg - 1));

    const bi = Math.min(1, biome) * 2;
    const a = this.theme.light[Math.floor(bi)] ?? 0xffffff;
    const b = this.theme.light[Math.ceil(bi)] ?? a;
    this.light.tint = lerpColor(a, b, bi - Math.floor(bi));

    this.sinceSpawn += speed;
    if (this.sinceSpawn > 70) { this.sinceSpawn = 0; this.spawnProp(biome); }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.y += speed;
      if (s.y - s.height > FIELD_H + 40) { s.visible = false; this.active.splice(i, 1); this.pool.push(s); }
    }

    for (const m of this.motes) {
      m.y += m.vy * dt; m.x += m.vx * dt;
      if (m.y > FIELD_H) { m.y = -4; m.x = Math.random() * FIELD_W; }
    }

    if (this.weather === 'rain') this.updateRain(dt);
  }

  updateRain(dt) {
    for (const s of this.rain) {
      s.y += s.vy * dt; s.x -= 1.5 * dt;
      if (s.y > FIELD_H) { s.y = -12; s.x = Math.random() * (FIELD_W + 60); }
    }
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) { this.flashT = 8; this.nextBolt = 150 + Math.random() * 360; }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.alpha = Math.max(0, this.flashT / 8) * 0.5; }
  }
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = (ar + (br - ar) * t) | 0, g = (ag + (bg - ag) * t) | 0, bl = (ab + (bb - ab) * t) | 0;
  return (r << 16) | (g << 8) | bl;
}
