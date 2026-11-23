// Logical playfield size (world units == unscaled pixels). Vertical danmaku
// aspect; the renderer letterboxes this into the window.
export const FIELD_W = 600;
export const FIELD_H = 800;
export const TICK_RATE = 60;

// Ticks between two weapon swaps (SWAP button), so the two weapons' patterns
// can't be interleaved frame by frame.
export const SWAP_COOLDOWN = 30;
