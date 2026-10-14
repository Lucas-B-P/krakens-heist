import { Rectangle } from 'pixi.js';
import { ShockwaveFilter } from 'pixi-filters/shockwave';
import { DESIGN_H, DESIGN_W } from './layout.js';

/** Tremor de tela e ondas de choque aplicadas a um container (coordenadas de design). */
export class ScreenFx {
  #waves = [];
  #dirty = false;

  constructor(target) {
    this.target = target;
    this.target.filterArea = new Rectangle(0, 0, DESIGN_W, DESIGN_H);
    this.shake = 0;
  }

  addShake(amount) {
    this.shake = Math.min(30, this.shake + amount);
  }

  shockwave(x, y, { amplitude = 30, wavelength = 160, speed = 900, radius = 700, brightness = 1.15 } = {}) {
    const t = this.target;
    const global = t.toGlobal({ x, y });
    const origin = t.toGlobal({ x: 0, y: 0 });
    const s = t.worldTransform.a;
    const filter = new ShockwaveFilter({
      center: { x: global.x - Math.max(0, origin.x), y: global.y - Math.max(0, origin.y) },
      amplitude: amplitude * s,
      wavelength: wavelength * s,
      speed: speed * s,
      radius: radius * s,
      brightness,
      time: 0,
    });
    filter.padding = 0;
    this.#waves.push({ filter, duration: radius / speed });
    this.#dirty = true;
  }

  update(dt) {
    this.shake *= Math.pow(0.015, dt);
    const s = this.shake < 0.2 ? 0 : this.shake;
    this.target.position.set((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);

    const finished = [];
    for (let i = this.#waves.length - 1; i >= 0; i--) {
      const wave = this.#waves[i];
      wave.filter.time += dt;
      if (wave.filter.time >= wave.duration) {
        finished.push(wave.filter);
        this.#waves.splice(i, 1);
        this.#dirty = true;
      }
    }
    if (this.#dirty) {
      this.target.filters = this.#waves.length ? this.#waves.map((w) => w.filter) : null;
      this.#dirty = false;
    }
    for (const f of finished) f.destroy();
  }
}
