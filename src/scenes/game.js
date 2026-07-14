// Game scene: playfield (sim + renderer) + top bar + sidebar + boss bar +
// progress rail. Owns the sim event loop, routing each event to particles
// (renderer), sound (audio) and transient banners / dialogue / results.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { createSim, tickSim } from '../sim/sim.js';
import { LockstepDriver } from '../net/lockstep.js';
import { spawnBoss } from '../sim/boss.js';
import { LEVELS } from '../levels/index.js';
import { DIFFICULTIES } from '../sim/difficulty.js';
import { Renderer } from '../render/renderer.js';
import { Sidebar } from '../ui/sidebar.js';
import { BossBar } from '../ui/bossbar.js';
import { makeResults } from '../ui/results.js';
import { makeNameEntry } from '../ui/nameentry.js';
import { bossDialogue } from '../data/dialogue.js';
import { audio } from '../engine/audio.js';
import { music } from '../engine/music.js';
import { BTN } from '../engine/input.js';
import { qualifies, submitScore } from '../engine/scores.js';
import { FIELD_W, FIELD_H, TICK_RATE } from '../sim/constants.js';

const TICK_MS = 1000 / TICK_RATE;
const GOLD = 0xd9a94a;
const LEVEL_SEEDS = [0xc0ffee, 0x5eeded, 0xba5e1a];

// Practice: a synthetic level that just drops the chosen boss in immediately.
function practiceScript(bossDef) {
  return (sim) => { if (!sim._pbInit) { sim._pbInit = true; spawnBoss(sim, bossDef); } };
}

