// Character select: the 6-character roster on cards (idle sprite + sheet
// banner), arrow/WASD navigation, Enter/J confirms.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { ROSTER } from '../characters/index.js';

const GOLD = 0xd9a94a;
const NAVY_LIGHT = 0x1b2340;

export class SelectScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.container = new Container();
    const { app, atlas } = ctx;
    const W = app.renderer.width, H = app.renderer.height;

    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(0x0b1020);
    this.container.addChild(bg);

    const title = new Text({
      text: '─◆ ELIGE TU PERSONAJE ◆─',
      style: {
        fill: GOLD, fontSize: 30, fontFamily: 'Georgia, serif', fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 }, letterSpacing: 2,
      },
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, 52);
    this.container.addChild(title);

    // 3 x 2 card grid
    const CARD_W = 200, CARD_H = 240, GAP_X = 40, GAP_Y = 34;
    const gridW = 3 * CARD_W + 2 * GAP_X;
    const x0 = (W - gridW) / 2, y0 = 110;
    this.cards = [];
    ROSTER.forEach((char, i) => {
      const col = i % 3, row = (i / 3) | 0;
      const card = new Container();
      card.position.set(x0 + col * (CARD_W + GAP_X), y0 + row * (CARD_H + GAP_Y));

      const frame = new Graphics();
      frame.roundRect(0, 0, CARD_W, CARD_H, 10).fill(NAVY_LIGHT).stroke({ color: 0x39415e, width: 2 });
      card.addChild(frame);

      const art = atlas.characters[char.id];
      const spr = new Sprite(art.poses.idle);
      spr.anchor.set(0.5);
      spr.scale.set(120 / spr.texture.frame.height);
      spr.position.set(CARD_W / 2, 84);
      card.addChild(spr);

      const banner = new Sprite(art.banner);
      banner.anchor.set(0.5, 0);
      banner.scale.set((CARD_W - 30) / banner.texture.frame.width);
      banner.position.set(CARD_W / 2, 156);
      card.addChild(banner);

      const cls = new Text({
        text: char.className,
        style: { fill: GOLD, fontSize: 14, fontFamily: 'monospace' },
      });
      cls.anchor.set(0.5, 0);
      cls.position.set(CARD_W / 2, 194);
      card.addChild(cls);

      // skill icon row (shot / focus / bomb / special)
      const icons = atlas.skills?.[char.id];
      if (icons) {
        const ICON = 26, STEP = 32, rowW = 3 * STEP + ICON;
        const ix0 = (CARD_W - rowW) / 2;
        icons.forEach((tex, k) => {
          const si = new Sprite(tex);
          si.width = ICON; si.height = ICON;
          si.position.set(ix0 + k * STEP, 212);
          card.addChild(si);
        });
      }

      const cursor = new Graphics();
      cursor.roundRect(-4, -4, CARD_W + 8, CARD_H + 8, 12).stroke({ color: GOLD, width: 4 });
      cursor.visible = false;
      card.addChild(cursor);

      const cursor2 = new Graphics();
      cursor2.roundRect(-9, -9, CARD_W + 18, CARD_H + 18, 14).stroke({ color: 0x3f7fe0, width: 4 });
      cursor2.visible = false;
      card.addChild(cursor2);

      const p1tag = new Text({
        text: 'P1 ✔',
        style: { fill: GOLD, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      p1tag.position.set(8, 6);
      p1tag.visible = false;
      card.addChild(p1tag);

      this.container.addChild(card);
      this.cards.push({ card, cursor, cursor2, p1tag, char });
    });

    // info footer
    this.info = new Text({
      text: '',
      style: { fill: 0xd8dcea, fontSize: 15, fontFamily: 'monospace' },
    });
    this.info.anchor.set(0.5);
    this.info.position.set(W / 2, H - 62);
    this.container.addChild(this.info);

    this.hint = new Text({
      text: '',
      style: { fill: 0x5a648a, fontSize: 13, fontFamily: 'monospace' },
    });
    this.hint.anchor.set(0.5);
    this.hint.position.set(W / 2, H - 28);
    this.container.addChild(this.hint);

    // Flow: P1 picks -> "join?" -> optional P2 picks -> start.
    this.stage = 'p1';       // 'p1' | 'join' | 'p2'
    this.index = 0;          // P1 cursor
    this.index2 = 1;         // P2 cursor
    this.p1Pick = null;
    this.refresh();

    const move = (idx, code) => {
      const col = idx % 3, row = (idx / 3) | 0;
      if (code === 'ArrowLeft' || code === 'KeyA') return row * 3 + (col + 2) % 3;
      if (code === 'ArrowRight' || code === 'KeyD') return row * 3 + (col + 1) % 3;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowDown' || code === 'KeyS') {
        return ((row + 1) % 2) * 3 + col;
      }
      return null;
    };

    this.onKey = (e) => {
      if (this.stage === 'p1') {
        const m = move(this.index, e.code);
        if (m !== null) this.index = m;
        else if (e.code === 'Enter' || e.code === 'KeyJ') { this.p1Pick = this.cards[this.index].char; this.stage = 'join'; }
        else if (e.code === 'Escape') { this.ctx.goToTitle(); return; }
        else return;
      } else if (this.stage === 'join') {
        if (e.code.startsWith('Arrow')) this.stage = 'p2';
        else if (e.code === 'Enter' || e.code === 'KeyJ') { this.ctx.startGame([this.p1Pick]); return; }
        else if (e.code === 'Escape') { this.stage = 'p1'; this.p1Pick = null; }
        else return;
      } else {
        const m = move(this.index2, e.code);
        if (m !== null) this.index2 = m;
        else if (e.code === 'Enter' || e.code === 'Numpad1') {
          this.ctx.startGame([this.p1Pick, this.cards[this.index2].char]);
          return;
        } else if (e.code === 'Escape') { this.stage = 'join'; }
        else return;
      }
      this.refresh();
    };
    window.addEventListener('keydown', this.onKey);
    this.t = 0;
  }

  refresh() {
    this.cards.forEach((c, i) => {
      c.cursor.visible = this.stage === 'p1' && i === this.index;
      c.cursor2.visible = this.stage === 'p2' && i === this.index2;
      c.p1tag.visible = this.p1Pick === c.char;
    });
    const ch = this.stage === 'p2' ? this.cards[this.index2].char : this.cards[this.index].char;
    const s = ch.stats;
    this.info.text =
      `${ch.name} — ${ch.className}   ATK ${s.atk} · DEF ${s.def} · SPD ${s.spd} · HP ${s.hp}\n` +
      `${ch.skills[0]} / ${ch.skills[1]} · Bomba: ${ch.skills[2]} · Especial: ${ch.skills[3]}`;
    this.hint.text = this.stage === 'p1'
      ? 'P1: FLECHAS/WASD elegir · ENTER confirmar · ESC volver'
      : this.stage === 'join'
        ? '¿JUGADOR 2? — FLECHAS para unirse · ENTER empieza solo · ESC cambia P1'
        : 'P2: FLECHAS elegir · ENTER/NUMPAD1 empezar · ESC salir';
  }

  update(dtMs) {
    this.t += dtMs / 1000;
    const pulse = 0.7 + Math.sin(this.t * 6) * 0.3;
    for (const c of this.cards) {
      if (c.cursor.visible) c.cursor.alpha = pulse;
      if (c.cursor2.visible) c.cursor2.alpha = pulse;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
