// Render layer for the playfield: reads sim state each frame and mirrors it
// into PixiJS display objects. Strictly one-way (sim -> screen); the sim never
// sees this. Events are routed by the GameScene, which calls onEvent() for
// particle feedback and handles banners/UI itself.
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';
import { LivingBackground } from './background.js';
import { MapBackground } from './mapbackground.js';
import { level1Theme } from './themes.js';
import {
  makeBulletTextures, makeItemTextures, makeEnemyTextures,
  makeOrcHeroTexture, makeDarkLordTexture, makeBaphometTexture,
} from './textures.js';

const PLAYER_HEIGHT = 64;

const BOSS_TEX = {
  'Orc Hero': 'orcHero', 'Dark Lord': 'darkLord', 'Baphomet': 'baphomet', 'Vesper': 'vesper', 'Seyren Windsor': 'seyren', 'Magaleta': 'magaleta', 'Amon-Ra': 'amonRa', 'Loli Ruri': 'loliRuri', 'Lord of Death': 'lordOfDeath',
  'Thanatos': 'thanatos',
  'Odium of Thanatos': 'odium', 'Despero of Thanatos': 'despero', 'Maero of Thanatos': 'maero', 'Dolor of Thanatos': 'dolor',
};
// Summoned memories of past MVPs: a pale violet tint (a tint multiplies, so a
// strong violet would sink dark sprites like Baphomet into the background)
// plus an additive ghost copy that makes them glow.
const ECHO_TINT = 0xe2d4ff;
const FADE_TICKS = 30;      // ttl enemies fade out over their last ticks

// Height of an atlas entry's front idle frame. displayH means "the idle pose
// is this tall on screen"; every other pose keeps the same scale.
function idleHeight(art) {
  const idle = art.down.idle;
  return (Array.isArray(idle) ? idle[0] : idle).frame.height;
}

export class Renderer {
  constructor(app, atlas, parent, theme = level1Theme, mapTextures = null) {
    this.app = app;
    this.atlas = atlas;
    this.world = new Container();
    parent.addChild(this.world);

    this.bg = (mapTextures && mapTextures.length)
      ? new MapBackground(app, this.world, mapTextures)
      : new LivingBackground(app, this.world, theme);

    this.itemLayer = new Container();
    this.enemyLayer = new Container();
    this.bossLayer = new Container();
    this.playerLayer = new Container();
    this.bulletLayer = new Container();       // player shots
    this.enemyBulletLayer = new Container();  // enemy danmaku on top
    this.fxLayer = new Container();
    this.world.addChild(
      this.itemLayer, this.enemyLayer, this.bossLayer, this.playerLayer,
      this.bulletLayer, this.enemyBulletLayer, this.fxLayer,
    );

    const mask = new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill(0xffffff);
    this.world.addChild(mask);
    this.world.mask = mask;

    this.enemyTex = makeEnemyTextures(app.renderer);
    this.bossTex = {
      orcHero: makeOrcHeroTexture(app.renderer),
      darkLord: makeDarkLordTexture(app.renderer),
      baphomet: makeBaphometTexture(app.renderer),
    };
    this.bulletTex = makeBulletTextures(app.renderer);
    this.itemTex = makeItemTextures(app.renderer);
    this.hitboxDots = [];
    this.playerMarkers = [];   // co-op P1/P2 identity markers (ring + tag)
    this.sprites = new WeakMap();

    this.particles = [];
    this.floaters = [];
    this.floaterPool = [];
    this.bombRing = new Graphics();
    this.magnusG = new Graphics();
    this.bombFx = [];               // animated additive bomb sprites (slash/arrow/ki)
    this.bombFxLayer = new Container();
    this.magnusSprite = null;       // persistent cross sprite over Dposada's field
    this.stormG = new Graphics();   // Eric's procedural Storm Gust vortex
    this.storms = [];               // active vortices { x, y, t }
    this.fxLayer.addChild(this.magnusG, this.bombRing, this.stormG, this.bombFxLayer);

    this.bossSprite = null;
  }

