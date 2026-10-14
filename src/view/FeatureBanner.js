import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { fmt, goldStyle, plainStyle, waitUnless } from '../util/fx.js';

const CENTER = { x: 960, y: 470 };

export class FeatureBanner extends Container {
  constructor(ctx) {
    super();

    this.dim = new Graphics().rect(-2000, -2000, 6000, 6000).fill({ color: 0x0a0220, alpha: 0.8 });

    this.center = new Container();
    this.center.position.set(CENTER.x, CENTER.y);

    this.rays = new Sprite(ctx.raysTex);
    this.rays.anchor.set(0.5);
    this.rays.tint = 0x7cf3ff;
    this.rays.blendMode = 'add';
    this.rays.alpha = 0.4;
    this.rays.scale.set(1.3);

    this.chest = new Sprite(ctx.textures.sym_scatter);
    this.chest.anchor.set(0.5);
    this.chestScale = 300 / this.chest.texture.width;
    this.chest.scale.set(this.chestScale);
    this.chest.y = -170;

    this.title = new Text({ text: '', style: goldStyle(84) });
    this.title.anchor.set(0.5);
    this.title.y = 30;

    this.big = new Text({ text: '', style: goldStyle(160) });
    this.big.anchor.set(0.5);
    this.big.y = 170;

    this.hint = new Text({ text: 'TOQUE PARA CONTINUAR', style: plainStyle(30, '#a8eaff') });
    this.hint.anchor.set(0.5);
    this.hint.y = 300;

    this.center.addChild(this.rays, this.chest, this.title, this.big, this.hint);

    this.toastText = new Text({ text: '', style: goldStyle(72) });
    this.toastText.anchor.set(0.5);
    this.toastText.position.set(CENTER.x, 520);
    this.toastText.visible = false;

    this.overlay = new Container();
    this.overlay.addChild(this.dim, this.center);
    this.overlay.visible = false;
    this.overlay.eventMode = 'static';
    this.overlay.on('pointertap', () => this.skip());

    this.addChild(this.overlay, this.toastText);
    this.skipped = false;
    this.value = 0;
  }

  get isOpen() {
    return this.overlay.visible;
  }

  skip() {
    this.skipped = true;
  }

  async #show() {
    this.overlay.visible = true;
    this.skipped = false;
    gsap.fromTo(this.overlay, { alpha: 0 }, { alpha: 1, duration: 0.35 });
    gsap.fromTo(this.center.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.7, ease: 'back.out(1.8)' });
    const s = this.chestScale;
    gsap.fromTo(this.chest.scale, { x: 0, y: 0 }, { x: s, y: s, duration: 0.8, delay: 0.15, ease: 'elastic.out(1, 0.45)' });
  }

  async #hide() {
    await gsap.to(this.overlay, { alpha: 0, duration: 0.35 });
    this.overlay.visible = false;
  }

  async intro(spins) {
    this.chest.visible = true;
    this.title.text = 'RODADAS GRÁTIS';
    this.big.text = String(spins);
    this.hint.text = 'TOQUE PARA COMEÇAR';
    await this.#show();
    gsap.fromTo(this.big.scale, { x: 3, y: 3 }, { x: 1, y: 1, duration: 0.6, delay: 0.3, ease: 'back.out(2)' });
    await waitUnless(5, () => this.skipped);
    await this.#hide();
  }

  async outro(total) {
    this.chest.visible = true;
    this.title.text = 'VOCÊ GANHOU';
    this.big.text = fmt(0);
    this.big.style.fontSize = 120;
    this.hint.text = 'TOQUE PARA CONTINUAR';
    await this.#show();

    this.value = 0;
    const counter = gsap.to(this, {
      value: total,
      duration: total > 0 ? 2 : 0.01,
      ease: 'power1.out',
      onUpdate: () => (this.big.text = fmt(this.value)),
    });
    await waitUnless(2.1, () => this.skipped);
    counter.progress(1);
    this.skipped = false;
    await waitUnless(3, () => this.skipped);
    await this.#hide();
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
    if (this.overlay.visible) this.rays.rotation += dt * 0.3;
    if (this.overlay.visible) this.hint.alpha = 0.6 + Math.sin(performance.now() / 250) * 0.4;
  }
}
