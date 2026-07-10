// Uniform-grid spatial hash for circle-vs-circle collision queries.
// Rebuilt every tick (cheap: plain arrays, no allocation after warmup).
export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(e) {
    const k = ((e.x / this.cellSize) | 0) * 100000 + ((e.y / this.cellSize) | 0);
    let arr = this.cells.get(k);
    if (!arr) this.cells.set(k, (arr = []));
    arr.push(e);
  }

  // Visit entities in the 3x3 cells around (x, y).
  query(x, y, visit) {
    const cx = (x / this.cellSize) | 0;
    const cy = (y / this.cellSize) | 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = this.cells.get((cx + dx) * 100000 + (cy + dy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) visit(arr[i]);
      }
    }
  }
}

export function circleHit(a, b, ra, rb) {
  const dx = a.x - b.x, dy = a.y - b.y, r = ra + rb;
  return dx * dx + dy * dy <= r * r;
}
