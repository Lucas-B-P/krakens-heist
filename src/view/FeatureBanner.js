import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../audio/Sfx.js';
import { ParticleSystem } from '../util/ParticleSystem.js';
import { fmt, goldStyle, lerpColor, pick, plainStyle, rand, wait, waitUnless } from '../util/fx.js';

const CENTER = { x: 960, y: 470 };
const CHEST_Y = -170;
const GEM_COLORS = [0xff4dd2, 0x22e6ff, 0x7cff6b, 0xffd34d, 0xb36bff];

export class FeatureBanner extends Container {
  constructor(ctx) {
    super();
    this.ctx = ctx;

    this.dim = new Graphics().rect(-2000, -2000, 6000, 6000).fill({ color: 0x0a0220, alpha: 0.85 });

    this.center = new Container();
    this.center.position.set(CENTER.x, CENTER.y);

    this.bgGlow = new Sprite(ctx.glowTex);
    this.bgGlow.anchor.set(0.5);
    this.bgGlow.blendMode = 'add';
    this.bgGlow.scale.set(16, 12);
    this.bgGlow.alpha = 0.35;
    this.bgGlow.y = CHEST_Y;

    this.vortex = new Sprite(ctx.raysTex);
    this.vortex.anchor.set(0.5);
    this.vortex.tint = 0xb36bff;
    this.vortex.blendMode = 'add';
    this.vortex.alpha = 0.35;
    this.vortex.scale.set(2.2);
    this.vortex.y = CHEST_Y;

    this.rays = new Sprite(ctx.raysTex);
    this.rays.anchor.set(0.5);
    this.rays.tint = 0xffd34d;
    this.rays.blendMode = 'add';
    this.rays.alpha = 0.4;
    this.rays.scale.set(1.3);
    this.rays.y = CHEST_Y;

    this.chestGlow = new Sprite(ctx.glowTex);
    this.chestGlow.anchor.set(0.5);
    this.chestGlow.tint = 0xffd34d;
    this.chestGlow.blendMode = 'add';
    this.chestGlow.y = CHEST_Y;
    this.chestGlow.alpha = 0;

    this.chest = new Sprite(ctx.textures.sym_scatter);
    this.chest.anchor.set(0.5);
    this.chestScale = 300 / this.chest.texture.width;
    this.chest.scale.set(this.chestScale);
    this.chest.y = CHEST_Y;

    this.krakenPeek = new Sprite(ctx.textures.kraken);
    this.krakenPeek.anchor.set(0.5, 1);
    this.krakenPeek.scale.set(560 / this.krakenPeek.texture.height);
    this.krakenPeek.position.set(-640, 620);
    this.krakenPeek.visible = false;

    this.titleRow = new Container();
    this.titleRow.y = 30;

    this.big = new Text({ text: '', style: goldStyle(160) });
    this.big.anchor.set(0.5);
    this.big.y = 170;

    this.sub = new Text({ text: '', style: plainStyle(40, '#ffe7a0') });
    this.sub.anchor.set(0.5);
    this.sub.y = 270;

    this.hint = new Text({ text: 'TOQUE PARA CONTINUAR', style: plainStyle(30, '#a8eaff') });
    this.hint.anchor.set(0.5);
    this.hint.y = 330;

    this.rings = new Container();
    this.particles = new ParticleSystem(900);

    this.center.addChild(
      this.bgGlow,
      this.vortex,
      this.rays,
      this.chestGlow,
      this.rings,
      this.chest,
      this.krakenPeek,
      this.titleRow,
      this.big,
      this.sub,
      this.hint,
      this.particles,
    );

    this.flash = new Graphics().rect(-2000, -2000, 6000, 6000).fill(0xffffff);
    this.flash.alpha = 0;

    this.toastText = new Text({ text: '', style: goldStyle(72) });
    this.toastText.anchor.set(0.5);
    this.toastText.position.set(CENTER.x, 520);
    this.toastText.visible = false;

    this.overlay = new Container();
    this.overlay.addChild(this.dim, this.center);
    this.overlay.visible = false;
    this.overlay.eventMode = 'static';
    this.overlay.on('pointertap', () => this.skip());

    this.addChild(this.overlay, this.toastText, this.flash);
    this.skipped = false;
    this.value = 0;
    this.time = 0;
    this.fountain = 0;
    this.hintOn = false;
  }

