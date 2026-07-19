// Boss system: a single sim.boss with named spell cards (phases). Each card
// has an HP pool and a step(sim, b) that drives movement + danmaku from b.t.
// Deterministic: only sim.rng / b.t, like the rest of the sim.
import { FIELD_W } from './constants.js';
import { ring, ringWithGap, fan, aimed, spiralArm, rain, angleTo } from './patterns.js';

// After arriving, the boss poses (invulnerable, no attacks) for this many ticks
// while the intro dialogue is readable — then the box clears and the fight
// begins. Deterministic, so co-op peers start the fight on the same tick.
const INTRO_HOLD = 120; // ~2 s at 60 Hz

// Build a boss object anchored at homeX. hpMult scales card HP for co-op.
function makeBoss(def, homeX, hpMult) {
  const maxHp = Math.round(def.cards.reduce((s, c) => s + c.hp, 0) * hpMult);
  return {
    def,
    hpMult,
    name: def.name,
    homeX,
    x: homeX, y: -90,
    r: def.r ?? 42,
    targetY: def.targetY ?? 170,
    intro: true,
    t: 0,
    cardIndex: 0,
    cardHp: Math.round(def.cards[0].hp * hpMult),
    cardMax: Math.round(def.cards[0].hp * hpMult),
    cardName: def.cards[0].name,
    maxHp,
    hp: maxHp,
    hitFlash: 0,
    introHold: 0,
    transition: 0,
    dying: 0,
    dead: false,
  };
}

export function spawnBoss(sim, def) {
  // Co-op nearly doubles party DPS; scale card HP so the fight keeps its
  // intended length (learn the pattern, find the flow) with 2 players too.
  const hpMult = sim.players.filter(Boolean).length > 1 ? 1.7 : 1;
  const b = makeBoss(def, FIELD_W / 2, hpMult);
  sim.bosses = [b];
  sim.boss = b; // primary — music/tension and legacy reads
  sim.events.push({ type: 'bossWarning', name: def.name });
}

// Two (or more) simultaneous bosses, spread across the field, each with its own
// HP bar. HP is scaled down a touch per boss since their danmaku overlaps.
export function spawnBosses(sim, defs) {
  const hpMult = (sim.players.filter(Boolean).length > 1 ? 1.7 : 1) * (defs.length > 1 ? 0.7 : 1);
  const xs = defs.length === 2 ? [FIELD_W * 0.32, FIELD_W * 0.68] : defs.map((_, i) => FIELD_W * (i + 1) / (defs.length + 1));
  sim.bosses = defs.map((def, i) => makeBoss(def, xs[i], hpMult));
  sim.boss = sim.bosses[0];
  sim.events.push({ type: 'bossWarning', name: defs.map((d) => d.name).join(' & '), dual: defs.length > 1 });
}

// Advance every active boss one tick; complete the level when the last one dies.
export function stepBoss(sim) {
  const list = sim.bosses;
  if (!list || list.length === 0) return;
  for (const b of list) stepOne(sim, b);
  // reap bosses whose death throes finished
  const before = list.length;
  sim.bosses = list.filter((b) => !b.dead);
  sim.boss = sim.bosses[0] ?? null;
  if (sim.bosses.length === 0 && before > 0) {
    sim.enemyBullets.clear();
    sim.levelComplete = true;
    sim.events.push({ type: 'levelClear' });
  }
}

