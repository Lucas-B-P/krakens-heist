import { Container, Sprite } from 'pixi.js';
import { lerpColor } from './fx.js';

export class ParticleSystem extends Container {
  #pool = [];
  #alive = [];

  constructor(maxParticles = 1500) {
    super();
    this.maxParticles = maxParticles;
  }

  spawn(o) {
    if (this.#alive.length >= this.maxParticles) return;

    let s = this.#pool.pop();
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      this.addChild(s);
    }

    s.texture = o.texture;
    s.blendMode = o.blendMode ?? 'add';
    s.position.set(o.x, o.y);
    s.rotation = o.rotation ?? 0;
    s.visible = true;
    s.tint = o.colorStart ?? 0xffffff;
    s.alpha = o.alpha ?? 1;
    s.p = {
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      age: 0,
      life: o.life ?? 1,
      scaleStart: o.scaleStart ?? 1,
      scaleEnd: o.scaleEnd ?? o.scaleStart ?? 1,
      colorStart: o.colorStart ?? 0xffffff,
      colorEnd: o.colorEnd,
      alpha: o.alpha ?? 1,
      fadeIn: o.fadeIn ?? 0,
      gravity: o.gravity ?? 0,
      drag: o.drag ?? 1,
      spin: o.spin ?? 0,
      sway: o.sway ?? 0,
      swayFreq: o.swayFreq ?? 3,
      flip: o.flip ?? 0,
      phase: Math.random() * Math.PI * 2,
    };
    this.#applyScale(s, 0);
    this.#alive.push(s);
  }

  update(dt) {
    const alive = this.#alive;
    for (let i = alive.length - 1; i >= 0; i--) {
      const s = alive[i];
      const p = s.p;
      p.age += dt;

      if (p.age >= p.life) {
        s.visible = false;
        this.#pool.push(s);
        alive[i] = alive[alive.length - 1];
        alive.pop();
        continue;
      }

      const k = p.age / p.life;
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      s.x += (p.vx + Math.sin(p.age * p.swayFreq + p.phase) * p.sway) * dt;
      s.y += p.vy * dt;
      s.rotation += p.spin * dt;

      const fadeIn = p.fadeIn > 0 ? Math.min(1, p.age / p.fadeIn) : 1;
      s.alpha = p.alpha * fadeIn * (1 - k * k);
      if (p.colorEnd !== undefined) s.tint = lerpColor(p.colorStart, p.colorEnd, k);
      this.#applyScale(s, k);
    }
  }

  #applyScale(s, k) {
    const p = s.p;
    const sc = p.scaleStart + (p.scaleEnd - p.scaleStart) * k;
    const flip = p.flip ? Math.cos(p.age * p.flip + p.phase) : 1;
    s.scale.set(sc * flip, sc);
  }
}
