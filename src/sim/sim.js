// Deterministic simulation core. Rules:
//  - state advances ONLY in tickSim(sim, inputs), one fixed tick at a time
//  - all randomness through sim.rng (seeded), never Math.random()
//  - no Date.now(), no wall-clock, no render state read here
// Same seed + same input stream => identical game on every client.
import { Rng } from '../engine/rng.js';
import { Pool } from '../engine/pool.js';
import { SpatialHash, circleHit } from '../engine/spatialhash.js';
import { BTN } from '../engine/input.js';
import { FIELD_W, FIELD_H } from './constants.js';
import { stepBoss, damageBoss } from './boss.js';
import { DIFFICULTIES, DEFAULT_DIFF } from './difficulty.js';

const GRAZE_R = 18;          // extra radius around the hitbox that counts a graze
const RESPAWN_IFRAMES = 180;
const BOMB_IFRAMES = 90;
export const METER_MAX = 100;
const METER_PER_GRAZE = 4;
const METER_PER_KILL = 2;
const MAGNET_R = 90;
const POC_LINE = FIELD_H * 0.3; // above this, items auto-collect (Point of Collection)

// `carry` (optional) seeds per-player state from the previous level:
// [{ lives, bombs, power, spheres }, ...]. `startScore` continues the tally.
// `diffIndex` selects a difficulty preset (affects bullet speed / lives / score).
export function createSim(seed, characters, carry = null, startScore = 0, diffIndex = DEFAULT_DIFF) {
  const diff = DIFFICULTIES[diffIndex] ?? DIFFICULTIES[DEFAULT_DIFF];
  const sim = {
    tick: 0,
    rng: new Rng(seed),
    score: startScore,
    continues: 0,            // arcade continues used this run (set by the scene from the campaign)
    diff,
    bulletScale: diff.bulletScale,
    gameOver: false,
    levelComplete: false,
    boss: null,              // active boss (see boss.js)
    biome: 0,                // level progress 0..1 (drives living background)
    lastBomb: null,          // { tick, x, y } for render feedback
    magnus: null,            // Dposada bomb field { x, y, t }
    events: [],              // render-feedback queue: {type, x, y, ...}
    stats: { kills: 0, deaths: 0, bombs: 0, maxGraze: 0, cards: 0 },
    cards: [],               // collected monster-card ids (unique)
    players: [],
    bullets: new Pool(() => ({})),       // player shots
    enemyBullets: new Pool(() => ({})),
    enemies: new Pool(() => ({})),
    items: new Pool(() => ({})),
    grid: new SpatialHash(48),

    spawnPlayerBullet(p, props) {
      const b = this.bullets.spawn();
      b.x = props.x; b.y = props.y; b.vx = props.vx; b.vy = props.vy;
      b.dmg = props.dmg; b.r = props.r; b.skin = props.skin;
      b.pierce = props.pierce ?? 0;
      b.ttl = props.ttl ?? 0; // 0 = unlimited
      b.owner = p ? p.index : -1;
      return b;
    },

    spawnEnemyBullet(props) {
      const b = this.enemyBullets.spawn();
      b.x = props.x; b.y = props.y;
      b.vx = props.vx * this.bulletScale; b.vy = props.vy * this.bulletScale;
      b.r = props.r ?? 5;
      b.color = props.color ?? 'red';
      b.bounce = props.bounce ?? 0;   // ricochets off left/right/top walls
      b.spin = props.spin ?? 0;       // render-only: sprite spin speed
      b.grazeMask = 0;
      return b;
    },

    spawnEnemy(props) {
      const e = this.enemies.spawn();
      Object.assign(e, {
        hp: 1, r: 16, vx: 0, vy: 1, skin: 'poring', hitFlash: 0, t: 0, tele: 0,
        score: 100, drop: null, shoot: null, onDeath: null, invuln: false,
        frozen: 0, poison: 0, lastHitBy: -1, phase: 0,
      }, props);
      return e;
    },

    addScore(n) { this.score += Math.round(n * diff.scoreMult); },

    spawnItem(x, y, kind) {
      const it = this.items.spawn();
      it.x = x; it.y = y; it.vx = 0; it.vy = -1.6; it.kind = kind;
      it.magnetTo = -1;
      return it;
    },

    // baseline bomb effect shared by every class
    baseBomb(p) {
      p.bombs--;
      this.stats.bombs++;
      this.lastBomb = { tick: this.tick, x: p.x, y: p.y };
      this.events.push({ type: 'bomb', x: p.x, y: p.y });
      this.addScore(this.enemyBullets.active.length * 10);
      this.enemyBullets.clear();
      p.iframes = Math.max(p.iframes, BOMB_IFRAMES);
    },

    alivePlayers() {
      return this.players.filter((p) => p && !p.down);
    },
  };

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i];
    if (!c) { sim.players.push(null); continue; }
    sim.players.push({
      index: i,
      char: c,
      x: FIELD_W * (characters.length > 1 ? (i === 0 ? 0.35 : 0.65) : 0.5),
      y: FIELD_H - 90,
      hitR: c.hitR,
      lives: Math.max(1, c.lives + diff.livesBonus),
      bombs: 3,
      power: 0,
      graze: 0,
      meter: 0,
      spheres: 0,        // Viri's spirit spheres
      down: false,
      iframes: 0,
      focused: false,
      vx: 0, vy: 0,
      prevMask: 0,
      // special-effect timers
      quicken: 0, cloak: 0, steel: 0, falcon: 0, meteor: 0,
      // temporary power-ups
      awaken: 0, speedBoost: 0, shield: 0,
    });
    if (carry && carry[i]) {
      const c2 = carry[i];
      const p = sim.players[i];
      p.lives = c2.lives; p.bombs = c2.bombs; p.power = c2.power; p.spheres = c2.spheres ?? 0;
    }
  }
  return sim;
}

