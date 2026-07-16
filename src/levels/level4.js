// Level 4 — Juperos, the buried machine civilization. Phase machine:
// entrance → corridor → machine hall → mid-boss Archdam (~60%) → core approach
// → Vesper (final boss). Deterministic (rng/tick only).
import { FIELD_W } from '../sim/constants.js';
import { spawnBoss, vesper } from '../sim/boss.js';
import { ring, fan, aimed, spiralArm, rain, angleTo } from '../sim/patterns.js';

// --- behaviors ---
function dimikStep(sim, e) {
  // crawls; short aimed bursts up close
  if (e.t % 90 === 60) e.tele = 20;
  if (e.t % 90 === 0 && e.t > 0) aimed(sim, e.x, e.y, { speed: 3.0, color: 'red' });
}
function venatuStep(sim, e) {
  // floating sentry: telegraphed ion bolt
  e.x += Math.sin(e.t / 24) * 1.2;
  if (e.t % 100 === 70) e.tele = 24;
  if (e.t % 100 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.4, speed: 3.2, color: 'cyan' });
}
function cellStep(sim, e) {
  // fragile energy cube: pulses a small ring
  if (e.t % 120 === 90) e.tele = 20;
  if (e.t % 120 === 0 && e.t > 0) ring(sim, e.x, e.y, { n: 8, speed: 1.8, baseAngle: sim.rng.range(0, 6.28), color: 'cyan', r: 6 });
}
function sentryStep(sim, e) {
  // stops and turns into a turret, then fires a fast aimed volley
  if (e.y < e.stopY) { e.vy = Math.min(e.vy, 1.4); } else e.vy = 0;
  if (e.vy === 0) {
    if (e.t % 80 === 55) e.tele = 22;
    if (e.t % 80 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.25, speed: 4.2, color: 'cyan' });
  }
}
function plasmaStep(sim, e) {
  // erratic energy wisp: a spiral arm while it drifts
  e.x += Math.sin(e.t / 12) * 2.4;
  if (e.t % 60 >= 30 && e.t % 60 < 54 && e.t % 4 === 0) spiralArm(sim, e.x, e.y, { arms: 1, phase: e.t * 0.5, speed: 2.4, color: 'cyan' });
}
function guardianStep(sim, e) {
  // slow tank: melee sweep of fast bullets when close
  if (e.t % 130 === 100) e.tele = 26;
  if (e.t % 130 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 5, angle: Math.PI / 2, spread: 1.1, speed: 3.2, color: 'cyan' });
}
function repairStep(sim, e) {
  // support drone: heals nearby machines (buff) — here just a defensive drift + weak shots
  e.x += Math.sin(e.t / 18) * 1.6;
  if (e.t % 100 === 40) aimed(sim, e.x, e.y, { speed: 2.6, color: 'orange' });
}
// spark beetle: just skitters fast (no shot)

// mid-boss: Archdam — heavy war-robot. Cross volleys + charging spear rain.
function archdamStep(sim, e) {
  if (e.y < 155) { e.vy = 1.3; e.at = -1; return; }
  e.vy = 0;
  e.at = (e.at ?? -1) + 1;
  const cyc = e.at % 240;
  if (cyc < 150) {
    // stance A: sway + cross ion volleys
    e.x = FIELD_W / 2 + Math.sin(e.at / 44) * 160;
    if (cyc % 70 === 50) e.tele = 18;
    if (cyc % 70 === 0 && e.at > 0) {
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) fan(sim, e.x, e.y, { n: 3, angle: a + e.at * 0.05, spread: 0.4, speed: 2.5, color: 'cyan' });
    }
    if (cyc % 40 === 20) aimed(sim, e.x, e.y, { speed: 3.0, color: 'red' });
  } else {
    // stance B: recenter + heavy spear rain in a sweep
    e.x += (FIELD_W / 2 - e.x) * 0.08;
    const k = cyc - 150;
    if (k === 0) e.tele = 20;
    if (k >= 16 && k % 6 === 0) {
      const frac = (k - 16) / (240 - 150 - 16);
      rain(sim, 30 + frac * (FIELD_W - 60), { speed: 2.9, color: 'red', r: 6 });
    }
  }
}

// --- spawns ---
function dimik(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: sim.rng.range(-0.3, 0.3), vy: 1.0, hp: 18, r: 15, skin: 'dimik', score: 300, shoot: dimikStep }); }
function venatu(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.9, hp: 16, r: 14, skin: 'venatu', score: 350, shoot: venatuStep, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function cell(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.1, hp: 10, r: 13, skin: 'cell', score: 250, shoot: cellStep, drop: sim.rng.next() < 0.15 ? 'zeny' : null }); }
function sentry(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 2.2, stopY: sim.rng.range(90, 200), hp: 22, r: 16, skin: 'sentry', score: 400, shoot: sentryStep }); }
function plasma(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: 0, vy: 1.0, hp: 12, r: 13, skin: 'plasma', score: 350, shoot: plasmaStep }); }
function guardian(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.7, hp: 40, r: 18, skin: 'guardian', score: 500, shoot: guardianStep, drop: sim.rng.next() < 0.2 ? 'zeny' : null }); }
function repairdrone(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.0, hp: 20, r: 14, skin: 'repairdrone', score: 350, shoot: repairStep, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function sparkbeetle(sim) { sim.spawnEnemy({ x: sim.rng.range(40, FIELD_W - 40), y: -30, vx: sim.rng.range(-0.6, 0.6), vy: 1.6, hp: 10, r: 12, skin: 'sparkbeetle', score: 200 }); }

export function level4(sim) {
  if (!sim.level) sim.level = { phase: 'entrance', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    case 'entrance':
      approach(0.15, 0.01);
      if (t % 55 === 0) dimik(sim);
      if (t % 90 === 30) cell(sim);
      if (t > 400 && t % 150 === 0) sparkbeetle(sim);
      if (t >= 1300) { L.phase = 'corridor'; L.t = 0; }
      break;
    case 'corridor':
      approach(0.38, 0.012);
      if (t % 80 === 0) venatu(sim);
      if (t % 110 === 40) dimik(sim);
      if (t % 140 === 70) sentry(sim);
      if (t > 300 && t % 200 === 0) plasma(sim);
      if (t >= 1400) { L.phase = 'hall'; L.t = 0; }
      break;
    case 'hall':
      approach(0.56, 0.012);
      if (t % 90 === 0) guardian(sim);
      if (t % 100 === 40) venatu(sim);
      if (t % 120 === 60) repairdrone(sim);
      if (t > 300 && t % 160 === 0) plasma(sim);
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      // mid-boss at ~60%; the core-approach screens fill 60->100%
      approach(0.62, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Archdam' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 640, r: 40,
          skin: 'archdam', score: 18000, shoot: archdamStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'core'; L.t = 0; }
      break;
    case 'core': {
      // final descent through the two core-approach screens toward Vesper.
      approach(0.9, 0.008);
      if (t % 95 === 0) venatu(sim);
      if (t % 120 === 40) guardian(sim);
      if (t % 100 === 70) plasma(sim);
      if (t % 150 === 30) sentry(sim);
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1500) { L.phase = 'approach'; L.t = 0; }
      break;
    }
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, vesper); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