  get isOpen() {
    return this.overlay.visible;
  }

  skip() {
    this.skipped = true;
  }

  /** Clarão branco na tela toda. */
  flashScreen(alpha = 1, duration = 0.7) {
    gsap.killTweensOf(this.flash);
    this.flash.alpha = alpha;
    gsap.to(this.flash, { alpha: 0, duration, ease: 'power2.out' });
  }

  #reset() {
    gsap.killTweensOf([this.center.scale, this.chest, this.chest.scale, this.big.scale, this.krakenPeek]);
    this.overlay.visible = true;
    this.overlay.alpha = 1;
    this.skipped = false;
    this.hintOn = false;
    this.hint.alpha = 0;
    this.center.scale.set(1);
    this.chest.rotation = 0;
    this.chest.x = 0;
    this.chest.scale.set(this.chestScale);
    this.chestGlow.alpha = 0;
    this.titleRow.removeChildren().forEach((c) => c.destroy());
    this.big.text = '';
    this.sub.text = '';
    this.krakenPeek.visible = false;
  }

  async #close() {
    this.hintOn = false;
    this.fountain = 0;
    sfx.whoosh(0.45);
    gsap.to(this.center.scale, { x: 2.4, y: 2.4, duration: 0.45, ease: 'power2.in' });
    await gsap.to(this.overlay, { alpha: 0, duration: 0.45, ease: 'power2.in' });
    this.overlay.visible = false;
    this.center.scale.set(1);
  }

  // ---------- efeitos ----------

  #ring(color = 0xffd34d, maxScale = 6, duration = 0.8, width = 10) {
    const ring = new Graphics().circle(0, 0, 60).stroke({ color, width });
    ring.blendMode = 'add';
    ring.y = CHEST_Y;
    this.rings.addChild(ring);
    gsap.fromTo(ring.scale, { x: 0.3, y: 0.3 }, { x: maxScale, y: maxScale, duration, ease: 'power2.out' });
    gsap.fromTo(ring, { alpha: 1 }, { alpha: 0, duration, ease: 'power1.in', onComplete: () => ring.destroy() });
  }

  #explode() {
    const p = this.particles;
    for (let i = 0; i < 70; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(500, 1300);
      p.spawn({
        texture: this.ctx.coinTex,
        blendMode: 'normal',
        x: 0,
        y: CHEST_Y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 400,
        gravity: 1400,
        drag: 0.985,
        life: rand(1.4, 2.2),
        scaleStart: rand(0.4, 0.75),
        flip: rand(5, 12),
        spin: rand(-3, 3),
      });
    }
    for (let i = 0; i < 60; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(300, 1100);
      const c = pick(GEM_COLORS);
      p.spawn({
        texture: this.ctx.glowTex,
        x: 0,
        y: CHEST_Y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        drag: 0.94,
        life: rand(0.8, 1.6),
        scaleStart: rand(0.25, 0.5),
        scaleEnd: 0,
        colorStart: c,
        colorEnd: 0xffffff,
      });
    }
    for (let i = 0; i < 25; i++) {
      const a = rand(0, Math.PI * 2);
      p.spawn({
        texture: this.ctx.bubbleTex,
        blendMode: 'normal',
        x: Math.cos(a) * 60,
        y: CHEST_Y + Math.sin(a) * 60,
        vx: Math.cos(a) * rand(150, 400),
        vy: Math.sin(a) * rand(150, 400) - 150,
        gravity: -250,
        drag: 0.96,
        life: rand(1.2, 2),
        scaleStart: rand(0.15, 0.35),
        alpha: 0.8,
      });
    }
  }

  #sparkBurst(y, count = 40, color = 0xffd34d) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(300, 900);
      this.particles.spawn({
        texture: this.ctx.glowTex,
        x: rand(-120, 120),
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        drag: 0.92,
        life: rand(0.5, 1.1),
        scaleStart: rand(0.2, 0.4),
        scaleEnd: 0,
        colorStart: color,
        colorEnd: 0xffffff,
      });
    }
  }

  /** Título que cai letra por letra, cada uma com um "plim". */
  async #dropTitle(text, size = 92) {
    const style = goldStyle(size);
    const letters = [...text].map((ch) => {
      const t = new Text({ text: ch, style });
      t.anchor.set(0.5);
      return t;
    });
    const gap = 2;
    const total = letters.reduce((w, t) => w + t.width + gap, -gap);
    let x = -total / 2;
    letters.forEach((t, i) => {
      t.x = x + t.width / 2;
      x += t.width + gap;
      this.titleRow.addChild(t);
      t.alpha = 0;
      const delay = i * 0.05;
      gsap.fromTo(t, { y: -160, alpha: 0 }, { y: 0, alpha: 1, duration: 0.45, delay, ease: 'bounce.out' });
      gsap.fromTo(t.scale, { x: 1.8, y: 1.8 }, { x: 1, y: 1, duration: 0.4, delay, ease: 'back.out(2)' });
      if (t.text !== ' ') gsap.delayedCall(delay + 0.15, () => sfx.letterPop(i));
    });
    await wait(letters.length * 0.05 + 0.35);
  }

  /** Abertura do baú: chacoalha, brilha e explode em moedas e gemas. */
  async #openChest() {
    const s = this.chestScale;
    gsap.fromTo(this.chest.scale, { x: s * 2.4, y: s * 2.4 }, { x: s, y: s, duration: 0.5, ease: 'back.out(1.5)' });
    await wait(0.4);

    sfx.chestRattle(0.9);
    gsap.to(this.chestGlow, { alpha: 1, duration: 0.9, ease: 'power2.in' });
    gsap.fromTo(this.chestGlow.scale, { x: 2, y: 2 }, { x: 6, y: 6, duration: 0.9, ease: 'power2.in' });
    const shake = gsap.timeline();
    for (let i = 0; i < 14; i++) {
      const k = (i + 1) / 14;
      shake.to(this.chest, { rotation: (i % 2 ? -1 : 1) * 0.12 * k, x: rand(-10, 10) * k, duration: 0.065 });
    }
    await shake;

    sfx.chestBurst();
    this.flashScreen(0.85, 0.6);
    this.chest.rotation = 0;
    this.chest.x = 0;
    gsap.fromTo(this.chest.scale, { x: s * 1.6, y: s * 1.6 }, { x: s, y: s, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
    gsap.to(this.chestGlow, { alpha: 0.6, duration: 0.6 });
    this.#ring(0xffffff, 8, 0.7, 14);
    this.#ring(0xffd34d, 11, 1.1, 8);
    this.#ring(0xb36bff, 14, 1.4, 6);
    this.#explode();
    this.fountain = 1;
  }

  #peekKraken() {
    const k = this.krakenPeek;
    k.visible = true;
    gsap.fromTo(k, { x: -1100, rotation: -0.4 }, { x: -640, rotation: 0, duration: 0.7, ease: 'back.out(1.6)' });
    gsap.delayedCall(0.3, () => sfx.laugh(1.1));
  }

  // ---------- telas ----------

  async intro(spins) {
    this.#reset();
    this.sub.text = '';
    this.hint.text = 'TOQUE PARA COMEÇAR';
    gsap.fromTo(this.dim, { alpha: 0 }, { alpha: 1, duration: 0.3 });

    await this.#openChest();
    this.#peekKraken();
    await this.#dropTitle('RODADAS GRÁTIS');

    this.value = 0;
    this.big.text = '0';
    const tickDur = 0.9;
    sfx.roll(tickDur, 4, 0.9);
    await gsap.to(this, {
      value: spins,
      duration: tickDur,
      ease: 'power1.in',
      onUpdate: () => {
        const v = Math.round(this.value);
        if (this.big.text !== String(v)) {
          this.big.text = String(v);
          gsap.fromTo(this.big.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.12 });
        }
      },
    });

    sfx.spinsSlam();
    this.big.text = String(spins);
    gsap.fromTo(this.big.scale, { x: 2.8, y: 2.8 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.2)' });
    this.#ring(0xffd34d, 9, 0.9, 10);
    this.#sparkBurst(170, 60);
    this.fountain = 1.6;
    this.sub.text = 'MULTIPLICADORES ACUMULAM!';
    gsap.fromTo(this.sub, { alpha: 0, y: 300 }, { alpha: 1, y: 270, duration: 0.4, delay: 0.2 });

    this.skipped = false;
    this.hintOn = true;
    await waitUnless(5, () => this.skipped);
    await this.#close();
  }

  async outro(total) {
    this.#reset();
    this.hint.text = 'TOQUE PARA CONTINUAR';
    gsap.fromTo(this.dim, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    const s = this.chestScale;
    gsap.fromTo(this.chest.scale, { x: 0, y: 0 }, { x: s, y: s, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    gsap.to(this.chestGlow, { alpha: 0.6, duration: 0.5 });
    this.chestGlow.scale.set(5);
    this.#peekKraken();
    await this.#dropTitle('VOCÊ GANHOU');

    this.value = 0;
    this.big.text = fmt(0);
    this.big.style.fontSize = 120;
    this.fountain = total > 0 ? 0.8 : 0;
    const counter = gsap.to(this, {
      value: total,
      duration: total > 0 ? 2.2 : 0.01,
      ease: 'power1.out',
      onUpdate: () => (this.big.text = fmt(this.value)),
    });
    const roll = total > 0 ? sfx.roll(2.2, 0, 0.45) : null;
    await waitUnless(2.3, () => this.skipped);
    if (counter.isActive()) roll?.cancel();
    counter.progress(1);

    if (total > 0) {
      sfx.chestBurst();
      this.flashScreen(0.5, 0.5);
      gsap.fromTo(this.big.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      this.#ring(0xffd34d, 10, 1, 10);
      this.#explode();
      this.fountain = 1.6;
    }

    this.skipped = false;
    this.hintOn = true;
    await waitUnless(3.5, () => this.skipped);
    await this.#close();
    this.big.style.fontSize = 160;
  }

  async toast(text, duration = 1.4) {
    const t = this.toastText;
    gsap.killTweensOf(t);
    gsap.killTweensOf(t.scale);
    t.text = text;
    t.visible = true;
    t.alpha = 1;
    await gsap.fromTo(t.scale, { x: 0.2, y: 0.2 }, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2.2)' });
    await gsap.to(t, { alpha: 0, duration: 0.35, delay: duration });
    t.visible = false;
  }

  update(dt) {
    this.particles.update(dt);
    if (!this.overlay.visible) return;
    this.time += dt;
    this.rays.rotation += dt * 0.35;
    this.vortex.rotation -= dt * 0.18;
    this.bgGlow.tint = lerpColor(0x7a2cff, 0x1fb8ff, (Math.sin(this.time * 0.9) + 1) / 2);
    this.bgGlow.alpha = 0.3 + Math.sin(this.time * 2.2) * 0.08;
    this.rays.alpha = 0.35 + Math.sin(this.time * 3) * 0.1;
    this.hint.alpha = this.hintOn ? 0.6 + Math.sin(this.time * 4) * 0.4 : 0;
    if (this.krakenPeek.visible) this.krakenPeek.y = 620 + Math.sin(this.time * 2) * 8;

    if (this.fountain > 0 && Math.random() < dt * 30 * this.fountain) {
      this.particles.spawn({
        texture: this.ctx.coinTex,
        blendMode: 'normal',
        x: rand(-40, 40),
        y: CHEST_Y - 30,
        vx: rand(-380, 380),
        vy: rand(-1100, -700),
        gravity: 1500,
        life: rand(1.2, 1.8),
        scaleStart: rand(0.3, 0.55),
        flip: rand(5, 11),
      });
    }
    if (Math.random() < dt * 20) {
      const a = rand(0, Math.PI * 2);
      const r = rand(170, 260);
      this.particles.spawn({
        texture: this.ctx.glowTex,
        x: Math.cos(a) * r,
        y: CHEST_Y + Math.sin(a) * r * 0.8,
        vx: -Math.sin(a) * 120,
        vy: Math.cos(a) * 120,
        life: rand(0.6, 1.2),
        scaleStart: rand(0.12, 0.25),
        scaleEnd: 0,
        colorStart: pick(GEM_COLORS),
        fadeIn: 0.2,
      });
    }
  }
}