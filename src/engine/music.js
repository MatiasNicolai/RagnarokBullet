// Chiptune background music: a tiny step sequencer over the shared AudioContext
// (from audio.js). Each track is a lead melody + bass, looped with a lookahead
// scheduler. Boss tracks can raise `tension` to speed the tempo in the final
// phase. Purely presentational — never touches the sim.
import { audio, readMute, writeMute } from './audio.js';

// note name -> frequency (A4 = 440)
const NOTE = {};
(() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let oct = 2; oct <= 6; oct++) {
    for (let i = 0; i < 12; i++) {
      NOTE[names[i] + oct] = 440 * Math.pow(2, (oct * 12 + i - 57) / 12);
    }
  }
})();
const _ = 0; // rest

// Recorded tracks (mp3) that replace the chiptune for specific stages.
// Boss / victory still use the synthesized sequencer below.
// BASE ('/' in dev, '/RagnarokBullet/' on Pages) keeps URLs valid under any subpath.
const BASE = import.meta.env.BASE_URL;
const MP3_TRACKS = {
  menu: `${BASE}assets/music/menu.mp3`,
  level1: `${BASE}assets/music/prontera.mp3`,
  level2: `${BASE}assets/music/geffen.mp3`,
  level3: `${BASE}assets/music/glastheim.mp3`,
  level4: `${BASE}assets/music/juperos.mp3`,
};

// Melodies (16 steps) + bass. Kept short and loopable.
const TRACKS = {
  menu: {
    bpm: 104, wave: 'triangle',
    lead: ['E4', _, 'G4', 'A4', 'B4', _, 'A4', 'G4', 'E4', _, 'D4', 'E4', 'G4', _, 'E4', _],
    bass: ['E2', _, _, _, 'A2', _, _, _, 'B2', _, _, _, 'C3', _, 'B2', _],
  },
  level1: {
    bpm: 128, wave: 'square',
    lead: ['C4', 'E4', 'G4', 'E4', 'F4', 'A4', 'G4', 'E4', 'D4', 'F4', 'E4', 'C4', 'G3', 'C4', 'E4', _],
    bass: ['C2', _, 'G2', _, 'F2', _, 'C2', _, 'G2', _, 'C2', _, 'G2', _, 'C2', _],
  },
  level2: {
    bpm: 118, wave: 'square',
    lead: ['A3', 'C4', 'E4', 'A4', 'G4', 'E4', 'C4', 'E4', 'F4', 'A4', 'G4', 'E4', 'D4', 'F4', 'E4', _],
    bass: ['A1', _, 'A2', _, 'F2', _, 'F1', _, 'G2', _, 'G1', _, 'E2', _, 'E1', _],
  },
  level3: {
    bpm: 112, wave: 'sawtooth',
    lead: ['D4', _, 'F4', 'D4', 'A4', 'G4', 'F4', 'D4', 'C4', _, 'E4', 'C4', 'A3', 'C4', 'D4', _],
    bass: ['D2', _, 'D2', 'A1', 'Bb2', _, 'Bb1', _, 'C2', _, 'C1', _, 'D2', _, 'A1', _],
  },
  level4: {
    // Juperos — eerie mechanical march (no mp3 yet; chiptune stand-in)
    bpm: 120, wave: 'square',
    lead: ['E4', _, 'B3', 'E4', 'G4', 'F#4', 'E4', 'B3', 'A3', _, 'C4', 'E4', 'D4', 'B3', 'A3', _],
    bass: ['E2', _, 'E1', _, 'C2', _, 'C1', _, 'A2', _, 'A1', _, 'B1', _, 'B2', _],
  },
  level5: {
    // Biolab — cold, clinical, faintly menacing pulse (chiptune stand-in)
    bpm: 126, wave: 'square',
    lead: ['A3', _, 'C4', 'E4', 'D4', 'C4', 'A3', _, 'G3', _, 'B3', 'D4', 'C4', 'A3', 'G3', _],
    bass: ['A1', _, 'A2', _, 'F2', _, 'F1', _, 'G1', _, 'G2', _, 'E2', _, 'E1', _],
  },
  boss: {
    bpm: 148, wave: 'sawtooth',
    lead: ['E4', 'E4', 'G4', 'E4', 'B4', 'A4', 'G4', 'E4', 'D4', 'D4', 'F4', 'A4', 'G4', 'E4', 'D4', 'B3'],
    bass: ['E2', 'E2', 'E2', 'E2', 'C2', 'C2', 'C2', 'C2', 'D2', 'D2', 'D2', 'D2', 'B1', 'B1', 'B1', 'B1'],
  },
  victory: {
    bpm: 130, wave: 'square', once: true,
    lead: ['C4', 'E4', 'G4', 'C5', 'G4', 'C5', 'E5', _, 'F4', 'A4', 'C5', 'F5', _, _, _, _],
    bass: ['C2', _, 'C2', _, 'G2', _, 'C3', _, 'F2', _, 'C2', _, 'C3', _, _, _],
  },
};

