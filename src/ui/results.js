// Level-clear results panel: score, stats and a graded medal (S/A/B/C).
// Built as a container the GameScene overlays; call show() with sim + chars.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';

const GOLD = 0xd9a94a;

function grade(sim) {
  // simple heuristic: fewer deaths + more graze = better letter
  const { deaths, maxGraze } = sim.stats;
  if (deaths === 0 && maxGraze >= 60) return { letter: 'S', color: 0xffe14a };
  if (deaths <= 1) return { letter: 'A', color: 0x6fd0ff };
  if (deaths <= 3) return { letter: 'B', color: 0x8fe08a };
  return { letter: 'C', color: 0xffa060 };
}

export function makeResults(atlas, sim, chars, cx, opts = {}) {
  const { levelName = '', isFinal = false } = opts;
  const root = new Container();
  const dim = new Graphics();
  dim.rect(0, 0, FIELD_W, FIELD_H).fill({ color: 0x081018, alpha: 0.86 });
  root.addChild(dim);

  const title = new Text({
    text: isFinal ? '¡VICTORIA!' : '¡NIVEL COMPLETADO!',
    style: { fill: isFinal ? 0xffe14a : GOLD, fontSize: isFinal ? 40 : 32, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 5 }, letterSpacing: 1 },
  });
  title.anchor.set(0.5); title.position.set(cx, 120);
  root.addChild(title);

  const sub = new Text({
    text: isFinal ? 'Has salvado Midgard, héroe.' : levelName,
    style: { fill: 0x9aa4c0, fontSize: 14, fontFamily: 'monospace' },
  });
  sub.anchor.set(0.5); sub.position.set(cx, 158);
  root.addChild(sub);

  // medal
  const g = grade(sim);
  const medal = new Graphics();
  medal.circle(cx, 240, 46).fill({ color: 0x101820 }).stroke({ color: g.color, width: 5 });
  medal.circle(cx, 240, 38).stroke({ color: g.color, width: 1 });
  root.addChild(medal);
  const letter = new Text({
    text: g.letter,
    style: { fill: g.color, fontSize: 58, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 4 } },
  });
  letter.anchor.set(0.5); letter.position.set(cx, 238);
  root.addChild(letter);
  const rank = new Text({
    text: 'RANGO', style: { fill: 0x9aa4c0, fontSize: 12, fontFamily: 'monospace', letterSpacing: 2 },
  });
  rank.anchor.set(0.5); rank.position.set(cx, 300);
  root.addChild(rank);

  // stat rows
  const rows = [
    ['SCORE', String(sim.score).padStart(8, '0')],
    ['ENEMIGOS', String(sim.stats.kills)],
    ['MAX GRAZE', String(sim.stats.maxGraze)],
    ['CARTAS', String(sim.stats.cards)],
    ['BOMBAS', String(sim.stats.bombs)],
    ['MUERTES', String(sim.stats.deaths)],
  ];
  let y = 340;
  for (const [label, value] of rows) {
    const l = new Text({ text: label, style: { fill: 0x9aa4c0, fontSize: 16, fontFamily: 'monospace' } });
    l.position.set(cx - 150, y); root.addChild(l);
    const v = new Text({ text: value, style: { fill: 0xffffff, fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold' } });
    v.anchor.set(1, 0); v.position.set(cx + 150, y); root.addChild(v);
    y += 30;
  }

  const hint = new Text({
    text: isFinal ? 'ENTER para volver al título' : 'ENTER para el siguiente nivel',
    style: { fill: GOLD, fontSize: 16, fontFamily: 'monospace' },
  });
  hint.anchor.set(0.5); hint.position.set(cx, y + 24);
  root.addChild(hint);

  return root;
}
