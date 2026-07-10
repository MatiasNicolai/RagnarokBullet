// Level 3 — Glast Heim. Phase machine: courtyard → halls → inner sanctum →
// mid-boss Baphomet Jr. (giant) → approach → Baphomet (final). Deterministic.
import { FIELD_W, FIELD_H } from '../sim/constants.js';
import { spawnBoss, baphomet } from '../sim/boss.js';
import { ring, fan, aimed, angleTo } from '../sim/patterns.js';

// --- behaviors ---
function evildruidShoot(sim, e) {
  if (e.t % 100 === 70) e.tele = 24;
  if (e.t % 100 === 0 && e.t > 0) ring(sim, e.x, e.y, { n: 8, speed: 1.4, baseAngle: sim.rng.range(0, 6.28), color: 'purple', r: 8 });
}
function darkpriestMove(sim, e) {
  if (e.t % 130 === 100) e.tele = 26;
  if (e.t % 130 === 126) {
    const p = nearest(sim, e);
    if (p) { e.x = Math.max(30, Math.min(FIELD_W - 30, p.x + sim.rng.range(-80, 80))); e.y = Math.max(60, sim.rng.range(80, 200)); }
    fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.3, speed: 4.0, color: 'red' });
  }
}
function raydricShoot(sim, e) {
  if (e.t % 110 === 80) e.tele = 24;
  if (e.t % 110 === 0 && e.t > 0) {
    const gapX = sim.rng.range(80, FIELD_W - 80);
    for (let x = 30; x < FIELD_W - 20; x += 34) {
      if (Math.abs(x - gapX) < 48) continue; // safe lane
      sim.spawnEnemyBullet({ x, y: e.y, vx: 0, vy: 2.6, color: 'red', r: 6 });
    }
  }
}
function gargoyleShoot(sim, e) {
  if (e.y < e.stopY) { e.vy = Math.min(e.vy, 1.4); } else e.vy = 0;
  if (e.vy === 0) {
    if (e.t % 75 === 50) e.tele = 20;
    if (e.t % 75 === 0 && e.t > 0) fan(sim, e.x, e.y, { n: 3, angle: angleTo(sim, e.x, e.y), spread: 0.5, speed: 3.6, color: 'orange' });
  }
}
function whisperMove(sim, e) {
  // intangible except in a brief window right before/while it shoots
  const c = e.t % 100;
  if (c === 60) e.tele = 20;
  if (c >= 72 && c <= 90) {
    e.invuln = false;
    if (c === 80) aimed(sim, e.x, e.y, { speed: 3.4, color: 'cyan' });
  } else {
    e.invuln = true;
  }
  e.x += Math.sin(e.t / 20) * 1.4;
}
function baphoJrShoot(sim, e) {
  if (e.t % 70 === 30) fan(sim, e.x, e.y, { n: 4, angle: Math.PI / 2, spread: 1.4, speed: 3.0, color: 'purple' });
}

// mid-boss: giant Baphomet Jr. — fast cross-scythe volleys.
function bigBaphoJrStep(sim, e) {
  if (e.y < 155) { e.vy = 1.3; return; }
  e.vy = 0;
  e.x = FIELD_W / 2 + Math.sin(e.t / 42) * 165;
  if (e.t % 70 === 50) e.tele = 18;
  if (e.t % 70 === 0 && e.t > 0) {
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      fan(sim, e.x, e.y, { n: 3, angle: a + e.t * 0.05, spread: 0.4, speed: 2.6, color: 'red' });
    }
  }
  if (e.t % 40 === 20) aimed(sim, e.x, e.y, { speed: 3.4, color: 'purple' });
}

function nearest(sim, e) {
  let best = null, bd = Infinity;
  for (const p of sim.players) { if (!p || p.down) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}

// --- spawns ---
function evildruid(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: sim.rng.range(-0.4, 0.4), vy: 0.9, hp: 18, r: 15, skin: 'evildruid', score: 350, shoot: evildruidShoot }); }
function darkpriest(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.0, hp: 16, r: 13, skin: 'darkpriest', score: 400, shoot: darkpriestMove, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function raydric(sim) { sim.spawnEnemy({ x: sim.rng.range(80, FIELD_W - 80), y: -30, vx: sim.rng.range(-0.3, 0.3), vy: 0.8, hp: 22, r: 15, skin: 'raydric', score: 400, shoot: raydricShoot }); }
function khalitzburg(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 0.7, hp: 34, r: 17, skin: 'khalitzburg', score: 450, drop: sim.rng.next() < 0.2 ? 'zeny' : null }); }
function gargoyle(sim) { sim.spawnEnemy({ x: sim.rng.range(40, FIELD_W - 40), y: -30, vx: 0, vy: 2.2, stopY: sim.rng.range(90, 200), hp: 14, r: 13, skin: 'gargoyle', score: 350, shoot: gargoyleShoot }); }
function ghoul(sim) { sim.spawnEnemy({ x: sim.rng.range(50, FIELD_W - 50), y: -30, vx: sim.rng.range(-0.4, 0.4), vy: 1.0, hp: 12, r: 14, skin: 'ghoul', score: 200 }); }
function whisper(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.0, hp: 10, r: 13, skin: 'whisper', score: 400, invuln: true, shoot: whisperMove, drop: sim.rng.next() < 0.12 ? 'gem' : null }); }
function baphoJr(sim) { sim.spawnEnemy({ x: sim.rng.range(60, FIELD_W - 60), y: -30, vx: 0, vy: 1.1, hp: 16, r: 14, skin: 'bapho_jr', score: 400, shoot: baphoJrShoot }); }

export function level3(sim) {
  if (!sim.level) sim.level = { phase: 'courtyard', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    case 'courtyard':
      approach(0.15, 0.01);
      if (t % 60 === 0) ghoul(sim);
      if (t % 90 === 30) evildruid(sim);
      if (t > 400 && t % 150 === 0) gargoyle(sim);
      if (t >= 1300) { L.phase = 'halls'; L.t = 0; }
      break;
    case 'halls':
      approach(0.5, 0.012);
      if (t % 80 === 0) raydric(sim);
      if (t % 110 === 40) darkpriest(sim);
      if (t % 140 === 70) khalitzburg(sim);
      if (t > 300 && t % 200 === 0) whisper(sim);
      if (t >= 1400) { L.phase = 'sanctum'; L.t = 0; }
      break;
    case 'sanctum':
      approach(0.85, 0.012);
      if (t % 90 === 0) baphoJr(sim);
      if (t % 100 === 40) whisper(sim);
      if (t % 120 === 60) darkpriest(sim);
      if (t > 300 && t % 160 === 0) raydric(sim);
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      approach(0.9, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Baphomet Jr.' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 360, r: 38,
          skin: 'bapho_jr_giant', score: 15000, shoot: bigBaphoJrStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'approach'; L.t = 0; }
      break;
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, baphomet); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
