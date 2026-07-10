// Records screen: local high-score table. ESC/ENTER returns to title.
import { Container, Graphics, Text } from 'pixi.js';
import { loadScores } from '../engine/scores.js';

const GOLD = 0xf2c14e;

export class RecordsScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.container = new Container();
    const W = ctx.app.renderer.width, H = ctx.app.renderer.height, cx = W / 2;

    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(0x0b1020);
    this.container.addChild(bg);

    const title = new Text({
      text: '─◆ RÉCORDS ◆─',
      style: { fill: GOLD, fontSize: 32, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } },
    });
    title.anchor.set(0.5); title.position.set(cx, 70);
    this.container.addChild(title);

    const scores = loadScores();
    if (!scores.length) {
      const none = new Text({ text: 'Aún no hay récords.\n¡Sé el primero!', style: { fill: 0x9aa4c0, fontSize: 18, fontFamily: 'monospace', align: 'center' } });
      none.anchor.set(0.5); none.position.set(cx, H * 0.42);
      this.container.addChild(none);
    } else {
      let y = 140;
      scores.forEach((s, i) => {
        const rowY = y + i * 40;
        const rank = new Text({ text: `${i + 1}.`, style: { fill: GOLD, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' } });
        rank.position.set(cx - 250, rowY); this.container.addChild(rank);
        const name = new Text({ text: s.initials, style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' } });
        name.position.set(cx - 200, rowY); this.container.addChild(name);
        const sc = new Text({ text: String(s.score).padStart(8, '0'), style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace' } });
        sc.position.set(cx - 130, rowY); this.container.addChild(sc);
        const meta = new Text({
          text: `${s.char}  ${s.diff}${s.cleared ? '  ✔' : ''}`,
          style: { fill: s.cleared ? 0x8fe08a : 0x9aa4c0, fontSize: 14, fontFamily: 'monospace' },
        });
        meta.anchor.set(1, 0); meta.position.set(cx + 250, rowY + 3); this.container.addChild(meta);
      });
    }

    const hint = new Text({ text: 'ENTER / ESC para volver', style: { fill: 0x5a648a, fontSize: 14, fontFamily: 'monospace' } });
    hint.anchor.set(0.5); hint.position.set(cx, H - 40);
    this.container.addChild(hint);

    this.onKey = (e) => { if (e.code === 'Enter' || e.code === 'Escape') ctx.goToTitle(); };
    window.addEventListener('keydown', this.onKey);
  }

  update() {}

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
