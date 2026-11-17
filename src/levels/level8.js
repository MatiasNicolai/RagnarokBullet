// Level 8: Thanatos Tower, the final stage (museum entrance -> museum ->
// abandoned space -> room of angel [fragment pairs] -> rooms of anguish and
// sadness -> rooms of despair and hatred -> summit -> Thanatos).
// The tower goes all-out: denser mixed waves, a two-pair midboss and the
// longest boss of the game. The house rules still hold: every attack has a
// telegraph or a readable lane, elites are concurrency-capped, no shooter
// fires every tick, and guaranteed potion + chest drops before the boss.
//
// Pooled enemies keep stale fields, so every custom field (maxhp, mode, tx,
// ty, n...) is set in the spawn props.
import { FIELD_W } from '../sim/constants.js';
import { ring, fan, aimed, spiralArm, ringWithGap, angleTo } from '../sim/patterns.js';
import { spawnBoss } from '../sim/boss.js';
import { thanatos, FRAGMENT_STEPS, FRAGMENT_NAMES } from '../sim/thanatos.js';

function alive(sim, skin) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.skin === skin) n++;
  return n;
}

function nearestPlayerX(sim, x) {
  let best = x, bd = Infinity;
  for (const p of sim.players) {
    if (!p || p.down) continue;
    const d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p.x; }
  }
  return best;
}

// Dame of Sentinel: sniper. Parks near an edge, telegraphs a sight line,
// then fires a 5-shot burst along it; leaves after three volleys. Cap 3.
function sentinel(sim, edge) {
  if (alive(sim, 'sentinel') >= 3) return;
  const x = edge === 0 ? 70 : FIELD_W - 70;
  sim.spawnEnemy({
    x, y: -30, vy: 1.1, hp: 34, maxhp: 34, r: 18, skin: 'sentinel', score: 700,
    stopY: 120 + sim.rng.range(0, 60), aim: Math.PI / 2, n: 0,
    shoot: (s, e) => {
      if (e.n < 3 && e.y >= e.stopY) e.vy = 0;
      if (e.vy !== 0) return;
      const c = e.t % 130;
      if (c === 70) { e.tele = 30; e.aim = angleTo(s, e.x, e.y); }
      if (c >= 100 && c < 120 && c % 4 === 0) {
        s.spawnEnemyBullet({ x: e.x, y: e.y, vx: Math.cos(e.aim) * 3.4, vy: Math.sin(e.aim) * 3.4, color: 'cyan' });
      }
      if (c === 120 && ++e.n >= 3) e.vy = 1.4; // done: drift out the bottom
    },
  });
}

// Baroness of Retribution: diver. Stops, locks the nearest player's x
// (telegraphed), dives at it, fans on arrival and exits. Cap 2.
function retribution(sim, x) {
  if (alive(sim, 'retribution') >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vy: 1.4, hp: 40, maxhp: 40, r: 19, skin: 'retribution', score: 800,
    mode: 0, tx: x, k: 0,
    shoot: (s, e) => {
      if (e.mode === 0 && e.y >= 110) { e.mode = 1; e.vy = 0; e.tele = 24; e.tx = nearestPlayerX(s, e.x); e.k = 0; }
      else if (e.mode === 1 && e.tele === 0) { e.mode = 2; e.vx = (e.tx - e.x) / 30; e.vy = 4; e.k = 0; }
      else if (e.mode === 2 && ++e.k >= 30) {
        e.mode = 3; e.vx = 0; e.vy = 1.6;
        fan(s, e.x, e.y, { n: 5, angle: angleTo(s, e.x, e.y), spread: 0.9, speed: 2.8, color: 'red' });
      }
    },
  });
}

