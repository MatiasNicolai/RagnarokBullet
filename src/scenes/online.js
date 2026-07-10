// Online co-op lobby. Owns the NetClient lifecycle: connect to the relay, host
// (get a 4-letter code) or join (type a code), then a two-player lobby where
// each picks a character and readies up. The host starts the match, which sends
// both characters + difficulty to both peers; each then launches an identical
// online GameScene (level 1) driven by the lockstep driver.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { ROSTER } from '../characters/index.js';
import { NetClient } from '../net/netclient.js';
import { DIFFICULTIES } from '../sim/difficulty.js';
import { audio } from '../engine/audio.js';
import { music } from '../engine/music.js';

const GOLD = 0xf2c14e;
const NAVY = 0x0b1020;
const NAVY_LIGHT = 0x1b2340;
const DIM = 0x9aa4c0;

const charById = (id) => ROSTER.find((c) => c.id === id) ?? ROSTER[0];

export class OnlineScene {
  constructor(ctx) {
    this.ctx = ctx;
    this.container = new Container();
    const W = ctx.app.renderer.width, H = ctx.app.renderer.height;
    this.W = W; this.H = H; this.cx = W / 2;

    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(NAVY);
    this.container.addChild(bg);

    this.title = new Text({
      text: '─◆ CO-OP ONLINE ◆─',
      style: { fill: GOLD, fontSize: 30, fontFamily: 'Georgia, serif', fontWeight: 'bold', stroke: { color: 0x000000, width: 4 }, letterSpacing: 2 },
    });
    this.title.anchor.set(0.5); this.title.position.set(this.cx, 56);
    this.container.addChild(this.title);

    this.body = new Container();
    this.container.addChild(this.body);

    this.status = new Text({ text: '', style: { fill: DIM, fontSize: 15, fontFamily: 'monospace' } });
    this.status.anchor.set(0.5); this.status.position.set(this.cx, H - 84);
    this.container.addChild(this.status);

    this.hint = new Text({ text: '', style: { fill: 0x5a648a, fontSize: 13, fontFamily: 'monospace' } });
    this.hint.anchor.set(0.5); this.hint.position.set(this.cx, H - 52);
    this.container.addChild(this.hint);

    // lobby state
    this.net = null;
    this.menuIndex = 0;              // 0 host, 1 join, 2 back
    this.codeInput = '';
    this.myCharIdx = 0;
    this.myReady = false;
    this.peerCharId = null;
    this.peerReady = false;
    this.peerPresent = false;

    this.setStage('menu');

    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.t = 0;
    music.play('menu');
  }

  // --- stage machine ---
  setStage(stage) {
    this.stage = stage;
    this.render();
  }

  render() {
    this.body.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (this.stage === 'menu') this.renderMenu();
    else if (this.stage === 'hosting') this.renderHosting();
    else if (this.stage === 'joinentry') this.renderJoinEntry();
    else if (this.stage === 'connecting') this.renderConnecting();
    else if (this.stage === 'lobby') this.renderLobby();
  }

  label(text, x, y, opts = {}) {
    const t = new Text({
      text, style: {
        fill: opts.fill ?? 0xffffff, fontSize: opts.size ?? 18,
        fontFamily: opts.mono === false ? 'Georgia, serif' : 'monospace',
        fontWeight: opts.bold ? 'bold' : 'normal',
      },
    });
    t.anchor.set(opts.ax ?? 0.5, opts.ay ?? 0.5);
    t.position.set(x, y);
    this.body.addChild(t);
    return t;
  }

  renderMenu() {
    const items = ['CREAR SALA', 'UNIRSE A SALA', 'VOLVER'];
    this.menuItems = items.map((txt, i) =>
      this.label(txt, this.cx, 220 + i * 56, { size: 22, fill: i === this.menuIndex ? GOLD : 0xffffff, bold: i === this.menuIndex }));
    this.status.text = 'Juega la campaña en co-op online (2 jugadores).';
    this.hint.text = '↑↓ elegir · ENTER confirmar · ESC volver al título';
  }

  renderConnecting() {
    this.label('Conectando al servidor…', this.cx, this.H / 2, { size: 20, fill: GOLD });
    this.status.text = '';
    this.hint.text = 'ESC cancelar';
  }

  renderHosting() {
    this.label('CÓDIGO DE SALA', this.cx, 190, { size: 16, fill: DIM });
    const box = new Graphics();
    box.roundRect(this.cx - 150, 214, 300, 90, 12).fill(NAVY_LIGHT).stroke({ color: GOLD, width: 3 });
    this.body.addChild(box);
    this.label(this.net?.code ?? '····', this.cx, 260, { size: 56, fill: GOLD, bold: true });
    this.label('Comparte este código con tu compañero.', this.cx, 340, { size: 15, fill: 0xffffff });
    this.status.text = this.peerPresent ? '¡Compañero conectado!' : 'Esperando a que alguien se una…';
    this.hint.text = 'ESC cancelar';
  }

