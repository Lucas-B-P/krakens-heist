import { Container, FillGradient, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { PAYLINES, REELS, ROWS } from '../game/config.js';
import { waitUnless } from '../util/fx.js';
import { CELL, LINE_COLORS } from './layout.js';
import { Reel } from './Reel.js';

export const REELS_W = REELS * CELL;
export const REELS_H = ROWS * CELL;
const W = REELS_W;
const H = REELS_H;

export class ReelSet extends Container {
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.time = 0;

    this.frame = new Graphics();
    this.#drawFrame();

    this.anticipationGlow = Array.from({ length: REELS }, (_, i) => {
      const g = new Graphics()
        .roundRect(i * CELL + 4, -6, CELL - 8, H + 12, 14)
        .fill({ color: 0xffc94d, alpha: 0.18 })
        .stroke({ width: 5, color: 0xffe28a, alpha: 0.9 });
      g.blendMode = 'add';
      g.alpha = 0;
      return g;
    });

    this.reelLayer = new Container();
    this.reels = Array.from({ length: REELS }, (_, i) => {
      const reel = new Reel(i, ctx);
      reel.x = i * CELL;
      this.reelLayer.addChild(reel);
      return reel;
    });

    this.maskShape = new Graphics().rect(0, -8, W, H + 16).fill(0xffffff);
    this.reelLayer.mask = this.maskShape;

    this.lines = new Graphics();
    this.lines.blendMode = 'add';

    this.addChild(this.frame, ...this.anticipationGlow, this.reelLayer, this.maskShape, this.lines);
  }

  #drawFrame() {
    const pad = 24;
    const gold = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#fff0b3' },
        { offset: 0.35, color: '#e8b03a' },
        { offset: 0.7, color: '#a8670f' },
        { offset: 1, color: '#ffdb7a' },
      ],
      textureSpace: 'local',
    });

    const f = this.frame;
    f.roundRect(-pad - 6, -pad - 6, W + (pad + 6) * 2, H + (pad + 6) * 2, 34).fill({ color: 0x000000, alpha: 0.35 });
    f.roundRect(-pad, -pad, W + pad * 2, H + pad * 2, 28).fill(gold).stroke({ width: 5, color: 0x3b0d57 });
    f.roundRect(-10, -10, W + 20, H + 20, 16).fill({ color: 0x021521, alpha: 0.88 }).stroke({ width: 3, color: 0x3b0d57 });

    for (let i = 1; i < REELS; i++) f.rect(i * CELL - 1, -6, 2, H + 12).fill({ color: 0x7cf3ff, alpha: 0.08 });

    const corners = [
      [-pad, -pad],
      [W + pad, -pad],
      [-pad, H + pad],
      [W + pad, H + pad],
    ];
    for (const [x, y] of corners) {
      f.circle(x, y, 17).fill(0xf4ecff).stroke({ width: 4, color: 0x3b0d57 });
      f.circle(x - 5, y - 5, 5).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  symbolAt(reel, row) {
    return this.reels[reel].visibleSymbols()[row];
  }

  allSymbols() {
    const out = [];
    for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) out.push(this.symbolAt(r, row));
    return out;
  }

  setAnticipation(index, on) {
    const g = this.anticipationGlow[index];
    gsap.killTweensOf(g);
    if (on) {
      gsap.fromTo(g, { alpha: 0.4 }, { alpha: 1, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else {
      gsap.to(g, { alpha: 0, duration: 0.2 });
    }
  }

  /**
   * Gira e para os rolos no resultado `grid`.
   * @param {object} o
   * @param {boolean} o.turbo
   * @param {() => boolean} o.slam  verdadeiro quando o jogador pede para parar já
   * @param {(reel: number, column: object[], symbols: SymbolView[]) => void} o.onReelStop
   * @param {(on: boolean) => void} o.onAnticipation
   */
  async spin(grid, { turbo, slam, onReelStop, onAnticipation }) {
    this.clearWins();
    this.reels.forEach((reel, i) => reel.startSpin(i * (turbo ? 0.02 : 0.06), turbo));

    await waitUnless(turbo ? 0.3 : 0.65, slam);

    const stops = [];
    let scatters = 0;
    let anticipating = false;

    for (let i = 0; i < REELS; i++) {
      const anticipate = scatters >= 2 && !slam();
      if (anticipate) {
        if (!anticipating) onAnticipation?.(true);
        anticipating = true;
        this.setAnticipation(i, true);
        await waitUnless(turbo ? 0.8 : 1.4, slam);
      }

      stops.push(
        this.reels[i].stop(grid[i], turbo || slam()).then((symbols) => {
          this.setAnticipation(i, false);
          onReelStop?.(i, grid[i], symbols);
        }),
      );
      scatters += grid[i].filter((c) => c.id === 'scatter').length;

      if (i < REELS - 1 && !slam()) await waitUnless(turbo ? 0.06 : 0.14, slam);
    }

    await Promise.all(stops);
    if (anticipating) onAnticipation?.(false);
  }

  // ---------- apresentação de ganhos ----------

  clearWins() {
    this.lines.clear();
    for (const reel of this.reels) for (const s of reel.symbols) s.reset();
  }

  /** Destaca posições vencedoras e escurece o resto. */
  highlight(positions, repeat = 3) {
    const keys = new Set(positions.map(([r, row]) => `${r}:${row}`));
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const s = this.symbolAt(r, row);
        if (keys.has(`${r}:${row}`)) {
          s.dim(false);
          s.win(repeat);
        } else {
          s.dim(true);
        }
      }
    }
  }

  undim() {
    for (const s of this.allSymbols()) s.dim(false);
  }

  drawLines(lineWins) {
    this.lines.clear();
    for (const w of lineWins) this.#drawLine(w.line, w.count);
  }

  #drawLine(index, count) {
    const color = LINE_COLORS[index % LINE_COLORS.length];
    const rows = PAYLINES[index];
    const pts = [-14, rows[0] * CELL + CELL / 2];
    rows.forEach((row, reel) => pts.push(reel * CELL + CELL / 2, row * CELL + CELL / 2));
    pts.push(W + 14, rows[REELS - 1] * CELL + CELL / 2);

    for (const [width, alpha] of [
      [16, 0.18],
      [8, 0.45],
      [3.5, 1],
    ]) {
      this.lines.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) this.lines.lineTo(pts[i], pts[i + 1]);
      this.lines.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    }

    for (let reel = 0; reel < count; reel++) {
      this.lines.circle(reel * CELL + CELL / 2, rows[reel] * CELL + CELL / 2, 7).fill(0xffffff);
    }
  }

  update(dt) {
    this.time += dt;
    for (const reel of this.reels) reel.update(dt, this.time);
  }
}
