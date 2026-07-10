// Object pool: bullet-hell entity churn (hundreds of spawns/kills per second)
// must not allocate. Entities live in a dense array; kills swap-remove.
export class Pool {
  constructor(create) {
    this.create = create;
    this.active = [];
    this.free = [];
  }

  spawn() {
    const e = this.free.pop() ?? this.create();
    e.alive = true;
    this.active.push(e);
    return e;
  }

  // Swap-remove by index (iterate active[] backwards when killing).
  killAt(i) {
    const e = this.active[i];
    e.alive = false;
    const last = this.active.pop();
    if (last !== e) this.active[i] = last;
    this.free.push(e);
  }

  clear() {
    while (this.active.length) this.killAt(this.active.length - 1);
  }
}