export class GameScene {
  // campaign = { chars, levelIndex, score, carry, difficulty, practice? }
  constructor(ctx, campaign) {
    this.ctx = ctx;
    this.campaign = campaign;
    this.chars = campaign.chars;
    this.levelIndex = campaign.levelIndex;
    this.practice = campaign.practice ?? null;
    this.diffIndex = campaign.difficulty ?? ctx.difficulty ?? 1;
    const baseLevel = LEVELS[this.levelIndex];
    this.level = this.practice
      ? { script: practiceScript(this.practice), theme: baseLevel.theme, title: 'Práctica', biomeNames: baseLevel.biomeNames }
      : baseLevel;
    this.isFinal = !this.practice && this.levelIndex === LEVELS.length - 1;
    this.container = new Container();

    this.sim = createSim(
      LEVEL_SEEDS[this.levelIndex] ?? 0xc0ffee,
      this.chars, campaign.carry, campaign.score ?? 0, this.diffIndex,
    );
    this.sim.continues = campaign.continues ?? 0; // arcade continues carry across levels
    if (this.practice) this.sim.biome = 1; // show the boss's final biome
    // levels with a real map set (Prontera, Geffen) use the scrolling backdrop;
    // the rest fall back to the procedural living theme.
    const mapSet = baseLevel.mapSet ? ctx.atlas.maps?.[baseLevel.mapSet] : null;
    const maps = (mapSet && mapSet.length === 5) ? mapSet : null;
    this.renderer = new Renderer(ctx.app, ctx.atlas, this.container, this.level.theme, maps);

    // progress rail (left edge)
    this.progressBg = new Graphics();
    this.progressBg.roundRect(4, 66, 8, FIELD_H - 130, 4)
      .fill({ color: 0x000000, alpha: 0.4 }).stroke({ color: 0x8a6a2a, width: 1 });
    this.container.addChild(this.progressBg);
    this.progressFill = new Graphics();
    this.container.addChild(this.progressFill);

    this.sidebar = new Sidebar(ctx.atlas, this.chars, this.container);
    this.bossbar = new BossBar(this.container);

    // top bar
    const bar = new Graphics();
    bar.rect(0, 0, FIELD_W, 30).fill({ color: 0x000000, alpha: 0.45 });
    this.container.addChild(bar);
    this.topLeft = new Text({
      text: `${this.level.title} — ${this.level.biomeNames[0][1]}`,
      style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', stroke: { color: 0x000000, width: 3 } },
    });
    this.topLeft.position.set(18, 7);
    this.container.addChild(this.topLeft);
    this.fpsText = new Text({
      text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', stroke: { color: 0x000000, width: 3 } },
    });
    this.fpsText.anchor.set(1, 0);
    this.fpsText.position.set(FIELD_W - 10, 7);
    this.container.addChild(this.fpsText);

    // transient center banner
    this.banner = new Text({
      text: '', style: {
        fill: 0xffffff, fontSize: 40, fontFamily: 'Georgia, serif', fontWeight: 'bold',
        stroke: { color: 0x000000, width: 6 }, letterSpacing: 2, align: 'center',
      },
    });
    this.banner.anchor.set(0.5);
    this.banner.position.set(FIELD_W / 2, FIELD_H * 0.4);
    this.banner.visible = false;
    this.container.addChild(this.banner);
    this.bannerT = 0;

    // fade-in overlay (covers the playfield + sidebar)
    this.fade = new Graphics();
    this.fade.rect(0, 0, FIELD_W + 240, FIELD_H).fill(0x000000);
    this.container.addChild(this.fade);
    this.fadeT = 30;

    this.acc = 0;
    this.fpsSmooth = 60;
    this.slowmo = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.resultsShown = false;
    this.dialogueDone = false;
    this.recorded = false;
    this.bossMusic = false;

    music.play(this.practice ? 'boss' : `level${this.levelIndex + 1}`);

    this.onKey = (e) => {
      if (e.code === 'Escape') { this.leaveToTitle(); return; }
      if (this.overlayKey) this.overlayKey(e);
    };
    window.addEventListener('keydown', this.onKey);

    // --- online co-op: drive the sim via lockstep instead of local input ---
    this.net = campaign.net ?? null;        // { client, localSlot, epoch }
    this.online = !!this.net;
    this.driver = null;
    this.netStall = false;
    this.resultsHold = 0;
    if (this.online) {
      this.driver = new LockstepDriver({
        net: this.net.client, sim: this.sim, stage: this.level.script,
        localSlot: this.net.localSlot, epoch: this.net.epoch ?? 0,
        // each player is at their own keyboard, so the local player always uses
        // the P1 key set; the driver routes it to this client's slot.
        sampleLocal: () => this.ctx.input.sample()[0],
        onStall: (w) => { this.netStall = w; },
        onDesync: () => this.handleNetEnd('Desincronización — se cerró la partida online'),
      });
      this._offPeerLeft = this.net.client.on('peerleft', () => this.handleNetEnd('Compañero desconectado'));
      this._offClose = this.net.client.on('close', () => this.handleNetEnd('Conexión perdida'));

      // small online status badge (slot + waiting indicator)
      this.netBadge = new Text({
        text: '', style: { fill: 0x7fdc8a, fontSize: 12, fontFamily: 'monospace', stroke: { color: 0x000000, width: 3 } },
      });
      this.netBadge.anchor.set(0.5, 0);
      this.netBadge.position.set(FIELD_W / 2, 34);
      this.container.addChild(this.netBadge);
    }

    window.__game = { sim: this.sim, app: ctx.app };
  }

  showBanner(text, ticks, color = 0xffffff) {
    this.banner.text = text;
    this.banner.style.fill = color;
    this.banner.visible = true;
    this.bannerT = ticks;
  }

