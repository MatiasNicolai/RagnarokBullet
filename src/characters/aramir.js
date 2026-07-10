// Aramir — Lord Knight. Tank profile: slower, wide 3-way sword waves;
// focus fire concentrates into piercing thrusts.
export const aramir = {
  id: 'aramir',
  name: 'Aramir',
  speed: 3.2,
  focusSpeed: 1.6,
  hitR: 5,
  lives: 4,

  // Called by the sim while FIRE is held. Spawns player bullets.
  // Power: 3-way -> 5-way fan; +1 dmg at power 2.
  fire(sim, p) {
    const focused = p.focused;
    let every = focused ? 6 : 9;
    if (p.quicken > 0 || p.awaken > 0) every = Math.max(2, Math.ceil(every / 2)); // Quicken / Awakening
    if (sim.tick % every !== 0) return;
    const dmgBonus = p.power >= 2 ? 1 : 0;
    if (focused) {
      // Pierce: two tight high-damage bolts.
      for (const dx of [-8, 8]) {
        sim.spawnPlayerBullet(p, {
          x: p.x + dx, y: p.y - 14, vx: 0, vy: -14,
          dmg: 5 + dmgBonus, r: 6, skin: 'aramir:2', pierce: 1,
        });
      }
    } else {
      // Bash: fan of sword waves.
      const angles = p.power >= 1 ? [-0.52, -0.26, 0, 0.26, 0.52] : [-0.26, 0, 0.26];
      for (const a of angles) {
        sim.spawnPlayerBullet(p, {
          x: p.x, y: p.y - 12,
          vx: Math.sin(a) * 9, vy: -Math.cos(a) * 9,
          dmg: 3 + dmgBonus, r: 9, skin: 'aramir:3', pierce: 0,
        });
      }
    }
  },
};