function addMeter(p, amount) {
  p.meter = Math.min(METER_MAX, p.meter + amount);
}

// Viri also charges spirit spheres by landing fist hits on bosses/mid-bosses
// (those fights have no kills, which starved Asura exactly when it matters).
// Every 30 hits -> +1 sphere; his focused fists land ~10/s, so ~1 sphere / 3 s
// of sustained close-range pressure.
function chargeSphereOnHit(sim, ownerIdx) {
  const p = sim.players[ownerIdx];
  if (!p || p.down || p.char.id !== 'viri') return;
  p.sphereHits = (p.sphereHits ?? 0) + 1;
  if (p.sphereHits >= 30) {
    p.sphereHits = 0;
    p.spheres = Math.min(5, p.spheres + 1);
  }
}

function playerHit(sim, p) {
  if (p.iframes > 0) return;
  if (p.shield > 0) {          // Kafra Guard: absorbs one hit
    p.shield = 0;
    p.iframes = 60;
    sim.events.push({ type: 'shieldBreak', x: p.x, y: p.y });
    return;
  }
  p.lives--;
  sim.stats.deaths++;
  sim.events.push({ type: 'death', x: p.x, y: p.y });
  if (p.lives <= 0) {
    p.lives = 0;
    p.down = true;
    sim.events.push({ type: 'downed', x: p.x, y: p.y, index: p.index });
    if (sim.alivePlayers().length === 0) sim.gameOver = true;
    return;
  }
  // respawn: clear the field so the player isn't instantly re-killed
  sim.enemyBullets.clear();
  p.x = FIELD_W / 2;
  p.y = FIELD_H - 90;
  p.iframes = RESPAWN_IFRAMES;
  p.bombs = 3;
  p.power = Math.max(0, p.power - 1);
}

function revive(sim, p) {
  p.down = false;
  p.lives = 2;
  p.bombs = 3;
  p.x = FIELD_W / 2;
  p.y = FIELD_H - 90;
  p.iframes = RESPAWN_IFRAMES;
  sim.events.push({ type: 'revive', x: p.x, y: p.y });
}

function killEnemy(sim, e) {
  sim.addScore(e.score);
  sim.stats.kills++;
  sim.events.push({ type: 'kill', x: e.x, y: e.y, value: e.score });
  if (e.onDeath) e.onDeath(sim, e);
  const killer = sim.players[e.lastHitBy];
  if (killer && !killer.down) {
    addMeter(killer, METER_PER_KILL);
    if (killer.char.id === 'viri') killer.spheres = Math.min(5, killer.spheres + 1);
  }
  // rare monster-card drop (~1.5%), tagged with the enemy it came from
  if (sim.rng.next() < 0.015) {
    const it = sim.spawnItem(e.x, e.y, 'card');
    it.cardId = e.skin;
  } else if (e.drop) sim.spawnItem(e.x, e.y, e.drop);
  else if (sim.rng.next() < 0.25) sim.spawnItem(e.x, e.y, 'zeny');
}

