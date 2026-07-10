// Tiny Web Audio SFX synth — no asset files, everything generated. The context
// unlocks on the first user gesture (browsers block audio before that).

// mute-state persistence (shared with the music engine + mute buttons)
export function readMute(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
export function writeMute(key, v) {
  try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* ignore */ }
}

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.sfxMuted = readMute('rbh_mute_sfx');
    this.last = {}; // per-sound rate limiter (ctx.currentTime of last play)
    const unlock = () => {
      if (!this.ctx) this.init();
      if (this.ctx?.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.sfxMuted ? 0 : 0.35;
    this.master.connect(this.ctx.destination);
    // separate bus for background music so SFX stay punchy over it
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.ctx.destination);
  }

  setSfxMuted(v) {
    this.sfxMuted = v;
    writeMute('rbh_mute_sfx', v);
    if (this.master) this.master.gain.value = v ? 0 : 0.35;
  }

  // Ensure the context exists (music engine calls this). Returns ctx or null.
  ensure() {
    if (!this.ctx) this.init();
    return this.ctx;
  }

  tone({ type = 'square', f0, f1, dur = 0.12, gain = 0.3, delay = 0 }) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, gain = 0.3, delay = 0 }) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(this.master);
    src.start(t);
  }

  // rate limit a sound to at most once per `minGap` seconds
  gate(name, minGap) {
    if (!this.ctx) return true;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < minGap) return false;
    this.last[name] = now;
    return true;
  }

  // Per-class shot timbre — a light, rate-limited blip while firing.
  playShot(charId) {
    if (!this.gate('shot', 0.06)) return;
    const S = {
      aramir: { type: 'square', f0: 620, f1: 900, gain: 0.05 },      // sword swipe
      zeos: { type: 'square', f0: 1100, f1: 1500, gain: 0.035 },     // fast daggers
      eric: { type: 'sine', f0: 760, f1: 1180, gain: 0.05 },         // arcane orb
      dposada: { type: 'triangle', f0: 980, f1: 1320, gain: 0.045 }, // holy light
      chel_snip: { type: 'sawtooth', f0: 1300, f1: 1700, gain: 0.035 }, // arrow
      viri: { type: 'square', f0: 480, f1: 700, gain: 0.055 },       // fist
    }[charId] ?? { type: 'square', f0: 880, f1: 1200, gain: 0.05 };
    this.tone({ ...S, dur: 0.05 });
  }

  play(name) {
    switch (name) {
      case 'shot': if (this.gate('shot', 0.05)) this.tone({ type: 'square', f0: 880, f1: 1200, dur: 0.05, gain: 0.06 }); break;
      case 'kill': this.tone({ type: 'triangle', f0: 500, f1: 180, dur: 0.14, gain: 0.18 }); break;
      case 'graze': if (this.gate('graze', 0.08)) this.tone({ type: 'sine', f0: 1600, f1: 2200, dur: 0.04, gain: 0.05 }); break;
      case 'item': this.tone({ type: 'square', f0: 900, f1: 1500, dur: 0.1, gain: 0.14 }); break;
      case 'chest': this.tone({ type: 'square', f0: 700, f1: 1400, dur: 0.18, gain: 0.2 }); this.tone({ type: 'square', f0: 1050, f1: 1800, dur: 0.18, gain: 0.14, delay: 0.09 }); break;
      case 'bomb': this.noise({ dur: 0.5, gain: 0.3 }); this.tone({ type: 'sawtooth', f0: 300, f1: 60, dur: 0.5, gain: 0.22 }); break;
      case 'death': this.tone({ type: 'sawtooth', f0: 400, f1: 50, dur: 0.5, gain: 0.28 }); break;
      case 'warning': this.tone({ type: 'square', f0: 300, f1: 300, dur: 0.3, gain: 0.2 }); this.tone({ type: 'square', f0: 300, dur: 0.3, gain: 0.2, delay: 0.35 }); break;
      case 'spellcard': this.tone({ type: 'sawtooth', f0: 200, f1: 900, dur: 0.4, gain: 0.22 }); break;
      case 'bossDown': for (let i = 0; i < 5; i++) this.noise({ dur: 0.3, gain: 0.22, delay: i * 0.12 }); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.22, gain: 0.2, delay: i * 0.13 })); break;
      case 'select': this.tone({ type: 'square', f0: 700, f1: 1000, dur: 0.06, gain: 0.14 }); break;
      default: break;
    }
  }
}

export const audio = new Audio();