function stepOne(sim, b) {
  if (b.hitFlash > 0) b.hitFlash--;

  if (b.intro) {
    b.y += 2.2;
    if (b.y >= b.targetY) { b.y = b.targetY; b.intro = false; b.introHold = INTRO_HOLD; }
    return;
  }

  // pose while the intro dialogue is up; when it ends, clear the box + start.
  if (b.introHold > 0) {
    b.introHold--;
    if (b.introHold === 0) { b.t = 0; sim.events.push({ type: 'bossReady' }); }
    return;
  }

  if (b.dying > 0) {
    b.dying--;
    if (b.dying % 5 === 0) {
      sim.events.push({
        type: 'bossExplode',
        x: b.x + sim.rng.range(-b.r, b.r),
        y: b.y + sim.rng.range(-b.r, b.r),
      });
    }
    if (b.dying === 0) b.dead = true; // reaped in stepBoss
    return;
  }

  if (b.transition > 0) {
    b.transition--;
    // drift back to its home position during the card break
    b.x += (b.homeX - b.x) * 0.05;
    if (b.transition === 0) {
      b.t = 0;
      sim.events.push({ type: 'spellCard', name: b.cardName });
    }
    return;
  }

  b.def.cards[b.cardIndex].step(sim, b);
  b.t++;
}

// Player bullet dealt `dmg` to a specific boss `b`. Card transitions + death.
export function damageBoss(sim, dmg, b = sim.boss) {
  if (!b || b.intro || b.introHold > 0 || b.dying > 0 || b.transition > 0) return;
  const solo = (sim.bosses?.length ?? 1) === 1; // only clear the field for solo bosses
  b.cardHp -= dmg;
  b.hp = Math.max(0, b.hp - dmg);
  b.hitFlash = 3;
  if (b.cardHp <= 0) {
    if (b.cardIndex < b.def.cards.length - 1) {
      b.cardIndex++;
      const card = b.def.cards[b.cardIndex];
      b.cardHp = Math.round(card.hp * b.hpMult);
      b.cardMax = Math.round(card.hp * b.hpMult);
      b.cardName = card.name;
      b.transition = 70;
      if (solo) sim.enemyBullets.clear();
      sim.events.push({ type: 'bossPhase', x: b.x, y: b.y });
    } else {
      b.dying = 90;
      if (solo) sim.enemyBullets.clear();
      sim.addScore(50000);
      sim.events.push({ type: 'bossDown', x: b.x, y: b.y });
    }
  }
}

// --- Orc Hero: level 1 boss, 3 spell cards ---

// Card HP is tuned for ~30-45 s of active fight per boss at realistic solo DPS
// (~60-70/s with dodging downtime); co-op scales via hpMult in spawnBoss.
// Bullets run ~13% slower than the old values: slower bullets → more alive on
// screen at once → readable walls to weave through instead of reflex checks.
export const orcHero = {
  name: 'Orc Hero',
  r: 44,
  targetY: 165,
  cards: [
    {
      // Grito de Guerra: sways and pumps out rotating gapped rings (shockwaves).
      // The lesson: read the gap early and commit to it.
      name: 'Grito de Guerra',
      hp: 550,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 55) * 150;
        if (b.t % 50 === 0) {
          const gap = sim.rng.range(0, Math.PI * 2);
          ringWithGap(sim, b.x, b.y, { n: 26, speed: 1.8, gapAngle: gap, gapWidth: 0.55, color: 'orange' });
          ringWithGap(sim, b.x, b.y, { n: 26, speed: 1.8, gapAngle: gap + Math.PI, gapWidth: 0.55, color: 'red' });
        }
        if (b.t % 90 === 45) aimed(sim, b.x, b.y, { speed: 3.0, color: 'red' });
      },
    },
    {
      // Hacha Tormenta: spinning axes that ricochet off the walls.
      // The lesson: track ricochets, don't camp the bottom corners.
      name: 'Hacha Tormenta',
      hp: 650,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.cos(b.t / 40) * 170;
        if (b.t % 12 === 0) {
          const base = b.t / 22;
          for (let k = 0; k < 4; k++) {
            const a = base + (k / 4) * Math.PI * 2;
            sim.spawnEnemyBullet({
              x: b.x, y: b.y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6,
              color: 'purple', r: 7, bounce: 2, spin: 0.4,
            });
          }
        }
        if (b.t % 120 === 60) fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.7, speed: 3.0, color: 'red' });
      },
    },
    {
      // Carga del Héroe: dashes toward the player while spears rain from above.
      // Desperation: below 35% the rain thickens and the cycle shortens.
      name: 'Carga del Héroe',
      hp: 750,
      step(sim, b) {
        const desperate = b.cardHp < b.cardMax * 0.35;
        // charge cycle: wind up, dash to player x, recover
        const cycLen = desperate ? 120 : 150;
        const cyc = b.t % cycLen;
        if (cyc === 0) b.chargeX = null;
        if (cyc < 40) {
          // wind up: track player x slowly
          const p = nearestX(sim, b.x);
          b.x += (p - b.x) * 0.04;
        } else if (cyc < 70) {
          if (b.chargeX == null) b.chargeX = nearestX(sim, b.x);
          b.x += (b.chargeX - b.x) * 0.25;
          if (cyc % 6 === 0) fan(sim, b.x, b.y, { n: 3, angle: Math.PI / 2, spread: 0.5, speed: 3.1, color: 'orange' });
        }
        // constant spear rain from the top
        if (b.t % (desperate ? 8 : 11) === 0) rain(sim, sim.rng.range(30, FIELD_W - 30), { speed: 2.9, color: 'red', r: 5 });
        if (b.t % 70 === 0) ring(sim, b.x, b.y, { n: 16, speed: 1.8, baseAngle: sim.rng.range(0, 1), color: 'purple' });
      },
    },
  ],
};

