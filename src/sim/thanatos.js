// Level 8: Thanatos Tower - the fragment midbosses, the boss echoes and the
// final boss Thanatos. Kept apart from boss.js (the shared boss engine) so the
// last stage reads as one unit. Tick-driven, sim.rng only: deterministic like
// the rest of the sim.
import { FIELD_W } from './constants.js';
import { ring, ringWithGap, fan, aimed, spiralArm, rain, angleTo } from './patterns.js';

// --- the four soul fragments ---
// Shared danmaku: the campaign midboss pairs (inline elites in level8.js) and
// the practice duels below both call these, so each fragment shoots the same
// everywhere. Each is tuned to stay fair while its partner fires too.
export function odiumP(sim, x, y, t) {
  // hatred: short aimed red bursts, then a wide fan
  const c = t % 70;
  if (c < 18 && c % 6 === 0) aimed(sim, x, y, { speed: 3.1, color: 'red', jitter: 0.12 });
  if (t % 140 === 100) fan(sim, x, y, { n: 5, angle: angleTo(sim, x, y), spread: 0.9, speed: 2.6, color: 'red' });
}

export function desperoP(sim, x, y, t) {
  // despair: counter-rotating flame spirals
  if (t % 5 === 0) {
    spiralArm(sim, x, y, { arms: 2, phase: t * 0.07, speed: 2.0, color: 'orange' });
    spiralArm(sim, x, y, { arms: 2, phase: -t * 0.07, speed: 2.0, color: 'orange' });
  }
}

export function maeroP(sim, x, y, t) {
  // sorrow: slow rain curtain over 8 columns; two adjacent columns stay open
  // as the safe lane, and the open pair moves every 4 s
  if (t % 24 === 0) {
    const open = Math.floor(t / 240) % 3;
    const safe = [1 + open * 2, 2 + open * 2];
    for (let k = 0; k < 8; k++) {
      if (safe.includes(k)) continue;
      rain(sim, 37 + k * 75, { speed: 2.0, color: 'purple' });
    }
  }
  if (t % 90 === 45) aimed(sim, x, y, { speed: 2.6, color: 'purple' });
}

export function dolorP(sim, x, y, t) {
  // pain: breathing gapped rings (speed swells and ebbs) + a slow aimed shot
  if (t % 60 === 0) {
    ringWithGap(sim, x, y, { n: 20, speed: 1.6 + 0.4 * Math.sin(t / 120), gapAngle: t * 0.04, gapWidth: 0.7, color: 'cyan' });
  }
  if (t % 90 === 45) aimed(sim, x, y, { speed: 2.8, color: 'cyan' });
}

export const FRAGMENT_STEPS = { odium: odiumP, despero: desperoP, maero: maeroP, dolor: dolorP };
export const FRAGMENT_NAMES = {
  odium: 'Odium of Thanatos', despero: 'Despero of Thanatos', maero: 'Maero of Thanatos', dolor: 'Dolor of Thanatos',
};

// Practice duels: each midboss pair as dual bosses (spawnBosses scales their
// HP for the overlap, same as Seyren & Magaleta).
const fragmentBoss = (key) => ({
  name: FRAGMENT_NAMES[key], r: 36, targetY: 190,
  cards: [{
    name: FRAGMENT_NAMES[key], hp: 600,
    step(sim, b) {
      b.x = b.homeX + Math.sin(b.t / 70) * 70;
      FRAGMENT_STEPS[key](sim, b.x, b.y, b.t);
    },
  }],
});
export const odiumBoss = fragmentBoss('odium');
export const desperoBoss = fragmentBoss('despero');
export const maeroBoss = fragmentBoss('maero');
export const dolorBoss = fragmentBoss('dolor');

// --- echoes of past MVPs ---
// Thanatos summons memories of bosses the adventurers already beat. They reuse
// those bosses' own art (the renderer draws `echo` enemies with the boss
// texture, tinted), fire a small version of each signature pattern, and
// dissolve on their own (ttl): killing one early is a bonus, not a must.
const ECHO_STEPS = {
  orcHero(sim, e) {
    if (e.t % 45 === 25) e.tele = 20;
    if (e.t % 45 === 0) fan(sim, e.x, e.y, { n: 5, angle: angleTo(sim, e.x, e.y), spread: 0.8, speed: 2.8, color: 'orange' });
  },
  baphomet(sim, e) {
    if (e.t % 50 === 0) ring(sim, e.x, e.y, { n: 14, speed: 1.8, baseAngle: e.t * 0.07, color: 'purple' });
  },
  lordOfDeath(sim, e) {
    if (e.t % 4 === 0) spiralArm(sim, e.x, e.y, { arms: 2, phase: e.t * 0.11, speed: 1.9, color: 'red' });
  },
};
export const ECHO_ORDER = ['orcHero', 'baphomet', 'lordOfDeath'];
export const ECHO_TTL = 300;
const ECHO_Y = 140;

