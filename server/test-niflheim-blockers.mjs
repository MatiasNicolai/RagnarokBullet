// Focused Niflheim blocker tests (strict TDD for the reviewed blockers).
// Run: node server/test-niflheim-blockers.mjs
// Covers: Gibbet pooled fields + first-cycle validity, Loli Ruri maxhp/phase
// pool reuse, Lude concurrency cap (pacifist), level 7 timeline with finite
// coordinates, game-over exit, Loli dialogue event wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSim, tickSim } from '../src/sim/sim.js';
import { ROSTER } from '../src/characters/index.js';
import { level7 } from '../src/levels/level7.js';
import { FIELD_W, FIELD_H } from '../src/sim/constants.js';
import { DIALOGUE, bossDialogue } from '../src/data/dialogue.js';

let passed = 0;
const ok = (name) => { passed++; console.log(`ok - ${name}`); };

const finiteEnemyState = (sim, where) => {
  for (const e of sim.enemies.active) {
    for (const k of ['x', 'y', 'vx', 'vy', 'hp']) {
      assert.ok(Number.isFinite(e[k]), `${where}: enemy ${e.skin}.${k}=${e[k]}`);
    }
    assert.ok(e.x >= -80 && e.x <= FIELD_W + 80, `${where}: enemy ${e.skin}.x in play ${e.x}`);
    assert.ok(e.y >= -80 && e.y <= FIELD_H + 80, `${where}: enemy ${e.skin}.y in play ${e.y}`);
  }
  for (const b of sim.enemyBullets.active) {
    for (const k of ['x', 'y', 'vx', 'vy']) {
      assert.ok(Number.isFinite(b[k]), `${where}: bullet ${b.color}.${k}=${b[k]}`);
    }
  }
};

// Run the level script with a fixed mask; drain render events.
const step = (sim, n, mask = 0) => {
  for (let k = 0; k < n; k++) {
    tickSim(sim, [mask], level7);
    sim.events.length = 0;
  }
};

const phase = (sim) => sim.level.phase;