function nearestX(sim, x) {
  let best = x, bd = Infinity;
  for (const p of sim.players) {
    if (!p || p.down) continue;
    const d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p.x; }
  }
  return best;
}

// --- Dark Lord: level 2 boss, 3 spell cards ---

export const darkLord = {
  name: 'Dark Lord',
  r: 46,
  targetY: 175,
  cards: [
    {
      // Meteor Storm: meteors fall in COLUMNS. A slow purple marker leads each
      // column, then the burst hammers the same x — read the marker, sidestep
      // the column. Sparse random drizzle keeps you honest between columns.
      name: 'Meteor Storm',
      hp: 650,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 60) * 150;
        const cyc = b.t % 70;
        if (cyc === 0) b.meteorX = sim.rng.range(40, FIELD_W - 40);
        if (cyc === 0) rain(sim, b.meteorX, { speed: 2.0, color: 'purple', r: 8 }); // telegraph marker
        if (cyc >= 22 && cyc < 46 && cyc % 4 === 0) {
          rain(sim, b.meteorX + sim.rng.range(-14, 14), { speed: 3.3, color: 'orange', r: 6 }); // the column
        }
        if (b.t % 17 === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 2.7, color: 'orange', r: 5 });
        if (b.t % 70 === 35) ring(sim, b.x, b.y, { n: 18, speed: 1.5, baseAngle: sim.rng.range(0, 6.28), color: 'purple' });
      },
    },
    {
      // Hell Judgement: dense multi-layer rings pulsing from the center.
      // Desperation: a third ring layer joins below 35%.
      name: 'Hell Judgement',
      hp: 780,
      step(sim, b) {
        b.x += (FIELD_W / 2 - b.x) * 0.06;
        const desperate = b.cardHp < b.cardMax * 0.35;
        if (b.t % 36 === 0) {
          const base = (b.t / 36) * 0.4;
          ring(sim, b.x, b.y, { n: 22, speed: 2.0, baseAngle: base, color: 'red' });
          ring(sim, b.x, b.y, { n: 22, speed: 1.5, baseAngle: -base + 0.14, color: 'purple' });
          if (desperate) ring(sim, b.x, b.y, { n: 14, speed: 2.4, baseAngle: base + 0.07, color: 'orange' });
        }
        if (b.t % 100 === 50) fan(sim, b.x, b.y, { n: 7, angle: angleTo(sim, b.x, b.y), spread: 0.9, speed: 2.8, color: 'orange' });
      },
    },
    {
      // Tinieblas Eternas: rotating twin spirals + spear rain; darkens the arena.
      // Desperation: the spirals spin faster below 35%.
      name: 'Tinieblas Eternas',
      hp: 910,
      step(sim, b) {
        if (b.t === 0) sim.events.push({ type: 'darken', on: true });
        b.x = FIELD_W / 2 + Math.cos(b.t / 50) * 160;
        const desperate = b.cardHp < b.cardMax * 0.35;
        const ph = b.t * (desperate ? 0.2 : 0.16);
        spiralArm(sim, b.x, b.y, { arms: 2, phase: ph, speed: 2.2, color: 'purple' });
        spiralArm(sim, b.x, b.y, { arms: 2, phase: -ph + Math.PI, speed: 2.2, color: 'red' });
        if (b.t % 14 === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 2.8, color: 'orange', r: 5 });
      },
    },
  ],
};