export function echoesAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.echo) n++;
  return n;
}

export function summonEcho(sim, key, x) {
  sim.events.push({ type: 'summon', x, y: ECHO_Y });
  return sim.spawnEnemy({
    x, y: -40, vx: 0, vy: 2.0, hp: 140, maxhp: 140, r: 34, skin: 'echo', echo: key,
    ttl: ECHO_TTL, score: 3000,
    shoot: (s, e) => {
      if (e.y >= ECHO_Y) { e.y = ECHO_Y; e.vy = 0; }
      // quiet while arriving and while dissolving: readable entry and exit
      if (e.vy === 0 && e.t > 40 && e.t < ECHO_TTL - 30) ECHO_STEPS[key](s, e);
    },
  });
}

// Every echo and add starts dissolving now (the transformation clears the
// stage). No kill credit: they fade out.
export function dismissEchoes(sim) {
  for (const e of sim.enemies.active) if (e.echo || e.thanatosAdd) e.ttl = e.t + 1;
}

// --- Thanatos' adds (cards 1-3) ---
// Small summons drawn from the tower's own monsters, so the first form never
// fights alone. Flagged `thanatosAdd` (pool-safe: always set in the props),
// capped together, and they dissolve on a timer if left alive.
const ADD_CAP = 4;
function addsAlive(sim) {
  let n = 0;
  for (const e of sim.enemies.active) if (e.thanatosAdd) n++;
  return n;
}

// Baroness guard: drops in at a side, parks, fires aimed fans. 10 s.
function guardAdd(sim, x) {
  if (addsAlive(sim) >= ADD_CAP) return;
  sim.spawnEnemy({
    x, y: -30, vy: 2.0, hp: 60, maxhp: 60, r: 19, skin: 'retribution', score: 800,
    ttl: 600, thanatosAdd: true,
    shoot: (s, e) => {
      if (e.y >= 130) { e.y = 130; e.vy = 0; }
      if (e.vy !== 0) return;
      if (e.t % 70 === 50) e.tele = 20;
      if (e.t % 70 === 0) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.45, speed: 2.8, color: 'red' });
    },
  });
}

// Anger: zigzags down the field with short fans; leaves at the bottom.
function rageAdd(sim, x) {
  if (addsAlive(sim) >= ADD_CAP) return;
  sim.spawnEnemy({
    x, y: -30, vy: 1.8, hp: 40, maxhp: 40, r: 20, skin: 'anger', score: 700,
    thanatosAdd: true,
    shoot: (s, e) => {
      e.vx = Math.sin(e.t / 10) * 2.6;
      if (e.t % 45 === 30) e.tele = 12;
      if (e.t % 45 === 0 && e.t > 0) fan(s, e.x, e.y, { n: 3, angle: angleTo(s, e.x, e.y), spread: 0.45, speed: 2.9, color: 'red' });
    },
  });
}

// Book of Death: parks low and rings slowly; 12 s.
function bookAdd(sim, x) {
  if (addsAlive(sim) >= ADD_CAP) return;
  sim.spawnEnemy({
    x, y: -30, vy: 1.4, hp: 70, maxhp: 70, r: 18, skin: 'deathbook', score: 900,
    ttl: 720, thanatosAdd: true,
    shoot: (s, e) => {
      if (e.y >= 240) { e.y = 240; e.vy = 0; }
      if (e.vy === 0 && e.t % 90 === 0) ring(s, e.x, e.y, { n: 10, speed: 1.6, baseAngle: e.t * 0.1, color: 'purple' });
    },
  });
}

