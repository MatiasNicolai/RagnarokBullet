// Boss system: a single sim.boss with named spell cards (phases). Each card
// has an HP pool and a step(sim, b) that drives movement + danmaku from b.t.
// Deterministic: only sim.rng / b.t, like the rest of the sim.
import { FIELD_W } from './constants.js';
import { ring, ringWithGap, fan, aimed, spiralArm, rain, angleTo } from './patterns.js';

export function spawnBoss(sim, def) {
  // Co-op nearly doubles party DPS; scale card HP so the fight keeps its
  // intended length (learn the pattern, find the flow) with 2 players too.
  const hpMult = sim.players.filter(Boolean).length > 1 ? 1.7 : 1;
  const maxHp = Math.round(def.cards.reduce((s, c) => s + c.hp, 0) * hpMult);
  sim.boss = {
    def,
    hpMult,
    name: def.name,
    x: FIELD_W / 2, y: -90,
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
    transition: 0,
    dying: 0,
    dead: false,
  };
  sim.events.push({ type: 'bossWarning', name: def.name });
}

// Called each tick from the sim. Returns nothing; mutates sim.boss / sim.
export function stepBoss(sim) {
  const b = sim.boss;
  if (!b) return;
  if (b.hitFlash > 0) b.hitFlash--;

  if (b.intro) {
    b.y += 2.2;
    if (b.y >= b.targetY) { b.y = b.targetY; b.intro = false; b.t = 0; }
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
    if (b.dying === 0) {
      b.dead = true;
      sim.boss = null;
      sim.enemyBullets.clear();
      sim.levelComplete = true;
      sim.events.push({ type: 'levelClear' });
    }
    return;
  }

  if (b.transition > 0) {
    b.transition--;
    // drift back to center during the card break
    b.x += (FIELD_W / 2 - b.x) * 0.05;
    if (b.transition === 0) {
      b.t = 0;
      sim.events.push({ type: 'spellCard', name: b.cardName });
    }
    return;
  }

  b.def.cards[b.cardIndex].step(sim, b);
  b.t++;
}

// Player bullet dealt `dmg` to the boss. Handles card transitions + death.
export function damageBoss(sim, dmg) {
  const b = sim.boss;
  if (!b || b.intro || b.dying > 0 || b.transition > 0) return;
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
      sim.enemyBullets.clear();
      sim.events.push({ type: 'bossPhase', x: b.x, y: b.y });
    } else {
      b.dying = 90;
      sim.enemyBullets.clear();
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