// --- Baphomet: level 3 final boss, 3 spell cards + desperation ---

export const baphomet = {
  name: 'Baphomet',
  r: 50,
  targetY: 175,
  cards: [
    {
      // Guadaña Dimensional: crossing diagonal scythe-waves in an X.
      // The lesson: the crossing point sweeps down — ride between the blades.
      // Tuned from playtest feedback: the diagonals were too fast/dense, so the
      // only safe pocket was hugging the boss up top (right in the ring). Slower
      // blades, wider spacing (bigger spawn-y step) and a lighter ring keep the
      // mid/lower field navigable so you don't have to camp under Baphomet.
      name: 'Guadaña Dimensional',
      hp: 760,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 55) * 150;
        if (b.t % 18 === 0) {
          const s = 2.0;
          sim.spawnEnemyBullet({ x: 0, y: (b.t % 300) * 2.6 - 40, vx: s, vy: s, color: 'purple', r: 6 });
          sim.spawnEnemyBullet({ x: FIELD_W, y: (b.t % 300) * 2.6 - 40, vx: -s, vy: s, color: 'red', r: 6 });
        }
        if (b.t % 90 === 45) ring(sim, b.x, b.y, { n: 14, speed: 1.7, baseAngle: sim.rng.range(0, 6.28), color: 'orange' });
      },
    },
    {
      // Invocación Demoníaca: summons orbiting Baphomet Jr. minions + aimed fans.
      // The lesson: prioritize the adds without losing the fan rhythm.
      name: 'Invocación Demoníaca',
      hp: 860,
      step(sim, b) {
        b.x += (FIELD_W / 2 - b.x) * 0.05;
        if (b.t % 200 === 30 && sim.enemies.active.length < 6) {
          for (let k = 0; k < 2; k++) {
            sim.spawnEnemy({
              x: b.x + (k ? 60 : -60), y: b.y + 20, vx: 0, vy: 1.2,
              hp: 24, r: 15, skin: 'bapho_jr', score: 800,
              shoot: (s, e) => { if (e.t % 60 === 30) aimed(s, e.x, e.y, { speed: 2.8, color: 'red' }); },
            });
          }
          sim.events.push({ type: 'summon', x: b.x, y: b.y });
        }
        if (b.t % 50 === 0) fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.7, speed: 2.7, color: 'purple' });
      },
    },
    {
      // Juicio Final: the hardest — layered rings + spiral + rain. Speeds up
      // as HP drops (desperation).
      name: 'Juicio Final',
      hp: 980,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 40) * 140;
        const desperate = b.cardHp < b.cardMax * 0.35;
        const period = desperate ? 26 : 40;
        if (b.t % period === 0) {
          const base = sim.rng.range(0, 6.28);
          ringWithGap(sim, b.x, b.y, { n: 30, speed: 2.2, gapAngle: base, gapWidth: 0.5, color: 'red' });
          ring(sim, b.x, b.y, { n: 18, speed: 1.6, baseAngle: base, color: 'purple' });
        }
        const ph = b.t * (desperate ? 0.22 : 0.16);
        spiralArm(sim, b.x, b.y, { arms: 3, phase: ph, speed: 2.3, color: 'orange' });
        if (b.t % 12 === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 3.0, color: 'purple', r: 5 });
      },
    },
  ],
};