function openChest(sim, p, x, y) {
  const mimic = sim.rng.next() < 0.125;
  sim.events.push({ type: mimic ? 'mimic' : 'chest', x, y });
  const n = (mimic ? 6 : 4) + sim.rng.int(0, 3);
  for (let i = 0; i < n; i++) {
    const it = sim.spawnItem(x + sim.rng.range(-30, 30), y + sim.rng.range(-16, 8), 'zeny');
    it.vy = sim.rng.range(-3.2, -1.2);
    it.vx = sim.rng.range(-1.2, 1.2);
  }
  const roll = sim.rng.next();
  const anyDown = sim.players.some((q) => q && q.down);
  let bonus = roll < 0.34 ? 'gem'
    : roll < 0.5 ? 'potion'
      : roll < 0.64 ? 'awakening'
        : roll < 0.78 ? 'speed'
          : roll < 0.9 ? 'kafra'
            : 'leaf';
  if (bonus === 'leaf' && !anyDown && sim.players.filter(Boolean).length < 2) bonus = 'potion';
  const it = sim.spawnItem(x, y - 10, bonus);
  it.vy = -2.6;
}

function collectItem(sim, p, it) {
  sim.events.push({ type: 'item', x: it.x, y: it.y, kind: it.kind });
  if (it.kind === 'zeny') sim.addScore(500);
  else if (it.kind === 'gem') {
    if (p.power < 2) p.power++;
    else sim.addScore(1000);
  } else if (it.kind === 'potion') {
    if (p.lives < p.char.lives) p.lives++;
    else sim.addScore(2000);
  } else if (it.kind === 'leaf') {
    const downed = sim.players.find((q) => q && q.down);
    if (downed) revive(sim, downed);
    else sim.addScore(3000);
  } else if (it.kind === 'chest') {
    openChest(sim, p, it.x, it.y);
  } else if (it.kind === 'awakening') {
    p.awaken = 600;                 // 10 s of doubled fire rate
  } else if (it.kind === 'speed') {
    p.speedBoost = 480;             // 8 s of +move speed
  } else if (it.kind === 'kafra') {
    p.shield = 1;                   // absorb the next hit
  } else if (it.kind === 'card') {
    if (!sim.cards.includes(it.cardId)) {
      sim.cards.push(it.cardId);
      sim.stats.cards++;
      p.bombs = Math.min(3, p.bombs + 1);  // basic passive: refund a bomb
      sim.addScore(3000);
    } else {
      sim.addScore(1000);
    }
  }
}

// Per-tick effects of active specials that need sim access.
function updateSpecials(sim, p) {
  for (const k of ['quicken', 'cloak', 'steel', 'falcon', 'meteor', 'awaken', 'speedBoost']) {
    if (p[k] > 0) p[k]--;
  }
  if (p.cloak > 0 || p.steel > 0) p.iframes = Math.max(p.iframes, 2);
  if (p.falcon > 0 && sim.tick % 10 === 0) {
    // the falcon snipes the nearest enemy
    let best = null, bd = Infinity;
    for (const e of sim.enemies.active) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const a = Math.atan2(best.y - p.y, best.x - p.x);
      sim.spawnPlayerBullet(p, {
        x: p.x, y: p.y - 10, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16,
        dmg: 6, r: 7, skin: 'chel_snip:3', pierce: 1,
      });
      sim.events.push({ type: 'falcon', x: p.x, y: p.y });
    }
  }
  if (p.meteor > 0 && sim.tick % 15 === 0 && sim.enemies.active.length) {
    const target = sim.enemies.active[sim.rng.int(0, sim.enemies.active.length)];
    sim.events.push({ type: 'meteor', x: target.x, y: target.y });
    for (const e of sim.enemies.active) {
      if ((e.x - target.x) ** 2 + (e.y - target.y) ** 2 < 80 * 80) {
        e.hp -= 6;
        e.hitFlash = 5;
        e.lastHitBy = p.index;
      }
    }
  }
}

// Arcade continue: the run resumes but the score resets to 0 and the counter
// climbs. Everyone revives with full lives/bombs; the field is cleared.
function doContinue(sim) {
  sim.continues++;
  sim.score = 0;
  sim.enemyBullets.clear();
  const multi = sim.players.filter(Boolean).length > 1;
  for (const p of sim.players) {
    if (!p) continue;
    p.down = false;
    p.lives = Math.max(1, p.char.lives + sim.diff.livesBonus);
    p.bombs = 3;
    p.iframes = RESPAWN_IFRAMES;
    p.x = FIELD_W * (multi ? (p.index === 0 ? 0.35 : 0.65) : 0.5);
    p.y = FIELD_H - 90;
  }
  sim.events.push({ type: 'continue', count: sim.continues });
}

