// Pause / exit-confirmation state machine. No PixiJS and no globals here, so
// the node test suite exercises the exact transitions GameScene runs (not a
// source-string match), and GameScene only has to draw what this reports.
//
// Why a machine and not two booleans: pausing, opening the confirmation from
// a paused game, and cancelling it have to return to the right state. ESC used
// to dump a live run straight to the title with no confirmation.
//
// Online runs are NOT pausable: lockstep couples both clients, so a local
// freeze would stall the peer. There the confirmation still works (leaving is
// the player's call) but the sim keeps running underneath, and P reports
// 'blocked' so the scene can say why.

export const MODE = { PLAYING: 'playing', PAUSED: 'paused', CONFIRM: 'confirm' };
// NO is index 0 and the default: a mis-hit ESC + ENTER must never drop the run.
export const CHOICES = ['no', 'si'];

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const ACCEPT = new Set(['Enter', 'NumpadEnter', 'Space']);

export function createPauseState({ pausable = true } = {}) {
  return {
    mode: MODE.PLAYING,
    choice: 0,              // index into CHOICES; 0 = NO
    returnTo: MODE.PLAYING, // where cancelling the confirmation goes back to
    pausable,
  };
}

export const isFrozen = (st) => st.mode === MODE.PAUSED
  || (st.mode === MODE.CONFIRM && st.returnTo === MODE.PAUSED)
  || (st.mode === MODE.CONFIRM && st.pausable);

// Handles one keydown. Returns the effect the scene must apply:
//   'none' | 'freeze' | 'thaw' | 'leave' | 'blocked' | 'redraw'
// The state object is mutated in place (the scene keeps one instance).
export function pauseKey(st, code) {
  if (code === 'KeyP') {
    if (st.mode === MODE.CONFIRM) return 'none';   // answer the question first
    if (!st.pausable) return 'blocked';
    if (st.mode === MODE.PLAYING) { st.mode = MODE.PAUSED; return 'freeze'; }
    st.mode = MODE.PLAYING;
    return 'thaw';
  }

  if (code === 'Escape') {
    if (st.mode === MODE.CONFIRM) return cancel(st);
    st.returnTo = st.mode;
    st.mode = MODE.CONFIRM;
    st.choice = 0;                                 // always reopens on NO
    return st.pausable && st.returnTo === MODE.PLAYING ? 'freeze' : 'redraw';
  }

  if (st.mode !== MODE.CONFIRM) return 'none';

  if (LEFT.has(code) || RIGHT.has(code)) {
    const next = LEFT.has(code) ? st.choice - 1 : st.choice + 1;
    const clamped = Math.max(0, Math.min(CHOICES.length - 1, next));
    if (clamped === st.choice) return 'none';
    st.choice = clamped;
    return 'redraw';
  }
  if (ACCEPT.has(code)) {
    if (CHOICES[st.choice] === 'si') return 'leave';
    return cancel(st);
  }
  return 'none';
}

function cancel(st) {
  const wasPaused = st.returnTo === MODE.PAUSED;
  st.mode = wasPaused ? MODE.PAUSED : MODE.PLAYING;
  st.choice = 0;
  // Leaving the confirmation only thaws when the game is going back to play.
  return !wasPaused && st.pausable ? 'thaw' : 'redraw';
}