// Mistress of Shelter: slow tank. Parks, then rotating gapped rings (the
// gap is the lane) plus a slow aimed shot. Cap 2.
function shelter(sim, x) {
  if (alive(sim, 'shelter') >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vy: 0.6, hp: 90, maxhp: 90, r: 24, skin: 'shelter', score: 1200,
    shoot: (s, e) => {
      if (e.y >= 190) e.vy = 0;
      if (e.t % 110 === 0 && e.t > 0) {
        ringWithGap(s, e.x, e.y, { n: 16, speed: 1.7, gapAngle: e.t * 0.03, gapWidth: 0.8, color: 'orange' });
      }
      if (e.t % 90 === 45) aimed(s, e.x, e.y, { speed: 2.4, color: 'cyan' });
    },
  });
}

// Lady Solace: healer. Every 2 s she restores HP to every enemy within
// reach (herself included), so she is the priority target. Sparse fans.
// Cap 2.
const HEAL_R = 150, HEAL_AMT = 10;
function solace(sim, x) {
  if (alive(sim, 'solace') >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vy: 0.7, hp: 45, maxhp: 45, r: 18, skin: 'solace', score: 1100,
    shoot: (s, e) => {
      if (e.y >= 150) e.vy = 0;
      if (e.t % 120 === 100) e.tele = 20;
      if (e.t % 120 === 0 && e.t > 0) {
        let healed = 0;
        for (const o of s.enemies.active) {
          if (o.maxhp == null || o.hp <= 0 || o.hp >= o.maxhp) continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > HEAL_R * HEAL_R) continue;
          o.hp = Math.min(o.maxhp, o.hp + HEAL_AMT);
          healed++;
        }
        if (healed) s.events.push({ type: 'heal', x: e.x, y: e.y, n: healed });
      }
      if (e.t % 100 === 50) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.5, speed: 2.5, color: 'green' });
    },
  });
}

// Book of Death: caster. Parks; a two-arm spiral for 120 of every 200
// ticks (clear recovery window) plus a slow ring. Cap 2.
function deathbook(sim, x) {
  if (alive(sim, 'deathbook') >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vy: 0.8, hp: 50, maxhp: 50, r: 18, skin: 'deathbook', score: 900,
    shoot: (s, e) => {
      if (e.y >= 180) e.vy = 0;
      if (e.vy !== 0) return;
      if (e.t % 200 < 120 && e.t % 4 === 0) spiralArm(s, e.x, e.y, { arms: 2, phase: e.t * 0.09, speed: 1.9, color: 'purple' });
      if (e.t % 150 === 75) ring(s, e.x, e.y, { n: 8, speed: 1.4, baseAngle: e.t * 0.1, color: 'purple' });
    },
  });
}

// Anger of Thanatos: berserker. Fast zigzag charge down the field with short
// aimed fans; low HP. Cap 3.
function anger(sim, x) {
  if (alive(sim, 'anger') >= 3) return;
  sim.spawnEnemy({
    x, y: -30, vy: 2.1, hp: 30, maxhp: 30, r: 20, skin: 'anger', score: 700,
    shoot: (s, e) => {
      e.vx = Math.sin(e.t / 10) * 2.8;
      if (e.t % 40 === 28) e.tele = 12;
      if (e.t % 40 === 0 && e.t > 0) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.45, speed: 3.0, color: 'red' });
    },
  });
}

// Void Mimic: ambusher. Falls in like a chest, then teleports: the
// destination is telegraphed for 24 ticks (event + wind-up pose) before it
// lands there and bursts a ring. Leaves after four jumps. Cap 2.
function voidmimic(sim, x) {
  if (alive(sim, 'voidmimic') >= 2) return;
  sim.spawnEnemy({
    x, y: -30, vy: 1.2, hp: 60, maxhp: 60, r: 20, skin: 'voidmimic', score: 1000,
    tx: x, ty: 160, n: 0,
    shoot: (s, e) => {
      if (e.n < 4 && e.y >= 160) e.vy = 0;
      if (e.vy !== 0) return;
      const c = e.t % 150;
      if (c === 100) {
        e.tx = s.rng.range(60, FIELD_W - 60);
        e.ty = s.rng.range(90, 260);
        e.tele = 24;
        s.events.push({ type: 'telegraph', x: e.tx, y: e.ty, color: 0xc95bff });
      }
      if (c === 124) {
        e.x = e.tx; e.y = e.ty;
        ring(s, e.x, e.y, { n: 12, speed: 1.8, baseAngle: e.t * 0.2, color: 'purple' });
        if (++e.n >= 4) e.vy = 1.5;
      }
    },
  });
}

