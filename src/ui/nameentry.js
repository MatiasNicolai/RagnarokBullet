// Arcade 3-letter initials entry. Up/Down cycle the current letter,
// Left/Right move between slots, Enter confirms. key(e) is driven by the scene.
import { Container, Graphics, Text } from 'pixi.js';

const GOLD = 0xd9a94a;
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

export function makeNameEntry(cx, y, onDone) {
  const root = new Container();
  const label = new Text({
    text: '¡NUEVO RÉCORD! Ingresa tus iniciales',
    style: { fill: GOLD, fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold' },
  });
  label.anchor.set(0.5); label.position.set(cx, y - 40);
  root.addChild(label);

  const slots = [0, 0, 0]; // indices into CHARS
  let cur = 0;
  const texts = [];
  const boxes = [];
  for (let i = 0; i < 3; i++) {
    const bx = cx - 60 + i * 60;
    const box = new Graphics();
    box.roundRect(bx - 22, y - 22, 44, 52, 6).fill(0x0d1220).stroke({ color: GOLD, width: 2 });
    root.addChild(box); boxes.push(box);
    const t = new Text({
      text: 'A', style: { fill: 0xffffff, fontSize: 34, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    t.anchor.set(0.5); t.position.set(bx, y + 2);
    root.addChild(t); texts.push(t);
  }
  const hint = new Text({
    text: '↑↓ letra · ←→ posición · ENTER confirmar',
    style: { fill: 0x9aa4c0, fontSize: 12, fontFamily: 'monospace' },
  });
  hint.anchor.set(0.5); hint.position.set(cx, y + 56);
  root.addChild(hint);

  const redraw = () => {
    for (let i = 0; i < 3; i++) {
      texts[i].text = CHARS[slots[i]] === ' ' ? '_' : CHARS[slots[i]];
      boxes[i].clear();
      const bx = cx - 60 + i * 60;
      boxes[i].roundRect(bx - 22, y - 22, 44, 52, 6).fill(0x0d1220)
        .stroke({ color: i === cur ? 0xffffff : GOLD, width: i === cur ? 3 : 2 });
    }
  };
  redraw();

  const key = (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') slots[cur] = (slots[cur] + 1) % CHARS.length;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') slots[cur] = (slots[cur] + CHARS.length - 1) % CHARS.length;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') cur = (cur + 2) % 3;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') cur = (cur + 1) % 3;
    else if (e.code === 'Enter') { onDone(slots.map((s) => CHARS[s]).join('').trim() || 'AAA'); return; }
    else return;
    redraw();
  };

  return { root, key };
}
