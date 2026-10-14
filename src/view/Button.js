import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../audio/Sfx.js';
import { plainStyle } from '../util/fx.js';

export function bindPress(target, onClick) {
  target.eventMode = 'static';
  target.cursor = 'pointer';
  const to = (s) => gsap.to(target.scale, { x: s, y: s, duration: 0.12, ease: 'power2.out' });
  target.on('pointerover', () => to(1.06));
  target.on('pointerout', () => to(1));
  target.on('pointerdown', () => to(0.92));
  target.on('pointerup', () => to(1.06));
  target.on('pointertap', () => {
    sfx.click();
    onClick?.();
  });
}

export class Button extends Container {
  constructor({ width, height, label, fontSize = 28, onClick }) {
    super();
    this.w = width;
    this.h = height;
    this.bg = new Graphics();
    this.label = new Text({ text: label, style: plainStyle(fontSize) });
    this.label.anchor.set(0.5);
    this.addChild(this.bg, this.label);
    this.setActive(false);
    bindPress(this, onClick);
    this._enabled = true;
  }

  setActive(on) {
    const { w, h } = this;
    this.bg
      .clear()
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(on ? 0xffb31a : 0x0b3550)
      .stroke({ width: 4, color: on ? 0xfff0b3 : 0xffd34d });
    this.label.style.fill = on ? '#3b0d57' : '#ffffff';
  }

  setLabel(text) {
    this.label.text = text;
  }

  set enabled(value) {
    this._enabled = value;
    this.alpha = value ? 1 : 0.4;
    this.eventMode = value ? 'static' : 'none';
  }

  get enabled() {
    return this._enabled;
  }
}

export class SpinButton extends Container {
  constructor({ radius = 86, onClick }) {
    super();
    const ring = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#fff0b3' },
        { offset: 0.5, color: '#e8a317' },
        { offset: 1, color: '#8a5200' },
      ],
      textureSpace: 'local',
    });
    const core = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#5effc8' },
        { offset: 1, color: '#0a6f5a' },
      ],
      textureSpace: 'local',
    });

    this.halo = new Graphics().circle(0, 0, radius + 14).fill({ color: 0x5effc8, alpha: 0.35 });
    this.halo.blendMode = 'add';

    const base = new Graphics()
      .circle(0, 0, radius)
      .fill(ring)
      .stroke({ width: 6, color: 0x3b0d57 })
      .circle(0, 0, radius - 14)
      .fill(core)
      .stroke({ width: 4, color: 0x063a2e });

    this.icon = new Graphics();
    const r = radius * 0.42;
    for (const start of [0.15, Math.PI + 0.15]) {
      const end = start + Math.PI * 0.72;
      this.icon.arc(0, 0, r, start, end).stroke({ width: 13, color: 0xffffff, cap: 'round' });
      const ax = Math.cos(end) * r;
      const ay = Math.sin(end) * r;
      const tx = -Math.sin(end);
      const ty = Math.cos(end);
      this.icon
        .poly([ax + tx * 20, ay + ty * 20, ax - ty * 16, ay + tx * 16, ax + ty * 16, ay - tx * 16])
        .fill(0xffffff);
    }

    this.autoText = new Text({ text: '', style: plainStyle(54) });
    this.autoText.anchor.set(0.5);
    this.autoText.visible = false;

    this.addChild(this.halo, base, this.icon, this.autoText);
    bindPress(this, onClick);
    this.spinning = false;
    this.time = 0;
  }

  setSpinning(on) {
    this.spinning = on;
  }

  setAutoCount(count) {
    this.autoText.visible = count > 0;
    this.icon.visible = count <= 0;
    this.autoText.text = String(count);
  }

  set enabled(value) {
    this.alpha = value ? 1 : 0.5;
    this.eventMode = value ? 'static' : 'none';
  }

  update(dt) {
    this.time += dt;
    this.icon.rotation += dt * (this.spinning ? 14 : 0.5);
    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    this.halo.scale.set(pulse);
    this.halo.alpha = this.spinning ? 0.15 : 0.3 + Math.sin(this.time * 3) * 0.1;
  }
}

/** Botão redondo com ícone desenhado por `draw(graphics)`; chame `redraw()` quando o estado mudar. */
export class IconButton extends Container {
  constructor({ radius = 38, draw, onClick }) {
    super();
    this.draw = draw;
    this.disc = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: 0x0b3550, alpha: 0.9 })
      .stroke({ color: 0xffd34d, width: 3 });
    this.icon = new Graphics();
    this.icon.scale.set(radius / 38);
    this.addChild(this.disc, this.icon);
    bindPress(this, onClick);
    this.redraw();
  }

  redraw() {
    this.icon.clear();
    this.draw(this.icon);
  }
}

/** Ícone de alto-falante (raio ~38). */
export function drawSpeaker(g, muted) {
  g.poly([-16, -8, -6, -8, 6, -18, 6, 18, -6, 8, -16, 8]).fill(0xffffff);
  if (muted) {
    g.moveTo(12, -9).lineTo(28, 9).moveTo(28, -9).lineTo(12, 9).stroke({ color: 0xff6b6b, width: 4, cap: 'round' });
  } else {
    g.arc(8, 0, 10, -0.9, 0.9).stroke({ color: 0xffffff, width: 3.5, cap: 'round' });
    g.arc(8, 0, 18, -0.9, 0.9).stroke({ color: 0xffffff, width: 3.5, cap: 'round' });
  }
}

/** Ícone de engrenagem (raio ~38). */
export function drawGear(g) {
  const teeth = 8;
  const pts = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? 21 : 15;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.poly(pts).fill(0xffffff);
  g.circle(0, 0, 7).fill(0x0b3550);
}