// --- side-steps ---
// Thanatos never stands still: every ~1-1.5 s he dashes 130-230 px, mostly
// AWAY from the nearest player (so a focused beam parked under him keeps
// losing its target and players must move), sometimes cutting across them.
// A short tele marks each dash. Driven by its own counter (b.t resets per
// card) and sim.rng, so it stays deterministic in online lockstep.
const EDGE = 70;
function nearestPlayerX(sim, x) {
  let best = x, bd = Infinity;
  for (const p of sim.players) {
    if (!p || p.down) continue;
    const d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p.x; }
  }
  return best;
}
export function sidestep(sim, b, { min = 130, max = 230, every = [55, 85], lerp = 0.2 } = {}) {
  b.stepT = (b.stepT ?? 0) + 1;
  if (b.dashX == null) b.dashX = b.x;
  if (b.stepT >= (b.nextStep ?? 30)) {
    b.stepT = 0;
    b.nextStep = Math.round(sim.rng.range(every[0], every[1]));
    let dir = nearestPlayerX(sim, b.x) < b.x ? 1 : -1;
    if (sim.rng.next() < 0.25) dir = -dir;
    const dist = sim.rng.range(min, max);
    let target = b.x + dir * dist;
    if (target < EDGE || target > FIELD_W - EDGE) target = b.x - dir * dist;
    b.dashX = Math.max(EDGE, Math.min(FIELD_W - EDGE, target));
    b.tele = Math.max(b.tele, 8);
  }
  b.x += (b.dashX - b.x) * lerp;
}

