// Level 1 — Campos de Prontera → Plaza de Prontera. Orcs are raiding the city;
// you push from the outer fields up the royal avenue to the central plaza.
// Uses only the 5 real animated monster sprites (Poring, Pupa, Picky, Chonchon,
// Orc Baby) for a cohesive look. Phase machine, deterministic (rng/tick only).
import { FIELD_W } from '../sim/constants.js';
import { spawnBoss, orcHero } from '../sim/boss.js';
import { ring, ringWithGap, fan, aimed, angleTo, nearestPlayer } from '../sim/patterns.js';

// --- enemy behaviors (each telegraphs ~20 ticks before firing) ---

function pickyMove(sim, e) {
  e.x += Math.sin(e.t / 12) * 2.4; // fast zigzag flock, no shots
}
function chonchonMove(sim, e) {
  // drift in, then dive at the nearest player with a parting shot
  if (e.t === 70) {
    const a = angleTo(sim, e.x, e.y);
    e.vx = Math.cos(a) * 4.2; e.vy = Math.sin(a) * 4.2;
    e.tele = 16;
  }
  if (e.t === 86) aimed(sim, e.x, e.y, { speed: 3.2, color: 'purple' });
}
function pupaShoot(sim, e) {
  // slow-crawling cocoon that pulses out rings; bursts on death
  if (e.t % 130 === 100) e.tele = 24;
  if (e.t % 130 === 0 && e.t > 0) {
    ring(sim, e.x, e.y, { n: 10, speed: 1.7, baseAngle: sim.rng.range(0, 6.28), color: 'red', r: 6 });
  }
}
function pupaExplode(sim, e) {
  ring(sim, e.x, e.y, { n: 16, speed: 2.4, baseAngle: sim.rng.range(0, 6.28), color: 'cyan' });
}
function orcBabyShoot(sim, e) {
  // the main threat: telegraphed aimed fans
  if (e.t % 70 === 20) e.tele = 22;
  if (e.t % 70 === 42) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.4, speed: 3.4, color: 'orange' });
}
function lunaticShoot(sim, e) {
  // bunny hops to a spot then pumps out rings; hops away after a while
  if (e.y < e.stopY) e.vy = Math.min(e.vy, 1.6); else e.vy = 0;
  if (e.vy === 0) {
    if (e.t % 100 === 78) e.tele = 22;
    if (e.t % 100 === 0 && e.t > 0) ring(sim, e.x, e.y, { n: 12, speed: 2.1, baseAngle: sim.rng.range(0, 6.28), color: 'red' });
  }
  if (e.t > 560) e.vy = 1.6;
}

// mid-boss Mastering: a giant poring — its signature is the HOP & SLAM.
// Cycle: sway spitting baby porings → telegraph → hop onto the player's x →
// landing shockwave (gapped double ring: read the gap, slip through).
function masteringStep(sim, e) {
  // cycle clocked from arrival (e.at) so the hop never runs without its
  // telegraph having set slamX (descent early-returns would skip it).
  if (e.y < 150) { e.vy = 1.2; e.at = -1; return; }
  e.vy = 0;
  e.at = (e.at ?? -1) + 1;
  const cyc = e.at % 180;
  if (cyc < 110) {
    // sway phase (lerped so the post-slam return doesn't snap)
    const target = FIELD_W / 2 + Math.sin(e.t / 45) * 160;
    e.x += (target - e.x) * 0.08;
    if (cyc % 90 === 45) {
      sim.spawnEnemy({
        x: e.x + sim.rng.range(-30, 30), y: e.y + 20,
        vx: sim.rng.range(-1, 1), vy: sim.rng.range(1, 1.8),
        hp: 5, r: 15, skin: 'poring', score: 100,
      });
    }
  } else if (cyc === 110) {
    e.tele = 26;                                   // squash: the hop is coming
    const p = nearestPlayer(sim, e.x, e.y);
    e.slamX = p ? p.x : FIELD_W / 2;
  } else if (cyc >= 136 && cyc < 156) {
    e.x += (e.slamX - e.x) * 0.3;                  // the hop
  } else if (cyc === 156) {
    // SLAM: shockwave rings with a readable escape gap
    const gap = sim.rng.range(0, Math.PI * 2);
    ringWithGap(sim, e.x, e.y, { n: 22, speed: 1.9, gapAngle: gap, gapWidth: 0.6, color: 'red' });
    ringWithGap(sim, e.x, e.y, { n: 22, speed: 1.5, gapAngle: gap, gapWidth: 0.6, color: 'orange' });
  }
}

