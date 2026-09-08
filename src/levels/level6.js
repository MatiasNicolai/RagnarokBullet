// Level 6: Pyramid of the Sun (oasis approach -> entrance -> inner descent ->
// Osiris arena -> royal tomb -> solar sanctuary -> Amon-Ra). The expedition
// pushes one notch past Biolab: tougher hulls, slightly faster curtains, a
// mobile midboss and a near-stationary throne boss.
import { FIELD_W } from '../sim/constants.js';
import { ring, ringWithGap, fan, aimed, spiralArm, rain, angleTo, nearestPlayer } from '../sim/patterns.js';
import { spawnBoss, amonRa } from '../sim/boss.js';

// Familiar: swooping scout — sine drift, dives at the player with aimed bolts.
// edge 0 enters from the left, edge 1 from the right (symmetric inward base).
function familiar(sim, edge) {
  const vx0 = edge === 0 ? 1.6 : -1.6;
  const x = edge === 0 ? -40 : FIELD_W + 40;
  sim.spawnEnemy({
    x, y: -30, vx: vx0, vy: 1.2, hp: 20, r: 16, skin: 'familiar', score: 500,
    shoot: (s, e) => {
      e.vx = vx0 + Math.sin(e.t / 26) * 1.4;
      if (e.t % 80 === 40) aimed(s, e.x, e.y, { speed: 3.1, color: 'purple' });
    },
  });
}

// Soldier Skeleton: shielded infantry — slow, sturdy, straight aimed volleys.
function soldier(sim, x) {
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.9, hp: 44, r: 19, skin: 'soldier', score: 900,
    shoot: (s, e) => {
      if (e.t % 110 === 60) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.35, speed: 3.0, color: 'orange' });
    },
  });
}

// Archer Skeleton: keeps high ground, looses aimed fans.
function archer(sim, x) {
  sim.spawnEnemy({
    x, y: -30, vx: (x > FIELD_W / 2 ? -0.5 : 0.5), vy: 0.7, hp: 26, r: 17, skin: 'archer', score: 800,
    shoot: (s, e) => {
      if (e.y > 220) e.vy = 0;
      if (e.t % 100 === 50) fan(s, e.x, e.y, { n: 4, angle: angleTo(s, e.x, e.y), spread: 0.55, speed: 3.2, color: 'orange' });
    },
  });
}

// Mummy: slow pressure tank — wide, slow fan; takes a beating.
function mummy(sim, x) {
  sim.spawnEnemy({
    x, y: -40, vx: 0, vy: 0.55, hp: 60, r: 22, skin: 'mummy', score: 1100,
    shoot: (s, e) => {
      if (e.t % 130 === 70) fan(s, e.x, e.y, { n: 5, angle: Math.PI / 2, spread: 1.1, speed: 2.2, color: 'cyan' });
    },
  });
}

// Verit: erratic rusher — fast sine descent, shard burst when close.
// edge 0 enters from the left, edge 1 from the right (symmetric inward base).
function verit(sim, edge) {
  const vx0 = edge === 0 ? 2.4 : -2.4;
  const x = edge === 0 ? -50 : FIELD_W + 50;
  sim.spawnEnemy({
    x, y: -30, vx: vx0, vy: 1.9, hp: 24, r: 17, skin: 'verit', score: 800,
    shoot: (s, e) => {
      e.vx = vx0 + Math.sin(e.t / 12) * 2.2;
      const p = nearestPlayer(s, e.x, e.y);
      if (p && (p.y - e.y) ** 2 + (p.x - e.x) ** 2 < 260 ** 2 && e.t % 46 === 0) {
        ring(s, e.x, e.y, { n: 8, speed: 2.6, baseAngle: s.rng.range(0, 6.28), color: 'red' });
      }
    },
  });
}

// Matyr: fast pursuit hound — steers toward the player's column, fire bolts.
function matyr(sim, x) {
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 1.7, hp: 28, r: 17, skin: 'matyr', score: 900,
    shoot: (s, e) => {
      const p = nearestPlayer(s, e.x, e.y);
      if (p) e.vx += Math.max(-0.06, Math.min(0.06, (p.x - e.x) * 0.002));
      if (e.t % 70 === 30) aimed(s, e.x, e.y, { speed: 3.6, color: 'red' });
    },
  });
}

