// Boot + scene manager. Flow: title -> character select -> game.
// The canvas is field + sidebar wide; scenes swap on ctx callbacks.
import { Application } from 'pixi.js';
import { loadAtlas } from './engine/atlas.js';
import { Input } from './engine/input.js';
import { TitleScene } from './scenes/title.js';
import { SelectScene } from './scenes/select.js';
import { GameScene } from './scenes/game.js';
import { RecordsScene } from './scenes/records.js';
import { PracticeScene } from './scenes/practice.js';
import { OnlineScene } from './scenes/online.js';
import { SIDEBAR_W } from './ui/sidebar.js';
import { MuteButtons } from './ui/mutebuttons.js';
import { DEFAULT_DIFF } from './sim/difficulty.js';
import { FIELD_W, FIELD_H } from './sim/constants.js';
import { audio } from './engine/audio.js';
import { music } from './engine/music.js';

const APP_W = FIELD_W + SIDEBAR_W;

async function boot() {
  const app = new Application();
  await app.init({ width: APP_W, height: FIELD_H, background: 0x0a0a12, antialias: false });
  document.getElementById('game').appendChild(app.canvas);

  const fit = () => {
    const scale = Math.min(window.innerWidth / APP_W, window.innerHeight / FIELD_H);
    app.canvas.style.width = `${APP_W * scale}px`;
    app.canvas.style.height = `${FIELD_H * scale}px`;
  };
  window.addEventListener('resize', fit);
  fit();

  const atlas = await loadAtlas();
  const input = new Input();

  const muteButtons = new MuteButtons(app, APP_W);

  let current = null;
  const setScene = (make) => {
    current?.destroy();
    current = make();
    app.stage.addChild(current.container);
    muteButtons.raise(app.stage); // keep mute toggles on top of every scene
  };

  const ctx = {
    app, atlas, input,
    difficulty: DEFAULT_DIFF,   // shared across menus, chosen on the title
    net: null,                  // live online NetClient while in a co-op run
    goToTitle: () => setScene(() => new TitleScene(ctx)),
    goToSelect: () => setScene(() => new SelectScene(ctx)),
    goToRecords: () => setScene(() => new RecordsScene(ctx)),
    goToPractice: () => setScene(() => new PracticeScene(ctx)),
    goToOnline: () => setScene(() => new OnlineScene(ctx)),
    startGame: (chars) => setScene(() => new GameScene(ctx, {
      chars, levelIndex: 0, score: 0, carry: null, difficulty: ctx.difficulty,
    })),
    startLevel: (campaign) => setScene(() => new GameScene(ctx, campaign)),
    startPractice: (chars, bossDef, bossLevel) => setScene(() => new GameScene(ctx, {
      chars, levelIndex: bossLevel, score: 0, carry: null,
      difficulty: ctx.difficulty, practice: bossDef,
    })),
  };

  window.__app = { app, get scene() { return current; }, ctx, audio, music };

  ctx.goToTitle();
  app.ticker.add((ticker) => current?.update(ticker.deltaMS));
}

boot();