// Crow Duke: hunter. Hovers mid-height with a sway, three-beat aimed bursts.
// Cap 2.
function crowduke(sim, edge) {
  if (alive(sim, 'crowduke') >= 2) return;
  const x0 = edge === 0 ? FIELD_W * 0.3 : FIELD_W * 0.7;
  sim.spawnEnemy({
    x: x0, y: -30, vy: 1.2, hp: 45, maxhp: 45, r: 19, skin: 'crowduke', score: 900,
    homeX: x0,
    shoot: (s, e) => {
      if (e.y >= 160) e.vy = 0;
      if (e.vy === 0) e.x = e.homeX + Math.sin(e.t / 50) * 80;
      const c = e.t % 90;
      if (c === 70) e.tele = 20;
      if (c === 0 || c === 6 || c === 12) {
        if (e.t > 0) aimed(s, e.x, e.y, { speed: 3.2, color: 'orange', jitter: 0.08 });
      }
    },
  });
}

// Fragment pair (midboss): two inline elites, mirrored across the room of
// angel. Same idiom as Loli Ruri: warning banner, kill-gated exit, chest
// drop. Each fragment's danmaku is the shared helper from thanatos.js.
const FRAG_HP = 600;
function fragment(sim, key, side) {
  const homeX = side === 0 ? FIELD_W * 0.3 : FIELD_W * 0.7;
  sim.spawnEnemy({
    x: homeX, y: -60, vy: 1.1, hp: FRAG_HP, maxhp: FRAG_HP, r: 36, skin: key, score: 12000,
    homeX, drop: 'chest',
    shoot: (s, e) => {
      if (e.y < 200) return; // still descending into the arena
      e.y = 200; e.vy = 0;
      e.x = e.homeX + Math.sin(e.t / 70 + (side === 0 ? 0 : Math.PI)) * 70;
      FRAGMENT_STEPS[key](s, e.x, e.y, e.t);
    },
    // when the pair is down, restart the phase clock: the next pair (or the
    // exit) waits its beat instead of firing on the same tick
    onDeath: (s) => { if (--s.level.fragAlive === 0) s.level.t = 0; },
  });
}
const FRAG_PAIRS = [['odium', 'despero'], ['maero', 'dolor']];

// Parked mobs (Shelter, Solace, Book of Death...) never leave on their own.
// Before a boss arena they dissolve (ttl, no kill credit), so the midboss and
// Thanatos are fought on a clean, readable stage.
const DISSOLVE_TICKS = 45;
function clearStage(sim) {
  for (const e of sim.enemies.active) {
    if (!e.ttl || e.ttl > e.t + DISSOLVE_TICKS) e.ttl = e.t + DISSOLVE_TICKS;
  }
}

