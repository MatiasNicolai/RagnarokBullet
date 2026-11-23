// Playable roster: per-class weapons (basic + focus shot each), themed bomb (L)
// and graze-charged special (I). Every hero carries TWO weapons and swaps
// between them with SWAP (see WEAPONS-PLAN.md); the bomb and special belong to
// the hero and never change. Display stats/skill names feed the UI.
import { aramir, swordFire } from './aramir.js';
// Blast Mines a Sniper may have on the field at once.
export const MAX_MINES = 3;

function haste(p, every) {
  return p.quicken > 0 || p.awaken > 0 ? Math.max(2, Math.ceil(every / 2)) : every;
}

// Power level (Blue Gemstones) widens every kit: +1 flank pair at power 1,
// +1 damage at power 2. Two-Hand Quicken (Aramir) halves the cadence.
// Returns true on the ticks it fires.
function shot(sim, p, { every, spread, dmg, r, speed, skin, pierce = 0, ttl = 0, fx = null, flankDmg = null }) {
  every = haste(p, every);
  if (sim.tick % every !== 0) return false;
  const angles = [...spread];
  const main = angles.length;
  if (p.power >= 1) {
    const max = Math.max(...spread.map(Math.abs), 0.12);
    angles.push(-(max + 0.28), max + 0.28);
  }
  if (p.power >= 2) dmg += 1;
  angles.forEach((a, i) => {
    sim.spawnPlayerBullet(p, {
      x: p.x, y: p.y - 12,
      vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed,
      dmg: i >= main && flankDmg != null ? flankDmg + (p.power >= 2 ? 1 : 0) : dmg,
      r, skin, pierce, ttl, fx,
    });
  });
  return true;
}

// ---------------------------------------------------------------- weapons
// Each weapon: { id, name, skills: [basic, focus], pose: [basic, focus],
// shake: [basic, focus], fire(sim, p) -> fired }.
//   pose  = ticks the hero holds the attack pose after a volley (render only):
//           heavy swings linger, flurries flicker;
//   shake = screen-shake strength of one volley (render only, 0 = none).

// ---- Aramir
const SWORD = {
  id: 'sword', name: 'Espada', skills: ['Bash', 'Magnum Break'],
  pose: [6, 5], shake: [0, 0],
  fire: swordFire,
};
const LANCE = {
  id: 'lance', name: 'Lanza', skills: ['Brandish Spear', 'Spiral Pierce'],
  pose: [10, 12], shake: [1, 3],
  fire(sim, p) {
    const bonus = p.power >= 2 ? 1 : 0;
    if (p.focused) {
      // Spiral Pierce: one slow, heavy lance that drills through 3 targets.
      if (sim.tick % haste(p, 14) !== 0) return false;
      sim.spawnPlayerBullet(p, {
        x: p.x, y: p.y - 16, vx: 0, vy: -11,
        dmg: 11 + bonus, r: 10, skin: 'wpn:spiral', pierce: 3,
      });
      if (p.power >= 1) {
        for (const a of [-0.22, 0.22]) {
          sim.spawnPlayerBullet(p, {
            x: p.x, y: p.y - 14, vx: Math.sin(a) * 11, vy: -Math.cos(a) * 11,
            dmg: 3 + bonus, r: 7, skin: 'wpn:spiral', pierce: 1,
          });
        }
      }
      return true;
    }
    // Brandish Spear: a wide, short frontal sweep that cuts through.
    if (sim.tick % haste(p, 12) !== 0) return false;
    const n = p.power >= 1 ? 7 : 5, half = p.power >= 1 ? 0.85 : 0.7;
    for (let i = 0; i < n; i++) {
      const a = -half + (2 * half * i) / (n - 1);
      sim.spawnPlayerBullet(p, {
        x: p.x, y: p.y - 12, vx: Math.sin(a) * 10, vy: -Math.cos(a) * 10,
        dmg: 2.6 + bonus, r: 11, skin: 'wpn:spearArc', pierce: 1, ttl: 22,
      });
    }
    return true;
  },
};

// ---- Zeos
const KATAR = {
  id: 'katar', name: 'Katar', skills: ['Grimtooth', 'Sonic Blow'],
  pose: [5, 3], shake: [0, 0],
  fire(sim, p) {
    if (p.focused) return shot(sim, p, { every: 3, spread: [0], dmg: 3.5, r: 5, speed: 15, skin: 'zeos:1' });
    return shot(sim, p, { every: 7, spread: [-0.5, -0.06, 0.06, 0.5], dmg: 2.3, r: 6, speed: 13, skin: 'zeos:3' });
  },
};
const DAGGERS = {
  id: 'daggers', name: 'Dagas', skills: ['Venom Knife', 'Soul Destroyer'],
  pose: [6, 9], shake: [0, 1],
  fire(sim, p) {
    // Soul Destroyer: one long-range dagger that tears through.
    if (p.focused) return shot(sim, p, { every: 10, spread: [0], dmg: 4, r: 6, speed: 20, skin: 'wpn:soulDestroyer', pierce: 2, flankDmg: 2 });
    // Venom Knife: a tight fan of poisoned knives (damage over time).
    return shot(sim, p, { every: 8, spread: [-0.3, -0.15, 0, 0.15, 0.3], dmg: 1.1, r: 5, speed: 14, skin: 'wpn:venom', fx: 'poison' });
  },
};

