import { Application, Assets, Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { Game } from './Game.js';
import { loadCharacterVisual } from './view/characterVisuals.js';

const MANIFEST = {
  bg: 'assets/bg.jpg',
  kraken: 'assets/kraken.png',
  logo: 'assets/logo.png',
  ...Object.fromEntries(
    ['wild', 'scatter', 'crown', 'gold', 'pearl', 'chips', 'a', 'k', 'q', 'j'].map((s) => [
      `sym_${s}`,
      `assets/sym_${s}.png`,
    ]),
  ),
};

function createLoader(app) {
  const root = new Container();
  const title = new Text({
    text: "KRAKEN'S HEIST",
    style: { fontFamily: '"Lilita One", sans-serif', fontSize: 56, fill: '#ffd34d', letterSpacing: 3 },
  });
  title.anchor.set(0.5);
  const track = new Graphics().roundRect(-200, 0, 400, 14, 7).fill({ color: 0xffffff, alpha: 0.12 });
  const bar = new Graphics();
  track.y = bar.y = 60;
  root.addChild(title, track, bar);
  app.stage.addChild(root);

  const layout = () => root.position.set(app.screen.width / 2, app.screen.height / 2 - 30);
  layout();
  app.renderer.on('resize', layout);

  return {
    progress(p) {
      bar.clear().roundRect(-200, 0, 400 * p, 14, 7).fill(0x7cf3ff);
    },
    async destroy() {
      await gsap.to(root, { alpha: 0, duration: 0.3 });
      app.renderer.off('resize', layout);
      root.destroy({ children: true });
    },
  };
}

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#020d16',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  await document.fonts.load('48px "Lilita One"').catch(() => {});

  const loader = createLoader(app);
  Assets.addBundle('game', MANIFEST);
  const textures = await Assets.loadBundle('game', (p) => loader.progress(p));
  const krakenVisual = await loadCharacterVisual(textures, app.renderer);
  await loader.destroy();

  const game = new Game(app, textures, krakenVisual);
  if (import.meta.env.DEV) window.__kraken = { app, game };
}

boot();