// --- spawns (only the 5 real-sprite monsters) ---
function spawnPoring(sim) {
  sim.spawnEnemy({
    x: sim.rng.range(40, FIELD_W - 40), y: -30,
    vx: sim.rng.range(-0.8, 0.8), vy: sim.rng.range(0.9, 1.5),
    hp: 6, r: 18, skin: 'poring', score: 100, drop: sim.rng.next() < 0.1 ? 'gem' : null,
  });
}
function spawnPickyFlock(sim) {
  const n = 4 + sim.rng.int(0, 3);
  const baseX = sim.rng.range(60, FIELD_W - 60);
  for (let i = 0; i < n; i++) {
    sim.spawnEnemy({
      x: baseX + (i - n / 2) * 26, y: -30 - i * 18,
      vx: 0, vy: 2.2, hp: 3, r: 14, skin: 'picky', score: 120, shoot: pickyMove,
    });
  }
}
function spawnChonchon(sim) {
  sim.spawnEnemy({
    x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.4,
    hp: 6, r: 15, skin: 'chonchon', score: 150, shoot: chonchonMove,
    drop: sim.rng.next() < 0.08 ? 'gem' : null,
  });
}
function spawnPupa(sim) {
  const roll = sim.rng.next();
  sim.spawnEnemy({
    x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: sim.rng.range(-0.3, 0.3), vy: 0.5,
    hp: 18, r: 17, skin: 'pupa', score: 300, shoot: pupaShoot, onDeath: pupaExplode,
    drop: roll < 0.14 ? 'chest' : roll < 0.4 ? 'gem' : null,
  });
}
function spawnOrcBaby(sim) {
  sim.spawnEnemy({
    x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: sim.rng.range(-0.4, 0.4), vy: 1.0,
    hp: 16, r: 17, skin: 'orcbaby', score: 350, shoot: orcBabyShoot,
    drop: sim.rng.next() < 0.1 ? 'potion' : null,
  });
}
function spawnLunatic(sim) {
  const roll = sim.rng.next();
  sim.spawnEnemy({
    x: sim.rng.range(80, FIELD_W - 80), y: -30, vx: 0, vy: 2.2,
    stopY: sim.rng.range(120, 240), hp: 16, r: 15, skin: 'lunatic', score: 400,
    shoot: lunaticShoot, drop: roll < 0.12 ? 'chest' : roll < 0.4 ? 'gem' : null,
  });
}

export function level1(sim) {
  if (!sim.level) sim.level = { phase: 'fields', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    case 'fields': {
      approach(0.2, 0.01);
      if (t % 40 === 0) spawnPoring(sim);
      if (t % 220 === 120) spawnPickyFlock(sim);
      if (t > 500 && t % 160 === 0) spawnChonchon(sim);
      if (t >= 1300) { L.phase = 'gate'; L.t = 0; }
      break;
    }
    case 'gate': {
      approach(0.55, 0.012);
      if (t % 55 === 0) spawnPoring(sim);
      if (t % 180 === 40) spawnPupa(sim);
      if (t % 150 === 90) spawnChonchon(sim);
      if (t > 400 && t % 260 === 0) spawnLunatic(sim);
      if (t >= 1400) { L.phase = 'avenue'; L.t = 0; }
      break;
    }
    case 'avenue': {
      approach(0.85, 0.012);
      if (t % 90 === 0) spawnOrcBaby(sim);
      if (t % 150 === 60) spawnPupa(sim);
      if (t % 170 === 90) spawnPickyFlock(sim);
      if (t > 300 && t % 220 === 0) spawnLunatic(sim);
      if (t > 300 && t % 200 === 0) spawnChonchon(sim);
      // a guaranteed chest partway through
      if (t === 700) { const it = sim.spawnItem(sim.rng.range(80, FIELD_W - 80), -20, 'chest'); it.vy = 1.2; }
      if (t >= 1200) { L.phase = 'midboss'; L.t = 0; }
      break;
    }
    case 'midboss': {
      approach(0.92, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Mastering' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 420, r: 42,
          skin: 'mastering', score: 8000, shoot: masteringStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'approach'; L.t = 0; }
      break;
    }
    case 'approach': {
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, orcHero); }
      break;
    }
    case 'boss': {
      if (sim.levelComplete) L.phase = 'done';
      break;
    }
    default: break;
  }
}