  renderJoinEntry() {
    this.label('ESCRIBE EL CÓDIGO (4 letras)', this.cx, 200, { size: 16, fill: DIM });
    const box = new Graphics();
    box.roundRect(this.cx - 150, 224, 300, 84, 12).fill(NAVY_LIGHT).stroke({ color: GOLD, width: 3 });
    this.body.addChild(box);
    const shown = (this.codeInput + '····').slice(0, 4).split('').join(' ');
    this.label(shown, this.cx, 266, { size: 48, fill: GOLD, bold: true });
    this.status.text = this.joinError ?? '';
    this.status.style.fill = this.joinError ? 0xff6a6a : DIM;
    this.hint.text = 'ESCRIBE 4 letras · ENTER unirse · ⌫ borrar · ESC volver';
  }

  renderLobby() {
    // two player panels side by side (P1 = host/slot0, P2 = guest/slot1)
    const mine = this.net.slot;
    const slots = [0, 1];
    const panelW = 300, gap = 40, totalW = panelW * 2 + gap;
    const x0 = (this.W - totalW) / 2;
    this.charSprites = [];
    slots.forEach((slot, i) => {
      const isMine = slot === mine;
      const charId = isMine ? ROSTER[this.myCharIdx].id : this.peerCharId;
      const ready = isMine ? this.myReady : this.peerReady;
      const px = x0 + i * (panelW + gap);
      const frame = new Graphics();
      frame.roundRect(px, 150, panelW, 320, 12).fill(NAVY_LIGHT)
        .stroke({ color: slot === 0 ? GOLD : 0x3f7fe0, width: 3 });
      this.body.addChild(frame);
      const cxp = px + panelW / 2;
      this.label(`JUGADOR ${slot + 1}${isMine ? ' (TÚ)' : ''}`, cxp, 176,
        { size: 15, fill: slot === 0 ? GOLD : 0x7fb3ff, bold: true });

      if (charId) {
        const art = this.ctx.atlas.characters[charId];
        if (art) {
          const spr = new Sprite(art.poses.idle);
          spr.anchor.set(0.5); spr.scale.set(150 / spr.texture.frame.height);
          spr.position.set(cxp, 290);
          this.body.addChild(spr);
        }
        const ch = charById(charId);
        this.label(ch.name, cxp, 392, { size: 20, fill: 0xffffff, bold: true });
        this.label(ch.className, cxp, 416, { size: 14, fill: GOLD });
      } else {
        this.label('elige…', cxp, 290, { size: 18, fill: DIM });
      }
      this.label(ready ? '✔ LISTO' : '…', cxp, 446, { size: 16, fill: ready ? 0x7fdc8a : DIM, bold: ready });
    });

    const bothReady = this.myReady && this.peerReady && this.peerPresent;
    this.status.text = !this.peerPresent ? 'Esperando al compañero…'
      : bothReady ? (this.net.isHost ? '¡Ambos listos!' : 'Esperando a que el anfitrión empiece…')
        : 'Elige personaje y marca LISTO.';
    this.hint.text = this.net.isHost
      ? '←→ personaje · ESPACIO listo · ENTER empezar (ambos listos) · ESC salir'
      : '←→ personaje · ESPACIO listo · ESC salir';
  }

  // --- networking ---
  async ensureClient() {
    if (this.net) return this.net;
    const net = new NetClient();
    net.on('peerjoined', () => {
      this.peerPresent = true;
      if (this.stage === 'hosting') this.enterLobby(); else this.render();
    });
    net.on('joined', () => { this.peerPresent = true; });
    net.on('peerleft', () => {
      this.peerPresent = false; this.peerReady = false; this.peerCharId = null;
      if (this.stage === 'lobby') { this.status.text = 'El compañero se fue.'; this.setStage('menu'); this.teardownNet(); }
      else this.render();
    });
    net.on('lobby', (m) => { this.peerCharId = m.char; this.peerReady = !!m.ready; if (this.stage === 'lobby') this.render(); });
    net.on('error', (m) => {
      this.joinError = m.msg || 'Error';
      if (this.stage === 'connecting') this.setStage(this._pendingJoin ? 'joinentry' : 'menu');
      else this.render();
    });
    net.on('start', (m) => this.launch(m));
    net.on('close', () => {
      if (this.stage === 'lobby' || this.stage === 'hosting') { this.setStage('menu'); this.teardownNet(); }
    });
    await net.connect();
    this.net = net;
    return net;
  }

  teardownNet() {
    try { this.net?.close(); } catch { /* ignore */ }
    this.net = null;
    this.peerPresent = false; this.peerReady = false; this.peerCharId = null;
    this.myReady = false;
  }

  async doHost() {
    this.setStage('connecting');
    try { const net = await this.ensureClient(); net.host(); this.setStage('hosting'); }
    catch { this.status.text = 'No se pudo conectar al servidor.'; this.setStage('menu'); }
    // 'hosted' arrives async; re-render once code is set
    this.net?.on('hosted', () => { if (this.stage === 'hosting') this.render(); });
  }

