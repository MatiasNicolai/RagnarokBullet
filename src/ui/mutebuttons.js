// Persistent mute toggles (top-right): music (♪) and SFX (speaker). Click or
// press M / N. State lives in the audio + music engines (localStorage-backed),
// so it survives scene changes and reloads. Added on top of every scene.
import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { audio } from '../engine/audio.js';
import { music } from '../engine/music.js';

const GOLD = 0xd9a94a;
const NAVY = 0x131a2e;
const SIZE = 32;

function drawIcon(g, kind, on) {
  const c = on ? 0xffffff : 0x6a7088;
  if (kind === 'music') {
    g.circle(11, 23, 4.5).fill(c);
    g.circle(21, 20, 4.5).fill(c);
    g.rect(14, 9, 2.4, 15).fill(c);
    g.rect(24, 6, 2.4, 15).fill(c);
    g.rect(14, 9, 12, 3).fill(c);
  } else { // speaker
    g.poly([8, 13, 13, 13, 19, 8, 19, 24, 13, 19, 8, 19]).fill(c);
    if (on) {
      g.arc(20, 16, 5, -0.8, 0.8).stroke({ color: c, width: 2 });
      g.arc(20, 16, 9, -0.8, 0.8).stroke({ color: c, width: 2 });
    }
  }
}

export class MuteButtons {
  constructor(app, appW) {
    this.container = new Container();
    const musicBtn = this.makeButton('music', appW - SIZE * 2 - 12, () => music.muted, (v) => music.setMuted(v));
    const sfxBtn = this.makeButton('sfx', appW - SIZE - 6, () => audio.sfxMuted, (v) => audio.setSfxMuted(v));
    this.container.addChild(musicBtn.node, sfxBtn.node);

    this.onKey = (e) => {
      if (e.code === 'KeyM') musicBtn.toggle();
      else if (e.code === 'KeyN') sfxBtn.toggle();
    };
    window.addEventListener('keydown', this.onKey);
  }

  makeButton(kind, x, getMuted, setMuted) {
    const node = new Container();
    node.position.set(x, 6);
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.hitArea = new Rectangle(0, 0, SIZE, SIZE);

    const bg = new Graphics();
    const icon = new Graphics();
    const slash = new Graphics();
    node.addChild(bg, icon, slash);

    const hint = new Text({
      text: kind === 'music' ? 'M' : 'N',
      style: { fill: 0x9aa4c0, fontSize: 9, fontFamily: 'monospace' },
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(SIZE / 2, SIZE + 1);
    node.addChild(hint);

    const redraw = () => {
      const muted = getMuted();
      bg.clear();
      bg.roundRect(0, 0, SIZE, SIZE, 7).fill({ color: NAVY, alpha: 0.85 })
        .stroke({ color: GOLD, width: 2 });
      icon.clear();
      drawIcon(icon, kind, !muted);
      slash.clear();
      if (muted) slash.moveTo(6, SIZE - 6).lineTo(SIZE - 6, 6).stroke({ color: 0xff4a4a, width: 3 });
    };
    const toggle = () => { setMuted(!getMuted()); redraw(); };
    node.on('pointertap', toggle);
    redraw();
    return { node, toggle };
  }

  raise(stage) { stage.addChild(this.container); } // keep on top after scene swaps
}
