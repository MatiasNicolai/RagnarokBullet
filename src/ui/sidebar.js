// Right-hand panel, RO style. Solo: portrait, banner, score, lives, skill
// grid, stats. Co-op: shared score on top + one compact block per player.
// All chrome is procedural (Graphics); portraits/banners come from the atlas.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';
import { METER_MAX } from '../sim/sim.js';

export const SIDEBAR_W = 240;

const GOLD = 0xd9a94a;
const GOLD_DARK = 0x8a6a2a;
const NAVY = 0x131a2e;
const NAVY_LIGHT = 0x1b2340;
const TEXT_DIM = 0x9aa4c0;

function header(label) {
  return new Text({
    text: `─◆ ${label} ◆─`,
    style: { fill: GOLD, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 1 },
  });
}

// Real illustrated skill icon (from the atlas) sized into a 40x40 slot; falls
// back to a procedural glyph if the icon sheet is unavailable.
function skillIcon(kind, accent, tex) {
  if (tex) {
    const s = new Sprite(tex);
    s.width = 40; s.height = 40;
    return s;
  }
  const g = new Graphics();
  g.roundRect(0, 0, 40, 40, 6).fill(0x0d1220).stroke({ color: GOLD_DARK, width: 2 });
  if (kind === 0) { // shot: blade
    g.poly([20, 6, 26, 26, 20, 32, 14, 26]).fill(accent);
    g.rect(13, 27, 14, 4).fill(GOLD);
  } else if (kind === 1) { // focus: crosshair
    g.circle(20, 20, 10).stroke({ color: accent, width: 3 });
    g.rect(19, 4, 2, 8).fill(accent).rect(19, 28, 2, 8).fill(accent);
    g.rect(4, 19, 8, 2).fill(accent).rect(28, 19, 8, 2).fill(accent);
  } else if (kind === 2) { // bomb: star
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 6 : 14;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      pts.push(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
    }
    g.poly(pts).fill(accent);
  } else { // special: bolt
    g.poly([24, 5, 12, 22, 19, 22, 15, 35, 28, 17, 21, 17]).fill(accent);
  }
  return g;
}

function heart(scale = 1) {
  const g = new Graphics();
  g.circle(-4 * scale, -3 * scale, 5.5 * scale).fill(0xd8353f);
  g.circle(4 * scale, -3 * scale, 5.5 * scale).fill(0xd8353f);
  g.poly([-9 * scale, 0, 9 * scale, 0, 0, 11 * scale]).fill(0xd8353f);
  g.circle(-4 * scale, -4 * scale, 2 * scale).fill(0xf07a80);
  return g;
}

export class Sidebar {
  constructor(atlas, chars, parent) {
    this.chars = chars;
    this.root = new Container();
    this.root.x = FIELD_W;
    parent.addChild(this.root);

    const bg = new Graphics();
    bg.rect(0, 0, SIDEBAR_W, FIELD_H).fill(NAVY);
    bg.rect(0, 0, 4, FIELD_H).fill(GOLD_DARK);
    bg.roundRect(8, 8, SIDEBAR_W - 16, FIELD_H - 16, 10).stroke({ color: GOLD, width: 2 });
    bg.roundRect(12, 12, SIDEBAR_W - 24, FIELD_H - 24, 8).stroke({ color: GOLD_DARK, width: 1 });
    this.root.addChild(bg);

    const cx = SIDEBAR_W / 2;
    this.playerUI = [];

    if (chars.length === 1) this.buildSolo(atlas, chars[0], cx);
    else this.buildDuo(atlas, chars, cx);

    // footer ornament
    const orn = new Graphics();
    orn.poly([cx - 30, FIELD_H - 28, cx, FIELD_H - 40, cx + 30, FIELD_H - 28, cx, FIELD_H - 22]).fill(GOLD_DARK);
    orn.circle(cx, FIELD_H - 30, 5).fill(0x3f7fe0).stroke({ color: GOLD, width: 1 });
    this.root.addChild(orn);
  }

  // --- shared pieces ---

