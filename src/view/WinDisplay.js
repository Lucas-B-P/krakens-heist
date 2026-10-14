import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { aquaFill, fmt, goldStyle } from '../util/fx.js';

export class WinDisplay extends Container {
  constructor() {
    super();
    this.plate = new Graphics()
      .roundRect(-300, -62, 600, 124, 62)
      .fill({ color: 0x021521, alpha: 0.78 })
      .stroke({ width: 4, color: 0xffd34d, alpha: 0.9 });

    this.amount = new Text({ text: '', style: goldStyle(82) });
    this.amount.anchor.set(0.5);

    this.multText = new Text({
      text: '',
      style: {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: 150,
        fill: aquaFill(),
        stroke: { color: '#2a0650', width: 14, join: 'round' },
      },
    });
    this.multText.anchor.set(0.5);
    this.multText.y = -150;
    this.multText.visible = false;

    this.box = new Container();
    this.box.addChild(this.plate, this.amount);
    this.addChild(this.box, this.multText);

    this.value = 0;
    this.visible = false;
  }

  /** Posição (no pai) para onde as bolhas voam. */
  multiplierPoint() {
    return { x: this.x, y: this.y + this.multText.y };
  }

  count(from, to, duration) {
    gsap.killTweensOf(this);
    this.visible = true;
    this.alpha = 1;
    this.value = from;
    this.amount.text = fmt(from);
    if (from === 0) gsap.fromTo(this.box.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2.5)' });
    else gsap.fromTo(this.box.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });

    return gsap.to(this, {
      value: to,
      duration,
      ease: 'power1.out',
      onUpdate: () => {
        this.amount.text = fmt(this.value);
      },
    });
  }

  async slamMultiplier(multiplier) {
    const t = this.multText;
    t.text = `x${multiplier}`;
    t.visible = true;
    t.alpha = 1;
    t.y = -150;
    await gsap
      .timeline()
      .fromTo(t.scale, { x: 3.5, y: 3.5 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(1.6)' })
      .fromTo(t, { alpha: 0, rotation: -0.3 }, { alpha: 1, rotation: 0, duration: 0.25 }, '<');
    await gsap
      .timeline({ delay: 0.35 })
      .to(t, { y: 0, alpha: 0, duration: 0.3, ease: 'power2.in' })
      .to(t.scale, { x: 0.4, y: 0.4, duration: 0.3, ease: 'power2.in' }, '<');
    t.visible = false;
  }

  hide(instant = false) {
    gsap.killTweensOf(this);
    if (instant) {
      this.visible = false;
      return;
    }
    gsap.to(this, {
      alpha: 0,
      duration: 0.3,
      onComplete: () => {
        this.visible = false;
      },
    });
  }
}
