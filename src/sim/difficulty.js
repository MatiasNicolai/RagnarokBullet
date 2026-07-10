// Difficulty presets. bulletScale multiplies enemy bullet speed; livesBonus
// adjusts starting lives; scoreMult rewards harder play. Passed into the sim
// so the whole run stays deterministic for a given choice.
export const DIFFICULTIES = [
  { id: 'novice', name: 'Novice', bulletScale: 0.82, livesBonus: 1, scoreMult: 0.7, blurb: 'Balas más lentas, +1 vida. Para aprender.' },
  { id: 'normal', name: 'Normal', bulletScale: 1.0, livesBonus: 0, scoreMult: 1.0, blurb: 'La experiencia equilibrada.' },
  { id: 'nightmare', name: 'Nightmare', bulletScale: 1.2, livesBonus: -1, scoreMult: 1.6, blurb: 'Balas veloces, −1 vida. Sólo expertos.' },
];

export const DEFAULT_DIFF = 1; // Normal