// ---- Eric
const STAFF = {
  id: 'staff', name: 'Báculo', skills: ['Soul Strike', 'Jupitel Thunder'],
  pose: [9, 8], shake: [0, 0],
  fire(sim, p) {
    if (p.focused) return shot(sim, p, { every: 10, spread: [0], dmg: 9, r: 11, speed: 12, skin: 'eric:2', pierce: 1 });
    return shot(sim, p, { every: 13, spread: [-0.18, 0.18], dmg: 7, r: 12, speed: 7, skin: 'eric:1' });
  },
};
// Rod bolts rotate element every volley: fire hits harder, cold chills (slows),
// lightning pierces one target.
const BOLTS = [
  { skin: 'wpn:fireBolt', dmg: 5, fx: null, pierce: 0 },
  { skin: 'wpn:coldBolt', dmg: 4.2, fx: 'chill', pierce: 0 },
  { skin: 'wpn:lightningBolt', dmg: 3.7, fx: null, pierce: 1 },
];
const ROD = {
  id: 'rod', name: 'Vara', skills: ['Bolts', 'Fire Wall'],
  pose: [4, 10], shake: [0, 1],
  fire(sim, p) {
    if (p.focused) {
      // Fire Wall: a slow-rising wall of flames that eats enemy bullets.
      if (sim.tick % haste(p, 24) !== 0) return false;
      const n = p.power >= 1 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        sim.spawnPlayerBullet(p, {
          x: p.x + (i - (n - 1) / 2) * 24, y: p.y - 50, vx: 0, vy: -1.6,
          dmg: 1.5 + (p.power >= 2 ? 0.5 : 0), r: 12, skin: 'wpn:fireWall', pierce: 4, ttl: 70, blocker: true,
        });
      }
      return true;
    }
    const el = BOLTS[(p.boltCycle ?? 0) % BOLTS.length];
    const fired = shot(sim, p, { every: 5, spread: [0], dmg: el.dmg, r: 6, speed: 13, skin: el.skin, pierce: el.pierce, fx: el.fx });
    if (fired) p.boltCycle = (p.boltCycle ?? 0) + 1;
    return fired;
  },
};

// ---- Dposada
const HOLY_STAFF = {
  id: 'holyStaff', name: 'Báculo sagrado', skills: ['Holy Light', 'Judex'],
  pose: [7, 5], shake: [0, 0],
  fire(sim, p) {
    if (p.focused) return shot(sim, p, { every: 6, spread: [0], dmg: 4.6, r: 8, speed: 13, skin: 'dposada:2' });
    return shot(sim, p, { every: 10, spread: [-0.45, 0, 0.45], dmg: 3.5, r: 9, speed: 9, skin: 'dposada:1' });
  },
};
const MACE = {
  id: 'mace', name: 'Maza', skills: ['Holy Smite', 'Duple Light'],
  pose: [9, 6], shake: [2, 0],
  fire(sim, p) {
    // Duple Light: twin lights that each strike twice.
    if (p.focused) return shot(sim, p, { every: 8, spread: [-0.1, 0.1], dmg: 1.7, r: 8, speed: 12, skin: 'wpn:dupleLight', pierce: 1 });
    // Holy Smite: short, heavy mace blows (close range, big damage).
    return shot(sim, p, { every: 9, spread: [-0.25, 0, 0.25], dmg: 2.6, r: 11, speed: 9, skin: 'wpn:mace', ttl: 16 });
  },
};

