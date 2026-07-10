// Level 2 — Torre de Geffen → Geffenia. Phase machine: tower → descent →
// geffenia → mid-boss Doppelganger → approach → Dark Lord. Deterministic.
import { FIELD_W, FIELD_H } from '../sim/constants.js';
import { spawnBoss, darkLord } from '../sim/boss.js';
import { ring, fan, aimed, spiralArm, angleTo } from '../sim/patterns.js';

// --- behaviors ---
function munakMove(sim, e) {
  e.y += Math.sin(e.t / 14) * 1.2; // hopping arc
  if (e.t % 80 === 12) e.tele = 20;
  if (e.t % 80 === 32) aimed(sim, e.x, e.y, { speed: 3.2, color: 'cyan' });
}
function ninetailsShoot(sim, e) {
  if (e.t % 90 === 60) e.tele = 24;
  if (e.t % 90 >= 60 && e.t % 90 < 84 && e.t % 4 === 0) spiralArm(sim, e.x, e.y, { arms: 1, phase: e.t * 0.4, speed: 2.4, color: 'orange' });
}
function deviruchiMove(sim, e) {
  e.x += Math.sin(e.t / 10) * 2.6;
  if (e.t % 65 === 20) e.tele = 18;
  if (e.t % 65 === 38) aimed(sim, e.x, e.y, { speed: 4.0, color: 'purple' });
}
function marionetteShoot(sim, e) {
  if (e.y < 70) { e.vy = Math.min(e.vy, 1.2); } else e.vy = 0;
  if (e.vy === 0 && e.t % 20 === 0) {
    sim.spawnEnemyBullet({ x: e.x + sim.rng.range(-40, 40), y: e.y + 10, vx: 0, vy: 2.6, color: 'purple', r: 5 });
  }
  if (e.t > 480) e.vy = 1.2;
}
function wraithMove(sim, e) {
  if (e.t % 120 === 90) e.tele = 26;
  if (e.t % 120 === 116) { // blink toward a player
    const p = nearest(sim, e);
    if (p) { e.x = Math.max(30, Math.min(FIELD_W - 30, p.x + sim.rng.range(-60, 60))); e.y = Math.max(60, p.y - 180); }
    ring(sim, e.x, e.y, { n: 8, speed: 2.2, baseAngle: sim.rng.range(0, 6.28), color: 'purple' });
  }
}
function zombieRevive(sim, e) {
  if (e.revived) return;
  sim.spawnEnemy({ x: e.x, y: e.y, vx: 0, vy: 0.6, hp: 7, r: 14, skin: 'zombie', score: 100, revived: true, shoot: zombieMove });
}
function zombieMove(sim, e) { /* just shambles down */ }

// mid-boss Doppelganger: mirrors the player's horizontal position with dense
// aimed fans + rings — a duel against your own shadow.
function doppelStep(sim, e) {
  if (e.y < 150) { e.vy = 1.4; return; }
  e.vy = 0;
  const p = nearest(sim, e);
  if (p) e.x += ((FIELD_W - p.x) - e.x) * 0.04; // mirror the player across the arena
  if (e.t % 40 === 24) e.tele = 16;
  if (e.t % 40 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 5, angle: angleTo(sim, e.x, e.y), spread: 0.6, speed: 3.2, color: 'purple' });
  if (e.t % 120 === 60) ring(sim, e.x, e.y, { n: 18, speed: 2.0, baseAngle: sim.rng.range(0, 6.28), color: 'red' });
}

function nearest(sim, e) {
  let best = null, bd = Infinity;
  for (const p of sim.players) { if (!p || p.down) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

// --- spawns ---
function willow(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: sim.rng.range(-0.3, 0.3), vy: 0.7, hp: 26, r: 17, skin: 'willow', score: 300, drop: sim.rng.next() < 0.2 ? 'zeny' : null }); }
function zombie(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: 0, vy: 0.7, hp: 14, r: 15, skin: 'zombie', score: 250, onDeath: zombieRevive }); }
function munak(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: sim.rng.range(-0.5, 0.5), vy: 1.0, hp: 12, r: 14, skin: 'munak', score: 250, shoot: munakMove }); }
function bongun(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 3.4, hp: 10, r: 14, skin: 'bongun', score: 200 }); }
function ninetails(sim) { sim.spawnEnemy({ x: sim.rng.range(80, FIELD_W - 80), y: -30, vx: 0, vy: 1.2, hp: 16, r: 14, skin: 'ninetails', score: 350, shoot: ninetailsShoot, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function deviruchi(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.1, hp: 12, r: 13, skin: 'deviruchi', score: 350, shoot: deviruchiMove }); }
function marionette(sim) { sim.spawnEnemy({ x: sim.rng.range(80, FIELD_W - 80), y: -30, vx: 0, vy: 2.0, hp: 20, r: 14, skin: 'marionette', score: 400, shoot: marionetteShoot, drop: sim.rng.next() < 0.15 ? 'chest' : null }); }
function wraith(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.0, hp: 14, r: 13, skin: 'wraith', score: 300, shoot: wraithMove }); }

export function level2(sim) {
  if (!sim.level) sim.level = { phase: 'tower', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    case 'tower':
      approach(0.15, 0.01);
      if (t % 50 === 0) munak(sim);
      if (t % 90 === 30) willow(sim);
      if (t > 400 && t % 120 === 0) bongun(sim);
      if (t >= 1300) { L.phase = 'descent'; L.t = 0; }
      break;
    case 'descent':
      approach(0.5, 0.012);
      if (t % 70 === 0) ninetails(sim);
      if (t % 100 === 40) zombie(sim);
      if (t % 130 === 70) deviruchi(sim);
      if (t > 300 && t % 240 === 0) marionette(sim);
      if (t >= 1400) { L.phase = 'geffenia'; L.t = 0; }
      break;
    case 'geffenia':
      approach(0.85, 0.012);
      if (t % 80 === 0) deviruchi(sim);
      if (t % 100 === 50) wraith(sim);
      if (t % 120 === 30) marionette(sim);
      if (t > 300 && t % 200 === 0) ninetails(sim);
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      approach(0.9, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Doppelganger' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 520, r: 40,
          skin: 'doppelganger', score: 12000, shoot: doppelStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'approach'; L.t = 0; }
      break;
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, darkLord); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