// --- 1. Gibbet: pooled fields initialized, first rooted cycle finite+valid ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]);
  sim.players[0].lives = 999;
  // gyoll 1300 + forest until the first gibbet spawns (forest t=80).
  step(sim, 1300, 16);
  assert.equal(phase(sim), 'forest', 'reached forest');
  let gib = null;
  for (let k = 0; k < 300 && !gib; k++) {
    tickSim(sim, [16], level7);
    sim.events.length = 0;
    gib = sim.enemies.active.find((e) => e.skin === 'gibbet');
  }
  assert.ok(gib, 'a gibbet spawns');
  // Fresh spawn: pooled custom fields must already be valid (no undefined laneX).
  assert.ok(!gib.rooted, 'fresh gibbet is not rooted');
  assert.ok(Number.isFinite(gib.laneX), `fresh gibbet laneX finite (got ${gib.laneX})`);
  assert.ok(gib.laneX >= 40 && gib.laneX <= FIELD_W - 40, `fresh laneX clamped (${gib.laneX})`);

  // Root it and watch the whole first cycle: every bullet stays finite, and
  // no top-rain fires before the first telegraph arms the lane.
  let sawTele = false;
  let rainBeforeTele = 0;
  let guard = 3000;
  while (guard-- > 0 && !sawTele) {
    const before = sim.enemyBullets.active.length;
    tickSim(sim, [0], level7);
    sim.events.length = 0;
    finiteEnemyState(sim, 'gibbet first cycle');
    if (gib.tele > 0 || gib.laneArmed) sawTele = true;
    else if (sim.enemyBullets.active.length > before) {
      // any bullet born at the top edge (rain) before the telegraph is invalid
      for (let i = before; i < sim.enemyBullets.active.length; i++) {
        const b = sim.enemyBullets.active[i];
        if (b.y < 30 && b.vx === 0 && b.vy > 0) rainBeforeTele++;
      }
    }
    if (!sim.enemies.active.includes(gib)) break; // died to poison/etc: stop
  }
  assert.ok(sim.enemies.active.includes(gib), 'gibbet survives to its first telegraph');
  assert.equal(rainBeforeTele, 0, `no rain before first telegraph (got ${rainBeforeTele})`);
  assert.ok(Number.isFinite(gib.laneX), 'rooted laneX stays finite');
  assert.ok(gib.laneArmed, 'the first telegraph arms this Gibbet’s own lane');
  ok('gibbet spawn fields + first rooted cycle (no pre-telegraph rain)');

  // The same Gibbet, after its own telegraph: lane rain is permitted in a
  // later c<30 window and a second telegraph fires (telegraphed cycles
  // continue; the arming gate only suppresses pre-telegraph rain).
  {
    let rainAfterTele = 0, secondTele = false, teleExpired = false;
    for (let k = 0; k < 400 && !secondTele; k++) {
      if (gib.tele === 0) teleExpired = true;
      const before = sim.enemyBullets.active.length;
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      if (teleExpired && gib.tele > 0) secondTele = true;
      for (let i = before; i < sim.enemyBullets.active.length; i++) {
        const b = sim.enemyBullets.active[i];
        if (b.y < 30 && b.vx === 0 && b.vy > 0) rainAfterTele++;
      }
      if (!sim.enemies.active.includes(gib)) break;
    }
    assert.ok(sim.enemies.active.includes(gib), 'gibbet survives into its second cycle');
    assert.ok(rainAfterTele > 0, `armed lane rains after its telegraph (got ${rainAfterTele})`);
    assert.ok(secondTele, 'a second telegraph fires (telegraphed cycles continue)');
    assert.ok(gib.laneX >= 40 && gib.laneX <= FIELD_W - 40, `lane stays clamped (${gib.laneX})`);
    ok('gibbet first telegraph permits rain, cycles continue telegraphed');
  }

  // Pool reuse: kill the rooted gibbet, catch the next spawn reusing it.
  gib.hp = 0;
  step(sim, 5, 0); // reap into the pool
  assert.ok(!sim.enemies.active.includes(gib), 'rooted gibbet reaped');
  let gib2 = null;
  for (let k = 0; k < 3000 && !gib2; k++) {
    tickSim(sim, [16], level7);
    sim.events.length = 0;
    gib2 = sim.enemies.active.find((e) => e.skin === 'gibbet' && e.t <= 2);
  }
  assert.ok(gib2, 'a second gibbet spawns');
  assert.ok(!gib2.rooted, 'pooled gibbet does not leak rooted=true');
  assert.ok(Number.isFinite(gib2.laneX), 'pooled gibbet does not leak laneX');
  assert.ok(!gib2.laneArmed, 'pooled gibbet does not leak an armed lane');
  finiteEnemyState(sim, 'gibbet reuse');
  ok('gibbet pool reuse (no rooted/laneX leak)');

  // Isolation across reuse: the pooled Gibbet likewise emits zero rain
  // before its OWN first telegraph. Freeze the spawner (boss phase spawns
  // nothing) and clear the field so only gib2 can produce rain.
  {
    for (const e of sim.enemies.active) if (e !== gib2) e.hp = 0;
    sim.enemyBullets.clear();
    sim.level = { phase: 'boss', t: 0, midAlive: false };
    step(sim, 2, 0); // reap the condemned; gib2 (hp 55) survives
    assert.ok(sim.enemies.active.includes(gib2), 'reused gibbet survives the isolation');
    let sawTele2 = false, rainBeforeTele2 = 0, guard2 = 3000;
    while (guard2-- > 0 && !sawTele2) {
      const before = sim.enemyBullets.active.length;
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      if (gib2.tele > 0 || gib2.laneArmed) sawTele2 = true;
      else if (sim.enemyBullets.active.length > before) {
        for (let i = before; i < sim.enemyBullets.active.length; i++) {
          const b = sim.enemyBullets.active[i];
          if (b.y < 30 && b.vx === 0 && b.vy > 0) rainBeforeTele2++;
        }
      }
      if (!sim.enemies.active.includes(gib2)) break;
    }
    assert.ok(sim.enemies.active.includes(gib2), 'reused gibbet survives to its first telegraph');
    assert.equal(rainBeforeTele2, 0, `reused gibbet: no rain before its telegraph (got ${rainBeforeTele2})`);
    ok('gibbet reuse isolation (no pre-telegraph rain after pool reuse)');
  }
}

