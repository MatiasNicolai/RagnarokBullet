// Playable roster: per-class basic shot, focus shot, themed bomb (L) and
// graze-charged special (I). Display stats/skill names feed the UI.
import { aramir } from './aramir.js';

// Power level (Blue Gemstones) widens every kit: +1 flank pair at power 1,
// +1 damage at power 2. Two-Hand Quicken (Aramir) halves the cadence.
function shot(sim, p, { every, spread, dmg, r, speed, skin, pierce = 0, ttl = 0 }) {
  if (p.quicken > 0 || p.awaken > 0) every = Math.max(2, Math.ceil(every / 2));
  if (sim.tick % every !== 0) return;
  const angles = [...spread];
  if (p.power >= 1) {
    const max = Math.max(...spread.map(Math.abs), 0.12);
    angles.push(-(max + 0.28), max + 0.28);
  }
  if (p.power >= 2) dmg += 1;
  for (const a of angles) {
    sim.spawnPlayerBullet(p, {
      x: p.x, y: p.y - 12,
      vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed,
      dmg, r, skin, pierce, ttl,
    });
  }
}

aramir.className = 'Lord Knight';
aramir.accent = 0xffcc55;
aramir.stats = { atk: 18, def: 14, spd: 12, hp: 100 };
aramir.skills = ['Bash', 'Pierce', 'Bowling Bash', 'Quicken'];
// Bowling Bash: baseline clear + a spinning ring of sword waves.
aramir.bomb = (sim, p) => {
  sim.baseBomb(p);
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
  fire(sim, p) {
    if (p.focused) {
      shot(sim, p, { every: 3, spread: [0], dmg: 3, r: 5, speed: 15, skin: 'zeos:1' });
    } else {
      shot(sim, p, { every: 7, spread: [-0.5, -0.06, 0.06, 0.5], dmg: 2, r: 6, speed: 13, skin: 'zeos:3' });
    }
  },
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
  fire(sim, p) {
    if (p.focused) {
      shot(sim, p, { every: 10, spread: [0], dmg: 8, r: 11, speed: 12, skin: 'eric:2', pierce: 1 });
    } else {
      shot(sim, p, { every: 13, spread: [-0.18, 0.18], dmg: 6, r: 12, speed: 7, skin: 'eric:1' });
    }
  },
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
  fire(sim, p) {
    if (p.focused) {
      shot(sim, p, { every: 6, spread: [0], dmg: 4, r: 8, speed: 13, skin: 'dposada:2' });
    } else {
      shot(sim, p, { every: 10, spread: [-0.45, 0, 0.45], dmg: 3, r: 9, speed: 9, skin: 'dposada:1' });
    }
  },
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
  fire(sim, p) {
    if (p.focused) {
      shot(sim, p, { every: 6, spread: [0], dmg: 5, r: 5, speed: 18, skin: 'chel_snip:3', pierce: 2 });
    } else {
      shot(sim, p, { every: 8, spread: [-0.06, 0.06], dmg: 3, r: 5, speed: 16, skin: 'chel_snip:1' });
    }
  },
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
  fire(sim, p) {
    // short-range fists: high damage but bullets expire quickly
    if (p.focused) {
      shot(sim, p, { every: 6, spread: [0], dmg: 7, r: 10, speed: 10, skin: 'viri:3', ttl: 33 });
    } else {
      shot(sim, p, { every: 8, spread: [-0.12, 0.12], dmg: 4, r: 9, speed: 9, skin: 'viri:2', ttl: 30 });
    }
  },
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