// --- Vesper: level 4 final boss (Juperos), 3 spell cards + desperation ---

export const vesper = {
  name: 'Vesper',
  r: 52,
  targetY: 175,
  cards: [
    {
      // Cañón Iónico: sweeps side to side firing telegraphed aimed ion beams and
      // a gapped ion ring — read the beam windups.
      name: 'Cañón Iónico',
      hp: 820,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 52) * 155;
        if (b.t % 70 === 44) b.tele = 22;
        if (b.t % 70 === 0 && b.t > 0) {
          fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.5, speed: 3.2, color: 'cyan' });
        }
        if (b.t % 44 === 0) {
          const gap = sim.rng.range(0, Math.PI * 2);
          ringWithGap(sim, b.x, b.y, { n: 24, speed: 1.8, gapAngle: gap, gapWidth: 0.6, color: 'cyan' });
        }
      },
    },
    {
      // Andanada Alada: twin rotating "wing" spirals + aimed volleys; recenters.
      name: 'Andanada Alada',
      hp: 920,
      step(sim, b) {
        b.x += (FIELD_W / 2 - b.x) * 0.05;
        const ph = b.t * 0.17;
        spiralArm(sim, b.x, b.y, { arms: 2, phase: ph, speed: 2.4, color: 'cyan' });
        spiralArm(sim, b.x, b.y, { arms: 2, phase: -ph + Math.PI, speed: 2.4, color: 'purple' });
        if (b.t % 90 === 60) b.tele = 20;
        if (b.t % 90 === 0 && b.t > 0) fan(sim, b.x, b.y, { n: 7, angle: angleTo(sim, b.x, b.y), spread: 0.8, speed: 3.0, color: 'orange' });
      },
    },
    {
      // Núcleo Ancestral: layered rings + spiral + ion rain, and summons Venatu
      // sentries. Speeds up below 35% HP (desperation).
      name: 'Núcleo Ancestral',
      hp: 1080,
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 42) * 140;
        const desperate = b.cardHp < b.cardMax * 0.35;
        const period = desperate ? 28 : 42;
        if (b.t % period === 0) {
          const base = sim.rng.range(0, 6.28);
          ringWithGap(sim, b.x, b.y, { n: 30, speed: 2.3, gapAngle: base, gapWidth: 0.5, color: 'cyan' });
          ring(sim, b.x, b.y, { n: 16, speed: 1.6, baseAngle: base, color: 'purple' });
        }
        const ph = b.t * (desperate ? 0.24 : 0.17);
        spiralArm(sim, b.x, b.y, { arms: 3, phase: ph, speed: 2.4, color: 'orange' });
        if (b.t % 12 === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 3.0, color: 'cyan', r: 5 });
        if (b.t % 260 === 40 && sim.enemies.active.length < 5) {
          for (let k = 0; k < 2; k++) {
            sim.spawnEnemy({
              x: b.x + (k ? 80 : -80), y: b.y + 10, vx: 0, vy: 1.1,
              hp: 26, r: 14, skin: 'venatu', score: 700,
              shoot: (s, e2) => { if (e2.t % 70 === 40) aimed(s, e2.x, e2.y, { speed: 3.0, color: 'cyan' }); },
            });
          }
          sim.events.push({ type: 'summon', x: b.x, y: b.y });
        }
      },
    },
  ],
};

// --- Seyren Windsor & Magaleta: level 5 dual boss (Biolab). Two bosses on the
// field at once, each 2 cards. Movement sways around b.homeX so they hold their
// own lane instead of both crowding the center. Balanced by spawnBosses' 0.7x
// per-boss HP scaling since their danmaku overlaps. ---

