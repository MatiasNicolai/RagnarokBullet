// Deterministic seeded PRNG (mulberry32). The simulation must NEVER call
// Math.random()/Date.now(); every random draw goes through the shared Rng so
// two clients with the same seed and inputs replay the exact same game.
export class Rng {
  constructor(seed) {
    this.s = seed >>> 0;
  }

  // float in [0, 1)
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, maxExclusive) {
    return min + Math.floor(this.next() * (maxExclusive - min));
  }
}
