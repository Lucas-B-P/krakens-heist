import { Container, FillGradient, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { ParticleSystem } from '../util/ParticleSystem.js';
import { goldStyle, makeShineTexture, plainStyle, rand } from '../util/fx.js';
import { DESIGN_H, DESIGN_W, KRAKEN } from './layout.js';
import { Logo } from './Logo.js';
import { bindPress, drawSpeaker, IconButton } from './Button.js';

const HERO = { x: 500, y: 1010, height: 860 };
const HERO_SCALE = HERO.height / KRAKEN.height;
const RIGHT_X = 1300;
const PLAY = { y: 830, w: 460, h: 136 };

const FEATURES = [
  { icon: 'bubble', title: 'BOLHAS', text: 'Multiplicadores\naté x100' },
  { icon: 'sym_scatter', title: '3+ BAÚS', text: 'Até 15 rodadas\ngrátis' },
  { icon: 'sym_wild', title: 'WILD', text: 'O Kraken substitui\nos símbolos' },
];

/**
 * Tela inicial: polvo em destaque, logo, recursos do jogo e botão JOGAR.
 * Usa o próprio Kraken do jogo (que continua sendo atualizado pelo Game) e o devolve na saída.
 */
export class StartScreen extends Container {
  constructor(ctx, kraken, { ticker, music }) {
    super();
    this.ctx = ctx;
    this.ticker = ticker;
    this.music = music;
    this.time = 0;

    this.shade = new Graphics().rect(-2000, -2000, DESIGN_W + 4000, DESIGN_H + 4000).fill({ color: 0x00060c, alpha: 0.35 });

    this.rays = new Sprite(ctx.raysTex);
    this.rays.anchor.set(0.5);
    this.rays.blendMode = 'add';
    this.rays.tint = 0xb36bff;
    this.rays.alpha = 0.22;
    this.rays.scale.set(1.25);
    this.rays.position.set(HERO.x, HERO.y - HERO.height * 0.55);

    this.heroGlow = new Sprite(ctx.glowTex);
    this.heroGlow.anchor.set(0.5);
    this.heroGlow.blendMode = 'add';
    this.heroGlow.tint = 0x7cf3ff;
    this.heroGlow.alpha = 0.3;
    this.heroGlow.scale.set(6.5, 7);
    this.heroGlow.position.copyFrom(this.rays.position);

    this.kraken = kraken;
    this.kraken.position.set(HERO.x, HERO.y);
    this.kraken.scale.set(HERO_SCALE);

    this.logo = new Logo(ctx.textures.logo, 820);
    this.logo.position.set(RIGHT_X, 250);

    this.cards = FEATURES.map((f, i) => this.#card(f, RIGHT_X + (i - 1) * 290, 575));

    this.play = this.#playButton();
    this.play.position.set(RIGHT_X, PLAY.y);

    this.footer = new Text({
      text: '20 LINHAS   •   GANHE ATÉ x100   •   RODADAS GRÁTIS',
      style: plainStyle(24, '#9fdcff', { letterSpacing: 2 }),
    });
    this.footer.anchor.set(0.5);
    this.footer.alpha = 0.85;
    this.footer.position.set(RIGHT_X, 960);

    this.sound = this.#soundButton();
    this.sound.position.set(DESIGN_W - 80, 70);

    this.fx = new ParticleSystem(200);

    this.addChild(
      this.shade,
      this.rays,
      this.heroGlow,
      this.kraken,
      this.logo,
      ...this.cards,
      this.play,
      this.footer,
      this.sound,
      this.fx,
    );

    this.onTick = (t) => this.update(Math.min(t.deltaMS / 1000, 0.05));
    ticker.add(this.onTick);
    this.#intro();
  }

  #card({ icon, title, text }, x, y) {
    const card = new Container();
    card.position.set(x, y);
    const W = 260;
    const H = 190;
    const bg = new Graphics()
      .roundRect(-W / 2, -H / 2, W, H, 26)
      .fill({ color: 0x062a40, alpha: 0.82 })
      .stroke({ color: 0xffd34d, width: 3, alpha: 0.9 });

    let iconView;
    if (icon === 'bubble') {
      iconView = new Container();
      const b = new Sprite(this.ctx.bubbleTex);
      b.anchor.set(0.5);
      b.scale.set(0.62);
      const label = new Text({ text: 'x100', style: goldStyle(30) });
      label.anchor.set(0.5);
      iconView.addChild(b, label);
    } else {
      iconView = new Sprite(this.ctx.textures[icon]);
      iconView.anchor.set(0.5);
      iconView.scale.set(100 / iconView.texture.height);
    }
    iconView.position.set(0, -H / 2 - 4);

    const t = new Text({ text: title, style: goldStyle(34) });
    t.anchor.set(0.5);
    t.y = 10;
    const d = new Text({ text, style: plainStyle(22, '#d9f6ff', { align: 'center', lineHeight: 26 }) });
    d.anchor.set(0.5, 0);
    d.y = 34;

    card.addChild(bg, iconView, t, d);
    card.icon = iconView;
    return card;
  }

  #playButton() {
    const btn = new Container();
    const { w, h } = PLAY;

    const glow = new Sprite(this.ctx.glowTex);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = 0x6bff9d;
    glow.scale.set(6, 2.6);
    glow.alpha = 0.45;

    const grad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#9dff7a' },
        { offset: 0.5, color: '#22c55e' },
        { offset: 1, color: '#0b7a3b' },
      ],
      textureSpace: 'local',
    });
    const body = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(grad)
      .stroke({ color: 0xffd34d, width: 7 });
    const gloss = new Graphics()
      .roundRect(-w / 2 + 26, -h / 2 + 12, w - 52, h * 0.3, h * 0.15)
      .fill({ color: 0xffffff, alpha: 0.3 });

    const maskShape = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(0xffffff);
    const shine = new Sprite(makeShineTexture());
    shine.anchor.set(0.5);
    shine.width = 110;
    shine.height = h * 1.8;
    shine.rotation = 0.35;
    shine.blendMode = 'add';
    const shineLayer = new Container();
    shineLayer.addChild(shine);
    shineLayer.mask = maskShape;

    const label = new Text({
      text: 'JOGAR',
      style: {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: 78,
        fill: '#ffffff',
        stroke: { color: '#0a4d26', width: 9, join: 'round' },
        letterSpacing: 4,
        dropShadow: { color: '#000000', alpha: 0.35, blur: 4, distance: 4, angle: Math.PI / 2 },
      },
    });
    label.anchor.set(0.5);
    label.y = -2;

    const face = new Container();
    face.addChild(body, gloss, shineLayer, maskShape, label);
    btn.addChild(glow, face);
    btn.face = face;
    btn.glow = glow;
    btn.shine = shine;

    this.playPressed = new Promise((resolve) => (this.resolvePlay = resolve));
    bindPress(btn, () => this.#onPlay());
    this.onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.#onPlay();
      }
    };
    window.addEventListener('keydown', this.onKey);
    return btn;
  }

  #soundButton() {
    const btn = new IconButton({
      draw: (g) => drawSpeaker(g, this.music.muted),
      onClick: () => {
        this.music.setMuted(!this.music.muted);
        if (!this.music.muted && !this.music.playing) this.music.play();
        btn.redraw();
      },
    });
    return btn;
  }

  #intro() {
    const tl = gsap.timeline();
    tl.from(this.shade, { alpha: 0, duration: 0.6 })
      .from(this.kraken, { x: HERO.x - 500, alpha: 0, duration: 0.9, ease: 'back.out(1.2)' }, 0)
      .from(this.rays, { alpha: 0, duration: 1 }, 0.3)
      .from(this.logo.scale, { x: 0, y: 0, duration: 0.8, ease: 'back.out(1.7)' }, 0.2);
    this.cards.forEach((c, i) => {
      tl.from(c, { y: c.y + 80, alpha: 0, duration: 0.5, ease: 'back.out(1.5)' }, 0.5 + i * 0.12);
    });
    tl.from(this.play.scale, { x: 0, y: 0, duration: 0.6, ease: 'back.out(2)' }, 0.9)
      .from([this.footer, this.sound], { alpha: 0, duration: 0.5 }, 1.1);
  }

  #onPlay() {
    if (this.leaving) return;
    this.leaving = true;
    window.removeEventListener('keydown', this.onKey);
    this.play.eventMode = 'none';
    this.resolvePlay();
  }

  /** Resolve quando o jogador aperta JOGAR (clique, Enter ou Espaço). */
  waitForPlay() {
    return this.playPressed;
  }

  /** Animação de saída: o polvo desliza até o lugar dele no jogo e o resto some. */
  async leave() {
    this.kraken.celebrate();
    for (let i = 0; i < 24; i++) this.#burst();
    const tl = gsap.timeline();
    tl.to(this.play.scale, { x: 1.25, y: 1.25, duration: 0.15, ease: 'power2.out' })
      .to(this.play, { alpha: 0, duration: 0.25 })
      .to([this.logo, ...this.cards, this.footer, this.sound], { alpha: 0, duration: 0.4, stagger: 0.04 }, 0.1)
      .to([this.shade, this.rays, this.heroGlow], { alpha: 0, duration: 0.6 }, 0.2)
      .to(this.kraken, { x: KRAKEN.x, y: KRAKEN.y, duration: 0.9, ease: 'power3.inOut' }, 0.5)
      .to(this.kraken.scale, { x: 1, y: 1, duration: 0.9, ease: 'power3.inOut' }, 0.5);
    await tl;
  }

  #burst() {
    const a = rand(0, Math.PI * 2);
    const sp = rand(250, 650);
    this.fx.spawn({
      texture: this.ctx.bubbleTex,
      blendMode: 'normal',
      x: RIGHT_X,
      y: PLAY.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      drag: 0.93,
      gravity: -200,
      life: rand(0.8, 1.4),
      scaleStart: rand(0.12, 0.3),
      scaleEnd: 0.05,
    });
  }

  dispose() {
    this.ticker.remove(this.onTick);
    window.removeEventListener('keydown', this.onKey);
    this.destroy({ children: true });
  }

  update(dt) {
    this.time += dt;
    this.logo.update(dt);
    this.rays.rotation += dt * 0.08;
    this.heroGlow.alpha = 0.26 + Math.sin(this.time * 1.8) * 0.06;

    if (!this.leaving) {
      const pulse = 1 + Math.sin(this.time * 4) * 0.04;
      this.play.face.scale.set(pulse);
      this.play.glow.alpha = 0.35 + Math.sin(this.time * 4) * 0.15;
    }
    const k = (this.time % 2.6) / 0.9;
    this.play.shine.visible = k <= 1;
    this.play.shine.x = -PLAY.w / 2 - 80 + k * (PLAY.w + 160);

    this.cards.forEach((c, i) => {
      c.icon.y = -99 + Math.sin(this.time * 2 + i * 1.3) * 6;
    });
    this.fx.update(dt);
  }
}
