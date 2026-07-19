// Level 5 — Lighthalzen Biolab, the campaign finale. Phase machine:
// containment → labs → reactor → mid-boss Failed Experiment (~60%) → inner
// sanctum → Seyren & Magaleta (dual final boss). Deterministic (rng/tick only).
import { FIELD_W } from '../sim/constants.js';
import { spawnBosses, seyren, magaleta } from '../sim/boss.js';
import { ring, fan, aimed, spiralArm, rain, angleTo } from '../sim/patterns.js';

// --- behaviors (8 Biolab mob skins) ---
function failedexpStep(sim, e) {
  // shambling reject: lurching aimed spit up close
  if (e.t % 95 === 65) e.tele = 20;
  if (e.t % 95 === 0 && e.t > 0) aimed(sim, e.x, e.y, { speed: 2.9, color: 'orange' });
}
function removerStep(sim, e) {
  // cleanup drone: strafes and fires a small gapped ring
  e.x += Math.sin(e.t / 22) * 1.6;
  if (e.t % 110 === 0 && e.t > 0) ring(sim, e.x, e.y, { n: 8, speed: 1.9, baseAngle: sim.rng.range(0, 6.28), color: 'purple', r: 6 });
}
function labdroneStep(sim, e) {
  // floating sentry: telegraphed toxic bolt fan
  e.x += Math.sin(e.t / 26) * 1.1;
  if (e.t % 100 === 70) e.tele = 22;
  if (e.t % 100 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.4, speed: 3.2, color: 'cyan' });
}
function testsubjectStep(sim, e) {
  // erratic escapee: skitters and coughs a short aimed burst
  e.x += Math.sin(e.t / 10) * 2.2;
  if (e.t % 70 === 45) aimed(sim, e.x, e.y, { speed: 3.0, color: 'red' });
}
function sporecloudStep(sim, e) {
  // drifting spore: pulses a slow ring of toxin
  if (e.t % 120 === 90) e.tele = 18;
  if (e.t % 120 === 0 && e.t > 0) ring(sim, e.x, e.y, { n: 10, speed: 1.4, baseAngle: sim.rng.range(0, 6.28), color: 'green', r: 6 });
}
function mutanthoundStep(sim, e) {
  // fast pack hunter: lunges downfield, fast aimed snap
  if (e.t % 60 === 40) e.tele = 14;
  if (e.t % 60 === 0 && e.t > 0) aimed(sim, e.x, e.y, { speed: 3.8, color: 'red' });
}
function serumturretStep(sim, e) {
  // stops and turns turret: fast aimed volley
  if (e.y < e.stopY) { e.vy = Math.min(e.vy, 1.4); } else e.vy = 0;
  if (e.vy === 0) {
    if (e.t % 85 === 58) e.tele = 22;
    if (e.t % 85 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.25, speed: 4.2, color: 'cyan' });
  }
}
function biosludgeStep(sim, e) {
  // slow tank blob: wide sweep of bullets when close
  if (e.t % 130 === 100) e.tele = 26;
  if (e.t % 130 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 5, angle: Math.PI / 2, spread: 1.1, speed: 3.0, color: 'green' });
}

// mid-boss: Failed Experiment (Alpha) — an unstable specimen that broke out.
function failedAlphaStep(sim, e) {
  if (e.y < 155) { e.vy = 1.3; e.at = -1; return; }
  e.vy = 0;
  e.at = (e.at ?? -1) + 1;
  const cyc = e.at % 220;
  if (cyc < 140) {
    // stance A: sway + rotating spiral + aimed spit
    e.x = FIELD_W / 2 + Math.sin(e.at / 42) * 160;
    spiralArm(sim, e.x, e.y, { arms: 2, phase: e.at * 0.16, speed: 2.2, color: 'green' });
    if (cyc % 46 === 24) aimed(sim, e.x, e.y, { speed: 3.0, color: 'red' });
  } else {
    // stance B: recenter + toxic rain sweep
    e.x += (FIELD_W / 2 - e.x) * 0.08;
    const k = cyc - 140;
    if (k === 0) e.tele = 20;
    if (k >= 16 && k % 6 === 0) {
      const frac = (k - 16) / (220 - 140 - 16);
      rain(sim, 30 + frac * (FIELD_W - 60), { speed: 2.8, color: 'purple', r: 6 });
    }
  }
}

// --- spawns ---
function failedexp(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: sim.rng.range(-0.3, 0.3), vy: 1.0, hp: 18, r: 15, skin: 'failedexp', score: 300, shoot: failedexpStep }); }
function remover(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.0, hp: 16, r: 14, skin: 'remover', score: 350, shoot: removerStep, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function labdrone(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.9, hp: 16, r: 14, skin: 'labdrone', score: 350, shoot: labdroneStep, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function testsubject(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: 0, vy: 1.2, hp: 12, r: 13, skin: 'testsubject', score: 300, shoot: testsubjectStep }); }
function sporecloud(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.8, hp: 14, r: 15, skin: 'sporecloud', score: 300, shoot: sporecloudStep }); }
function mutanthound(sim) { sim.spawnEnemy({ x: sim.rng.range(40, FIELD_W - 40), y: -30, vx: sim.rng.range(-0.6, 0.6), vy: 2.0, hp: 14, r: 13, skin: 'mutanthound', score: 350, shoot: mutanthoundStep }); }
function serumturret(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 2.2, stopY: sim.rng.range(90, 200), hp: 22, r: 16, skin: 'serumturret', score: 400, shoot: serumturretStep }); }
function biosludge(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.7, hp: 42, r: 18, skin: 'biosludge', score: 500, shoot: biosludgeStep, drop: sim.rng.next() < 0.2 ? 'zeny' : null }); }

export function level5(sim) {
  if (!sim.level) sim.level = { phase: 'containment', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    case 'containment':
      approach(0.15, 0.01);
      if (t % 55 === 0) failedexp(sim);
      if (t % 90 === 30) sporecloud(sim);
      if (t > 400 && t % 150 === 0) testsubject(sim);
      if (t >= 1300) { L.phase = 'labs'; L.t = 0; }
      break;
    case 'labs':
      approach(0.38, 0.012);
      if (t % 80 === 0) labdrone(sim);
      if (t % 110 === 40) remover(sim);
      if (t % 140 === 70) serumturret(sim);
      if (t > 300 && t % 200 === 0) mutanthound(sim);
      if (t >= 1400) { L.phase = 'reactor'; L.t = 0; }
      break;
    case 'reactor':
      approach(0.56, 0.012);
      if (t % 90 === 0) biosludge(sim);
      if (t % 100 === 40) labdrone(sim);
      if (t % 120 === 60) remover(sim);
      if (t > 300 && t % 150 === 0) mutanthound(sim);
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      // mid-boss at ~60%; the sanctum screens fill 60->100%
      approach(0.62, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Experimento Fallido' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 620, r: 40,
          skin: 'failedexp', score: 18000, shoot: failedAlphaStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'sanctum'; L.t = 0; }
      break;
    case 'sanctum': {
      // final descent through the inner-sanctum screens toward the two knights.
      approach(0.9, 0.008);
      if (t % 95 === 0) labdrone(sim);
      if (t % 120 === 40) biosludge(sim);
      if (t % 100 === 70) serumturret(sim);
      if (t % 150 === 30) mutanthound(sim);
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1500) { L.phase = 'approach'; L.t = 0; }
      break;
    }
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBosses(sim, [seyren, magaleta]); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