export function tickSim(sim, inputs, stage) {
  if (sim.gameOver) {
    // Continue on a FRESH press of FIRE from any seat (rising edge, so the
    // held-down fire button you died with doesn't insta-continue). Runs inside
    // the tick so it flows through lockstep inputs and stays synced online.
    for (const p of sim.players) {
      if (!p) continue;
      const mask = inputs[p.index] ?? 0;
      if ((mask & BTN.FIRE) && !(p.prevMask & BTN.FIRE)) {
        sim.gameOver = false;
        doContinue(sim);
        break;
      }
      p.prevMask = mask;
    }
    if (sim.gameOver) return;
  }
  sim.tick++;

  // --- players ---
  for (const p of sim.players) {
    if (!p || p.down) continue;
    const mask = inputs[p.index] ?? 0;
    p.focused = (mask & BTN.FOCUS) !== 0;
    let speed = p.focused ? p.char.focusSpeed : p.char.speed;
    if (p.speedBoost > 0) speed *= 1.35;
    let dx = 0, dy = 0;
    if (mask & BTN.LEFT) dx -= 1;
    if (mask & BTN.RIGHT) dx += 1;
    if (mask & BTN.UP) dy -= 1;
    if (mask & BTN.DOWN) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    p.vx = dx * speed; p.vy = dy * speed;
    p.x = Math.min(FIELD_W - 16, Math.max(16, p.x + p.vx));
    p.y = Math.min(FIELD_H - 24, Math.max(24, p.y + p.vy));
    if (p.iframes > 0) p.iframes--;
    updateSpecials(sim, p);
    if ((mask & BTN.FIRE) && p.steel <= 0) p.char.fire(sim, p);
    if ((mask & BTN.BOMB) && !(p.prevMask & BTN.BOMB) && p.bombs > 0) p.char.bomb(sim, p);
    if ((mask & BTN.SPECIAL) && !(p.prevMask & BTN.SPECIAL) && p.meter >= METER_MAX) {
      p.meter = 0;
      p.char.special(sim, p);
      sim.events.push({ type: 'special', x: p.x, y: p.y, char: p.char.id });
    }
    p.prevMask = mask;
  }

  // --- stage script (enemy spawns / boss trigger) ---
  if (stage) stage(sim);

  // --- boss ---
  stepBoss(sim);

  // --- Magnus Exorcismus field (Dposada bomb) ---
  if (sim.magnus) {
    sim.magnus.t++;
    if (sim.magnus.t % 6 === 0) {
      for (const e of sim.enemies.active) {
        if ((e.x - sim.magnus.x) ** 2 + (e.y - sim.magnus.y) ** 2 < 130 * 130) {
          e.hp -= 2;
          e.hitFlash = 3;
          e.lastHitBy = sim.magnus.owner;
        }
      }
    }
    if (sim.magnus.t > 180) sim.magnus = null;
  }

  // --- enemies ---
  const enemies = sim.enemies.active;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t++;
    if (e.hitFlash > 0) e.hitFlash--;
    if (e.tele > 0) e.tele--;
    if (e.frozen > 0) {
      e.frozen--;
    } else {
      e.x += e.vx;
      e.y += e.vy;
      if (e.shoot) e.shoot(sim, e);
    }
    if (e.poison > 0) {
      e.poison--;
      if (e.poison % 15 === 0) { e.hp -= 1; e.hitFlash = 2; }
    }
    if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); }
    if (e.x > FIELD_W - e.r) { e.x = FIELD_W - e.r; e.vx = -Math.abs(e.vx); }
    if (e.y > FIELD_H + 60) sim.enemies.killAt(i);
  }

  // --- player bullets vs enemies ---
  sim.grid.clear();
  for (const e of enemies) sim.grid.insert(e);
  const bullets = sim.bullets.active;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.ttl && --b.ttl <= 0) { sim.bullets.killAt(i); continue; }
    if (b.y < -30 || b.y > FIELD_H + 30 || b.x < -30 || b.x > FIELD_W + 30) {
      sim.bullets.killAt(i);
      continue;
    }
    let spent = false;
    sim.grid.query(b.x, b.y, (e) => {
      if (spent && b.pierce <= 0) return;
      if (!e.alive || e.hp <= 0 || e.invuln) return;
      if (!circleHit(b, e, b.r, e.r)) return;
      e.hp -= b.dmg;
      e.hitFlash = 4;
      e.lastHitBy = b.owner;
      if (e.r >= 38) chargeSphereOnHit(sim, b.owner); // mid-bosses count as boss hits
      if (b.pierce > 0) b.pierce--;
      else spent = true;
    });
    // boss takes hits too (it lives outside the enemy pool)
    if (!spent && sim.boss && !sim.boss.intro && sim.boss.dying === 0
        && circleHit(b, sim.boss, b.r, sim.boss.r)) {
      damageBoss(sim, b.dmg);
      chargeSphereOnHit(sim, b.owner);
      if (b.pierce > 0) b.pierce--;
      else spent = true;
    }
    if (spent) sim.bullets.killAt(i);
  }
  // Reap dead enemies after the bullet pass (keeps kill order deterministic).
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      killEnemy(sim, enemies[i]);
      sim.enemies.killAt(i);
    }
  }

  // --- enemy bullets: move, graze, hit players ---
  const ebs = sim.enemyBullets.active;
  for (let i = ebs.length - 1; i >= 0; i--) {
    const b = ebs[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.bounce > 0) {
      if (b.x < b.r && b.vx < 0) { b.x = b.r; b.vx = -b.vx; b.bounce--; }
      else if (b.x > FIELD_W - b.r && b.vx > 0) { b.x = FIELD_W - b.r; b.vx = -b.vx; b.bounce--; }
      if (b.y < b.r && b.vy < 0) { b.y = b.r; b.vy = -b.vy; b.bounce--; }
    }
    if (b.y < -20 || b.y > FIELD_H + 20 || b.x < -20 || b.x > FIELD_W + 20) {
      sim.enemyBullets.killAt(i);
      continue;
    }
    let dead = false;
    for (const p of sim.players) {
      if (!p || p.down) continue;
      if (p.iframes <= 0 && circleHit(p, b, p.hitR, b.r)) {
        sim.enemyBullets.killAt(i);
        playerHit(sim, p); // may clear the whole pool (respawn)
        dead = true;
        break;
      }
      const bit = 1 << p.index;
      if (!(b.grazeMask & bit) && circleHit(p, b, p.hitR + GRAZE_R, b.r)) {
        b.grazeMask |= bit;
        p.graze++;
        if (p.graze > sim.stats.maxGraze) sim.stats.maxGraze = p.graze;
        sim.addScore(10);
        addMeter(p, METER_PER_GRAZE);
        sim.events.push({ type: 'graze', x: b.x, y: b.y });
      }
    }
    // playerHit may have emptied the pool mid-iteration; re-clamp the index
    if (dead) { i = Math.min(i, ebs.length); continue; }
  }

  // --- enemies / boss vs players (contact) ---
  for (const p of sim.players) {
    if (!p || p.down || p.iframes > 0) continue;
    let hit = false;
    for (const e of enemies) {
      if (circleHit(p, e, p.hitR, e.r)) { playerHit(sim, p); hit = true; break; }
    }
    if (!hit && sim.boss && !sim.boss.intro && sim.boss.dying === 0
        && circleHit(p, sim.boss, p.hitR, sim.boss.r - 12)) {
      playerHit(sim, p);
    }
  }

  // --- items: pop, magnet, fall, collect ---
  const items = sim.items.active;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    // point-of-collection: any player above the line vacuums everything
    if (it.magnetTo < 0) {
      for (const p of sim.players) {
        if (p && !p.down && p.y < POC_LINE) { it.magnetTo = p.index; break; }
      }
    }
    // proximity magnet
    if (it.magnetTo < 0) {
      for (const p of sim.players) {
        if (!p || p.down) continue;
        if ((p.x - it.x) ** 2 + (p.y - it.y) ** 2 < MAGNET_R * MAGNET_R) {
          it.magnetTo = p.index;
          break;
        }
      }
    }
    const target = it.magnetTo >= 0 ? sim.players[it.magnetTo] : null;
    if (target && !target.down) {
      const a = Math.atan2(target.y - it.y, target.x - it.x);
      it.vx = Math.cos(a) * 7;
      it.vy = Math.sin(a) * 7;
    } else {
      it.magnetTo = -1;
      it.vx *= 0.98;
      it.vy = Math.min(it.vy + 0.06, 2.2);
    }
    it.x += it.vx;
    it.y += it.vy;
    if (it.y > FIELD_H + 20) { sim.items.killAt(i); continue; }
    for (const p of sim.players) {
      if (!p || p.down) continue;
      if (circleHit(p, it, 26, 8)) {
        collectItem(sim, p, it);
        sim.items.killAt(i);
        break;
      }
    }
  }
}
