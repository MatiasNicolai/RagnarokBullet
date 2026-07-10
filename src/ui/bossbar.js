// Boss health bar across the top of the playfield: name, current spell-card
// name, an HP bar for the current card, and pips for the remaining cards.
import { Container, Graphics, Text } from 'pixi.js';
import { FIELD_W } from '../sim/constants.js';

const GOLD = 0xd9a94a;

export class BossBar {
  constructor(parent) {
    this.root = new Container();
    this.root.visible = false;
    parent.addChild(this.root);

    const bg = new Graphics();
    bg.roundRect(20, 34, FIELD_W - 40, 26, 6).fill({ color: 0x120a10, alpha: 0.7 })
      .stroke({ color: GOLD, width: 2 });
    this.root.addChild(bg);

    this.name = new Text({
      text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 } },
    });
    this.name.position.set(30, 37);
    this.root.addChild(this.name);

    this.card = new Text({
      text: '', style: { fill: GOLD, fontSize: 13, fontFamily: 'monospace', fontStyle: 'italic', stroke: { color: 0x000000, width: 3 } },
    });
    this.card.anchor.set(1, 0);
    this.card.position.set(FIELD_W - 30, 38);
    this.root.addChild(this.card);

    this.barBg = new Graphics();
    this.barBg.roundRect(28, 52, FIELD_W - 56, 6, 3).fill(0x2a1418);
    this.root.addChild(this.barBg);
    this.bar = new Graphics();
    this.root.addChild(this.bar);
  }

  update(sim) {
    const b = sim.boss;
    if (!b || b.intro) { this.root.visible = false; return; }
    this.root.visible = true;
    this.name.text = b.name;
    this.card.text = b.transition > 0 ? '' : `✦ ${b.cardName} ✦`;

    // One segment per spell card: past = dim, current = live fraction, future = full.
    const total = b.def.cards.length;
    const gap = 3;
    const segW = (FIELD_W - 56 - gap * (total - 1)) / total;
    const frac = Math.max(0, b.cardHp / b.cardMax);
    this.bar.clear();
    for (let i = 0; i < total; i++) {
      const x = 28 + i * (segW + gap);
      if (i < b.cardIndex) {
        this.bar.roundRect(x, 52, segW, 6, 2).fill(0x4a2a2a); // spent
      } else if (i === b.cardIndex) {
        const col = b.transition > 0 ? 0x8a8a8a : (frac < 0.3 ? 0xff6a6a : 0xe0472e);
        this.bar.roundRect(x, 52, segW, 6, 2).fill(0x2a1418);
        this.bar.roundRect(x, 52, Math.max(1, segW * frac), 6, 2).fill(col);
      } else {
        this.bar.roundRect(x, 52, segW, 6, 2).fill(0xb5443a); // upcoming
      }
    }
  }
}
