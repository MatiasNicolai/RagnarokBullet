// Art Lab — internal visual-asset review tool (NOT part of the game).
// Opens only with ?artlab=1 (see ARTLAB.md). Loads the ORIGINAL atlas plus
// the CLEAN V2.1 tables side by side; gameplay, balance and original assets
// are never touched. Review verdicts live in localStorage only and can be
// downloaded as JSON — nothing is ever written back to the repository.
import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';

const BASE = import.meta.env.BASE_URL || '/';
const REVIEW_KEY = 'artlab_reviews_v1';
export const REVIEW_STATES = ['pendiente', 'aprobado', 'limpieza manual', 'regenerar', 'escala', 'animación'];

// [manifest json, sheet subdir] for every cleaned set produced by the pilots.
const CLEAN_SETS = [
  ['monsters3.clean.json', 'geffen'],
  ['monsters2.clean.json', 'bosses'],
  ['monsters8.clean.json', 'bosses'],
  ['bosses.clean.json', 'bosses'],
  ['bosses2.clean.json', 'bosses'],
  ['bosses3.clean.json', 'bosses'],
  ['monsters5.clean.json', 'bosses'],
  ['monsters7.clean.json', 'bosses'],
];

const jfetch = (url) => fetch(url).then((r) => r.json()).catch(() => null);
const apload = (url) => Assets.load(url).catch(() => null);

/** Load CLEAN V2.1 tables in parallel to the game atlas.
 *  Returns {monsters, bosses} shaped like atlas tables, or empty tables when
 *  a file is missing (the scene then shows 'sin versión clean'). */
export async function loadCleanTables() {
  const monsters = {};
  const bosses = {};
  const sub = (src, r) => new Texture({ source: src.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
  const toTex = (src) => (v) => (Array.isArray(v) ? v.map((r) => sub(src, r)) : sub(src, v));
  await Promise.all(CLEAN_SETS.map(async ([json, dir]) => {
    const mf = await jfetch(`${BASE}assets-v2/${dir}/${json}`);
    if (!mf || !mf.sheet) return;
    const src = await apload(`${BASE}assets-v2/${dir}/${mf.sheet}`);
    if (!src) return;
    const conv = toTex(src);
    if (mf.monsters) {
      for (const [name, m] of Object.entries(mf.monsters)) {
        monsters[name] = {
          down: Object.fromEntries(Object.entries(m.down || {}).map(([k, v]) => [k, conv(v)])),
          up: Object.fromEntries(Object.entries(m.up || {}).map(([k, v]) => [k, conv(v)])),
        };
      }
    }
    if (mf.bosses) {
      for (const [name, m] of Object.entries(mf.bosses)) {
        bosses[name] = {
          down: Object.fromEntries(Object.entries(m.down || {}).map(([k, v]) => [k, conv(v)])),
          up: Object.fromEntries(Object.entries(m.up || {}).map(([k, v]) => [k, conv(v)])),
        };
      }
    }
  }));
  return { monsters, bosses };
}

// Priority first: the 11 cleaned encounters, then the 8 Geffen mobs.
const PRIORITY_BOSSES = ['orcHero', 'mastering', 'doppelganger', 'darkLord',
  'bapho_jr_giant', 'baphomet', 'archdam', 'vesper', 'failedexp',
  'seyren', 'magaleta'];
const GEFFEN_MOBS = ['willow', 'zombie', 'munak', 'bongun', 'ninetails',
  'deviruchi', 'marionette', 'wraith'];
const CHARACTERS = ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri'];

/** Flat navigable catalog: [{group, name, label, kind}].
 *  kind 'boss'|'mob' reads bosses→monsters tables; 'char' reads characters. */
export function buildCatalog(ctx) {
  const cat = [];
  const hasBoss = (n) => !!(ctx.atlas.bosses && ctx.atlas.bosses[n]);
  const hasMob = (n) => !!(ctx.atlas.monsters && ctx.atlas.monsters[n]);
  for (const n of PRIORITY_BOSSES) {
    if (hasBoss(n) || hasMob(n)) cat.push({ group: 'Jefes y midbosses', name: n, label: n, kind: hasBoss(n) ? 'boss' : 'mob' });
  }
  for (const n of GEFFEN_MOBS) {
    if (hasMob(n)) cat.push({ group: 'Mobs Geffen', name: n, label: n, kind: 'mob' });
  }
  for (const n of CHARACTERS) {
    if (ctx.atlas.characters && ctx.atlas.characters[n]) cat.push({ group: 'Personajes', name: n, label: n, kind: 'char' });
  }
  const seen = new Set(cat.map((e) => e.name));
  for (const n of Object.keys(ctx.atlas.monsters || {})) {
    if (!seen.has(n)) cat.push({ group: 'Otros mobs', name: n, label: n, kind: 'mob' });
  }
  for (const n of Object.keys(ctx.atlas.bosses || {})) {
    if (!seen.has(n)) cat.push({ group: 'Otros jefes', name: n, label: n, kind: 'boss' });
  }
  return cat;
}

export function loadReviews() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch { return {}; }
}

export function saveReviews(reviews) {
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews)); } catch { /* private mode: reviews stay in memory */ }
}

