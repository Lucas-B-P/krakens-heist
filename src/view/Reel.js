import { BlurFilter, Container } from 'pixi.js';
import gsap from 'gsap';
import { ROWS } from '../game/config.js';
import { randomBubbleValue, randomSymbol } from '../game/SlotMath.js';
import { CELL } from './layout.js';
import { SymbolView } from './SymbolView.js';

// Um símbolo extra fica escondido acima da janela visível.
const N = ROWS + 1;
const mod = (a, n) => ((a % n) + n) % n;

const SPEED = { normal: 22, turbo: 34 };

export class Reel extends Container {
  constructor(index, ctx) {
    super();
    this.index = index;
    this.symbols = Array.from({ length: N }, () => {
      const s = new SymbolView(ctx);
      s.x = CELL / 2;
      this.addChild(s);
      return s;
    });

    this.pos = 0;
    this.speed = 0;
    this.spinning = false;
    this.moving = false;
    this.target = null;
    this.final = null;
    this.phases = new Array(N).fill(0);
    this.blur = new BlurFilter({ strength: 0, quality: 2 });

    this.symbols.forEach((s) => s.set(this.#randomCell()));
    this.#layout();
  }

  #randomCell() {
    const id = randomSymbol(this.index);
    return id === 'bubble' ? { id, value: randomBubbleValue() } : { id };
  }

  #layout() {
    for (let j = 0; j < N; j++) {
      const phase = mod(this.pos + j, N);
      const prev = this.phases[j];
      if (this.moving && Math.abs(phase - prev) > N / 2) this.#onWrap(j, phase);
      this.phases[j] = phase;
      this.symbols[j].y = (phase - 1) * CELL + CELL / 2;
    }
  }

  /** Quando um símbolo dá a volta, decide se ele já é um dos símbolos finais do giro. */
  #onWrap(j, phase) {
    let cell = null;
    if (this.target !== null && this.target - this.pos < N - phase) {
      const row = Math.round(phase + (this.target - this.pos)) - 1;
      if (row >= 0 && row < ROWS) cell = this.final[row];
    }
    this.symbols[j].set(cell ?? this.#randomCell());
  }

  /** Símbolos visíveis, de cima para baixo. */
  visibleSymbols() {
    const rows = [];
    for (let j = 0; j < N; j++) {
      const row = Math.round(this.phases[j]) - 1;
      if (row >= 0 && row < ROWS) rows[row] = this.symbols[j];
    }
    return rows;
  }

  startSpin(delay, turbo) {
    gsap.killTweensOf(this);
    this.symbols.forEach((s) => {
      s.visible = true;
      s.reset();
    });
    this.moving = true;
    this.target = null;
    this.final = null;
    this.filters = [this.blur];

    const max = turbo ? SPEED.turbo : SPEED.normal;
    gsap
      .timeline({ delay })
      .to(this, { pos: this.pos - 0.28, duration: 0.16, ease: 'power2.out' })
      .add(() => {
        this.spinning = true;
      })
      .to(this, { speed: max, duration: 0.22, ease: 'power1.in' });
  }

  stop(finalColumn, turbo) {
    gsap.killTweensOf(this);
    this.spinning = false;
    this.final = finalColumn;

    const from = this.pos;
    this.target = Math.ceil(from + N);
    const speed = Math.max(this.speed, 12);
    const distance = this.target - from;
    // back.out começa ~4x mais rápido que a média: ajusta a duração para casar com a velocidade atual.
    const duration = Math.max(turbo ? 0.25 : 0.4, (distance / speed) * 3.2);

    return gsap
      .to(this, { pos: this.target, speed: 0, duration, ease: 'back.out(1.3)' })
      .then(() => {
        this.moving = false;
        this.filters = null;
        this.blur.strengthY = 0;
        this.target = null;
        const visible = this.visibleSymbols();
        this.symbols.forEach((s) => {
          s.visible = visible.includes(s);
        });
        visible.forEach((s) => s.land());
        return visible;
      });
  }

  update(dt, time) {
    if (this.spinning) this.pos += this.speed * dt;
    if (this.moving) {
      this.#layout();
      this.blur.strengthY = Math.min(22, this.speed * 0.9);
    }
    this.symbols.forEach((s) => s.update(time));
  }
}