  async doJoin(code) {
    this._pendingJoin = true;
    this.setStage('connecting');
    try {
      const net = await this.ensureClient();
      net.on('joined', () => { this._pendingJoin = false; this.enterLobby(); });
      net.join(code);
    } catch { this.joinError = 'No se pudo conectar al servidor.'; this.setStage('joinentry'); }
  }

  // Enter the shared lobby and announce our initial pick so the peer sees it.
  enterLobby() {
    this.myReady = false;
    this.setStage('lobby');
    this.sendMyLobby();
  }

  sendMyLobby() {
    if (this.net) this.net.sendLobby(ROSTER[this.myCharIdx].id, this.myReady);
  }

  startMatch() {
    // host authoritative: fix characters (by slot) + difficulty and broadcast
    const hostChar = this.net.isHost ? ROSTER[this.myCharIdx].id : this.peerCharId;
    const guestChar = this.net.isHost ? this.peerCharId : ROSTER[this.myCharIdx].id;
    this.net.sendStart({ diff: this.ctx.difficulty, level: 0, chars: [hostChar, guestChar] });
    // launch ourselves too (host)
    this.launch({ diff: this.ctx.difficulty, level: 0, chars: [hostChar, guestChar] });
  }

  launch(m) {
    if (this._launched) return;
    this._launched = true;
    const chars = m.chars.map(charById);
    this.ctx.net = this.net;             // persist the connection across level scenes
    const localSlot = this.net.slot;
    // hand the live client to the game; OnlineScene stops owning it now.
    this.net = null;
    this.ctx.difficulty = m.diff ?? this.ctx.difficulty;
    this.ctx.startLevel({
      chars, levelIndex: m.level ?? 0, score: 0, carry: null, difficulty: m.diff ?? this.ctx.difficulty,
      net: { client: this.ctx.net, localSlot, epoch: 0 },
    });
  }

  // --- input ---
  handleKey(e) {
    const code = e.code;
    if (this.stage === 'menu') {
      if (code === 'ArrowUp' || code === 'KeyW') { this.menuIndex = (this.menuIndex + 2) % 3; audio.play('select'); this.render(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { this.menuIndex = (this.menuIndex + 1) % 3; audio.play('select'); this.render(); }
      else if (code === 'Enter' || code === 'KeyJ') {
        audio.play('select');
        if (this.menuIndex === 0) this.doHost();
        else if (this.menuIndex === 1) { this.joinError = null; this.codeInput = ''; this.setStage('joinentry'); }
        else this.leave();
      } else if (code === 'Escape') this.leave();
      return;
    }
    if (this.stage === 'hosting' || this.stage === 'connecting') {
      if (code === 'Escape') { this.teardownNet(); this.setStage('menu'); }
      return;
    }
    if (this.stage === 'joinentry') {
      if (code === 'Escape') { this.setStage('menu'); }
      else if (code === 'Backspace') { this.codeInput = this.codeInput.slice(0, -1); this.render(); }
      else if (code === 'Enter') { if (this.codeInput.length === 4) this.doJoin(this.codeInput); }
      else if (/^Key[A-Z]$/.test(code) && this.codeInput.length < 4) {
        const ch = code.slice(3);
        if ('ABCDEFGHJKLMNPQRSTUVWXYZ'.includes(ch)) { this.codeInput += ch; audio.play('select'); this.render(); }
      } else if (/^Digit[2-9]$/.test(code) && this.codeInput.length < 4) {
        this.codeInput += code.slice(5); audio.play('select'); this.render();
      }
      return;
    }
    if (this.stage === 'lobby') {
      if (code === 'Escape') { this.teardownNet(); this.setStage('menu'); return; }
      if (!this.myReady && (code === 'ArrowLeft' || code === 'KeyA')) { this.myCharIdx = (this.myCharIdx + ROSTER.length - 1) % ROSTER.length; audio.play('select'); this.sendMyLobby(); this.render(); }
      else if (!this.myReady && (code === 'ArrowRight' || code === 'KeyD')) { this.myCharIdx = (this.myCharIdx + 1) % ROSTER.length; audio.play('select'); this.sendMyLobby(); this.render(); }
      else if (code === 'Space') { this.myReady = !this.myReady; audio.play('select'); this.sendMyLobby(); this.render(); }
      else if (code === 'Enter' && this.net.isHost && this.myReady && this.peerReady && this.peerPresent) { audio.play('select'); this.startMatch(); }
      return;
    }
  }

  leave() {
    this.teardownNet();
    this.ctx.goToTitle();
  }

  update(dtMs) {
    this.t += dtMs / 1000;
    // pulse the hosting code / connecting text a touch
    if (this.stage === 'menu' && this.menuItems) {
      const pulse = 0.6 + Math.abs(Math.sin(this.t * 3)) * 0.4;
      this.menuItems[this.menuIndex].alpha = pulse;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    // if we're leaving the lobby without launching, drop the connection
    if (!this._launched) this.teardownNet();
    this.container.destroy({ children: true });
  }
}