// ---- Chel_Snip
const BOW = {
  id: 'bow', name: 'Arco', skills: ['Double Strafe', 'Focused Arrow'],
  pose: [6, 7], shake: [0, 0],
  fire(sim, p) {
    if (p.focused) return shot(sim, p, { every: 6, spread: [0], dmg: 5.8, r: 5, speed: 18, skin: 'chel_snip:3', pierce: 2 });
    return shot(sim, p, { every: 8, spread: [-0.06, 0.06], dmg: 3.5, r: 5, speed: 16, skin: 'chel_snip:1' });
  },
};
const ARBALEST = {
  id: 'arbalest', name: 'Ballesta', skills: ['Arbalest Bolt', 'Blast Mine'],
  pose: [11, 8], shake: [2, 1],
  fire(sim, p) {
    if (p.focused) {
      // Blast Mine: a lobbed mine that bursts on contact (area damage).
      if (sim.tick % haste(p, 24) !== 0) return false;
      let mine = 0;
      for (const b of sim.bullets.active) if (b.mine && b.owner === p.index) mine++;
      if (mine >= MAX_MINES) return false;
      sim.spawnPlayerBullet(p, {
        x: p.x, y: p.y - 30, vx: 0, vy: -2.4,
        dmg: 45 + (p.power >= 2 ? 3 : 0), r: 12, skin: 'wpn:mine', ttl: 200,
        mine: true, aoe: p.power >= 1 ? 90 : 70,
      });
      return true;
    }
    // Arbalest Bolt: slow cadence, heavy piercing bolts.
    return shot(sim, p, { every: 14, spread: [0], dmg: 7, r: 6, speed: 19, skin: 'wpn:arbalest', pierce: 1 });
  },
};

// ---- Viri
const KNUCKLES = {
  id: 'knuckles', name: 'Nudillos', skills: ['Triple Attack', 'Chain Combo'],
  pose: [5, 6], shake: [0, 0],
  fire(sim, p) {
    // short-range fists: high damage but bullets expire quickly
    if (p.focused) return shot(sim, p, { every: 6, spread: [0], dmg: 8, r: 10, speed: 10, skin: 'viri:3', ttl: 33 });
    return shot(sim, p, { every: 8, spread: [-0.12, 0.12], dmg: 4.6, r: 9, speed: 9, skin: 'viri:2', ttl: 30 });
  },
};
// Finger Offensive burns one spirit sphere every FINGER_PER_SPHERE volleys;
// with no spheres left it falls back to a single weak orb.
export const FINGER_PER_SPHERE = 6;
const MONK_STAFF = {
  id: 'monkStaff', name: 'Bastón', skills: ['Finger Offensive', 'Investigate'],
  pose: [7, 10], shake: [0, 2],
  fire(sim, p) {
    // Investigate: a palm strike that hits harder the tougher the target.
    if (p.focused) return shot(sim, p, { every: 12, spread: [0], dmg: 6, r: 12, speed: 9, skin: 'wpn:investigate', ttl: 26, fx: 'invest' });
    if (p.spheres > 0) {
      const fired = shot(sim, p, { every: 9, spread: [-0.06, 0.06], dmg: 5.5, r: 8, speed: 11, skin: 'wpn:finger' });
      if (fired) {
        p.fingerCount = (p.fingerCount ?? 0) + 1;
        if (p.fingerCount % FINGER_PER_SPHERE === 0) p.spheres--;
      }
      return fired;
    }
    return shot(sim, p, { every: 9, spread: [0], dmg: 4, r: 7, speed: 11, skin: 'wpn:finger' });
  },
};

// The hero's fire delegates to the active weapon and records the volley
// (tick + basic/focus) for the attack pose, the sound and the shake.
function heroFire(sim, p) {
  const w = p.char.weapons[p.weapon | 0] ?? p.char.weapons[0];
  if (w.fire(sim, p)) {
    p.lastShot = sim.tick;
    p.lastShotFocus = p.focused;
  }
}

// ---------------------------------------------------------------- heroes
aramir.className = 'Lord Knight';
aramir.accent = 0xffcc55;
aramir.stats = { atk: 18, def: 14, spd: 12, hp: 100 };
aramir.skills = ['Bash', 'Magnum Break', 'Bowling Bash', 'Quicken'];
aramir.weapons = [SWORD, LANCE];
aramir.fire = heroFire;
// Bowling Bash: baseline clear + a shockwave that hits every enemy on screen
// (it used to rely on the ring alone, which missed most of the field) + a
// spinning ring of sword waves for extra damage up close.
export const BOWLING_BASH_DMG = 12;
aramir.bomb = (sim, p) => {
  sim.baseBomb(p);
  for (const e of sim.enemies.active) {
    if (e.invuln) continue;
    e.hp -= BOWLING_BASH_DMG;
    e.hitFlash = 6;
    e.lastHitBy = p.index;
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    sim.spawnPlayerBullet(p, {
      x: p.x, y: p.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7,
      dmg: 6, r: 10, skin: 'aramir:3', pierce: 2,
    });
  }
};
// Two-Hand Quicken: 8 s of doubled fire rate.
aramir.special = (sim, p) => { p.quicken = 480; };