  handleEvent(ev) {
    this.renderer.onEvent(ev);
    switch (ev.type) {
      case 'kill': audio.play('kill'); break;
      case 'graze': audio.play('graze'); break;
      case 'item': audio.play('item'); break;
      case 'chest': audio.play('chest'); break;
      case 'mimic': audio.play('chest'); this.showBanner('¡MIMIC!', 60, 0xc95bff); break;
      case 'bomb': audio.play('bomb'); this.shake = Math.max(this.shake, 10); break;
      case 'death': audio.play('death'); this.shake = Math.max(this.shake, 14); this.hitstop = Math.max(this.hitstop, 6); break;
      case 'warning': audio.play('warning'); this.showBanner(`¡ALERTA!\n${ev.name}`, 120, 0xff4a4a); break;
      case 'bossWarning':
        audio.play('warning');
        this.showBanner(`¡¡JEFE!!\n${ev.name}`, 150, 0xff4a4a);
        this.showDialogue(ev.name);
        break;
      case 'spellCard': audio.play('spellcard'); this.showBanner(ev.name, 90, GOLD); break;
      case 'bossPhase': this.shake = Math.max(this.shake, 8); this.hitstop = Math.max(this.hitstop, 5); break;
      case 'bossDown': audio.play('bossDown'); this.slowmo = 90; this.shake = 24; break;
      case 'continue':
        // the sim revived the run (arcade continue): drop the game-over overlay
        if (this.overlay) { this.overlay.destroy({ children: true }); this.overlay = null; }
        this.overlayKey = null;
        audio.play('clear');
        this.showBanner(`CONTINUE ×${ev.count}\n(score reiniciado)`, 110, GOLD);
        break;
      case 'levelClear': audio.play('clear'); music.play('victory'); break;
      default: break;
    }
  }

  update(dtMs) {
    if (this.online) {
      // lockstep couples both clients; keep the juice counters live for gates
      // and screen shake, but don't scale the network clock with them (steady
      // pacing keeps the two sims smoothly in step).
      if (this.hitstop > 0) this.hitstop--;
      if (this.slowmo > 0) this.slowmo--;
      if (!this._netEnded) this.driver.advance(dtMs);
    } else {
      // hit-stop: freeze the sim briefly for impact (still renders)
      if (this.hitstop > 0) { this.hitstop--; dtMs = 0; }
      if (this.slowmo > 0) { this.slowmo--; dtMs *= 0.34; }
      this.acc += dtMs;
      if (this.acc > 250) this.acc = 250;
      while (this.acc >= TICK_MS) {
        tickSim(this.sim, this.ctx.input.sample(), this.level.script);
        this.acc -= TICK_MS;
      }
    }
    // route the batch of events produced this frame
    for (const ev of this.sim.events) this.handleEvent(ev);
    this.sim.events.length = 0;

    // per-class shot blip while a player holds fire. Online: both players' fire
    // is known from the sim (prevMask), so you hear your ally shooting too.
    if (!this.sim.gameOver && !this.sim.levelComplete) {
      const masks = this.online ? null : this.ctx.input.sample();
      this.sim.players.forEach((p, i) => {
        if (!p || p.down) return;
        const firing = this.online ? (p.prevMask & BTN.FIRE) : (masks[i] & BTN.FIRE);
        if (firing) audio.playShot(p.char.id);
      });
    }

    if (this.netBadge) {
      this.netBadge.text = this.netStall ? '⧗ esperando a tu compañero…' : '';
      this.netBadge.visible = this.netStall;
    }

    // switch to boss music once the boss is fighting; raise tension in its last card
    if (this.sim.boss && !this.sim.boss.intro) {
      if (!this.bossMusic) { music.play('boss'); this.bossMusic = true; }
      const b = this.sim.boss;
      const last = b.cardIndex === b.def.cards.length - 1;
      music.setTension(last ? 1 - Math.max(0, b.cardHp / b.cardMax) : 0);
    }

    this.renderer.sync(this.sim);
    this.sidebar.update(this.sim);
    this.bossbar.update(this.sim);
    this.updateProgress();
    this.updateTopBar();

    // screen shake (playfield only) + fade-in
    if (this.shake > 0) {
      this.shake--;
      const m = this.shake * 0.6;
      this.renderer.world.x = (Math.random() - 0.5) * m;
      this.renderer.world.y = (Math.random() - 0.5) * m;
    } else { this.renderer.world.x = 0; this.renderer.world.y = 0; }
    if (this.fadeT > 0) { this.fadeT--; this.fade.alpha = this.fadeT / 30; if (this.fadeT === 0) this.fade.visible = false; }

    if (this.bannerT > 0) {
      this.bannerT--;
      this.banner.alpha = Math.min(1, this.bannerT / 20);
      if (this.bannerT === 0) this.banner.visible = false;
    }

    if (this.dialogueBox) {
      this.dialogueTimer--;
      if (this.dialogueTimer <= 0) {
        this.dialogueBox.destroy({ children: true });
        this.dialogueBox = null;
      }
    }

    if (this.sim.levelComplete && !this.resultsShown && this.slowmo === 0) {
      this.resultsAt = (this.resultsAt ?? this.sim.tick) ;
      if (this.sim.tick - this.resultsAt > 60) this.showResults();
    }
    if (this.sim.gameOver && !this.overlay) this.showGameOver();

    // online: both clients auto-advance from the results screen so they stay
    // together (no per-client Enter), each spinning up the next level's sim.
    if (this.online && this.resultsHold > 0) {
      this.resultsHold--;
      if (this.resultsHold === 0) this.advanceOrEnd();
    }

    this.fpsSmooth += (1000 / Math.max(dtMs, 0.01) - this.fpsSmooth) * 0.05;
    this.fpsText.text = `${this.fpsSmooth.toFixed(0)} fps`;
  }