// --- 2. Loli Ruri elite: explicit maxhp, deterministic phases, pool reuse ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]);
  sim.players[0].lives = 999;
  step(sim, 1300 + 1400 + 1300 + 1400, 0); // gyoll/forest/lanes/square, pacifist
  assert.equal(phase(sim), 'midboss', 'reached midboss');
  step(sim, 30, 0);
  let loli = sim.enemies.active.find((e) => e.skin === 'loliruri');
  assert.ok(loli, 'Loli Ruri spawns');
  // Damage her DURING the descent: maxhp must still be the spawn HP, not
  // whatever hp she happens to hold when she first reaches combat height.
  loli.hp = 600;
  let guard = 2000;
  while (loli.y < 200 && guard-- > 0) {
    tickSim(sim, [0], level7);
    sim.events.length = 0;
  }
  assert.ok(loli.y >= 200, 'Loli descends to combat height');
  tickSim(sim, [0], level7);
  sim.events.length = 0;
  assert.equal(loli.maxhp, 750, `maxhp is the spawn HP (got ${loli.maxhp})`);

  // Phase thresholds off the explicit maxhp: P1 >0.66, P2 >0.33, else P3.
  const phaseOf = async (hp) => {
    loli.hp = hp;
    tickSim(sim, [0], level7);
    sim.events.length = 0;
    return loli.phase;
  };
  assert.equal(await phaseOf(750), 1, 'full hp -> phase 1');
  assert.equal(await phaseOf(400), 2, '400/750 -> phase 2');
  assert.equal(await phaseOf(200), 3, '200/750 -> phase 3');

  // Each phase executes a finite bullet pattern (nonzero, bounded, finite).
  for (const [hp, name] of [[750, 'P1'], [400, 'P2'], [200, 'P3']]) {
    loli.hp = hp;
    sim.enemyBullets.clear();
    const before = sim.tick;
    let made = 0;
    for (let k = 0; k < 300; k++) {
      const n = sim.enemyBullets.active.length;
      tickSim(sim, [0], level7);
      sim.events.length = 0;
      made += Math.max(0, sim.enemyBullets.active.length - n + 0); // born this tick (approx)
      finiteEnemyState(sim, `loli ${name}`);
      if (!sim.enemies.active.includes(loli)) break;
    }
    void before;
    assert.ok(sim.enemyBullets.active.length > 0, `${name} emits bullets`);
    assert.ok(sim.enemyBullets.active.length < 1500, `${name} pattern finite (${sim.enemyBullets.active.length})`);
  }

  // Kill gate: felling her advances midboss -> fortress.
  loli.hp = 0;
  step(sim, 61, 0);
  assert.equal(phase(sim), 'fortress', 'kill gate advances to fortress');

  // Pool reuse: force a second spawn through the t=30 trigger; it must be a
  // fresh elite (full hp/maxhp, phase 1 path), not a stale damage record.
  sim.level.phase = 'midboss';
  sim.level.t = 29;
  sim.level.midAlive = false;
  tickSim(sim, [0], level7);
  sim.events.length = 0;
  const loli2 = sim.enemies.active.find((e) => e.skin === 'loliruri');
  assert.ok(loli2, 'second Loli spawns');
  assert.equal(loli2.hp, 750, 'respawn hp reset');
  assert.equal(loli2.maxhp, 750, 'respawn maxhp reset (no pool inheritance)');
  guard = 2000;
  while (loli2.y < 200 && guard-- > 0) {
    tickSim(sim, [0], level7);
    sim.events.length = 0;
  }
  tickSim(sim, [0], level7);
  sim.events.length = 0;
  assert.equal(loli2.phase, 1, 'respawn deterministically reaches phase 1 at full hp');
  loli2.hp = 200;
  tickSim(sim, [0], level7);
  sim.events.length = 0;
  assert.equal(loli2.phase, 3, 'respawn reaches phase 3 when damaged');
  ok('loli elite maxhp/phases/kill-gate/pool-reuse');
}