export const seyren = {
  name: 'Seyren Windsor',
  r: 46,
  targetY: 165,
  cards: [
    {
      // Espada Sangrienta: fast aimed red slashes + a gapped ring. Aggressive
      // melee knight — the aimed fans punish standing still.
      name: 'Espada Sangrienta',
      hp: 700,
      step(sim, b) {
        b.x = b.homeX + Math.sin(b.t / 46) * 90;
        if (b.t % 56 === 34) b.tele = 18;
        if (b.t % 56 === 0 && b.t > 0) {
          fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.5, speed: 3.4, color: 'red' });
        }
        if (b.t % 40 === 0) {
          const gap = sim.rng.range(0, Math.PI * 2);
          ringWithGap(sim, b.x, b.y, { n: 20, speed: 1.8, gapAngle: gap, gapWidth: 0.7, color: 'orange' });
        }
      },
    },
    {
      // Carga Berserker: lunges toward the player's column then rains spears —
      // desperation card, speeds up below 35% HP.
      name: 'Carga Berserker',
      hp: 820,
      step(sim, b) {
        const desperate = b.cardHp < b.cardMax * 0.35;
        const targetX = sim.players.find(Boolean)?.x ?? b.homeX;
        b.x += (targetX - b.x) * (desperate ? 0.06 : 0.04);
        b.x = Math.max(40, Math.min(FIELD_W - 40, b.x));
        const period = desperate ? 32 : 46;
        if (b.t % period === 0) {
          const base = sim.rng.range(0, 6.28);
          ring(sim, b.x, b.y, { n: 14, speed: 2.2, baseAngle: base, color: 'red' });
          fan(sim, b.x, b.y, { n: 3, angle: angleTo(sim, b.x, b.y), spread: 0.35, speed: 3.8, color: 'orange' });
        }
        if (b.t % (desperate ? 9 : 14) === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 3.2, color: 'red', r: 5 });
      },
    },
  ],
};

export const magaleta = {
  name: 'Magaleta',
  r: 44,
  targetY: 165,
  cards: [
    {
      // Danza de Almas: a slow rotating skull spiral plus aimed dark bolts.
      // The lesson: the spiral is readable — weave through it while dodging bolts.
      name: 'Danza de Almas',
      hp: 700,
      step(sim, b) {
        b.x = b.homeX + Math.sin(b.t / 50) * 90;
        const ph = b.t * 0.15;
        spiralArm(sim, b.x, b.y, { arms: 2, phase: ph, speed: 2.1, color: 'purple' });
        if (b.t % 74 === 0 && b.t > 0) {
          fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.6, speed: 2.9, color: 'cyan' });
        }
      },
    },
    {
      // Réquiem: layered gapped rings + counter-spiral + rain. Desperation card.
      name: 'Réquiem',
      hp: 820,
      step(sim, b) {
        b.x += (b.homeX - b.x) * 0.05;
        const desperate = b.cardHp < b.cardMax * 0.35;
        const period = desperate ? 30 : 44;
        if (b.t % period === 0) {
          const base = sim.rng.range(0, 6.28);
          ringWithGap(sim, b.x, b.y, { n: 26, speed: 2.2, gapAngle: base, gapWidth: 0.55, color: 'purple' });
          ring(sim, b.x, b.y, { n: 14, speed: 1.5, baseAngle: base, color: 'cyan' });
        }
        const ph = b.t * (desperate ? 0.22 : 0.16);
        spiralArm(sim, b.x, b.y, { arms: 2, phase: -ph, speed: 2.3, color: 'orange' });
        if (b.t % 13 === 0) rain(sim, sim.rng.range(20, FIELD_W - 20), { speed: 3.0, color: 'purple', r: 5 });
      },
    },
  ],
};