export const zeos = {
  id: 'zeos', name: 'Zeos', className: 'Assassin Cross',
  accent: 0xb06cff,
  stats: { atk: 16, def: 8, spd: 18, hp: 70 },
  skills: ['Grimtooth', 'Sonic Blow', 'Meteor Assault', 'Cloaking'],
  speed: 4.2, focusSpeed: 2.1, hitR: 4, lives: 3,
  weapons: [KATAR, DAGGERS],
  fire: heroFire,
  // Meteor Assault: baseline clear + every enemy on screen is poisoned.
  bomb(sim, p) {
    sim.baseBomb(p);
    for (const e of sim.enemies.active) { e.poison = 300; e.lastHitBy = p.index; }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sim.spawnPlayerBullet(p, {
        x: p.x, y: p.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9,
        dmg: 4, r: 7, skin: 'zeos:3', pierce: 1,
      });
    }
  },
  // Cloaking: 3 s intangible.
  special(sim, p) { p.cloak = 180; },
};

export const eric = {
  id: 'eric', name: 'Eric.', className: 'High Wizard',
  accent: 0x55aaff,
  stats: { atk: 20, def: 6, spd: 9, hp: 60 },
  skills: ['Soul Strike', 'Jupitel Thunder', 'Storm Gust', 'Meteor Storm'],
  speed: 2.8, focusSpeed: 1.4, hitR: 5, lives: 3,
  weapons: [STAFF, ROD],
  fire: heroFire,
  // Storm Gust: baseline clear + freeze everything for 4 s.
  bomb(sim, p) {
    sim.baseBomb(p);
    for (const e of sim.enemies.active) { e.frozen = 240; e.hitFlash = 6; }
    sim.events.push({ type: 'stormgust', x: p.x, y: p.y });
  },
  // Meteor Storm: 5 s of meteors raining on random enemies.
  special(sim, p) { p.meteor = 300; },
};

export const dposada = {
  id: 'dposada', name: 'Dposada', className: 'Saint',
  accent: 0xffe08a,
  stats: { atk: 12, def: 12, spd: 10, hp: 80 },
  skills: ['Holy Light', 'Judex', 'Magnus Exorcismus', 'Sanctuary'],
  speed: 3.0, focusSpeed: 1.5, hitR: 5, lives: 3,
  weapons: [HOLY_STAFF, MACE],
  fire: heroFire,
  // Magnus Exorcismus: baseline clear + persistent holy field where she stands.
  bomb(sim, p) {
    sim.baseBomb(p);
    sim.magnus = { x: p.x, y: p.y, t: 0, owner: p.index };
  },
  // Sanctuary: +1 life to every standing player (score if already full).
  special(sim, p) {
    for (const q of sim.players) {
      if (!q || q.down) continue;
      if (q.lives < q.char.lives) q.lives++;
      else sim.score += 2000;
    }
    sim.events.push({ type: 'sanctuary', x: p.x, y: p.y });
  },
};

export const chel_snip = {
  id: 'chel_snip', name: 'Chel_Snip', className: 'Sniper',
  accent: 0x8fb5ff,
  stats: { atk: 19, def: 7, spd: 14, hp: 65 },
  skills: ['Double Strafe', 'Focused Arrow', 'Arrow Storm', 'Falcon Assault'],
  speed: 3.4, focusSpeed: 1.7, hitR: 4, lives: 3,
  weapons: [BOW, ARBALEST],
  fire: heroFire,
  // Arrow Storm: baseline clear + heavy damage to everything on screen.
  bomb(sim, p) {
    sim.baseBomb(p);
    for (const e of sim.enemies.active) {
      e.hp -= 10;
      e.hitFlash = 6;
      e.lastHitBy = p.index;
    }
    sim.events.push({ type: 'arrowstorm', x: p.x, y: p.y });
  },
  // Falcon Assault: 6 s of auto-sniping falcon.
  special(sim, p) { p.falcon = 360; },
};

export const viri = {
  id: 'viri', name: 'Viri', className: 'Monk',
  accent: 0xff7a55,
  stats: { atk: 17, def: 11, spd: 13, hp: 85 },
  skills: ['Triple Attack', 'Chain Combo', 'Asura Strike', 'Steel Body'],
  speed: 3.6, focusSpeed: 1.8, hitR: 5, lives: 3,
  weapons: [KNUCKLES, MONK_STAFF],
  fire: heroFire,
  // Asura Strike: baseline clear + a forward cone whose damage scales with
  // spirit spheres (gained on kills, max 5). The strongest bomb in the game.
  bomb(sim, p) {
    sim.baseBomb(p);
    const dmg = 10 + p.spheres * 8;
    for (const e of sim.enemies.active) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dy < 0 && Math.abs(Math.atan2(dx, -dy)) < 0.6) {
        e.hp -= dmg;
        e.hitFlash = 8;
        e.lastHitBy = p.index;
      }
    }
    sim.events.push({ type: 'asura', x: p.x, y: p.y, spheres: p.spheres });
    p.spheres = 0;
  },
  // Steel Body: 5 s immune, but fists sealed.
  special(sim, p) { p.steel = 300; },
};

export { aramir };
export const ROSTER = [aramir, zeos, eric, dposada, chel_snip, viri];
