// Level 7: Niflheim (valley of Gyoll -> haunted forest -> town lanes ->
// town square -> Loli Ruri arena -> fortress approach -> Lord of Death).
// The expedition pushes one notch past the Pyramid: heavier hulls, wider
// fans, a phased doll midboss and a mounted three-phase reaper. Every
// enemy has one readable behavior with telegraphs and safe lanes; elites
// are concurrency-gated like the Isis pair rule, and no shooter fires
// every tick.
import { FIELD_W } from '../sim/constants.js';
import { ring, fan, aimed, rain, angleTo } from '../sim/patterns.js';
import { spawnBoss, lordOfDeath, loliP1, loliP2, loliP3 } from '../sim/boss.js';

// Lude: valley spirit — slow drift, sparse aimed spirit shots. Capped pack.
function ludeAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'lude') n++;
  return n;
}
function lude(sim, x) {
  if (ludeAlive(sim) >= 4) return;
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.8, hp: 24, r: 17, skin: 'lude', score: 500,
    shoot: (s, e) => {
      e.x += Math.sin(e.t / 30) * 0.9;
      if (e.t % 90 === 45) aimed(s, e.x, e.y, { speed: 2.6, color: 'cyan' });
    },
  });
}

// Quve: hopping shade — sine hops, curved-feel aimed fans. Capped pack.
function quveAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'quve') n++;
  return n;
}
function quve(sim, edge) {
  if (quveAlive(sim) >= 3) return;
  const vx0 = edge === 0 ? 1.8 : -1.8;
  sim.spawnEnemy({
    x: edge === 0 ? -40 : FIELD_W + 40, y: -30, vx: vx0, vy: 1.1,
    hp: 30, r: 18, skin: 'quve', score: 600,
    shoot: (s, e) => {
      e.vx = vx0 + Math.sin(e.t / 14) * 2.0; // hopping weave, fans stay fair
      if (e.t % 100 === 82) e.tele = 18;
      if (e.t % 100 === 0 && e.t > 0) {
        fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.5, speed: 2.8, color: 'orange' });
      }
    },
  });
}

// Heirozoist: forest monolith — parks, then rotating shard rings. Capped.
function heirozoistAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'heirozoist') n++;
  return n;
}
function heirozoist(sim, x) {
  if (heirozoistAlive(sim) >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.7, hp: 40, r: 20, skin: 'heirozoist', score: 800,
    shoot: (s, e) => {
      if (e.y > 210) e.vy = 0;
      if (e.t % 120 === 0 && e.t > 0) {
        ring(s, e.x, e.y, { n: 10, speed: 1.8, baseAngle: e.t * 0.05, color: 'purple' });
      }
      if (e.t % 90 === 45) aimed(s, e.x, e.y, { speed: 3.0, color: 'cyan' });
    },
  });
}

// Gibbet: rooted gallows-tree — stops forever, then chain lanes (a fixed
// lane rains briefly, telegraphed) plus slow aimed soul shots. Rooted
// trees never leave, so the pack is capped like the other elites.
function gibbetAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'gibbet') n++;
  return n;
}
function gibbet(sim, x) {
  if (gibbetAlive(sim) >= 3) return;
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.7, hp: 55, r: 22, skin: 'gibbet', score: 900,
    rooted: false, laneX: Math.max(40, Math.min(FIELD_W - 40, x)), laneArmed: false,
    shoot: (s, e) => {
      if (e.y > 170) { e.vy = 0; e.vx = 0; e.rooted = true; } // rooted: never moves again
      if (!e.rooted) return;
      const c = e.t % 150;
      if (c === 120) {
        e.tele = 30; // chain lane telegraph; lane alternates deterministically
        e.laneX = Math.max(40, Math.min(FIELD_W - 40, e.x + (Math.floor(e.t / 150) % 2 === 0 ? -70 : 70)));
        e.laneArmed = true; // this Gibbet's own telegraph arms its lane (per-spawn,
        // pool-safe: reset at spawn above, so a Gibbet rooted after its
        // c===120 window emits zero rain before its first telegraph)
      }
      if (e.laneArmed && c < 30 && c % 6 === 0 && Number.isFinite(e.laneX)) rain(s, e.laneX, { speed: 2.6, color: 'cyan' });
      if (e.t % 110 === 55) aimed(s, e.x, e.y, { speed: 2.2, color: 'purple', r: 7 });
    },
  });
}

// Dullahan: headless rider — fast lateral passes, telegraphed sword fans,
// and a flaming-head orbit burst. Capped.
function dullahanAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'dullahan') n++;
  return n;
}
function dullahan(sim, edge) {
  if (dullahanAlive(sim) >= 2) return;
  const vx0 = edge === 0 ? 2.0 : -2.0;
  sim.spawnEnemy({
    x: edge === 0 ? -40 : FIELD_W + 40, y: -30, vx: vx0, vy: 1.0,
    hp: 65, r: 21, skin: 'dullahan', score: 1100,
    shoot: (s, e) => {
      e.vx = vx0 + Math.sin(e.t / 20) * 1.2;
      if (e.t % 64 === 44) e.tele = 20; // sword-fan telegraph
      if (e.t % 64 === 0 && e.t > 0) {
        fan(s, e.x, e.y, { n: 5, angle: angleTo(s, e.x, e.y), spread: 0.7, speed: 3.0, color: 'orange' });
      }
      if (e.t % 200 === 100) {
        ring(s, e.x, e.y, { n: 6, speed: 1.6, baseAngle: e.t * 0.1, color: 'red' }); // flaming-head orbit
      }
    },
  });
}

