// Boss health bar(s) across the top of the playfield. One boss: name + current
// spell-card name + a segmented HP bar (one segment per card). Two bosses
// (dual-boss fights): a compact name + HP bar row per boss, stacked.
import { Container, Graphics, Text } from 'pixi.js';
import { FIELD_W } from '../sim/constants.js';

const GOLD = 0xd9a94a;

export class BossBar {
  constructor(parent) {
    this.root = new Container();
    this.root.visible = false;
    parent.addChild(this.root);

    this.frame = new Graphics();
    this.root.addChild(this.frame);

    // two reusable rows (single-boss uses row 0 in full layout)
    this.rows = [];
    for (let i = 0; i < 2; i++) {
      const name = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } } });
      const card = new Text({ text: '', style: { fill: GOLD, fontSize: 13, fontFamily: 'monospace', fontStyle: 'italic', stroke: { color: 0x000000, width: 3 } } });
      card.anchor.set(1, 0);
      const bar = new Graphics();
      this.root.addChild(name, card, bar);
      this.rows.push({ name, card, bar });
    }
  }

  // Draw boss b's segmented card HP into [x0..x1] at y.
  drawBar(g, b, x0, x1, y) {
    const total = b.def.cards.length;
    const gap = 3;
    const segW = (x1 - x0 - gap * (total - 1)) / total;
    const frac = Math.max(0, b.cardHp / b.cardMax);
    for (let i = 0; i < total; i++) {
      const x = x0 + i * (segW + gap);
      if (i < b.cardIndex) {
        g.roundRect(x, y, segW, 6, 2).fill(0x4a2a2a);           // spent
      } else if (i === b.cardIndex) {
        const col = b.transition > 0 ? 0x8a8a8a : (frac < 0.3 ? 0xff6a6a : 0xe0472e);
        g.roundRect(x, y, segW, 6, 2).fill(0x2a1418);
        g.roundRect(x, y, Math.max(1, segW * frac), 6, 2).fill(col);
      } else {
        g.roundRect(x, y, segW, 6, 2).fill(0xb5443a);           // upcoming
      }
    }
  }

  update(sim) {
    const bosses = (sim.bosses ?? []).filter((b) => !b.intro);
    if (bosses.length === 0) { this.root.visible = false; return; }
    this.root.visible = true;
    const n = Math.min(bosses.length, 2);
    const dual = n > 1;

    this.frame.clear();
    const top = 34, rowH = dual ? 16 : 26, gap = dual ? 3 : 0;
    const totalH = n * rowH + (n - 1) * gap;
    this.frame.roundRect(20, top, FIELD_W - 40, totalH, 6)
      .fill({ color: 0x120a10, alpha: 0.7 }).stroke({ color: GOLD, width: 2 });

    for (let i = 0; i < 2; i++) {
      const row = this.rows[i];
      row.bar.clear();
      if (i >= n) { row.name.visible = false; row.card.visible = false; continue; }
      const b = bosses[i];
      const ry = top + i * (rowH + gap);
      row.name.visible = true;
      row.name.text = b.name;
      row.name.style.fontSize = dual ? 11 : 14;

      if (dual) {
        // compact: name on the left, HP bar filling the rest of the line
        row.name.position.set(30, ry + 3);
        row.card.visible = false;
        this.drawBar(row.bar, b, 150, FIELD_W - 30, ry + 5);
      } else {
        row.name.position.set(30, ry + 3);
        row.card.visible = true;
        row.card.text = b.transition > 0 ? '' : `✦ ${b.cardName} ✦`;
        row.card.style.fontSize = 13;
        row.card.position.set(FIELD_W - 30, ry + 4);
        this.drawBar(row.bar, b, 28, FIELD_W - 28, ry + 18);
      }
    }
  }
}
