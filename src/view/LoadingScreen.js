import { BlurFilter, Container, FillGradient, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { ParticleSystem } from '../util/ParticleSystem.js';
import {
  goldStyle,
  makeBubbleTexture,
  makeGlowTexture,
  makeShineTexture,
  makeVignetteTexture,
  plainStyle,
  rand,
} from '../util/fx.js';
import { DESIGN_H, DESIGN_W } from './layout.js';

const BAR_W = 820;
const BAR_H = 40;
const BAR_Y = 760;

const TIPS = [
  'Junte 3 ou mais BAÚS para ganhar até 15 Rodadas Grátis!',
  'Bolhas multiplicadoras podem chegar a x100.',
  'O Kraken é o WILD e substitui os símbolos pagantes.',
  'Pressione ESPAÇO para girar — e de novo para parar os rolos.',
  'Ative o TURBO para giros mais rápidos.',
];

/** Tela de carregamento: fundo desfocado, logo, barra de progresso e dicas. */
export class LoadingScreen extends Container {
  constructor(app, { bg, logo }) {
    super();
    this.app = app;
    this.shown = 0;
    this.target = 0;
    this.ceil = 0;
    this.time = 0;
    this.glowTex = makeGlowTexture();
    this.bubbleTex = makeBubbleTexture();

    this.bg = new Sprite(bg);
    this.bg.filters = [new BlurFilter({ strength: 10, quality: 3 })];
    this.bg.tint = 0x6688aa;
    this.vignette = new Sprite(makeVignetteTexture());
    this.bubbles = new ParticleSystem(150);

    this.root = new Container();
    this.addChild(this.bg, this.bubbles, this.vignette, this.root);

    this.logoGlow = new Sprite(this.glowTex);
    this.logoGlow.anchor.set(0.5);
    this.logoGlow.tint = 0x7cf3ff;
    this.logoGlow.blendMode = 'add';
    this.logoGlow.alpha = 0.35;
    this.logoGlow.scale.set(9, 5);
    this.logoGlow.position.set(DESIGN_W / 2, 400);

    this.logo = new Sprite(logo);
    this.logo.anchor.set(0.5);
    this.logo.scale.set(900 / logo.width);
    this.logo.position.set(DESIGN_W / 2, 400);

    this.bar = this.#buildBar();
    this.bar.position.set((DESIGN_W - BAR_W) / 2, BAR_Y);

    this.percent = new Text({ text: '0%', style: goldStyle(46) });
    this.percent.anchor.set(0.5);
    this.percent.position.set(DESIGN_W / 2, BAR_Y + BAR_H + 50);

    this.tip = new Text({
      text: TIPS[(Math.random() * TIPS.length) | 0],
      style: plainStyle(30, '#bfe9ff', { align: 'center' }),
    });
    this.tip.anchor.set(0.5);
    this.tip.position.set(DESIGN_W / 2, 960);
    this.tipIndex = TIPS.indexOf(this.tip.text);

    this.tap = new Text({ text: 'TOQUE PARA CONTINUAR', style: goldStyle(64) });
    this.tap.anchor.set(0.5);
    this.tap.position.set(DESIGN_W / 2, BAR_Y + 40);
    this.tap.visible = false;

    this.root.addChild(this.logoGlow, this.logo, this.bar, this.percent, this.tip, this.tap);

    this.onResize = () => this.#layout();
    this.onTick = (t) => this.update(Math.min(t.deltaMS / 1000, 0.05));
    app.renderer.on('resize', this.onResize);
    app.ticker.add(this.onTick);
    app.stage.addChild(this);
    this.#layout();

    this.alpha = 0;
    gsap.to(this, { alpha: 1, duration: 0.4 });
    gsap.from(this.logo.scale, { x: 0, y: 0, duration: 0.9, ease: 'back.out(1.6)' });
    this.tipTimer = setInterval(() => this.#nextTip(), 3200);
  }

  #buildBar() {
    const bar = new Container();
    const frame = new Graphics()
      .roundRect(-8, -8, BAR_W + 16, BAR_H + 16, (BAR_H + 16) / 2)
      .fill({ color: 0x041b2b, alpha: 0.85 })
      .stroke({ color: 0xffd34d, width: 4 });

    const fillGrad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: '#2fd8ff' },
        { offset: 0.6, color: '#7cf3ff' },
        { offset: 1, color: '#d24dff' },
      ],
      textureSpace: 'local',
    });
    const fill = new Graphics().roundRect(0, 0, BAR_W, BAR_H, BAR_H / 2).fill(fillGrad);
    const gloss = new Graphics()
      .roundRect(8, 5, BAR_W - 16, BAR_H * 0.32, BAR_H * 0.16)
      .fill({ color: 0xffffff, alpha: 0.35 });

    this.barShine = new Sprite(makeShineTexture());
    this.barShine.anchor.set(0.5);
    this.barShine.width = 140;
    this.barShine.height = BAR_H * 2;
    this.barShine.y = BAR_H / 2;
    this.barShine.rotation = 0.4;
    this.barShine.blendMode = 'add';

    this.barMask = new Graphics().rect(0, 0, BAR_W, BAR_H).fill(0xffffff);
    this.barMask.scale.x = 0;
    const inner = new Container();
    inner.addChild(fill, gloss, this.barShine);
    inner.mask = this.barMask;

    this.barHead = new Sprite(this.glowTex);
    this.barHead.anchor.set(0.5);
    this.barHead.tint = 0xbff8ff;
    this.barHead.blendMode = 'add';
    this.barHead.scale.set(0.9, 0.7);
    this.barHead.y = BAR_H / 2;

    bar.addChild(frame, inner, this.barMask, this.barHead);
    return bar;
  }

  #layout() {
    const { width: w, height: h } = this.app.screen;
    this.size = { w, h };
    const tex = this.bg.texture;
    const bs = Math.max(w / tex.width, h / tex.height) * 1.05;
    this.bg.scale.set(bs);
    this.bg.position.set((w - tex.width * bs) / 2, (h - tex.height * bs) / 2);
    this.vignette.width = w;
    this.vignette.height = h;

    const s = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.root.scale.set(s);
    this.root.position.set((w - DESIGN_W * s) / 2, (h - DESIGN_H * s) / 2);
  }

  #nextTip() {
    gsap.to(this.tip, {
      alpha: 0,
      duration: 0.3,
      onComplete: () => {
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
        this.tip.text = TIPS[this.tipIndex];
        gsap.to(this.tip, { alpha: 1, duration: 0.3 });
      },
    });
  }

  /** Define o progresso real (0–1); `creepTo` deixa a barra avançar devagar até esse teto enquanto espera. */
  setProgress(p, creepTo = p) {
    this.target = Math.max(this.target, p);
    this.ceil = Math.max(this.target, creepTo);
  }

  /** Completa a barra e espera ela chegar visualmente a 100%. */
  finish() {
    this.setProgress(1);
    return new Promise((resolve) => {
      const check = () => (this.shown >= 0.999 ? resolve() : requestAnimationFrame(check));
      check();
    });
  }

  /** Troca a barra por "TOQUE PARA CONTINUAR"; `onTap` roda dentro do gesto (necessário para liberar o áudio). */
  waitForTap(onTap) {
    gsap.to([this.bar, this.percent], { alpha: 0, duration: 0.3 });
    this.tap.visible = true;
    this.tap.alpha = 0;
    gsap.to(this.tap, { alpha: 1, duration: 0.4 });
    gsap.to(this.tap.scale, { x: 1.08, y: 1.08, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    return new Promise((resolve) => {
      const canvas = this.app.canvas;
      const done = () => {
        canvas.removeEventListener('pointerup', done);
        window.removeEventListener('keydown', done);
        onTap?.();
        resolve();
      };
      canvas.addEventListener('pointerup', done);
      window.addEventListener('keydown', done);
    });
  }

  async close() {
    clearInterval(this.tipTimer);
    await gsap.to(this, { alpha: 0, duration: 0.5 });
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off('resize', this.onResize);
    gsap.killTweensOf([this.tip, this.tap.scale]);
    this.destroy({ children: true });
  }

  update(dt) {
    this.time += dt;
    if (this.target < this.ceil) this.target += (this.ceil - this.target) * dt * 0.35;
    this.shown += (this.target - this.shown) * Math.min(1, dt * 6);
    if (this.target >= 1 && 1 - this.shown < 0.002) this.shown = 1;

    this.barMask.scale.x = this.shown;
    this.barHead.x = BAR_W * this.shown;
    this.barHead.alpha = this.shown > 0.01 && this.shown < 1 ? 0.9 : 0;
    this.barShine.x = ((this.time * 0.6) % 1.4) * BAR_W * this.shown * 1.2 - 70;
    this.percent.text = `${Math.round(this.shown * 100)}%`;

    this.logo.y = 400 + Math.sin(this.time * 1.4) * 8;
    this.logoGlow.alpha = 0.3 + Math.sin(this.time * 2) * 0.08;

    const { w, h } = this.size;
    if (Math.random() < dt * 6) {
      this.bubbles.spawn({
        texture: this.bubbleTex,
        blendMode: 'normal',
        x: rand(0, w),
        y: h + 20,
        vy: -rand(60, 140),
        sway: rand(15, 40),
        swayFreq: rand(1.5, 3),
        life: rand(5, 9),
        scaleStart: rand(0.05, 0.18),
        alpha: 0.6,
        fadeIn: 0.5,
      });
    }
    this.bubbles.update(dt);
  }
}