// Bloody Murderer: slow tank — telegraphed cleaver cone plus restrained
// blood rain. Capped.
function murdererAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === 'murderer') n++;
  return n;
}
function murderer(sim, x) {
  if (murdererAlive(sim) >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vx: 0, vy: 0.5, hp: 95, r: 24, skin: 'murderer', score: 1500,
    shoot: (s, e) => {
      if (e.t % 150 === 120) e.tele = 30; // cleaver-cone telegraph
      if (e.t % 150 === 0 && e.t > 0) {
        fan(s, e.x, e.y, { n: 7, angle: angleTo(s, e.x, e.y), spread: 1.2, speed: 2.4, color: 'red' });
      }
      if (e.t % 150 === 75) { // restrained blood rain: one triplet per cycle
        for (const dx of [-40, 0, 40]) rain(s, e.x + dx, { speed: 2.7, color: 'red', r: 6 });
      }
    },
  });
}

// Loli Ruri: the doll of the dead town — inline elite midboss (Osiris
// pattern: warning banner, kill-gated exit, chest drop). Her danmaku is
// the shared staged helpers from boss.js, phased by HP fraction with a
// telegraph on every phase change.
function loliStep(sim, e) {
  if (e.y < 200) return; // still descending into the arena
  e.vy = 0;
  e.x = FIELD_W / 2 + Math.sin(e.t / 80) * 150;
  if (e.maxhp == null) e.maxhp = e.hp;
  const frac = e.hp / e.maxhp;
  const ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (e.phase !== ph) { e.phase = ph; e.tele = 30; }
  if (ph === 1) loliP1(sim, e.x, e.y, e.t);
  else if (ph === 2) loliP2(sim, e.x, e.y, e.t);
  else loliP3(sim, e.x, e.y, e.t);
}

// Level script (same phase-machine idiom as levels 1-6).
export function level7(sim) {
  if (!sim.level) sim.level = { phase: 'gyoll', t: 0, midAlive: false };
  const L = sim.level;
  L.t++;
  const t = L.t;
  // Living-background progress: ease sim.biome toward the phase target
  // each tick (renderer clamps it to 0..1).
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };

  switch (L.phase) {
    // valley of Gyoll entry: spirits and shades in the mist
    case 'gyoll':
      approach(0.3, 0.012);
      if (t % 110 === 0) lude(sim, 120 + sim.rng.range(0, FIELD_W - 240));
      if (t % 140 === 70) quve(sim, t % 280 === 70 ? 0 : 1);
      if (t === 300) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'forest'; L.t = 0; }
      break;
    // haunted forest: monoliths and gallows among the dead trees
    case 'forest':
      approach(0.5, 0.01);
      if (t % 150 === 0) heirozoist(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 160 === 80) gibbet(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 130 === 65) lude(sim, 120 + sim.rng.range(0, FIELD_W - 240));
      if (t === 500) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'lanes'; L.t = 0; }
      break;
    // town lanes: headless riders charge between the houses
    case 'lanes':
      approach(0.62, 0.01);
      if (t % 140 === 0) dullahan(sim, t % 280 === 0 ? 0 : 1);
      if (t % 120 === 60) quve(sim, t % 240 === 60 ? 0 : 1);
      if (t % 200 === 100) heirozoist(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'square'; L.t = 0; }
      break;
    // town square pressure: the tank holds the plaza with mixed support
    case 'square':
      approach(0.7, 0.01);
      if (t % 170 === 0) murderer(sim, 160 + sim.rng.range(0, FIELD_W - 320));
      if (t % 150 === 75) dullahan(sim, t % 300 === 75 ? 0 : 1);
      if (t % 170 === 85) gibbet(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t >= 1400) { L.phase = 'midboss'; L.t = 0; }
      break;
    case 'midboss':
      approach(0.7, 0.01);
      if (t === 30) {
        sim.events.push({ type: 'warning', name: 'Loli Ruri' });
        sim.events.push({ type: 'bossWarning', name: 'Loli Ruri' });
        L.midAlive = true;
        sim.spawnEnemy({
          x: FIELD_W / 2, y: -60, vx: 0, vy: 1.1, hp: 750, r: 36,
          skin: 'loliruri', score: 20000, shoot: loliStep,
          maxhp: 750, phase: 1,
          onDeath: () => { sim.level.midAlive = false; }, drop: 'chest',
        });
      }
      if (t > 60 && !L.midAlive) { L.phase = 'fortress'; L.t = 0; }
      break;
    case 'fortress':
      // fortress approach: elite mixed waves on the climb
      approach(0.9, 0.008);
      if (t % 140 === 0) murderer(sim, 160 + sim.rng.range(0, FIELD_W - 320));
      if (t % 130 === 65) dullahan(sim, t % 260 === 65 ? 0 : 1);
      if (t % 160 === 80) heirozoist(sim, 140 + sim.rng.range(0, FIELD_W - 280));
      if (t % 150 === 100) quve(sim, t % 300 === 100 ? 0 : 1);
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'approach'; L.t = 0; }
      break;
    case 'approach':
      approach(1.0, 0.02);
      if (t >= 150) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, lordOfDeath); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