const W = 840;
const H = 800;
const GOLD = 0xf2c14e;
const PANEL = { y: 64, h: 470, w: 404, gap: 12 };
const BASELINE = 500; // feet line shared by both panels
const BG_MODES = ['negro', 'blanco', 'gris', 'mapa'];
const BG_COLORS = { negro: 0x0a0a12, blanco: 0xf2f2f2, gris: 0x808080 };

export class ArtLabScene {
  constructor(ctx, clean) {
    this.ctx = ctx;
    this.clean = clean || { monsters: {}, bosses: {} };
    this.catalog = buildCatalog(ctx);
    this.reviews = loadReviews();
    this.container = new Container();

    this.ei = 0;
    this.poseIdx = 0;
    this.frameIdx = 0;
    this.playing = true;
    this.acc = 0;
    this.zoom = 3;
    this.bgIdx = 0;
    this.overlay = 1; // 0 nada, 1 rect+ancla, 2 +hitbox aprox
    if (!this.mapTex) {
      const set = ctx.atlas.maps && ctx.atlas.maps.prontera;
      this.mapTex = Array.isArray(set) && set.length ? set[0] : null;
    }

    this.bg = new Graphics();
    this.container.addChild(this.bg);
    this.mapSprite = null;
    this.labels = {};
    this.buttons = [];
    this.buildHeader();
    this.buildPanels();
    this.buildControls();
    this.refreshAll();

    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
  }

  // ---- catalog / pose access (original + clean in parallel) ----

  entry() { return this.catalog[this.ei]; }

  table(entry, isClean) {
    const tables = isClean ? this.clean : this.ctx.atlas;
    if (entry.kind === 'char') return null;
    if (tables.bosses && tables.bosses[entry.name]) return { side: 'boss', t: tables.bosses[entry.name] };
    if (tables.monsters && tables.monsters[entry.name]) return { side: 'mob', t: tables.monsters[entry.name] };
    return null;
  }

  poseList(entry, isClean) {
    if (entry.kind === 'char') {
      if (isClean) return []; // characters have no clean version — never mirror original as clean
      const c = this.ctx.atlas.characters[entry.name];
      if (!c) return [];
      const out = [];
      for (const side of ['DOWN', 'UP']) {
        if (c.poses[side] && c.poses[side].length) out.push({ side, pose: 'frames', frames: c.poses[side] });
      }
      return out;
    }
    const found = this.table(entry, isClean);
    if (!found) return [];
    const out = [];
    for (const side of ['down', 'up']) {
      const s = found.t[side];
      if (!s) continue;
      for (const [pose, v] of Object.entries(s)) out.push({ side, pose, frames: Array.isArray(v) ? v : [v] });
    }
    return out;
  }

  hasClean(entry) {
    if (entry.kind === 'char') return false;
    const t = this.table(entry, true);
    return !!(t && (Object.keys(t.t.down || {}).length || Object.keys(t.t.up || {}).length));
  }

  currentPose() {
    const list = this.poseList(this.entry(), false);
    if (!list.length) return null;
    this.poseIdx = ((this.poseIdx % list.length) + list.length) % list.length;
    return list[this.poseIdx];
  }

  currentFrames(isClean) {
    const list = this.poseList(this.entry(), isClean);
    if (!list.length) return [];
    const p = list[Math.min(this.poseIdx, list.length - 1)];
    return p.frames;
  }

  // ---- navigation ----

  gotoEntity(i) {
    this.ei = ((i % this.catalog.length) + this.catalog.length) % this.catalog.length;
    this.poseIdx = 0;
    this.frameIdx = 0;
    this.refreshAll();
  }

