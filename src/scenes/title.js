// Title screen: the illustrated Start Menu art fills the screen; interactive
// bits (a moving highlight over the baked JUGAR / PRÁCTICA / RÉCORDS options
// and a live difficulty line that overwrites the baked one) are overlaid,
// pixel-aligned to the art. Falls back to a plain layout if the art is missing.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { DIFFICULTIES } from '../sim/difficulty.js';
import { music } from '../engine/music.js';
import { audio } from '../engine/audio.js';
import { FIELD_H } from '../sim/constants.js';

const GOLD = 0xf2c14e;
const BG = 0x01021a; // matches the art's background for a seamless cover
const IMG_W = 1182, IMG_H = 1330;

const MENU = [
  { act: (ctx) => ctx.goToSelect() },      // JUGAR
  { act: (ctx) => ctx.goToPractice() },    // PRÁCTICA DE JEFES
  { act: (ctx) => ctx.goToRecords() },     // RÉCORDS
  { act: (ctx) => ctx.goToOnline(), online: true }, // CO-OP ONLINE (overlaid — not baked into the art)
];
// baked text row centers in image pixels: options + difficulty + blurb
const IMG_Y = { jugar: 433, practica: 499, records: 568, diff: 648, blurb: 689 };

export class TitleScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.container = new Container();
    const { app } = ctx;
    const W = app.renderer.width, H = app.renderer.height;

    const bg = new Graphics().rect(0, 0, W, H).fill(BG);
    this.container.addChild(bg);

    // fit the art by height, centered horizontally
    const s = H / IMG_H;
    this.s = s;
    this.offX = (W - IMG_W * s) / 2;
    const art = ctx.atlas.startMenu;
    if (art) {
      const sprite = new Sprite(art);
      sprite.scale.set(s);
      sprite.position.set(this.offX, 0);
      this.container.addChild(sprite);
    }

    const sx = (imgX) => this.offX + imgX * s;   // image px -> screen x
    const sy = (imgY) => imgY * s;               // image px -> screen y
    const cx = sx(IMG_W / 2);
    this.optY = [sy(IMG_Y.jugar), sy(IMG_Y.practica), sy(IMG_Y.records)];

    // moving highlight over the selected option
    this.cursor = new Graphics();
    this.container.addChild(this.cursor);

    // cover the baked difficulty line + blurb, then draw the live ones on top
    const coverTop = sy(IMG_Y.diff) - 22 * s * 1.6;
    const coverBot = sy(IMG_Y.blurb) + 18;
    const cover = new Graphics();
    cover.rect(cx - 230, coverTop, 460, coverBot - coverTop).fill(BG);
    this.container.addChild(cover);

    this.diffText = new Text({
      text: '', style: { fill: GOLD, fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 }, letterSpacing: 2 },
    });
    this.diffText.anchor.set(0.5);
    this.diffText.position.set(cx, sy(IMG_Y.diff));
    this.container.addChild(this.diffText);

    this.diffBlurb = new Text({
      text: '', style: { fill: 0xbfc6dd, fontSize: 14, fontFamily: 'monospace' },
    });
    this.diffBlurb.anchor.set(0.5);
    this.diffBlurb.position.set(cx, sy(IMG_Y.blurb));
    this.container.addChild(this.diffBlurb);

    // CO-OP ONLINE is not baked into the art, so overlay it as a 4th option near
    // the bottom with a small backing plate for readability.
    const onlineY = H - 58;
    const plate = new Graphics();
    plate.roundRect(cx - 170, onlineY - 20, 340, 40, 10)
      .fill({ color: 0x01021a, alpha: 0.72 }).stroke({ color: 0x8a6a2a, width: 1 });
    this.container.addChild(plate);
    this.onlineText = new Text({
      text: '🌐 CO-OP ONLINE',
      style: { fill: GOLD, fontSize: 20, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 3 }, letterSpacing: 1 },
    });
    this.onlineText.anchor.set(0.5);
    this.onlineText.position.set(cx, onlineY);
    this.container.addChild(this.onlineText);
    this.optY.push(onlineY);   // 4th navigable option

    this.cx = cx;
    this.index = 0;
    this.t = 0;
    this.refresh();

    this.onKey = (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.index = (this.index + MENU.length - 1) % MENU.length;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.index = (this.index + 1) % MENU.length;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') ctx.difficulty = (ctx.difficulty + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') ctx.difficulty = (ctx.difficulty + 1) % DIFFICULTIES.length;
      else if (e.code === 'Enter' || e.code === 'KeyJ') { audio.play('select'); MENU[this.index].act(ctx); return; }
      else return;
      audio.play('select');
      this.refresh();
    };
    window.addEventListener('keydown', this.onKey);
    music.play('menu');
  }

  refresh() {
    const d = DIFFICULTIES[this.ctx.difficulty];
    this.diffText.text = `◄ ${d.name} ►`;
    this.diffBlurb.text = d.blurb;
  }

  update(dtMs) {
    this.t += dtMs / 1000;
    const y = this.optY[this.index];
    const pulse = 0.5 + Math.abs(Math.sin(this.t * 3)) * 0.5;
    this.cursor.clear();
    this.cursor.roundRect(this.cx - 150, y - 22, 300, 44, 10)
      .stroke({ color: GOLD, width: 3, alpha: pulse });
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
