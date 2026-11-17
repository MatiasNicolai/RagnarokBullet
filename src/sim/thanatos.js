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

// Every echo starts dissolving now (the transformation clears the stage).
export function dismissEchoes(sim) {
  for (const e of sim.enemies.active) if (e.echo) e.ttl = e.t + 1;
}

// --- Thanatos ---
// Six HP cards (10 500 total = 3.3x Lord of Death) plus a 30 s survival card
// at the transformation. Cards 1-3 use the armored form I sprite, the rest the
// awakened form II (`form` is the atlas key; changing it triggers the
// bossForm beat in boss.js). Every card keeps a readable route: gaps face or
// rotate past the player, curtains leave open lanes, and the last card
// guarantees a breather in each cycle.
export const THANATOS_HP_TOTAL = 10500;
export const thanatos = {
  name: 'Thanatos', r: 60, targetY: 170,
  cards: [
    {
      name: 'Juicio del Guardián', hp: 1400, form: 'thanatos',
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 90) * 120;
        if (b.t % 72 === 0) ringWithGap(sim, b.x, b.y, { n: 24, speed: 1.8, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.6, color: 'red' });
        if (b.t % 72 === 16) b.tele = 20;
        if (b.t % 72 === 36) fan(sim, b.x, b.y, { n: 5, angle: angleTo(sim, b.x, b.y), spread: 0.8, speed: 3.0, color: 'orange' });
        if (b.cardHp < b.cardMax * 0.35 && b.t % 48 === 24) aimed(sim, b.x, b.y, { speed: 3.3, color: 'red' });
      },
    },
    {
      name: 'Odio y Desesperación', hp: 1500, form: 'thanatos',
      step(sim, b) {
        // channels two fragments in turn; the switch is telegraphed
        const c = b.t % 480;
        const hatred = c < 240;
        b.x = FIELD_W / 2 + Math.sin(b.t / 80) * (hatred ? 160 : 60);
        if (c === 225 || c === 465) b.tele = 15;
        if (hatred) odiumP(sim, b.x, b.y, b.t);
        else desperoP(sim, b.x, b.y, b.t);
      },
    },
    {
      name: 'Memorias de Midgard', hp: 1700, form: 'thanatos',
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 120) * 50;
        if (b.t % 300 === 30 && echoesAlive(sim) < 2) {
          const n = Math.floor(b.t / 300);
          summonEcho(sim, ECHO_ORDER[n % ECHO_ORDER.length], n % 2 === 0 ? FIELD_W * 0.25 : FIELD_W * 0.75);
        }
        if (b.t % 100 === 50) fan(sim, b.x, b.y, { n: 3, angle: angleTo(sim, b.x, b.y), spread: 0.4, speed: 2.8, color: 'purple' });
        if (b.t % 140 === 0) ring(sim, b.x, b.y, { n: 12, speed: 1.6, baseAngle: b.t * 0.05, color: 'purple' });
      },
    },
    {
      // survival: invulnerable, ends on time (Novice: 20 s). Walls of rain
      // creep in from both sides and back out, over a central spiral.
      name: 'El Fin de la Memoria', hp: 0, survive: 1800, form: 'thanatosAwake',
      step(sim, b) {
        if (b.t === 0) dismissEchoes(sim);
        b.x = FIELD_W / 2;
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
      name: 'Pena y Dolor', hp: 1800, form: 'thanatosAwake',
      step(sim, b) {
        b.x = FIELD_W / 2 + Math.sin(b.t / 70) * 150;
        b.y = b.targetY + Math.sin(b.t / 35) * 30;
        if (b.t % 3 === 0) {
          spiralArm(sim, b.x, b.y, { arms: 1, phase: b.t * 0.13, speed: 2.0, color: 'cyan' });
          spiralArm(sim, b.x, b.y, { arms: 1, phase: -b.t * 0.13 + Math.PI, speed: 2.0, color: 'orange' });
        }
        if (b.t % 110 === 55) ringWithGap(sim, b.x, b.y, { n: 18, speed: 1.5, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.7, color: 'purple' });
      },
    },
    {
      name: 'Réquiem de la Torre', hp: 2000, form: 'thanatosAwake',
      step(sim, b) {
        const desperate = b.cardHp < b.cardMax * 0.35;
        b.x = FIELD_W / 2 + Math.sin(b.t / 110) * 60;
        if (b.t % 2 === 0) spiralArm(sim, b.x, b.y, { arms: 2, phase: b.t * 0.12, speed: 2.1, color: 'purple' });
        if (b.t % 72 === 0) ringWithGap(sim, b.x, b.y, { n: 26, speed: 1.7, gapAngle: angleTo(sim, b.x, b.y), gapWidth: 0.65, color: 'cyan' });
        if (b.t % 32 === 0) rain(sim, sim.rng.range(30, FIELD_W - 30), { speed: 2.6, color: 'red' });
        if (desperate && b.t % 70 === 35) fan(sim, b.x, b.y, { n: 3, angle: angleTo(sim, b.x, b.y), spread: 0.5, speed: 3.2, color: 'red' });
      },
    },
    {
      // escalates in three stages by card HP; under 15% every 240-tick cycle
      // ends with a guaranteed 60-tick breather
      name: 'Último Aliento', hp: 2100, form: 'thanatosAwake',
      step(sim, b) {
        const frac = b.cardHp / b.cardMax;
        const st = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
        if (b.stage !== st) { b.stage = st; b.tele = 30; }
        const last = frac < 0.15;
        const breath = last && (b.t % 240) >= 180;
        b.x = FIELD_W / 2 + Math.sin(b.t / 100) * (st === 3 ? 130 : 90);
        if (breath) {
          if (b.t % 60 === 0) aimed(sim, b.x, b.y, { speed: 2.4, color: 'cyan' });
          return;
        }
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