  gotoGroup() {
    if (!this.catalog.length) return;
    const cur = this.entry().group;
    const groups = [...new Set(this.catalog.map((e) => e.group))];
    const next = groups[(groups.indexOf(cur) + 1) % groups.length];
    this.gotoEntity(this.catalog.findIndex((e) => e.group === next));
  }

  stepPose(d) {
    const n = this.poseList(this.entry(), false).length;
    if (!n) return;
    this.poseIdx = ((this.poseIdx + d) % n + n) % n;
    this.frameIdx = 0;
    this.refreshAll();
  }

  toggleSide() {
    const list = this.poseList(this.entry(), false);
    if (!list.length) return;
    const cur = list[this.poseIdx].side;
    const other = (this.entry().kind === 'char' ? ['DOWN', 'UP'] : ['down', 'up']).find((s) => s !== cur);
    const j = list.findIndex((p) => p.side === other);
    if (j >= 0) { this.poseIdx = j; this.frameIdx = 0; this.refreshAll(); }
  }

  stepFrame(d) {
    const n = this.currentFrames(false).length;
    if (!n) return;
    this.frameIdx = ((this.frameIdx + d) % n + n) % n;
    this.refreshSprites();
  }

  cycleBg() {
    for (let k = 0; k < BG_MODES.length; k++) {
      this.bgIdx = (this.bgIdx + 1) % BG_MODES.length;
      if (BG_MODES[this.bgIdx] !== 'mapa' || this.mapTex) break;
    }
    this.refreshBg();
    this.refreshAll();
  }

  cycleZoom(d) {
    this.zoom = Math.min(8, Math.max(1, this.zoom + d));
    this.refreshSprites();
  }

  cycleReview() {
    const name = this.entry().name;
    const cur = this.reviews[name] ?? 0;
    this.reviews[name] = (cur + 1) % REVIEW_STATES.length;
    saveReviews(this.reviews);
    this.refreshAll();
  }

  reviewedCount() {
    return Object.values(this.reviews).filter((v) => v !== 0).length;
  }

