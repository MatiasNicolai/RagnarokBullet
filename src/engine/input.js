// Keyboard state -> per-tick input snapshots. The simulation only ever sees
// these plain bitmask snapshots, never raw DOM events — that keeps ticks
// deterministic and makes the snapshots the thing we ship over the network.
export const BTN = {
  UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8,
  FIRE: 16, FOCUS: 32, BOMB: 64, SPECIAL: 128,
};

const P1_KEYS = {
  KeyW: BTN.UP, KeyS: BTN.DOWN, KeyA: BTN.LEFT, KeyD: BTN.RIGHT,
  KeyJ: BTN.FIRE, KeyK: BTN.FOCUS, KeyL: BTN.BOMB, KeyI: BTN.SPECIAL,
};
const P2_KEYS = {
  ArrowUp: BTN.UP, ArrowDown: BTN.DOWN, ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT,
  Numpad1: BTN.FIRE, Numpad2: BTN.FOCUS, Numpad3: BTN.BOMB, Numpad0: BTN.SPECIAL,
};

// Standard-mapping gamepad -> mask. Pad 0 drives P1, pad 1 drives P2
// (keyboard always works for both, so one pad + keyboard covers co-op).
function gamepadMask(gp) {
  if (!gp) return 0;
  let m = 0;
  const b = (i) => gp.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  if (ax < -0.4 || b(14)) m |= BTN.LEFT;
  if (ax > 0.4 || b(15)) m |= BTN.RIGHT;
  if (ay < -0.4 || b(12)) m |= BTN.UP;
  if (ay > 0.4 || b(13)) m |= BTN.DOWN;
  if (b(0)) m |= BTN.FIRE;                    // A / Cruz
  if (b(2) || b(5) || b(7)) m |= BTN.FOCUS;   // X / RB / RT
  if (b(1)) m |= BTN.BOMB;                    // B / Círculo
  if (b(3)) m |= BTN.SPECIAL;                 // Y / Triángulo
  return m;
}

export class Input {
  constructor(target = window) {
    this.down = new Set();
    target.addEventListener('keydown', (e) => {
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code.startsWith('Numpad')) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  // [p1Mask, p2Mask] for the current tick (keyboard | gamepads).
  sample() {
    let p1 = 0, p2 = 0;
    for (const code of this.down) {
      p1 |= P1_KEYS[code] ?? 0;
      p2 |= P2_KEYS[code] ?? 0;
    }
    const pads = navigator.getGamepads?.() ?? [];
    p1 |= gamepadMask(pads[0]);
    p2 |= gamepadMask(pads[1]);
    return [p1, p2];
  }
}