// --- 3. Lude concurrency: finite fair cap on the pacifist (low-DPS) path ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]);
  sim.players[0].lives = 999;
  let peakLude = 0, peakBullets = 0;
  for (let k = 0; k < 4000; k++) {
    tickSim(sim, [0], level7); // pacifist: no fire, nothing ever dies to us
    sim.events.length = 0;
    let n = 0;
    for (const e of sim.enemies.active) if (e.skin === 'lude') n++;
    peakLude = Math.max(peakLude, n);
    peakBullets = Math.max(peakBullets, sim.enemyBullets.active.length);
    if (k % 60 === 0) finiteEnemyState(sim, 'pacifist path');
  }
  assert.ok(peakLude <= 4, `pacifist lude peak ${peakLude} <= 4`);
  assert.ok(peakLude >= 2, `cap is fair, ludes still show up (peak ${peakLude})`);
  assert.ok(peakBullets <= 1200, `pacifist bullet peak ${peakBullets} bounded`);
  finiteEnemyState(sim, 'pacifist end');
  ok(`lude cap on pacifist path (peak lude=${peakLude} bullets=${peakBullets})`);
}

// --- 5. Level 7 timeline: descend, phases, kill, finite coords, game over ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]);
  sim.players[0].lives = 999;
  const stepF = (n) => step(sim, n, 16);
  stepF(1300);
  assert.equal(phase(sim), 'forest', 'gyoll -> forest');
  stepF(1400);
  assert.equal(phase(sim), 'lanes', 'forest -> lanes');
  stepF(1300);
  assert.equal(phase(sim), 'square', 'lanes -> square');
  stepF(1400);
  assert.equal(phase(sim), 'midboss', 'square -> midboss');
  const seen = new Set();
  for (let k = 0; k < 30; k++) {
    tickSim(sim, [16], level7);
    for (const e of sim.events) if (e.type === 'warning' || e.type === 'bossWarning') seen.add(e.name);
    sim.events.length = 0;
  }
  assert.ok(seen.has('Loli Ruri'), 'midboss warning shows');
  const loli = sim.enemies.active.find((e) => e.skin === 'loliruri');
  assert.ok(loli, 'Loli holds the arena');
  // full FIRE path stays finite all the way through her descent + patterns
  let guard = 3000;
  while (loli.y < 200 && guard-- > 0) {
    tickSim(sim, [16], level7);
    sim.events.length = 0;
    finiteEnemyState(sim, 'loli descent');
  }
  assert.ok(loli.y >= 200, 'Loli reaches combat height on the FIRE path');
  for (let k = 0; k < 400; k++) {
    tickSim(sim, [16], level7);
    sim.events.length = 0;
    finiteEnemyState(sim, 'loli combat');
    if (!sim.enemies.active.includes(loli)) break;
  }
  loli.hp = 0;
  stepF(61);
  assert.equal(phase(sim), 'fortress', 'kill gate advances');
  ok('level7 timeline (descent, combat, finite coords, kill gate)');
}

// --- 5b. Game-over exit: pacifist death ends the run; fresh FIRE continues ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]); // no lives cheat: death sticks
  let guard = 30000;
  while (!sim.gameOver && guard-- > 0) {
    tickSim(sim, [0], level7); // pacifist under fire
    sim.events.length = 0;
  }
  assert.ok(sim.gameOver, 'an unanswered run ends in game over');
  // fresh FIRE press (rising edge) continues; held FIRE must not insta-loop.
  const cont = sim.continues;
  tickSim(sim, [16], level7);
  sim.events.length = 0;
  assert.ok(!sim.gameOver, 'fresh FIRE continues the run');
  assert.equal(sim.continues, cont + 1, 'continue counter climbs');
  assert.equal(sim.score, 0, 'continue resets the score');
  assert.ok(sim.players[0] && !sim.players[0].down, 'player revives');
  ok('game-over exit + arcade continue (sim behavior)');
}

