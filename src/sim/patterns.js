// Danmaku emitters: parameterized helpers that spawn enemy bullets.
// All of them run inside the deterministic sim (rng/tick only).

export function nearestPlayer(sim, x, y) {
  let best = null, bestD = Infinity;
  for (const p of sim.players) {
    if (!p) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function angleTo(sim, x, y) {
  const p = nearestPlayer(sim, x, y);
  return p ? Math.atan2(p.y - y, p.x - x) : Math.PI / 2;
}

// Ring of n bullets around (x, y). baseAngle rotates the whole ring.
export function ring(sim, x, y, { n = 12, speed = 2.2, baseAngle = 0, color = 'red', r = 5 }) {
  for (let i = 0; i < n; i++) {
    const a = baseAngle + (i / n) * Math.PI * 2;
    sim.spawnEnemyBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, r });
  }
}

// Fan of n bullets centered on `angle` with total `spread` radians.
export function fan(sim, x, y, { n = 3, angle, spread = 0.5, speed = 3, color = 'cyan', r = 5 }) {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? angle : angle - spread / 2 + (i / (n - 1)) * spread;
    sim.spawnEnemyBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, r });
  }
}

// Single aimed bullet at the nearest player.
export function aimed(sim, x, y, { speed = 3.4, color = 'orange', r = 5, jitter = 0 }) {
  const a = angleTo(sim, x, y) + (jitter ? sim.rng.range(-jitter, jitter) : 0);
  sim.spawnEnemyBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, r });
}

// One arm of a rotating spiral. Call each tick with an incrementing `phase`.
export function spiralArm(sim, x, y, { arms = 1, phase, speed = 2.6, color = 'purple', r = 5 }) {
  for (let k = 0; k < arms; k++) {
    const a = phase + (k / arms) * Math.PI * 2;
    sim.spawnEnemyBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, r });
  }
}

// Ring with a safe gap the player can slip through (gapAngle ± gapWidth open).
export function ringWithGap(sim, x, y, { n = 20, speed = 2.4, gapAngle, gapWidth = 0.5, color = 'red', r = 5 }) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let d = Math.abs(((a - gapAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (d < gapWidth) continue;
    sim.spawnEnemyBullet({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, r });
  }
}

// Vertical rain column from the top edge at a given x.
export function rain(sim, x, { speed = 3.2, color = 'orange', r = 5 }) {
  sim.spawnEnemyBullet({ x, y: -12, vx: 0, vy: speed, color, r });
}
