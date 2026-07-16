// Boss practice: pick a character, then a boss, and fight it directly.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { ROSTER } from '../characters/index.js';
import { orcHero, darkLord, baphomet, vesper } from '../sim/boss.js';
import { audio } from '../engine/audio.js';

const GOLD = 0xf2c14e;
const BOSSES = [
  { def: orcHero, level: 0, tag: 'Nivel 1' },
  { def: darkLord, level: 1, tag: 'Nivel 2' },
  { def: baphomet, level: 2, tag: 'Nivel 3' },
  { def: vesper, level: 3, tag: 'Nivel 4' },
];

export class PracticeScene {
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

    // character row
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

    // boss row
    this.bossCards = [];
    const bw = 200, bgap = 30, btotal = BOSSES.length * bw + (BOSSES.length - 1) * bgap;
    const bx0 = (W - btotal) / 2;
    BOSSES.forEach((b, i) => {
      const card = new Container();
      card.position.set(bx0 + i * (bw + bgap), 290);
      const fr = new Graphics();
      fr.roundRect(0, 0, bw, 120, 8).fill(0x2a1830).stroke({ color: 0x5a3a4a, width: 2 });
      card.addChild(fr);
      const nm = new Text({ text: b.def.name, style: { fill: 0xff8a6a, fontSize: 20, fontFamily: 'Georgia, serif', fontWeight: 'bold' } });
      nm.anchor.set(0.5); nm.position.set(bw / 2, 46); card.addChild(nm);
      const tag = new Text({ text: b.tag + ` · ${b.def.cards.length} spell cards`, style: { fill: 0x9aa4c0, fontSize: 12, fontFamily: 'monospace' } });
      tag.anchor.set(0.5); tag.position.set(bw / 2, 80); card.addChild(tag);
      const cur = new Graphics(); cur.roundRect(-3, -3, bw + 6, 126, 10).stroke({ color: GOLD, width: 4 }); cur.visible = false;
      card.addChild(cur);
      this.container.addChild(card);
      this.bossCards.push({ cur });
    });

    const hint = new Text({ text: '←→ elegir · ENTER confirmar · ESC volver', style: { fill: 0x5a648a, fontSize: 13, fontFamily: 'monospace' } });
    hint.anchor.set(0.5); hint.position.set(cx, H - 34);
    this.container.addChild(hint);

    this.stage = 'char';
    this.ci = 0; this.bi = 0;
    this.refresh();

    this.onKey = (e) => {
      if (e.code === 'Escape') { this.ctx.goToTitle(); return; }
      if (this.stage === 'char') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.ci = (this.ci + ROSTER.length - 1) % ROSTER.length;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.ci = (this.ci + 1) % ROSTER.length;
        else if (e.code === 'Enter' || e.code === 'KeyJ') { this.stage = 'boss'; audio.play('select'); }
        else return;
      } else {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.bi = (this.bi + BOSSES.length - 1) % BOSSES.length;
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.bi = (this.bi + 1) % BOSSES.length;
        else if (e.code === 'Enter' || e.code === 'KeyJ') {
          const b = BOSSES[this.bi];
          this.ctx.startPractice([ROSTER[this.ci]], b.def, b.level);
          return;
        } else return;
      }
      audio.play('select'); this.refresh();
    };
    window.addEventListener('keydown', this.onKey);
  }

  refresh() {
    this.heading.text = this.stage === 'char' ? 'PRÁCTICA — Elige personaje' : 'PRÁCTICA — Elige jefe';
    this.charCards.forEach((c, i) => { c.cur.visible = i === this.ci; });
    this.bossCards.forEach((c, i) => { c.cur.visible = this.stage === 'boss' && i === this.bi; });
  }

  update() {}

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
