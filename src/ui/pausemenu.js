// Pause banner + "back to the title?" confirmation, in the results-panel idiom
// (dim wash, Georgia gold heading, monospace hints). Pure presentation: the
// transitions live in src/engine/pausecontrol.js.
import { Container, Graphics, Text } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';

const GOLD = 0xd9a94a;
const DIM = 0x081018;

const dimWash = (alpha) => new Graphics().rect(0, 0, FIELD_W, FIELD_H).fill({ color: DIM, alpha });

const heading = (text, size, color) => new Text({
  text,
  style: {
    fill: color, fontSize: size, fontFamily: 'Georgia, serif', fontWeight: 'bold',
    stroke: { color: 0x000000, width: 5 }, letterSpacing: 2,
  },
});

const line = (text, color = 0x9aa4c0, size = 14) => new Text({
  text, style: { fill: color, fontSize: size, fontFamily: 'monospace' },
});

// Paused: lighter wash than results, so the frozen playfield stays readable.
export function makePauseOverlay({ levelName = '', pausedBy = '' } = {}) {
  const root = new Container();
  root.addChild(dimWash(0.62));

  const title = heading('PAUSA', 44, GOLD);
  title.anchor.set(0.5);
  title.position.set(FIELD_W / 2, FIELD_H / 2 - 40);
  root.addChild(title);

  if (levelName) {
    const sub = line(levelName);
    sub.anchor.set(0.5);
    sub.position.set(FIELD_W / 2, FIELD_H / 2 + 2);
    root.addChild(sub);
  }

  const hints = [pausedBy || 'P para continuar', 'ESC para volver al menú'];
  hints.forEach((t, i) => {
    const h = line(t, i === 0 ? GOLD : 0x9aa4c0, i === 0 ? 16 : 13);
    h.anchor.set(0.5);
    h.position.set(FIELD_W / 2, FIELD_H / 2 + 48 + i * 26);
    root.addChild(h);
  });
  return root;
}

// Exit confirmation. setChoice(i) re-styles the two buttons; 0 = NO (default).
export function makeConfirmExit({ warning = '' } = {}) {
  const root = new Container();
  root.addChild(dimWash(0.78));

  const cx = FIELD_W / 2;
  const cy = FIELD_H / 2;

  const panel = new Graphics();
  panel.roundRect(cx - 210, cy - 110, 420, warning ? 240 : 216, 10)
    .fill({ color: 0x101820, alpha: 0.96 })
    .stroke({ color: GOLD, width: 2 });
  root.addChild(panel);

  const q = heading('¿Volver al menú principal?', 22, GOLD);
  q.anchor.set(0.5);
  q.position.set(cx, cy - 66);
  root.addChild(q);

  const lost = line('Se pierde el progreso de esta partida.', 0x9aa4c0, 13);
  lost.anchor.set(0.5);
  lost.position.set(cx, cy - 30);
  root.addChild(lost);

  if (warning) {
    const w = line(warning, 0xffa060, 12);
    w.anchor.set(0.5);
    w.position.set(cx, cy - 8);
    root.addChild(w);
  }

  const buttons = [];
  const LABELS = ['NO', 'SÍ'];
  const bw = 130, bh = 46, gap = 26;
  LABELS.forEach((label, i) => {
    const bx = cx + (i === 0 ? -(bw + gap / 2) : gap / 2);
    const by = cy + 22;
    const box = new Graphics();
    const text = new Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    text.anchor.set(0.5);
    text.position.set(bx + bw / 2, by + bh / 2);
    root.addChild(box, text);
    buttons.push({ box, text, bx, by });
  });

  const hint = line('←/→ elegir · ENTER confirmar · ESC cancelar', 0x7c86a0, 12);
  hint.anchor.set(0.5);
  hint.position.set(cx, cy + 86);
  root.addChild(hint);

  const setChoice = (choice) => {
    buttons.forEach(({ box, text, bx, by }, i) => {
      const on = i === choice;
      box.clear()
        .roundRect(bx, by, bw, bh, 8)
        .fill({ color: on ? 0x2a3350 : 0x141c28, alpha: on ? 1 : 0.9 })
        .stroke({ color: on ? GOLD : 0x3a4560, width: on ? 3 : 1 });
      text.style.fill = on ? GOLD : 0x8a93ab;
    });
  };
  setChoice(0);

  return { root, setChoice };
}