// Isis: serpent sorceress — curved magic: telegraphed spiral bursts plus
// spread shots. Parks overhead, but at most a pair may hold the sky at once
// (spawn gate below) so parked sorceresses cannot layer full-screen spirals.
function isisAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'isis') n++;
  return n;
}
function isis(sim, x) {
  if (isisAlive(sim) >= 2) return; // a pair of sorceresses is plenty
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.8, hp: 34, r: 18, skin: 'isis', score: 1200,
    shoot: (s, e) => {
      if (e.y > 200) e.vy = 0;
      // 90-tick cycle: coil up (telegraph), loose 6-bullet spiral arc, rest.
      const c = e.t % 90;
      if (c === 60) e.tele = 24;
      if (c >= 64 && c < 88 && c % 4 === 0) {
        spiralArm(s, e.x, e.y, { arms: 1, phase: e.t * 0.35, speed: 2.2, color: 'cyan' });
      }
      if (e.t % 120 === 80) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.6, speed: 2.8, color: 'purple' });
    },
  });
}

// Ancient Mummy: tomb elite — layered rings, aimed volleys and curse rain.
function ancient(sim, x) {
  sim.spawnEnemy({
    x, y: -40, vx: 0, vy: 0.6, hp: 70, r: 23, skin: 'ancient', score: 1600,
    shoot: (s, e) => {
      if (e.y > 190) e.vy = 0;
      if (e.t % 140 === 60) {
        const base = s.rng.range(0, 6.28);
        ring(s, e.x, e.y, { n: 14, speed: 2.2, baseAngle: base, color: 'orange' });
        ringWithGap(s, e.x, e.y, { n: 18, speed: 1.7, gapAngle: angleTo(s, e.x, e.y), gapWidth: 0.5, color: 'cyan' });
      }
      if (e.t % 90 === 0) rain(s, s.rng.range(30, FIELD_W - 30), { speed: 2.9, color: 'purple', r: 5 });
    },
  });
}

// Osiris: the tomb's judge — mobile midboss. Sways across the arena throwing
// claw fans, winding bandage spirals and curse rain; presses forward slowly.
function osirisStep(sim, e) {
  if (e.y < 210) return; // still descending into the arena
  e.vy = 0;
  e.x = FIELD_W / 2 + Math.sin(e.t / 70) * 190;
  if (e.t % 66 === 44) e.tele = 18;
  if (e.t % 66 === 0 && e.t > 0) {
    fan(sim, e.x, e.y, { n: 5, angle: angleTo(sim, e.x, e.y), spread: 0.6, speed: 3.3, color: 'purple' });
  }
  const ph = e.t * 0.16;
  spiralArm(sim, e.x, e.y, { arms: 2, phase: ph, speed: 2.3, color: 'purple' });
  if (e.t % 34 === 0) rain(sim, sim.rng.range(30, FIELD_W - 30), { speed: 3.0, color: 'cyan', r: 5 });
}

// Level script (same phase-machine idiom as levels 1-5).
export function level6(sim) {
  if (!sim.level) sim.level = { phase: 'oasis', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  // Living-background progress, same idiom as levels 1-5: ease sim.biome
  // toward the phase target each tick (renderer clamps it to 0..1).
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    // oasis approach: scouts and infantry in the open
    case 'oasis':
      approach(0.3, 0.012);
      if (t % 100 === 0) familiar(sim, t % 200 === 0 ? 0 : 1);
      if (t % 130 === 30) soldier(sim, 120 + sim.rng.range(0, FIELD_W - 240));
      if (t % 170 === 90) archer(sim, 100 + sim.rng.range(0, FIELD_W - 200));
      if (t === 300) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'entrance'; L.t = 0; }
      break;
    // pyramid entrance: mummies and hounds between the pylons
    case 'entrance':
      approach(0.5, 0.01);
      if (t % 120 === 0) mummy(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 90 === 20) verit(sim, t % 180 === 20 ? 0 : 1);
      if (t % 110 === 60) matyr(sim, 120 + sim.rng.range(0, FIELD_W - 240));
      if (t === 500) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'descent'; L.t = 0; }
      break;
    // inner descent: sorceresses and elites in the dark
    case 'descent':
      approach(0.62, 0.01);
      if (t % 130 === 0) isis(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 200 === 100) ancient(sim, 160 + sim.rng.range(0, FIELD_W - 320));
      if (t % 100 === 50) familiar(sim, t % 200 === 50 ? 0 : 1);
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      approach(0.62, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Osiris' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -50, vx: 0, vy: 1.2, hp: 680, r: 42,
          skin: 'osiris', score: 20000, shoot: osirisStep,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'tomb'; L.t = 0; }
      break;
    case 'tomb':
      // royal tomb: the full bestiary closes in around the sarcophagi
      approach(0.9, 0.008);
      if (t % 95 === 0) archer(sim, 110 + sim.rng.range(0, FIELD_W - 220));
      if (t % 120 === 40) matyr(sim, 120 + sim.rng.range(0, FIELD_W - 240));
      if (t % 100 === 70) isis(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 150 === 30) ancient(sim, 160 + sim.rng.range(0, FIELD_W - 320));
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1500) { L.phase = 'approach'; L.t = 0; }
      break;
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, amonRa); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