  // Late map upgrade: swap the procedural backdrop for the real map set once
  // it finishes warming (GameScene triggers this when entering a level whose
  // maps weren't ready at construction, e.g. an immediate practice jump).
  // One-way and idempotent; both backdrops share the update(biome) shape.
  setMapTextures(mapTextures) {
    if (!mapTextures || !mapTextures.length || this.bg instanceof MapBackground) return false;
    this.world.removeChild(this.bg.root);
    this.bg.root.destroy({ children: true });
    this.bg = new MapBackground(this.app, this.world, mapTextures);
    this.world.removeChild(this.bg.root);
    this.world.addChildAt(this.bg.root, 0);
    return true;
  }

  spriteFor(e, layer) {
    let s = this.sprites.get(e);
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      s.roundPixels = true;   // snap to integer pixels -> no subpixel shimmer
      this.sprites.set(e, s);
      layer.addChild(s);
    }
    s.visible = true;
    return s;
  }

  spawnFloat(x, y, str, color = 0xffffff) {
    const t = this.floaterPool.pop() ?? new Text({
      text: '', style: { fill: 0xffffff, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } },
    });
    t.text = str; t.style.fill = color; t.anchor.set(0.5);
    t.position.set(x, y); t.alpha = 1; t.visible = true;
    if (!t.parent) this.fxLayer.addChild(t);
    this.floaters.push({ t, life: 40 });
  }

  burst(x, y, color, n = 6, speed = 2.5) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5); s.width = s.height = 4; s.tint = color;
      s.position.set(x, y);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.fxLayer.addChild(s);
      this.particles.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 24 });
    }
  }

  // Play a one-shot animated bomb FX (a class's 4-frame strip) at (x,y), drawn
  // additively so its black background reads as transparent. opts: size (px),
  // dur (ticks), tint, rot, spin, vx/vy (drift), grow (extra scale over life).
  playBombFx(frames, opts = {}) {
    if (!frames || !frames.length) return;
    const s = new Sprite(frames[0]);
    s.anchor.set(0.5);
    s.roundPixels = true;
    s.blendMode = 'add';
    s.position.set(opts.x ?? 0, opts.y ?? 0);
    s.rotation = opts.rot ?? 0;
    const px = opts.size ?? 220;
    s.scale.set(px / frames[0].frame.height);
    if (opts.tint != null) s.tint = opts.tint;
    this.bombFxLayer.addChild(s);
    this.bombFx.push({ s, frames, t: 0, dur: opts.dur ?? 30, vx: opts.vx ?? 0, vy: opts.vy ?? 0, spin: opts.spin ?? 0, grow: opts.grow ?? 0, basePx: px });
  }

  // Particle/floater feedback for a sim event. Banners/UI are the scene's job.
  onEvent(ev) {
    const ITEM_LABEL = {
      zeny: '+500z', gem: 'POWER ▲', potion: '♥ +1', leaf: '¡REVIVE!', chest: '',
      awakening: 'AWAKENING!', speed: 'SPEED!', kafra: 'GUARDIA', card: '¡CARTA!',
    };
    switch (ev.type) {
      case 'kill':
        this.burst(ev.x, ev.y, 0xffa0b4, 8, 3);
        if (ev.value) this.spawnFloat(ev.x, ev.y - 10, `+${ev.value}`, 0xfff2b0);
        break;
      case 'graze': this.burst(ev.x, ev.y, 0xffffff, 2, 1.5); break;
      case 'item': {
        const COL = { gem: 0x7fb3ff, awakening: 0xf2d24a, speed: 0x4ad06a, kafra: 0x7fb3ff, card: 0xffd24a };
        this.burst(ev.x, ev.y, COL[ev.kind] ?? 0xf2c14e, ev.kind === 'card' ? 16 : 5, ev.kind === 'card' ? 4 : 2);
        const label = ITEM_LABEL[ev.kind];
        if (label) this.spawnFloat(ev.x, ev.y - 12, label, COL[ev.kind] ?? 0xf2c14e);
        break;
      }
      case 'shieldBreak': this.burst(ev.x, ev.y, 0x7fb3ff, 18, 4); this.spawnFloat(ev.x, ev.y - 14, '¡GUARDIA!', 0x7fb3ff); break;
      case 'chest': this.burst(ev.x, ev.y, 0xf2c14e, 20, 4); this.spawnFloat(ev.x, ev.y - 14, '¡TESORO!', 0xf2c14e); break;
      case 'mimic': this.burst(ev.x, ev.y, 0xc95bff, 26, 5); this.spawnFloat(ev.x, ev.y - 14, '¡¡MIMIC!!', 0xc95bff); break;
      case 'death': this.burst(ev.x, ev.y, 0xff3b4e, 20, 4); break;
      case 'downed': this.spawnFloat(ev.x, ev.y - 20, 'P' + (ev.index + 1) + ' CAÍDO', 0xff3b4e); break;
      case 'revive': this.burst(ev.x, ev.y, 0x6fce5a, 24, 4); this.spawnFloat(ev.x, ev.y - 20, '¡DE VUELTA!', 0x6fce5a); break;
      case 'bomb': {
        this.burst(ev.x, ev.y, 0xfff2b0, 22, 5); // universal clear flash
        const slash = this.atlas.bombs?.aramir;
        // Aramir's Bowling Bash: a big golden slash sweep. Zeos's Meteor Assault
        // reuses the same slash, tinted violet and spun the other way.
        if (ev.id === 'aramir') this.playBombFx(slash, { x: ev.x, y: ev.y, size: 260, dur: 30, spin: 0.05, grow: 0.25 });
        else if (ev.id === 'zeos') this.playBombFx(slash, { x: ev.x, y: ev.y, size: 240, dur: 28, tint: 0xc98bff, rot: Math.PI, spin: -0.06, grow: 0.25 });
        break;
      }
      case 'special': this.burst(ev.x, ev.y, 0xffffff, 16, 4); break;
      case 'meteor': this.burst(ev.x, ev.y, 0xff9430, 14, 4); break;
      case 'falcon': this.burst(ev.x, ev.y, 0x8fb5ff, 3, 2); break;
      case 'stormgust': this.burst(ev.x, ev.y, 0x9fd8ff, 18, 5); this.storms.push({ x: ev.x, y: ev.y, t: 0 }); break;
      case 'arrowstorm': {
        // Chel's Arrow Storm: a volley raining straight down across the field.
        const arrow = this.atlas.bombs?.chel_snip;
        this.burst(ev.x, ev.y, 0x8fb5ff, 16, 5);
        for (let k = 0; k < 11; k++) {
          this.playBombFx(arrow, {
            x: 30 + Math.random() * (FIELD_W - 60),
            y: -60 - Math.random() * 260,           // staggered above the screen
            size: 130, dur: 30, vy: 15 + Math.random() * 4,
          });
        }
        break;
      }
      case 'sanctuary': this.burst(ev.x, ev.y, 0x6fce5a, 30, 5); break;
      case 'asura': {
        // Viri's Asura Strike: a ki column erupting upward, scaled by spirit spheres.
        const ki = this.atlas.bombs?.viri;
        const size = 220 + ev.spheres * 46;
        this.playBombFx(ki, { x: ev.x, y: ev.y - size * 0.22, size, dur: 34, grow: 0.15 });
        this.burst(ev.x, ev.y - 40, 0xff7a55, 20 + ev.spheres * 4, 7);
        break;
      }
      case 'summon': this.burst(ev.x, ev.y, 0x9f6aff, 24, 5); break;
      case 'heal': this.burst(ev.x, ev.y, 0x6fce5a, 14, 3); this.spawnFloat(ev.x, ev.y - 16, '+CURA', 0x6fce5a); break;
      case 'telegraph': this.burst(ev.x, ev.y, ev.color ?? 0xffffff, 12, 2); break;
      case 'bossForm': this.burst(ev.x, ev.y, 0xe6d0ff, 80, 10); break;
      case 'bossPhase': this.burst(ev.x, ev.y, 0xffffff, 40, 8); break;
      case 'bossExplode': this.burst(ev.x, ev.y, 0xffb060, 14, 4); break;
      case 'bossDown': this.burst(ev.x, ev.y, 0xfff2b0, 60, 9); break;
      default: break;
    }
  }

  bulletTexture(skin) {
    const [charName, idx] = skin.split(':');
    const c = this.atlas.characters[charName];
    return c?.projectiles[Math.min(+idx, c.projectiles.length - 1)] ?? Texture.WHITE;
  }

  playerPose(p) {
    const poses = this.atlas.characters[p.char.id].poses;
    // Default facing is UP (the way the field scrolls) — you fly forward into
    // the level, showing your back. The down-facing poses only appear while
    // actively descending, so a still or advancing character never looks like
    // it's walking backwards against the scroll.
    const down = p.vy > 0.01;
    if (Math.abs(p.vx) > 0.01) {
      if (down) return p.vx < 0 ? poses.moveL : poses.moveR;
      return p.vx < 0 ? poses.upMoveL : poses.upMoveR;
    }
    return down ? poses.idle : poses.upIdle;
  }

  sync(sim) {
    this.bg.update(sim.biome);

    const coop = sim.players.filter(Boolean).length > 1;
    for (const p of sim.players) {
      if (!p) continue;
      if (p.down) {
        const hidden = this.sprites.get(p);
        if (hidden) hidden.visible = false;
        const d = this.hitboxDots[p.index];
        if (d) d.visible = false;
        const mk = this.playerMarkers[p.index];
        if (mk) mk.root.visible = false;
        continue;
      }
      const s = this.spriteFor(p, this.playerLayer);
      const tex = this.playerPose(p);
      if (s.texture !== tex) { s.texture = tex; s.scale.set(PLAYER_HEIGHT / tex.frame.height); }
      s.position.set(p.x, p.y);
      s.alpha = p.iframes > 0 && (sim.tick & 4) ? 0.35 : 1;
      if (p.cloak > 0) s.alpha = 0.4;
      s.tint = p.steel > 0 ? 0xffd27f : (p.shield > 0 ? 0x9fc0ff : 0xffffff);

      let dot = this.hitboxDots[p.index];
      if (!dot) {
        dot = new Graphics();
        dot.circle(0, 0, p.hitR).fill(0xffffff).circle(0, 0, Math.max(1, p.hitR - 2)).fill(0xff3355);
        this.enemyBulletLayer.addChild(dot);
        this.hitboxDots[p.index] = dot;
      }
      // always show the hitbox point — subtle while unfocused, full in focus —
      // so you never lose track of your true vulnerable pixel mid-dodge.
      dot.visible = true;
      dot.alpha = p.focused ? 1 : 0.55;
      dot.position.set(p.x, p.y);

      // co-op identity marker: a colored ground ring + P1/P2 tag (gold P1 /
      // blue P2, matching the lobby and sidebar) so you can tell the two apart.
      if (coop) {
        let mk = this.playerMarkers[p.index];
        if (!mk) { mk = this.makePlayerMarker(p.index); this.playerMarkers[p.index] = mk; }
        mk.root.visible = true;
        mk.root.position.set(p.x, p.y);
        mk.ring.alpha = (p.focused ? 1 : 0.7) * (p.iframes > 0 && (sim.tick & 4) ? 0.4 : 1);
      } else {
        const mk = this.playerMarkers[p.index];
        if (mk) mk.root.visible = false;
      }
    }

    for (const e of sim.enemies.active) {
      const s = this.spriteFor(e, this.enemyLayer);
      // dissolving (ttl) enemies fade out over their last ticks
      const fade = e.ttl > 0 ? Math.max(0, Math.min(1, (e.ttl - e.t) / FADE_TICKS)) : 1;
      const echoArt = e.echo ? this.atlas.bosses?.[e.echo] : null;
      const mon = this.atlas.monsters?.[e.skin];
      if (!echoArt && s.echoGlow) s.echoGlow.visible = false; // pooled sprite back to a normal enemy
      if (echoArt) {
        // echo of a past MVP: that boss's own sprite, tinted and translucent
        const frames = e.tele > 0 ? echoArt.down.attack : echoArt.down.idle;
        const tex = frames[((e.t / 9) | 0) % frames.length];
        if (s.baseTex !== tex) { s.texture = tex; s.baseTex = tex; }
        s.tint = ECHO_TINT;
        s.position.set(e.x, e.y + Math.sin(e.t / 14) * 3);
        const vis = Math.min(1, e.t / 20) * fade;
        s.alpha = (e.hitFlash > 0 ? 0.6 : 0.85) * vis;
        // a smaller copy of the boss: same proportion of its displayH, if any
        const scale = echoArt.displayH ? (echoArt.displayH * 0.62) / idleHeight(echoArt) : (e.r * 2.7) / tex.frame.height;
        s.scale.set(scale, scale);
        // additive violet ghost on top: the "memory" glow
        if (!s.echoGlow) {
          s.echoGlow = new Sprite(); s.echoGlow.anchor.set(0.5); s.echoGlow.blendMode = 'add';
          s.echoGlow.tint = 0x9a6aff; s.addChild(s.echoGlow);
        }
        s.echoGlow.visible = true;
        s.echoGlow.texture = tex;
        s.echoGlow.alpha = 0.35 + 0.15 * Math.sin(e.t / 8);
      } else if (mon) {
        // real animated sprite: pick frame by facing + state. Some mid-boss
        // sheets have an incomplete "up" pose set (e.g. missing one strafe
        // direction), so fall back to idle rather than an undefined texture.
        const set = e.vy < -0.3 ? mon.up : mon.down;
        let tex;
        if (e.hitFlash > 0) tex = set.hit;
        else if (e.tele > 0) tex = set.attack;
        else if (e.vx < -0.3) tex = set.moveL ?? set.idle;
        else if (e.vx > 0.3) tex = set.moveR ?? set.idle;
        else tex = set.idle;
        // animated poses (mid-bosses) are frame arrays — cycle them; static
        // mobs are a single texture used directly.
        if (Array.isArray(tex)) tex = tex[((e.t / 9) | 0) % tex.length];
        if (s.baseTex !== tex) { s.texture = tex; s.baseTex = tex; }
        s.tint = e.frozen > 0 ? 0x9fd8ff : (e.poison > 0 ? 0xa9f09a : 0xffffff);
        // gentle idle bob for liveliness
        const bob = Math.sin(e.t / 12) * 2;
        s.position.set(e.x, e.y + bob);
        s.alpha = (e.hitFlash > 0 ? 0.85 : 1) * fade;
        // displayH art: one scale for every pose (from idle), so squash /
        // stretch and raised weapons read as drawn; older art normalizes
        // each pose to the same height, as before
        const scale = mon.displayH ? mon.displayH / idleHeight(mon) : (e.r * 2.7) / tex.frame.height;
        s.scale.set(scale, scale);
      } else {
        // procedural placeholder blob (drops / fabre / lunatic / mastering)
        const tex = this.enemyTex[e.skin] ?? this.enemyTex.poring;
        if (s.baseTex !== tex) { s.texture = tex; s.baseTex = tex; }
        if (e.frozen > 0) s.tint = 0x9fd8ff;
        else if (e.poison > 0) s.tint = 0xa9f09a;
        else if (e.tele > 0 && (e.tele & 2)) s.tint = 0xffffff;
        else s.tint = 0xffffff;
        s.position.set(e.x, e.y);
        s.alpha = (e.hitFlash > 0 ? 0.6 : 1) * fade;
        const base = (e.r * 2.3) / tex.frame.height;
        const ph = (e.t % 40) / 40;
        let squash = 1 + Math.sin(ph * Math.PI * 2) * 0.06;
        if (e.tele > 0) squash += 0.12 * (1 - e.tele / 20);
        if (e.frozen > 0) squash = 1;
        s.scale.set(base * squash, base / squash);
      }
    }

    this.syncBoss(sim);

    for (const b of sim.bullets.active) {
      const s = this.spriteFor(b, this.bulletLayer);
      const tex = this.bulletTexture(b.skin);
      if (s.texture !== tex) { s.texture = tex; s.blendMode = 'add'; s.scale.set(28 / tex.frame.height); }
      s.position.set(b.x, b.y);
      s.rotation = Math.atan2(b.vy, b.vx);
    }

    for (const b of sim.enemyBullets.active) {
      const s = this.spriteFor(b, this.enemyBulletLayer);
      const tex = this.bulletTex[b.color] ?? this.bulletTex.red;
      if (s.texture !== tex) { s.texture = tex; s.scale.set(1); }
      s.position.set(b.x, b.y);
      if (b.spin) s.rotation += b.spin;
    }

    for (const it of sim.items.active) {
      const s = this.spriteFor(it, this.itemLayer);
      const frames = this.atlas.items?.[it.kind];
      if (frames) {
        // real animated pickup: cycle frames, scale by a fixed reference height
        // (the item's tallest frame) so a spinning card thins in place instead
        // of resizing. No wobble — the frames are the animation.
        const tex = frames[((sim.tick / 7) | 0) % frames.length];
        if (s.baseTex !== tex) {
          s.texture = tex; s.baseTex = tex;
          s.anchor.set(0.5);
          this._itemRefH ??= {};
          const refH = this._itemRefH[it.kind] ??= Math.max(...frames.map((f) => f.frame.height));
          s.scale.set(34 / refH);
        }
        s.rotation = 0;
        s.position.set(it.x, it.y);
      } else {
        const tex = this.itemTex[it.kind] ?? this.itemTex.zeny;
        if (s.texture !== tex) { s.texture = tex; s.baseTex = tex; s.scale.set(1); }
        s.position.set(it.x, it.y);
        s.rotation = Math.sin(sim.tick / 12 + it.x) * 0.25;
      }
    }

    this.bombRing.clear();
    if (sim.lastBomb) {
      const age = sim.tick - sim.lastBomb.tick;
      if (age < 40) {
        const rr = 30 + age * 22;
        this.bombRing.circle(sim.lastBomb.x, sim.lastBomb.y, rr)
          .stroke({ color: 0xfff2b0, width: 10 * (1 - age / 40), alpha: 1 - age / 40 });
      }
    }

    this.magnusG.clear();
    if (sim.magnus) {
      // faint ring marks the actual damage radius (130) so the safe zone reads
      const pulse = 1 + Math.sin(sim.magnus.t / 5) * 0.06;
      const alpha = sim.magnus.t > 150 ? (180 - sim.magnus.t) / 30 : 1;
      this.magnusG.circle(sim.magnus.x, sim.magnus.y, 130 * pulse)
        .fill({ color: 0xffe08a, alpha: 0.08 * alpha }).stroke({ color: 0xffe08a, width: 2, alpha: 0.4 * alpha });
      // Dposada's Magnus Exorcismus: the holy cross sigil looping over the field
      const cross = this.atlas.bombs?.dposada;
      if (cross) {
        if (!this.magnusSprite) {
          this.magnusSprite = new Sprite(cross[0]);
          this.magnusSprite.anchor.set(0.5); this.magnusSprite.blendMode = 'add';
          this.bombFxLayer.addChild(this.magnusSprite);
        }
        const seq = [0, 1, 2, 3, 2, 1];
        this.magnusSprite.texture = cross[seq[Math.floor(sim.magnus.t / 7) % seq.length]];
        this.magnusSprite.position.set(sim.magnus.x, sim.magnus.y);
        this.magnusSprite.scale.set((300 * pulse) / cross[0].frame.height);
        this.magnusSprite.alpha = Math.max(0, alpha);
        this.magnusSprite.visible = true;
      }
    } else if (this.magnusSprite) {
      this.magnusSprite.visible = false;
    }

    // animated bomb FX (slash / arrow rain / ki column): advance frames, drift, fade
    for (let i = this.bombFx.length - 1; i >= 0; i--) {
      const fx = this.bombFx[i];
      fx.t++;
      const prog = fx.t / fx.dur;
      const fi = Math.min(fx.frames.length - 1, Math.floor(prog * fx.frames.length));
      if (fx.s.texture !== fx.frames[fi]) fx.s.texture = fx.frames[fi];
      fx.s.x += fx.vx; fx.s.y += fx.vy; fx.s.rotation += fx.spin;
      if (fx.grow) fx.s.scale.set((fx.basePx * (1 + prog * fx.grow)) / fx.frames[0].frame.height);
      fx.s.alpha = prog > 0.7 ? Math.max(0, 1 - (prog - 0.7) / 0.3) : 1;
      if (fx.t >= fx.dur) { fx.s.destroy(); this.bombFx.splice(i, 1); }
    }

    // Eric's Storm Gust: a procedural ice vortex — concentric frost rings +
    // snow spiralling inward + a cold tint + an outburst flash. Freezing itself
    // is handled in the sim; this is the readable "blizzard" flourish.
    this.stormG.clear();
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const st = this.storms[i]; st.t++;
      const t = st.t, DUR = 58;
      const fade = t > 42 ? Math.max(0, (DUR - t) / (DUR - 42)) : 1;
      const rad = t < 16 ? 8 + t * 1.6 : 40 + (t - 16) * 5.2;
      // cold screen tint (ramps in, then fades)
      const tint = 0.12 * fade * (t < 8 ? t / 8 : 1);
      if (tint > 0.002) this.stormG.rect(0, 0, FIELD_W, FIELD_H).fill({ color: 0x8fd0ff, alpha: tint });
      // concentric frost rings
      for (let ri = 0; ri < 4; ri++) {
        const rr = rad * (0.5 + ri * 0.17);
        if (rr < 3) continue;
        const a = (0.55 - ri * 0.08) * fade * (0.7 + 0.3 * Math.sin(t * 0.4 + ri));
        this.stormG.circle(st.x, st.y, rr).stroke({ color: ri % 2 ? 0xbfeeff : 0x6fc8ff, width: 2.2, alpha: Math.max(0, a) });
      }
      // snow spiralling inward
      for (let k = 0; k < 26; k++) {
        const ang = k * 0.55 + t * 0.13;
        const r = rad * (0.35 + (k % 7) / 7 * 0.7);
        const sx = st.x + Math.cos(ang) * r, sy = st.y + Math.sin(ang) * r * 0.9;
        this.stormG.rect(sx - 1.5, sy - 1.5, 3, 3).fill({ color: 0xe6f8ff, alpha: 0.7 * fade });
      }
      // outburst flash
      if (t >= 30 && t <= 40) this.stormG.circle(st.x, st.y, rad).fill({ color: 0xd8f4ff, alpha: (40 - t) / 40 * 0.22 });
      if (t >= DUR) this.storms.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.s.x += pt.vx; pt.s.y += pt.vy; pt.life--;
      pt.s.alpha = pt.life / 24;
      if (pt.life <= 0) { pt.s.destroy(); this.particles.splice(i, 1); }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t.y -= 0.9; f.life--;
      f.t.alpha = Math.min(1, f.life / 20);
      if (f.life <= 0) { f.t.visible = false; this.floaterPool.push(f.t); this.floaters.splice(i, 1); }
    }

    for (const pool of [sim.bullets, sim.enemies, sim.enemyBullets, sim.items]) {
      for (const e of pool.free) { const s = this.sprites.get(e); if (s) s.visible = false; }
    }
  }

  // A per-player identity marker for co-op: a colored ellipse at the feet plus
  // a small "P1"/"P2" tag above the head. Added to the player layer once.
  makePlayerMarker(index) {
    const color = index === 0 ? 0xf2c14e : 0x5aa0ff; // gold P1 / blue P2
    const root = new Container();
    const ring = new Graphics();
    ring.ellipse(0, PLAYER_HEIGHT * 0.42, 18, 7)
      .stroke({ color, width: 2.5, alpha: 0.9 })
      .ellipse(0, PLAYER_HEIGHT * 0.42, 18, 7)
      .fill({ color, alpha: 0.14 });
    root.addChild(ring);
    const tag = new Text({
      text: `P${index + 1}`,
      style: { fill: color, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } },
    });
    tag.anchor.set(0.5, 1);
    tag.position.set(0, -PLAYER_HEIGHT * 0.5);
    root.addChild(tag);
    this.playerLayer.addChild(root);
    return { root, ring, tag };
  }

  syncBoss(sim) {
    this.bossSprites ??= [];       // one sprite per active boss (dual-boss ready)
    this.bossRenderX ??= new WeakMap();
    const list = sim.bosses;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      let s = this.bossSprites[i];
      if (!s) { s = new Sprite(); s.anchor.set(0.5); s.roundPixels = true; this.bossLayer.addChild(s); this.bossSprites[i] = s; }
      // a card may name its own sprite (`form`): Thanatos switches from his
      // armored form to the awakened one inside the same fight
      const key = b.def.cards[b.cardIndex]?.form ?? BOSS_TEX[b.name] ?? 'orcHero';
      const art = this.atlas.bosses?.[key];
      let tex;
      if (art) {
        // real animated sprite: pose set by state (attack during phase change /
        // death throes, telegraph wind-up, strafe while sweeping, else idle),
        // frames cycled. The telegraph mirrors the enemy e.tele treatment.
        const prev = this.bossRenderX.get(b);
        const dx = prev == null ? 0 : b.x - prev;
        let frames;
        if (b.transition > 0 || b.dying > 0) frames = art.down.attack;
        else if (b.tele > 0) frames = art.down.attack;
        else if (dx < -0.5) frames = art.down.moveL;
        else if (dx > 0.5) frames = art.down.moveR;
        else frames = art.down.idle;
        tex = frames[((sim.tick / 9) | 0) % frames.length];
      } else {
        tex = this.bossTex[key] ?? this.bossTex.orcHero; // procedural fallback
      }
      this.bossRenderX.set(b, b.x);
      // displayH art (Bosses V3): one scale for every pose, taken from idle,
      // so raised weapons extend beyond the body instead of shrinking it
      if (s.texture !== tex) { s.texture = tex; s.scale.set(art?.displayH ? art.displayH / idleHeight(art) : (b.r * 2.9) / tex.frame.height); }
      s.visible = true;
      s.alpha = b.hitFlash > 0 ? 0.7 : 1;
      const bob = Math.sin(sim.tick / 20 + i) * 3;
      s.position.set(b.x, b.y + bob + (b.dying > 0 ? Math.sin(sim.tick) * 4 : 0));
    }
    for (let i = list.length; i < this.bossSprites.length; i++) if (this.bossSprites[i]) this.bossSprites[i].visible = false;
  }

  destroy() {
    // container children are destroyed by the scene; nothing extra to release
  }
}