// --- Thanatos ---
// Six HP cards (21 000 total = 6.6x Lord of Death) plus a 30 s survival card
// at the transformation. Cards 1-3 use the armored form I sprite and bring
// adds; the rest use the awakened form II (`form` is the atlas key; changing
// it triggers the bossForm beat in boss.js). He side-steps through every
// card. Every card keeps a readable route: gaps face or rotate past the
// player, curtains leave open lanes, and the last card guarantees a breather.
export const THANATOS_HP_TOTAL = 21000;
export const thanatos = {
  name: 'Thanatos', r: 60, targetY: 170,
  cards: [
    {
      name: 'Juicio del Guardián', hp: 2800, form: 'thanatos',
      step(sim, b) {
        sidestep(sim, b);
        if (b.t % 72 === 0) ringWithGap(sim, b.x, b.y, { n: 24, speed: 1.8, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.6, color: 'red' });
        if (b.t % 72 === 36) fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.8, speed: 3.0, color: 'orange' });
        if (b.cardHp < b.cardMax * 0.35 && b.t % 48 === 24) aimed(sim, b.x, b.y, { speed: 3.3, color: 'red' });
        // his guard: two Baronesses drop in at the sides every 7 s
        if (b.t % 420 === 120) { guardAdd(sim, 110); guardAdd(sim, FIELD_W - 110); }
      },
    },
    {
      name: 'Odio y Desesperación', hp: 3000, form: 'thanatos',
      step(sim, b) {
        // channels two fragments in turn; the switch is telegraphed
        const c = b.t % 480;
        const hatred = c < 240;
        sidestep(sim, b, hatred ? undefined : { min: 100, max: 180, every: [70, 100] });
        if (c === 225 || c === 465) b.tele = 15;
        if (hatred) odiumP(sim, b.x, b.y, b.t);
        else desperoP(sim, b.x, b.y, b.t);
        // rage made flesh: Anger charges in from alternating sides
        if (b.t % 200 === 100) rageAdd(sim, Math.floor(b.t / 200) % 2 === 0 ? 120 : FIELD_W - 120);
      },
    },
    {
      name: 'Memorias de Midgard', hp: 3400, form: 'thanatos',
      step(sim, b) {
        sidestep(sim, b, { min: 110, max: 200, every: [65, 95] });
        if (b.t % 240 === 30 && echoesAlive(sim) < 2) {
          const n = Math.floor(b.t / 240);
          summonEcho(sim, ECHO_ORDER[n % ECHO_ORDER.length], n % 2 === 0 ? FIELD_W * 0.25 : FIELD_W * 0.75);
        }
        if (b.t % 420 === 210) bookAdd(sim, sim.rng.range(140, FIELD_W - 140));
        if (b.t % 100 === 50) fan(sim, b.x, b.y, { n: 3, angle: angleTo(sim, b.x, b.y), spread: 0.4, speed: 2.8, color: 'purple' });
        if (b.t % 140 === 0) ring(sim, b.x, b.y, { n: 12, speed: 1.6, baseAngle: b.t * 0.05, color: 'purple' });
      },
    },
    {
      // survival: invulnerable, ends on time (Novice: 20 s). Walls of rain
      // creep in from both sides and back out, over a drifting central
      // spiral (shorter steps here: the walls already squeeze the field).
      name: 'El Fin de la Memoria', hp: 0, survive: 1800, form: 'thanatosAwake',
      step(sim, b) {
        if (b.t === 0) dismissEchoes(sim);
        sidestep(sim, b, { min: 60, max: 120, every: [90, 130], lerp: 0.1 });
        const wall = 40 + 110 * (0.5 - 0.5 * Math.cos((b.t / 300) * Math.PI));
        if (b.t % 10 === 0) {
          rain(sim, wall, { speed: 2.6, color: 'purple' });
          rain(sim, FIELD_W - wall, { speed: 2.6, color: 'purple' });
        }
        if (b.t % 30 === 15) {
          rain(sim, wall * 0.5, { speed: 2.4, color: 'purple' });
          rain(sim, FIELD_W - wall * 0.5, { speed: 2.4, color: 'purple' });
        }
        if (b.t % 5 === 0) spiralArm(sim, b.x, b.y, { arms: 3, phase: b.t * 0.09, speed: 1.9, color: 'cyan' });
        if (b.t % 120 === 60) aimed(sim, b.x, b.y, { speed: 3.0, color: 'red' });
      },
    },
    {
      name: 'Pena y Dolor', hp: 3600, form: 'thanatosAwake',
      step(sim, b) {
        sidestep(sim, b, { min: 150, max: 250, every: [50, 75] });
        b.y = b.targetY + Math.sin(b.t / 35) * 30;
        if (b.t % 3 === 0) {
          spiralArm(sim, b.x, b.y, { arms: 1, phase: b.t * 0.13, speed: 2.0, color: 'cyan' });
          spiralArm(sim, b.x, b.y, { arms: 1, phase: -b.t * 0.13 + Math.PI, speed: 2.0, color: 'orange' });
        }
        if (b.t % 110 === 55) ringWithGap(sim, b.x, b.y, { n: 18, speed: 1.5, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.7, color: 'purple' });
      },
    },
    {
      name: 'Réquiem de la Torre', hp: 4000, form: 'thanatosAwake',
      step(sim, b) {
        const desperate = b.cardHp < b.cardMax * 0.35;
        sidestep(sim, b, { min: 120, max: 210, every: [60, 90] });
        if (b.t % 2 === 0) spiralArm(sim, b.x, b.y, { arms: 2, phase: b.t * 0.12, speed: 2.1, color: 'purple' });
        if (b.t % 72 === 0) ringWithGap(sim, b.x, b.y, { n: 26, speed: 1.7, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.65, color: 'cyan' });
        if (b.t % 32 === 0) rain(sim, sim.rng.range(30, FIELD_W - 30), { speed: 2.6, color: 'red' });
        if (desperate && b.t % 70 === 35) fan(sim, b.x, b.y, { n: 3, angle: angleTo(sim, b.x, b.y), spread: 0.5, speed: 3.2, color: 'red' });
      },
    },
    {
      // escalates in three stages by card HP; under 15% every 240-tick cycle
      // ends with a guaranteed 60-tick breather (he holds still for it)
      name: 'Último Aliento', hp: 4200, form: 'thanatosAwake',
      step(sim, b) {
        const frac = b.cardHp / b.cardMax;
        const st = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
        if (b.stage !== st) { b.stage = st; b.tele = 30; }
        const last = frac < 0.15;
        const breath = last && (b.t % 240) >= 180;
        if (breath) {
          if (b.t % 60 === 0) aimed(sim, b.x, b.y, { speed: 2.4, color: 'cyan' });
          return;
        }
        sidestep(sim, b, st === 3 ? { min: 160, max: 260, every: [45, 70] } : { min: 130, max: 220, every: [55, 85] });
        if (b.t % 56 === 0) {
          ringWithGap(sim, b.x, b.y, { n: 22, speed: 1.8, gapAngle: b.t * 0.05, gapWidth: 0.6, color: 'red' });
          ringWithGap(sim, b.x, b.y, { n: 22, speed: 1.4, gapAngle: -b.t * 0.05 + Math.PI, gapWidth: 0.6, color: 'purple' });
        }
        if (b.t % 64 === 32) aimed(sim, b.x, b.y, { speed: 3.3, color: 'cyan' });
        if (st >= 2 && b.t % 4 === 0) spiralArm(sim, b.x, b.y, { arms: 3, phase: b.t * 0.1, speed: 2.0, color: 'orange' });
        if (st >= 3 && b.t % 22 === 0) rain(sim, sim.rng.range(30, FIELD_W - 30), { speed: 2.7, color: 'purple' });
        if (last && b.t % 30 === 0) fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 1.0, speed: 3.0, color: 'red' });
      },
    },
  ],
};