class Music {
  constructor() {
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.tension = 0; // 0..1, speeds boss tempo
    this.enabled = true;
    this.muted = readMute('rbh_mute_music');
    this.mp3El = null;   // <audio> element for the current recorded track
  }

  setMuted(v) {
    this.muted = v;
    writeMute('rbh_mute_music', v);
    if (audio.musicGain) audio.musicGain.gain.value = v ? 0 : 0.16;
    if (this.mp3El) this.mp3El.muted = v;
  }

  play(name) {
    if (name === this.current) return;
    // A recorded stage track keeps playing through its boss fight.
    if (name === 'boss' && this.mp3El && !this.mp3El.paused) return;

    this.current = name;
    this.tension = 0;

    const url = MP3_TRACKS[name];
    if (url) { this.playMp3(url); return; }

    // chiptune (sequencer) track
    this.stopMp3();
    this.track = TRACKS[name] || null;
    this.step = 0;
    const ctx = audio.ensure();
    if (audio.musicGain) audio.musicGain.gain.value = this.muted ? 0 : 0.16;
    if (!ctx || !this.track) { this.stopSequencer(); return; }
    this.nextTime = ctx.currentTime + 0.06;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  playMp3(url) {
    this.stopSequencer();
    if (!this.mp3El) { this.mp3El = new Audio(); this.mp3El.loop = true; this.mp3El.volume = 0.4; }
    this.mp3El.muted = this.muted;
    if (this.mp3El.src.indexOf(url) < 0) this.mp3El.src = url;
    this.mp3El.currentTime = 0;
    this.mp3El.play().catch(() => { /* awaits a user gesture; the game unlocks on keydown */ });
  }

  stopSequencer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.track = null;
  }

  stopMp3() {
    if (this.mp3El) { this.mp3El.pause(); }
  }

  stop() {
    this.stopSequencer();
    this.stopMp3();
    this.current = null;
  }

  setTension(v) { this.tension = Math.max(0, Math.min(1, v)); }

  schedule() {
    const ctx = audio.ctx;
    if (!ctx || !this.track) return;
    if (ctx.state === 'suspended') return;
    const t = this.track;
    const tensionScale = 1 - this.tension * 0.28; // up to ~1.4x faster
    const stepDur = (60 / t.bpm) / 2 * tensionScale; // 8th notes
    // schedule ~120ms ahead
    while (this.nextTime < ctx.currentTime + 0.12) {
      const i = this.step % 16;
      this.playNote(t.lead[i], t.wave, this.nextTime, stepDur, 0.5);
      this.playNote(t.bass[i], 'triangle', this.nextTime, stepDur * 1.5, 0.7, -1);
      this.step++;
      this.nextTime += stepDur;
      if (t.once && this.step >= 16) { this.stop(); break; }
    }
  }

  playNote(name, wave, time, dur, gain, oct = 0) {
    if (!name) return;
    const ctx = audio.ctx;
    let f = NOTE[name];
    if (!f) return;
    if (oct) f *= Math.pow(2, oct);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur * 0.9);
    osc.connect(g); g.connect(audio.musicGain);
    osc.start(time); osc.stop(time + dur);
  }
}

export const music = new Music();
