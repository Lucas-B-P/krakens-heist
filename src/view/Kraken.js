import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export class Kraken extends Container {
  /**
   * @param {object} visual  resultado de `loadCharacterVisual` (PNG, sprite sheet ou Spine)
   * @param {number} height  altura final em pixels de design
   */
  constructor(visual, height) {
    super();
    this.visual = visual;
    this.baseScale = height / visual.height;

    this.shadow = new Graphics().ellipse(0, 0, visual.width * 0.32, 26).fill({ color: 0x000000, alpha: 0.35 });
    this.shadow.scale.set(this.baseScale);

    this.body = new Container();
    this.body.addChild(visual.view);
    this.body.scale.set(this.baseScale);

    this.lean = new Container();
    this.lean.addChild(this.body);

    this.addChild(this.shadow, this.lean);
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.visual.update(dt);
    const bob = Math.sin(this.time * 1.6);
    this.lean.y = bob * 10 - 12;
    this.body.rotation = Math.sin(this.time * 0.9) * 0.025;
    this.shadow.scale.x = this.baseScale * (1 - bob * 0.06);
    this.shadow.alpha = 0.8 - bob * 0.15;
  }

  /** Pulinho de comemoração (squash & stretch) + animação 'win' do visual, se existir. */
  celebrate(times = 1) {
    this.visual.play('win');
    const b = this.baseScale;
    const tl = gsap.timeline();
    for (let i = 0; i < times; i++) {
      tl.to(this.body.scale, { x: b * 1.1, y: b * 0.9, duration: 0.12, ease: 'power2.out' })
        .to(this.body.scale, { x: b * 0.94, y: b * 1.1, duration: 0.16, ease: 'power2.out' })
        .to(this.body, { y: -50, duration: 0.2, ease: 'power2.out' }, '<')
        .to(this.body, { y: 0, duration: 0.25, ease: 'bounce.out' })
        .to(this.body.scale, { x: b, y: b, duration: 0.45, ease: 'elastic.out(1, 0.4)' }, '<');
    }
    return tl;
  }

  /** Inclina para frente durante a expectativa (antecipação). */
  setAnticipation(on) {
    this.visual.play(on ? 'anticipation' : 'idle');
    gsap.to(this.lean, { rotation: on ? 0.07 : 0, duration: 0.4, ease: 'power2.out' });
    gsap.to(this.lean.scale, { x: on ? 1.05 : 1, y: on ? 1.05 : 1, duration: 0.4 });
  }
}