export function level8(sim) {
  if (!sim.level) sim.level = { phase: 'museum', t: 0, pair: 0, fragAlive: 0 };
  const L = sim.level;
  L.t++;
  const t = L.t;
  const approach = (target, rate) => { sim.biome += (target - sim.biome) * rate; };
  const randX = (m) => m + sim.rng.range(0, FIELD_W - m * 2);

  switch (L.phase) {
    // museum entrance and halls: snipers and divers
    case 'museum':
      approach(0.18, 0.012);
      if (t % 120 === 0) sentinel(sim, (t / 120) % 2);
      if (t % 140 === 70) retribution(sim, randX(120));
      if (t === 300) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'abandoned'; L.t = 0; }
      break;
    // abandoned space: the tank and the healer join (kill Solace first)
    case 'abandoned':
      approach(0.32, 0.01);
      if (t % 170 === 0) shelter(sim, randX(140));
      if (t % 190 === 95) solace(sim, randX(140));
      if (t % 130 === 65) retribution(sim, randX(120));
      if (t % 150 === 30) sentinel(sim, (t / 150 | 0) % 2);
      if (t === 500) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'angels'; L.t = 0; }
      break;
    // approach to the room of angel: all four ladies together
    case 'angels':
      approach(0.45, 0.01);
      if (t % 150 === 0) shelter(sim, randX(140));
      if (t % 160 === 80) solace(sim, randX(140));
      if (t % 110 === 40) retribution(sim, randX(120));
      if (t % 130 === 90) sentinel(sim, (t / 130 | 0) % 2);
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1300) { L.phase = 'midboss'; L.t = 0; }
      break;
    // room of angel: the fragments of Thanatos' soul, two pairs in a row.
    // Only 'warning' (no bossWarning) so the pre-boss dialogue stays
    // reserved for Thanatos himself.
    case 'midboss':
      approach(0.5, 0.01);
      if (L.pair === 0 && t === 1) clearStage(sim);
      if (L.fragAlive === 0 && t >= 30 && L.pair < FRAG_PAIRS.length) {
        const [a, b] = FRAG_PAIRS[L.pair];
        sim.events.push({ type: 'warning', name: `${FRAGMENT_NAMES[a]}\n${FRAGMENT_NAMES[b]}` });
        L.fragAlive = 2;
        fragment(sim, a, 0);
        fragment(sim, b, 1);
        L.pair++;
        L.t = 0;
      }
      if (L.pair >= FRAG_PAIRS.length && L.fragAlive === 0 && t > 60) { L.phase = 'sorrow'; L.t = 0; }
      break;
    // rooms of anguish and sadness: casters, ambushers and hunters
    case 'sorrow':
      approach(0.66, 0.01);
      if (t % 160 === 0) deathbook(sim, randX(140));
      if (t % 150 === 75) crowduke(sim, (t / 150 | 0) % 2);
      if (t % 200 === 120) voidmimic(sim, randX(120));
      if (t === 500) { const it = sim.spawnItem(FIELD_W / 2, -20, 'gem'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'hatred'; L.t = 0; }
      break;
    // rooms of despair and hatred: rage charges over everything else
    case 'hatred':
      approach(0.8, 0.01);
      if (t % 70 === 0) anger(sim, randX(100));
      if (t % 180 === 90) voidmimic(sim, randX(120));
      if (t % 170 === 40) crowduke(sim, (t / 170 | 0) % 2);
      if (t % 200 === 150) deathbook(sim, randX(140));
      if (t === 650) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 1400) { L.phase = 'summit'; L.t = 0; }
      break;
    // summit: the last guard mixes both floors, then the tower restocks the
    // party (guaranteed potion + chest) before the final fight
    case 'summit':
      approach(0.92, 0.01);
      if (t % 150 === 0) shelter(sim, randX(140));
      if (t % 120 === 60) anger(sim, randX(100));
      if (t % 160 === 100) sentinel(sim, (t / 160 | 0) % 2);
      if (t % 180 === 30) solace(sim, randX(140));
      if (t === 300) { const it = sim.spawnItem(FIELD_W / 2, -20, 'potion'); it.vy = 1.2; }
      if (t === 600) { const it = sim.spawnItem(FIELD_W / 2, -20, 'chest'); it.vy = 1.2; }
      if (t >= 900) { L.phase = 'approach'; L.t = 0; }
      break;
    case 'approach':
      approach(1.0, 0.02);
      if (t === 1) clearStage(sim);
      if (t >= 180) { L.phase = 'boss'; L.t = 0; spawnBoss(sim, thanatos); }
      break;
    case 'boss':
      if (sim.levelComplete) L.phase = 'done';
      break;
    default: break;
  }
}