  scoreBlock(cx, y) {
    const h = header('SCORE');
    h.anchor.set(0.5, 0);
    h.position.set(cx, y);
    this.root.addChild(h);
    y += 20;
    const box = new Graphics();
    box.roundRect(cx - 90, y, 180, 30, 5).fill(0x0d1220).stroke({ color: GOLD_DARK, width: 2 });
    this.root.addChild(box);
    this.scoreText = new Text({
      text: '00000000',
      style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 2 },
    });
    this.scoreText.anchor.set(0.5);
    this.scoreText.position.set(cx, y + 15);
    this.root.addChild(this.scoreText);
    return y + 36;
  }

  meterBar(container, x, y, w, accent) {
    const bg = new Graphics();
    bg.roundRect(x, y, w, 10, 3).fill(0x0d1220).stroke({ color: GOLD_DARK, width: 1 });
    container.addChild(bg);
    const fill = new Graphics();
    container.addChild(fill);
    return { fill, x, y, w, accent };
  }

  drawMeter(m, value, active) {
    m.fill.clear();
    const frac = Math.min(1, value / METER_MAX);
    if (frac > 0) {
      m.fill.roundRect(m.x + 2, m.y + 2, Math.max(3, (m.w - 4) * frac), 6, 2)
        .fill(frac >= 1 ? (active ? 0xffffff : m.accent) : 0x3f7fe0);
    }
  }

  // --- solo layout (full detail) ---

  buildSolo(atlas, char, cx) {
    let y = 26;
    const pf = new Graphics();
    pf.roundRect(cx - 52, y, 104, 104, 8).fill(NAVY_LIGHT).stroke({ color: GOLD, width: 3 });
    pf.roundRect(cx - 46, y + 6, 92, 92, 5).stroke({ color: GOLD_DARK, width: 1 });
    this.root.addChild(pf);
    const art = atlas.characters[char.id];
    const portrait = new Sprite(art.poses.idle);
    portrait.anchor.set(0.5);
    portrait.scale.set(88 / portrait.texture.frame.height);
    portrait.position.set(cx, y + 53);
    this.root.addChild(portrait);
    y += 116;

    const banner = new Sprite(art.banner);
    banner.anchor.set(0.5, 0);
    banner.scale.set(190 / banner.texture.frame.width);
    banner.position.set(cx, y);
    this.root.addChild(banner);
    y += banner.height + 4;

    const cls = new Text({
      text: `✦ ${char.className} ✦`,
      style: { fill: GOLD, fontSize: 13, fontFamily: 'monospace' },
    });
    cls.anchor.set(0.5, 0);
    cls.position.set(cx, y);
    this.root.addChild(cls);
    y += 24;

    y = this.scoreBlock(cx, y);
    const sub = new Text({
      text: '',
      style: { fill: TEXT_DIM, fontSize: 12, fontFamily: 'monospace' },
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, y);
    this.root.addChild(sub);
    y += 20;

    // hearts
    const hearts = [];
    for (let i = 0; i < char.lives; i++) {
      const h = heart();
      h.position.set(cx + (i - (char.lives - 1) / 2) * 34, y + 8);
      this.root.addChild(h);
      hearts.push(h);
    }
    y += 26;

    // skills 2x2
    const keys = ['J', 'K', 'L', 'I'];
    const bombPips = [];
    let meter = null;
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = (i / 2) | 0;
      const slot = new Container();
      slot.position.set(cx - 104 + col * 108, y + row * 88);
      const icon = skillIcon(i, char.accent, atlas.skills?.[char.id]?.[i]);
      icon.x = 30;
      slot.addChild(icon);
      const key = new Text({
        text: keys[i],
        style: { fill: GOLD, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      key.position.set(74, 2);
      slot.addChild(key);
      const nm = new Text({
        text: char.skills[i],
        style: { fill: 0xe8e0cc, fontSize: 11, fontFamily: 'monospace' },
      });
      nm.anchor.set(0.5, 0);
      nm.position.set(50, 44);
      slot.addChild(nm);
      if (i === 2) {
        const bar = new Graphics();
        bar.roundRect(4, 60, 92, 8, 3).fill(0x0d1220).stroke({ color: GOLD_DARK, width: 1 });
        slot.addChild(bar);
        for (let s = 0; s < 3; s++) {
          const pip = new Graphics();
          pip.roundRect(9 + s * 30, 62, 24, 4, 2).fill(GOLD);
          slot.addChild(pip);
          bombPips.push(pip);
        }
      } else if (i === 3) {
        meter = this.meterBar(slot, 4, 59, 92, char.accent);
      } else {
        const bar = new Graphics();
        bar.roundRect(4, 60, 92, 8, 3).fill(0x0d1220).stroke({ color: GOLD_DARK, width: 1 });
        slot.addChild(bar);
        for (let s = 0; s < 5; s++) {
          const seg = new Graphics();
          seg.roundRect(7 + s * 18, 62, 15, 4, 2).fill(0x3f7fe0);
          slot.addChild(seg);
        }
      }
      this.root.addChild(slot);
    }
    y += 182;

    // stats
    const statsH = header('STATS');
    statsH.anchor.set(0.5, 0);
    statsH.position.set(cx, y);
    this.root.addChild(statsH);
    y += 22;
    const rows = [
      ['ATK', char.stats.atk], ['DEF', char.stats.def],
      ['SPD', char.stats.spd], ['MAX HP', char.stats.hp],
    ];
    for (const [label, value] of rows) {
      const l = new Text({ text: label, style: { fill: TEXT_DIM, fontSize: 13, fontFamily: 'monospace' } });
      l.position.set(34, y);
      this.root.addChild(l);
      const v = new Text({
        text: String(value),
        style: { fill: 0xffffff, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      v.anchor.set(1, 0);
      v.position.set(SIDEBAR_W - 34, y);
      this.root.addChild(v);
      y += 20;
    }

    this.playerUI.push({ hearts, bombPips, meter, sub, maxHearts: char.lives });
  }

  // --- duo layout (compact block per player) ---

  buildDuo(atlas, chars, cx) {
    let y = this.scoreBlock(cx, 24) + 8;
    chars.forEach((char, idx) => {
      const art = atlas.characters[char.id];
      const block = new Container();
      block.y = y;
      this.root.addChild(block);

      const frame = new Graphics();
      frame.roundRect(18, 0, SIDEBAR_W - 36, 158, 8).fill(NAVY_LIGHT)
        .stroke({ color: idx === 0 ? GOLD : 0x3f7fe0, width: 2 });
      block.addChild(frame);

      const tag = new Text({
        text: `P${idx + 1}`,
        style: { fill: idx === 0 ? GOLD : 0x7fb3ff, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      tag.position.set(26, 6);
      block.addChild(tag);

      const portrait = new Sprite(art.poses.idle);
      portrait.anchor.set(0.5);
      portrait.scale.set(54 / portrait.texture.frame.height);
      portrait.position.set(52, 42);
      block.addChild(portrait);

      const nm = new Text({
        text: char.name,
        style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      nm.position.set(84, 16);
      block.addChild(nm);
      const cls = new Text({
        text: char.className,
        style: { fill: GOLD, fontSize: 11, fontFamily: 'monospace' },
      });
      cls.position.set(84, 34);
      block.addChild(cls);

      const hearts = [];
      for (let i = 0; i < char.lives; i++) {
        const h = heart(0.7);
        h.position.set(92 + i * 24, 58);
        block.addChild(h);
        hearts.push(h);
      }

      const bombLabel = new Text({
        text: 'BOMBA',
        style: { fill: TEXT_DIM, fontSize: 10, fontFamily: 'monospace' },
      });
      bombLabel.position.set(26, 78);
      block.addChild(bombLabel);
      const bombPips = [];
      for (let s = 0; s < 3; s++) {
        const pip = new Graphics();
        pip.roundRect(78 + s * 30, 80, 24, 5, 2).fill(GOLD);
        block.addChild(pip);
        bombPips.push(pip);
      }

      const espLabel = new Text({
        text: char.skills[3].toUpperCase(),
        style: { fill: TEXT_DIM, fontSize: 10, fontFamily: 'monospace' },
      });
      espLabel.position.set(26, 100);
      block.addChild(espLabel);
      const meter = this.meterBar(block, 26, 114, SIDEBAR_W - 52, char.accent);

      const sub = new Text({
        text: '',
        style: { fill: TEXT_DIM, fontSize: 10, fontFamily: 'monospace' },
      });
      sub.position.set(26, 134);
      block.addChild(sub);

      const downText = new Text({
        text: 'CAÍDO — busca una Yggdrasil Leaf',
        style: { fill: 0xff3b4e, fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      downText.position.set(26, 145);
      downText.visible = false;
      block.addChild(downText);

      this.playerUI.push({ hearts, bombPips, meter, sub, downText, block, maxHearts: char.lives });
      y += 172;
    });
  }

  update(sim) {
    this.scoreText.text = String(sim.score).padStart(8, '0');
    sim.players.forEach((p, i) => {
      const ui = this.playerUI[i];
      if (!p || !ui) return;
      const pulse = p.lives === 1 ? 1 + Math.sin(sim.tick / 6) * 0.18 : 1;
      ui.hearts.forEach((h, k) => { h.visible = k < p.lives; h.scale.set(k === 0 ? pulse : 1); });
      ui.bombPips.forEach((pip, k) => { pip.visible = k < p.bombs; });
      if (ui.meter) {
        const active = p.quicken > 0 || p.cloak > 0 || p.steel > 0 || p.falcon > 0 || p.meteor > 0;
        this.drawMeter(ui.meter, p.meter, active || (sim.tick & 8));
      }
      const spheres = p.char.id === 'viri' ? ` · ✊${p.spheres}` : '';
      ui.sub.text = `GRAZE ${p.graze} · POWER ${p.power + 1}${spheres}`;
      if (ui.downText) ui.downText.visible = p.down;
      if (ui.block) ui.block.alpha = p.down ? 0.55 : 1;
    });
  }
}