// --- 6. Loli Ruri dialogue wiring: warning shows, DIALOGUE entry invoked ---
{
  const sim = createSim(0x51f47e, [ROSTER[0]]);
  sim.players[0].lives = 999;
  step(sim, 1300 + 1400 + 1300 + 1400, 0);
  const types = new Map();
  for (let k = 0; k < 30; k++) {
    tickSim(sim, [0], level7);
    for (const e of sim.events) {
      if (e.name === 'Loli Ruri') types.set(e.type, e);
    }
    sim.events.length = 0;
  }
  assert.ok(types.has('warning'), 'the warning banner event still fires');
  assert.ok(types.has('bossWarning'), 'final-boss event convention invokes the dialogue entry');
  assert.equal(types.get('bossWarning').name, 'Loli Ruri', 'dialogue invoked for Loli Ruri');
  // the invoked entry exists for every campaign character (what showDialogue
  // renders via bossDialogue on the bossWarning path).
  for (const c of ROSTER) {
    const line = bossDialogue('Loli Ruri', c.id);
    assert.ok(line && line.p && line.b, `dialogue line for ${c.id}`);
  }
  assert.ok(DIALOGUE['Loli Ruri'], 'DIALOGUE entry present');
  ok('loli dialogue wiring (warning + bossWarning + entry)');
}

// --- 7. Level select: all seven responsive cards fit at W=840 ---
// (levelselect.js imports PixiJS, so the layout is asserted statically:
// the width must derive from LEVELS.length with a min/max/gap clamp, and
// the recomputed seven-card bounds including selection strokes must fit.)
{
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const sel = fs.readFileSync(path.join(HERE, '..', 'src', 'scenes', 'levelselect.js'), 'utf8');
  assert.ok(sel.includes('LEVELS.length'), 'card layout derives from LEVELS.length');
  assert.ok(!/6\s*\*\s*128|128[^\n]*six|six LEVELS|the six LEVELS/.test(sel), 'no hardcoded six-level layout');
  assert.ok(sel.includes('Math.min') && sel.includes('Math.max'), 'card width is clamped responsively');
  const num = (re, name) => {
    const m = sel.match(re);
    assert.ok(m, `${name} constant present in levelselect.js`);
    return Number(m[1]);
  };
  const gap = num(/levelGap\s*=\s*(\d+)/, 'levelGap');
  const margin = num(/levelMargin\s*=\s*(\d+)/, 'levelMargin');
  const max = num(/levelMax\s*=\s*(\d+)/, 'levelMax');
  const min = num(/levelMin\s*=\s*(\d+)/, 'levelMin');
  const W = 840, n = 7; // APP_W = FIELD_W(600) + SIDEBAR_W(240); seven campaign levels
  const bw = Math.max(min, Math.min(max, Math.floor((W - margin * 2 - (n - 1) * gap) / n)));
  assert.ok(bw >= min && bw <= max, `card width ${bw} within [${min}, ${max}] (readable)`);
  const total = n * bw + (n - 1) * gap;
  const x0 = (W - total) / 2;
  const stroke = 3; // selection cursor extends 3px past each card edge
  assert.ok(x0 - stroke >= 0, `left card + stroke fits (left=${x0 - stroke})`);
  assert.ok(x0 + total + stroke <= W, `right card + stroke fits (right=${x0 + total + stroke} <= ${W})`);
  // one-row keyboard behavior + readable names preserved.
  for (const k of ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD']) {
    assert.ok(sel.includes(k), `one-row keyboard ${k} intact`);
  }
  assert.ok(sel.includes('wordWrap'), 'readable wrapped names intact');
  ok(`level select seven-card bounds at W=840 (bw=${bw} left=${x0 - stroke} right=${x0 + total + stroke})`);
}

console.log(`\nPASS — ${passed} niflheim blocker checks`);
process.exit(0);