  updateTopBar() {
    const cont = this.sim.continues > 0 ? `  ·  CONTINUE ×${this.sim.continues}` : '';
    if (this.sim.boss) { this.topLeft.text = `${this.level.title} — ${this.sim.boss.name}${cont}`; return; }
    let name = this.level.biomeNames[0][1];
    for (const [th, n] of this.level.biomeNames) if (this.sim.biome >= th) name = n;
    this.topLeft.text = `${this.level.title} — ${name}${cont}`;
  }

  updateProgress() {
    const barH = FIELD_H - 134;
    const top = 68;
    this.progressFill.clear();
    const frac = Math.min(1, this.sim.biome);
    this.progressFill.roundRect(6, top + barH * (1 - frac), 4, barH * frac, 2).fill(0xf2c14e);
    // mid-boss marker at 0.8, boss diamond at top
    const midY = top + barH * (1 - 0.8);
    this.progressFill.rect(2, midY, 12, 2).fill(this.sim.biome >= 0.8 ? 0xf2c14e : 0x5a648a);
    const bossReached = !!this.sim.boss || this.sim.levelComplete;
    this.progressFill.poly([8, top - 8, 14, top - 2, 8, top + 4, 2, top - 2])
      .fill(bossReached ? 0xe0472e : 0x5a648a).stroke({ color: GOLD, width: 1 });
  }

