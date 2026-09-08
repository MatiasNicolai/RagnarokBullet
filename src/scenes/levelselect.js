// Direct level select (review mode): pick a character, then any campaign
// level from LEVELS, and play that whole level from its start with fresh
// score/carry. Completing or losing never advances the campaign and never
// submits a high score — the run always returns to this selector.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { ROSTER } from '../characters/index.js';
import { LEVELS } from '../levels/index.js';
import { audio } from '../engine/audio.js';

const GOLD = 0xf2c14e;

export class LevelSelectScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.container = new Container();
    const W = ctx.app.renderer.width, H = ctx.app.renderer.height, cx = W / 2;

    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(0x0b1020);
    this.container.addChild(bg);

    this.heading = new Text({
      text: '', style: { fill: GOLD, fontSize: 26, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } },
    });
    this.heading.anchor.set(0.5); this.heading.position.set(cx, 54);
    this.container.addChild(this.heading);

    // character row (one of the six ROSTER characters)
    this.charCards = [];
    const cw = 120, gap = 16, total = ROSTER.length * cw + (ROSTER.length - 1) * gap;
    const x0 = (W - total) / 2;
    ROSTER.forEach((ch, i) => {
      const card = new Container();
      card.position.set(x0 + i * (cw + gap), 100);
      const fr = new Graphics();
      fr.roundRect(0, 0, cw, 150, 8).fill(0x1b2340).stroke({ color: 0x39415e, width: 2 });
      card.addChild(fr);
      const spr = new Sprite(ctx.atlas.characters[ch.id].poses.idle);
      spr.anchor.set(0.5); spr.scale.set(90 / spr.texture.frame.height); spr.position.set(cw / 2, 62);
      card.addChild(spr);
      const nm = new Text({ text: ch.name, style: { fill: 0xffffff, fontSize: 13, fontFamily: 'monospace' } });
      nm.anchor.set(0.5, 0); nm.position.set(cw / 2, 118); card.addChild(nm);
      const cur = new Graphics(); cur.roundRect(-3, -3, cw + 6, 156, 10).stroke({ color: GOLD, width: 4 }); cur.visible = false;
      card.addChild(cur);
      this.container.addChild(card);
      this.charCards.push({ cur });
    });

    // level row: one card per LEVELS entry (the single source of truth —
    // no duplicate registry, no hardcoded level count). Card width derives
    // from LEVELS.length so all seven cards plus their selection strokes
    // fit in one row within the renderer width W.
    this.levelCards = [];
    const levelGap = 8, levelMargin = 16, levelMax = 128, levelMin = 80;
    const bw = Math.max(levelMin, Math.min(levelMax,
      Math.floor((W - levelMargin * 2 - (LEVELS.length - 1) * levelGap) / LEVELS.length)));
    const btotal = LEVELS.length * bw + (LEVELS.length - 1) * levelGap;
    const bx0 = (W - btotal) / 2;
    LEVELS.forEach((lv, i) => {
      const card = new Container();
      card.position.set(bx0 + i * (bw + levelGap), 290);
      const fr = new Graphics();
      fr.roundRect(0, 0, bw, 120, 8).fill(0x1a2a1a).stroke({ color: 0x3a5a3a, width: 2 });
      card.addChild(fr);
      const num = new Text({ text: lv.title, style: { fill: GOLD, fontSize: 19, fontFamily: 'Georgia, serif', fontWeight: 'bold' } });
      num.anchor.set(0.5); num.position.set(bw / 2, 30); card.addChild(num);
      const nm = new Text({ text: lv.name, style: { fill: 0xd8dcea, fontSize: 11, fontFamily: 'monospace', wordWrap: true, wordWrapWidth: bw - 12, align: 'center' } });
      nm.anchor.set(0.5); nm.position.set(bw / 2, 62); card.addChild(nm);
      const cur = new Graphics(); cur.roundRect(-3, -3, bw + 6, 126, 10).stroke({ color: GOLD, width: 4 }); cur.visible = false;
      card.addChild(cur);
      this.container.addChild(card);
      this.levelCards.push({ cur });
    });

    this.info = new Text({ text: '', style: { fill: 0xd8dcea, fontSize: 14, fontFamily: 'monospace', align: 'center' } });
    this.info.anchor.set(0.5); this.info.position.set(cx, H - 66);
    this.container.addChild(this.info);

    const hint = new Text({ text: '←→ elegir · ENTER confirmar · ESC volver', style: { fill: 0x5a648a, fontSize: 13, fontFamily: 'monospace' } });
    hint.anchor.set(0.5); hint.position.set(cx, H - 34);
    this.container.addChild(hint);

    this.stage = 'char';
    this.ci = 0; this.li = 0;
    this.refresh();

    this.onKey = (e) => {
      if (e.code === 'Escape') {
        if (this.stage === 'level') this.stage = 'char';
        else { this.ctx.goToTitle(); return; }
      } else if (this.stage === 'char') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.ci = (this.ci + ROSTER.length - 1) % ROSTER.length;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.ci = (this.ci + 1) % ROSTER.length;
        else if (e.code === 'Enter' || e.code === 'KeyJ') { this.stage = 'level'; audio.play('select'); }
        else return;
      } else {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.li = (this.li + LEVELS.length - 1) % LEVELS.length;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.li = (this.li + 1) % LEVELS.length;
        else if (e.code === 'Enter' || e.code === 'KeyJ') {
          this.ctx.startDirectLevel([ROSTER[this.ci]], this.li);
          return;
        } else return;
      }
      audio.play('select'); this.refresh();
    };
    window.addEventListener('keydown', this.onKey);
  }

  refresh() {
    this.heading.text = this.stage === 'char' ? 'ELEGIR NIVEL — Elige personaje' : 'ELEGIR NIVEL — Elige nivel';
    this.charCards.forEach((c, i) => { c.cur.visible = this.stage === 'char' && i === this.ci; });
    this.levelCards.forEach((c, i) => { c.cur.visible = this.stage === 'level' && i === this.li; });
    const ch = ROSTER[this.ci];
    this.info.text = `${ch.name} — ${ch.className}   juega: ${LEVELS[this.li].title} — ${LEVELS[this.li].name}`;
  }

  update() {}

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
