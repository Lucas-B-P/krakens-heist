import { Application, Assets } from 'pixi.js';
import { Game } from './Game.js';
import { Music } from './util/Music.js';
import { loadCharacterVisual } from './view/characterVisuals.js';
import { LoadingScreen } from './view/LoadingScreen.js';
import { StartScreen } from './view/StartScreen.js';

/** Mínimo para desenhar a tela de carregamento. */
const BOOT_MANIFEST = {
  bg: 'assets/bg.jpg',
  logo: 'assets/logo.png',
};

const GAME_MANIFEST = {
  kraken: 'assets/kraken.png',
  ...Object.fromEntries(
    ['wild', 'scatter', 'crown', 'gold', 'pearl', 'chips', 'a', 'k', 'q', 'j'].map((s) => [
      `sym_${s}`,
      `assets/sym_${s}.png`,
    ]),
  ),
};

/** Fatia da barra de carregamento ocupada pelos símbolos; o resto é o sprite sheet do Kraken. */
const SYMBOLS_SHARE = 0.4;

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

/** Em celular: tela cheia + trava na horizontal (Android/Chrome; iOS ignora e fica o aviso de girar). */
function goLandscape() {
  if (!IS_TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  Promise.resolve(request?.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#020d16',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  const music = new Music('audio/menu.mp3');
  const autoplay = music.play();
  const gameMusic = new Music('audio/game.mp3', 0.45);
  const featureMusic = new Music('audio/scatter.mp3', 0.5);

  await document.fonts.load('48px "Lilita One"').catch(() => {});
  Assets.addBundle('boot', BOOT_MANIFEST);
  Assets.addBundle('game', GAME_MANIFEST);
  const bootTextures = await Assets.loadBundle('boot');

  const loading = new LoadingScreen(app, bootTextures);
  const gameTextures = await Assets.loadBundle('game', (p) =>
    loading.setProgress(p * SYMBOLS_SHARE, SYMBOLS_SHARE),
  );
  const textures = { ...bootTextures, ...gameTextures };

  loading.setProgress(SYMBOLS_SHARE, 0.93);
  const krakenVisual = await loadCharacterVisual(textures, app.renderer);
  await loading.finish();

  const game = new Game(app, textures, krakenVisual, { intro: true, music: gameMusic, featureMusic });
  app.stage.addChild(loading);
  if (import.meta.env.DEV) window.__kraken = { app, game, music, gameMusic };

  if (!(await autoplay)) await loading.waitForTap(() => music.play());

  const start = new StartScreen(game.ctx, game.kraken, { ticker: app.ticker, music });
  game.world.addChild(start);
  await loading.close();

  await start.waitForPlay();
  goLandscape();
  music.stop(1.2);
  gameMusic.setMuted(music.muted);
  gameMusic.play(2);
  await start.leave();
  game.start();
  start.dispose();
}

boot();