  exportReviews() {
    const payload = { tool: 'artlab', version: 1, exportedAt: new Date().toISOString(), reviews: this.reviews };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'artlab-reviews.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---- layout ----

  txt(str, style, x, y, anchor = 0) {
    const t = new Text({ text: str, style });
    if (anchor === 0.5) t.anchor.set(0.5);
    t.position.set(x, y);
    this.container.addChild(t);
    return t;
  }

  buildHeader() {
    this.txt('ART LAB · revisión visual (no es parte del juego)', {
      fill: GOLD, fontSize: 20, fontFamily: 'Georgia, serif', fontWeight: 'bold',
    }, W / 2, 8, 0.5);
    this.labels.entity = this.txt('', { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace' }, W / 2, 36, 0.5);
  }

  buildPanels() {
    this.panels = [];
    const titles = ['ORIGINAL', 'CLEAN V2.1'];
    for (let c = 0; c < 2; c++) {
      const x = 8 + c * (PANEL.w + PANEL.gap);
      const frame = new Graphics();
      frame.roundRect(x, PANEL.y, PANEL.w, PANEL.h, 8).fill(0x141828).stroke({ color: 0x5a3a4a, width: 2 });
      this.container.addChild(frame);
      const title = this.txt(titles[c], { fill: GOLD, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' }, x + PANEL.w / 2, PANEL.y + 6, 0.5);
      const sprite = new Sprite();
      sprite.anchor.set(0.5, 1);
      sprite.position.set(x + PANEL.w / 2, BASELINE);
      this.container.addChild(sprite);
      const overlay = new Graphics();
      this.container.addChild(overlay);
      const note = this.txt('', { fill: 0x9aa4c0, fontSize: 12, fontFamily: 'monospace' }, x + PANEL.w / 2, BASELINE + 8, 0.5);
      this.panels.push({ x, title, sprite, overlay, note });
    }
  }

  button(x, y, w, getLabel, onClick) {
    const ctr = new Container();
    ctr.position.set(x, y);
    const bg = new Graphics();
    ctr.addChild(bg);
    const label = new Text({ text: '', style: { fill: 0xffffff, fontSize: 13, fontFamily: 'monospace' } });
    label.anchor.set(0.5);
    label.position.set(w / 2, 15);
    ctr.addChild(label);
    ctr.eventMode = 'static';
    ctr.cursor = 'pointer';
    ctr.on('pointerdown', (e) => { e.stopPropagation(); onClick(); });
    const paint = () => {
      bg.clear();
      bg.roundRect(0, 0, w, 30, 6).fill(0x2a3350).stroke({ color: 0x5a3a4a, width: 1 });
    };
    paint();
    this.container.addChild(ctr);
    const btn = { ctr, refresh: () => { label.text = getLabel(); } };
    this.buttons.push(btn);
    return btn;
  }

  buildControls() {
    const y0 = 548;
    const B = (x, y, w, getLabel, onClick) => this.button(x, y, w, getLabel, onClick);
    // row 1: entity
    B(8, y0, 60, () => '◀', () => this.gotoEntity(this.ei - 1));
    B(72, y0, 60, () => '▶', () => this.gotoEntity(this.ei + 1));
    B(136, y0, 60, () => '+5', () => this.gotoEntity(this.ei + 5));
    B(200, y0, 110, () => 'Grupo', () => this.gotoGroup());
    this.labels.nav = this.txt('', { fill: 0x9aa4c0, fontSize: 13, fontFamily: 'monospace' }, 322, y0 + 7);
    // row 2: pose / playback
    const y1 = y0 + 40;
    B(8, y1, 90, () => '◀ Pose', () => this.stepPose(-1));
    B(102, y1, 90, () => 'Pose ▶', () => this.stepPose(1));
    B(196, y1, 80, () => 'Lado', () => this.toggleSide());
    B(280, y1, 90, () => (this.playing ? '⏸ Pausa' : '▶ Play'), () => { this.playing = !this.playing; this.refreshAll(); });
    B(374, y1, 90, () => 'Frame+', () => this.stepFrame(1));
    this.labels.pose = this.txt('', { fill: 0x9aa4c0, fontSize: 13, fontFamily: 'monospace' }, 476, y1 + 7);
    // row 3: view
    const y2 = y1 + 40;
    B(8, y2, 110, () => `Fondo: ${BG_MODES[this.bgIdx]}`, () => this.cycleBg());
    B(122, y2, 80, () => 'Zoom-', () => this.cycleZoom(-1));
    B(206, y2, 80, () => `Zoom ${this.zoom}x`, () => this.cycleZoom(1));
    B(290, y2, 130, () => `Overlay: ${['nada', 'rect+ancla', '+hitbox ≈'][this.overlay]}`, () => { this.overlay = (this.overlay + 1) % 3; this.refreshSprites(); });
    // row 4: review + exit
    const y3 = y2 + 40;
    B(8, y3, 220, () => `Veredicto: ${REVIEW_STATES[this.reviews[this.entry().name] ?? 0]}`, () => this.cycleReview());
    B(232, y3, 150, () => 'Exportar JSON', () => this.exportReviews());
    B(386, y3, 170, () => 'Salir al título', () => this.ctx.goToTitle());
    this.txt('Teclas: ←/→ entidad · Shift+←/→ ±5 · ↑/↓ pose · L lado · Espacio play · . frame · B fondo · Z zoom · O overlay · R veredicto · E exportar · Esc salir', {
      fill: 0x5a648a, fontSize: 11, fontFamily: 'monospace',
    }, W / 2, y3 + 36, 0.5);
  }

  // ---- refresh ----

  refreshBg() {
    this.bg.clear();
    const mode = BG_MODES[this.bgIdx];
    if (this.mapSprite) { this.container.removeChild(this.mapSprite); this.mapSprite.destroy(); this.mapSprite = null; }
    if (mode === 'mapa' && this.mapTex) {
      const s = new Sprite(this.mapTex);
      const cover = Math.max(W / this.mapTex.frame.width, H / this.mapTex.frame.height);
      s.scale.set(cover);
      s.position.set((W - this.mapTex.frame.width * cover) / 2, (H - this.mapTex.frame.height * cover) / 2);
      this.container.addChildAt(s, 0);
      this.mapSprite = s;
      this.bg.rect(0, 0, W, H).fill({ color: 0x0a0a12, alpha: 0.25 });
    } else {
      this.bg.rect(0, 0, W, H).fill(BG_COLORS[mode]);
    }
  }

  refreshHeader() {
    const e = this.entry();
    const st = REVIEW_STATES[this.reviews[e.name] ?? 0];
    this.labels.entity.text = `${e.group} · ${e.label}  (${this.ei + 1}/${this.catalog.length})  [${st}]  ·  revisados: ${this.reviewedCount()}`;
    this.labels.nav.text = `${e.group}`;
    const p = this.currentPose();
    const nf = p ? p.frames.length : 0;
    this.labels.pose.text = p ? `${p.side}.${p.pose} · frame ${this.frameIdx + 1}/${nf}` : 'sin poses';
  }

  refreshSprites() {
    const e = this.entry();
    const cleanMissing = !this.hasClean(e);
    const sides = [false, true];
    for (let c = 0; c < 2; c++) {
      const panel = this.panels[c];
      const isClean = sides[c];
      const frames = this.currentFrames(isClean);
      const tex = frames.length ? frames[this.frameIdx % frames.length] : null;
      panel.overlay.clear();
      if (!tex) {
        panel.sprite.texture = Texture.EMPTY;
        panel.title.text = sides[c] ? (cleanMissing ? 'CLEAN: sin versión clean' : 'CLEAN V2.1') : 'ORIGINAL';
        panel.note.text = sides[c] && cleanMissing ? 'este asset aún no tiene versión clean' : '';
        continue;
      }
      panel.title.text = sides[c] ? 'CLEAN V2.1' : 'ORIGINAL';
      panel.note.text = '';
      panel.sprite.texture = tex;
      panel.sprite.scale.set(this.zoom);
      const fw = tex.frame.width * this.zoom;
      const fh = tex.frame.height * this.zoom;
      const cx = panel.x + PANEL.w / 2;
      if (this.overlay >= 1) {
        const g = panel.overlay;
        g.rect(cx - fw / 2, BASELINE - fh, fw, fh).stroke({ color: 0xf2c14e, width: 1 });
        // anchor: feet center
        g.moveTo(cx - 6, BASELINE).lineTo(cx + 6, BASELINE).stroke({ color: 0x7de3f4, width: 2 });
        g.moveTo(cx, BASELINE - 6).lineTo(cx, BASELINE + 6).stroke({ color: 0x7de3f4, width: 2 });
      }
      if (this.overlay >= 2) {
        const g = panel.overlay;
        g.circle(cx, BASELINE - 12 * this.zoom, 12 * this.zoom).stroke({ color: 0xff6a6a, width: 1 });
        g.moveTo(cx - 3, BASELINE - 12 * this.zoom).lineTo(cx + 3, BASELINE - 12 * this.zoom).stroke({ color: 0xff6a6a, width: 1 });
        panel.note.text = 'hitbox ≈ ilustrativo (el real vive en la sim, no en el arte)';
      }
    }
    this.refreshHeader();
  }

  refreshAll() {
    this.refreshBg();
    for (const b of this.buttons) b.refresh();
    this.refreshSprites();
  }

  // ---- input / lifecycle ----

  handleKey(e) {
    const k = e.key;
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    if (k === 'ArrowRight') this.gotoEntity(this.ei + (e.shiftKey ? 5 : 1));
    else if (k === 'ArrowLeft') this.gotoEntity(this.ei - (e.shiftKey ? 5 : 1));
    else if (k === 'ArrowDown') this.stepPose(1);
    else if (k === 'ArrowUp') this.stepPose(-1);
    else if (k === 'l' || k === 'L') this.toggleSide();
    else if (k === ' ') { this.playing = !this.playing; this.refreshAll(); }
    else if (k === '.') this.stepFrame(1);
    else if (k === 'b' || k === 'B') this.cycleBg();
    else if (k === 'z' || k === 'Z') this.cycleZoom(e.shiftKey ? -1 : 1);
    else if (k === 'o' || k === 'O') { this.overlay = (this.overlay + 1) % 3; this.refreshSprites(); }
    else if (k === 'r' || k === 'R') this.cycleReview();
    else if (k === 'e' || k === 'E') this.exportReviews();
    else if (k === 'g' || k === 'G') this.gotoGroup();
    else if (k === 'Escape' || k === 't' || k === 'T') this.ctx.goToTitle();
  }

  update(deltaMS) {
    if (!this.playing) return;
    this.acc += deltaMS;
    const n = this.currentFrames(false).length;
    if (n > 1 && this.acc >= 140) {
      this.acc = 0;
      this.frameIdx = (this.frameIdx + 1) % n;
      this.refreshSprites();
    } else if (n <= 1) {
      this.acc = 0;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}