  showDialogue(bossName) {
    if (this.dialogueDone) return;
    this.dialogueDone = true;
    const line = bossDialogue(bossName, this.chars[0].id);
    if (!line) return;
    const box = new Container();
    const panel = new Graphics();
    panel.roundRect(20, FIELD_H - 180, FIELD_W - 40, 150, 10)
      .fill({ color: 0x0b1020, alpha: 0.92 }).stroke({ color: GOLD, width: 2 });
    box.addChild(panel);

    const art = this.ctx.atlas.characters[this.chars[0].id];
    const pPort = new Sprite(art.poses.idle);
    pPort.anchor.set(0.5, 1); pPort.scale.set(120 / pPort.texture.frame.height);
    pPort.position.set(70, FIELD_H - 34);
    box.addChild(pPort);

    const pName = new Text({ text: this.chars[0].name, style: { fill: GOLD, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' } });
    pName.position.set(120, FIELD_H - 168); box.addChild(pName);
    const pLine = new Text({
      text: line.p, style: { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace', wordWrap: true, wordWrapWidth: FIELD_W - 170 },
    });
    pLine.position.set(120, FIELD_H - 148); box.addChild(pLine);

    const bName = new Text({ text: bossName, style: { fill: 0xff6a4a, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' } });
    bName.anchor.set(1, 0); bName.position.set(FIELD_W - 40, FIELD_H - 100); box.addChild(bName);
    const bLine = new Text({
      text: line.b, style: { fill: 0xffd8c0, fontSize: 15, fontFamily: 'monospace', align: 'right', wordWrap: true, wordWrapWidth: FIELD_W - 170 },
    });
    bLine.anchor.set(1, 0); bLine.position.set(FIELD_W - 40, FIELD_H - 80); box.addChild(bLine);

    this.container.addChild(box);
    // auto-dismiss after the boss finishes flying in (counted down in update)
    this.dialogueBox = box;
    this.dialogueTimer = 260;
  }

  showResults() {
    this.resultsShown = true;
    if (this.practice) {
      music.play('victory');
      this.showBanner('¡JEFE DERROTADO!', 100000, GOLD);
      this.overlayKey = (e) => { if (e.code === 'Enter') this.ctx.goToPractice(); };
      return;
    }
    this.overlay = makeResults(this.ctx.atlas, this.sim, this.chars, FIELD_W / 2, {
      levelName: this.level.name, isFinal: this.isFinal,
    });
    this.container.addChild(this.overlay);
    if (this.online) {
      // no per-client Enter — auto-advance after a shared pause keeps peers together
      this.resultsHold = 300; // ~5 s at 60 fps
      this.overlayKey = null;
      return;
    }
    this.overlayKey = (e) => {
      if (e.code !== 'Enter') return;
      if (this.isFinal) { this.endRun(true); return; }
      this.ctx.startLevel(this.nextCampaign());
    };
  }

  // campaign for the next level, carrying player state + score forward.
  nextCampaign() {
    const carry = this.sim.players.map((p) => p && ({
      lives: Math.max(1, p.lives), bombs: 3, power: p.power, spheres: p.spheres,
    }));
    const next = {
      chars: this.chars, levelIndex: this.levelIndex + 1,
      score: this.sim.score, carry, difficulty: this.diffIndex,
      continues: this.sim.continues,
    };
    if (this.online) {
      next.net = { client: this.net.client, localSlot: this.net.localSlot, epoch: (this.net.epoch ?? 0) + 1 };
    }
    return next;
  }

  // online results countdown elapsed: advance to the next level or end the run.
  advanceOrEnd() {
    if (this._netEnded) return;
    if (this.isFinal) { this.handleNetEnd('¡Campaña completada!', true); return; }
    this.ctx.startLevel(this.nextCampaign());
  }

  // A terminal online condition (peer left, desync, connection lost, or a win).
  // Tears down the net link and shows a message; Enter returns to the title.
  handleNetEnd(msg, cleared = false) {
    if (this._netEnded) return;
    this._netEnded = true;
    try { this.net?.client.close(); } catch { /* ignore */ }
    if (this.ctx.net === this.net?.client) this.ctx.net = null;
    if (this.overlay) { this.overlay.destroy({ children: true }); this.overlay = null; }
    this.showBanner(msg, 100000, cleared ? GOLD : 0xff6a6a);
    this.overlayKey = (e) => { if (e.code === 'Enter') { music.play('menu'); this.ctx.goToTitle(); } };
  }

  // Leave to the title, closing the online link first if we're in a net game.
  leaveToTitle() {
    if (this.online) {
      try { this.net.client.close(); } catch { /* ignore */ }
      if (this.ctx.net === this.net.client) this.ctx.net = null;
    }
    music.play('menu');
    this.ctx.goToTitle();
  }

  // End of a full run (final victory or game over): record a high score if it
  // qualifies (skipped in practice), then return to the menu / records.
  endRun(cleared) {
    music.play('menu');
    if (this.practice) { this.ctx.goToPractice(); return; }
    // online: skip local high-score entry (both peers would submit the same
    // score) and just close the link back to the title.
    if (this.online) { this.leaveToTitle(); return; }
    if (!this.recorded && qualifies(this.sim.score)) {
      this.recorded = true;
      this.showNameEntry(cleared);
      return;
    }
    this.ctx.goToTitle();
  }

  showNameEntry(cleared) {
    if (this.overlay) this.overlay.destroy({ children: true });
    this.overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, FIELD_W, FIELD_H).fill({ color: 0x081018, alpha: 0.9 });
    this.overlay.addChild(dim);
    const entry = makeNameEntry(FIELD_W / 2, FIELD_H * 0.45, (initials) => {
      submitScore({
        initials, score: this.sim.score, char: this.chars[0].name,
        diff: DIFFICULTIES[this.diffIndex].name, cleared,
      });
      this.ctx.goToRecords();
    });
    this.overlay.addChild(entry.root);
    this.container.addChild(this.overlay);
    this.overlayKey = (e) => entry.key(e);
  }

  showGameOver() {
    this.overlay = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, FIELD_W, FIELD_H).fill({ color: 0x000000, alpha: 0.65 });
    this.overlay.addChild(dim);
    const go = new Text({
      text: 'GAME OVER', style: {
        fill: 0xe0472e, fontSize: 64, fontFamily: 'Georgia, serif', fontWeight: 'bold',
        stroke: { color: 0x000000, width: 6 }, letterSpacing: 6,
      },
    });
    go.anchor.set(0.5); go.position.set(FIELD_W / 2, 320);
    this.overlay.addChild(go);
    const sc = new Text({
      text: `SCORE ${String(this.sim.score).padStart(8, '0')}`,
      style: { fill: 0xffffff, fontSize: 24, fontFamily: 'monospace', stroke: { color: 0x000000, width: 4 } },
    });
    sc.anchor.set(0.5); sc.position.set(FIELD_W / 2, 390);
    this.overlay.addChild(sc);
    // arcade continue: FIRE flows through the sim (and lockstep online), so
    // both peers revive in sync; ENTER surrender is local/offline only.
    const cont = new Text({
      text: 'DISPARO (J) — CONTINUAR  ·  el score vuelve a 0',
      style: { fill: 0xf2c14e, fontSize: 17, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    cont.anchor.set(0.5); cont.position.set(FIELD_W / 2, 440);
    this.overlay.addChild(cont);
    const hint = new Text({
      text: this.online ? 'ESC salir de la partida' : 'ENTER rendirse y volver al título',
      style: { fill: 0x9aa4c0, fontSize: 15, fontFamily: 'monospace' },
    });
    hint.anchor.set(0.5); hint.position.set(FIELD_W / 2, 474);
    this.overlay.addChild(hint);
    if (this.sim.continues > 0) {
      const used = new Text({
        text: `continues usados: ${this.sim.continues}`,
        style: { fill: 0x5a648a, fontSize: 13, fontFamily: 'monospace' },
      });
      used.anchor.set(0.5); used.position.set(FIELD_W / 2, 504);
      this.overlay.addChild(used);
    }
    this.container.addChild(this.overlay);
    this.overlayKey = (e) => { if (e.code === 'Enter' && !this.online) this.endRun(false); };
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    if (window.__game?.sim === this.sim) window.__game = null;
    // detach the lockstep driver + net listeners (the connection itself lives
    // on ctx.net and persists across level scenes — only end/leave closes it).
    this.driver?.destroy();
    this._offPeerLeft?.();
    this._offClose?.();
    this.dialogueBox = null;
    this.container.destroy({ children: true });
  }
}
