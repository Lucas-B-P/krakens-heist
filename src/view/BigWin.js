import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { BIG_WIN_TIERS } from '../game/config.js';
import { ParticleSystem } from '../util/ParticleSystem.js';
import { fmt, goldStyle, rand, waitUnless } from '../util/fx.js';

const CENTER = { x: 960, y: 450 };
const TIERS = [...BIG_WIN_TIERS].sort((a, b) => a.min - b.min);

export class BigWin extends Container {
  constructor(ctx) {
    super();
    this.ctx = ctx;

    this.dim = new Graphics().rect(-2000, -2000, 6000, 6000).fill({ color: 0x000814, alpha: 0.78 });

    this.center = new Container();
    this.center.position.set(CENTER.x, CENTER.y);

    this.rays = new Sprite(ctx.raysTex);
    this.rays.anchor.set(0.5);
    this.rays.tint = 0xffc94d;
    this.rays.blendMode = 'add';
    this.rays.alpha = 0.55;
    this.rays.scale.set(1.4);

    this.rays2 = new Sprite(ctx.raysTex);
    this.rays2.anchor.set(0.5);
    this.rays2.tint = 0xff5df0;
    this.rays2.blendMode = 'add';
    this.rays2.alpha = 0.3;
    this.rays2.scale.set(1.1);

    this.glow = new Sprite(ctx.glowTex);
    this.glow.anchor.set(0.5);
    this.glow.tint = 0xffd34d;
    this.glow.blendMode = 'add';
    this.glow.scale.set(7);
    this.glow.alpha = 0.6;

    this.title = new Text({ text: '', style: goldStyle(150) });
    this.title.anchor.set(0.5);
    this.title.y = -60;

    this.amount = new Text({ text: '', style: goldStyle(110) });
    this.amount.anchor.set(0.5);
    this.amount.y = 110;

    this.center.addChild(this.rays2, this.rays, this.glow, this.title, this.amount);

    this.coins = new ParticleSystem(700);

    this.addChild(this.dim, this.center, this.coins);
    this.visible = false;
    this.emitting = 0;
    this.value = 0;
    this.skipped = false;

    this.eventMode = 'static';
    this.on('pointertap', () => this.skip());
  }

  skip() {
    this.skipped = true;
  }

  #setTitle(label) {
    this.title.text = label;
    gsap.fromTo(this.title.scale, { x: 2.4, y: 2.4 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(1.8)' });
    gsap.fromTo(this.title, { rotation: -0.12 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    this.#burst(70);
  }

  #burst(count) {
    for (let i = 0; i < count; i++) this.#coin(rand(900, 1700));
  }

  #coin(power = rand(900, 1500)) {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
    this.coins.spawn({
      texture: this.ctx.coinTex,
      blendMode: 'normal',
      x: CENTER.x + rand(-60, 60),
      y: 1120,
      vx: Math.cos(a) * power * 0.55,
      vy: Math.sin(a) * power,
      gravity: 1500,
      life: rand(1.8, 2.6),
      scaleStart: rand(0.45, 0.85),
      flip: rand(5, 11),
      spin: rand(-2, 2),
    });
  }

  async play(amount, bet) {
    const ratio = amount / bet;
    const tiers = TIERS.filter((t) => ratio >= t.min);
    const duration = 2.2 + tiers.length * 1.4;

    this.visible = true;
    this.skipped = false;
    this.value = 0;
    this.amount.text = fmt(0);
    this.emitting = 22;

    gsap.fromTo(this, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    gsap.fromTo(this.center.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.6, ease: 'back.out(2)' });

    let tierIndex = 0;
    this.#setTitle(tiers[0].label);

    const counter = gsap.to(this, {
      value: amount,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        this.amount.text = fmt(this.value);
        const next = tiers[tierIndex + 1];
        if (next && this.value >= next.min * bet) {
          tierIndex++;
          this.emitting += 14;
          this.#setTitle(next.label);
        }
      },
    });

    await waitUnless(duration + 0.05, () => this.skipped);
    if (counter.isActive()) counter.progress(1);
    if (tierIndex < tiers.length - 1) this.#setTitle(tiers[tiers.length - 1].label);

    gsap.fromTo(this.amount.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
    this.#burst(90);

    this.skipped = false;
    await waitUnless(2.5, () => this.skipped);
    this.emitting = 0;

    await gsap.to(this, { alpha: 0, duration: 0.4 });
    this.visible = false;
  }

  update(dt) {
    if (!this.visible) return;
    this.rays.rotation += dt * 0.25;
    this.rays2.rotation -= dt * 0.15;
    this.glow.alpha = 0.5 + Math.sin(performance.now() / 300) * 0.1;
    if (this.emitting > 0 && Math.random() < dt * this.emitting) this.#coin();
    if (this.emitting > 0 && Math.random() < dt * this.emitting) this.#coin();
    this.coins.update(dt);
  }
}
