import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { plainStyle } from '../util/fx.js';

function bindPress(target, onClick) {
  target.eventMode = 'static';
  target.cursor = 'pointer';
  const to = (s) => gsap.to(target.scale, { x: s, y: s, duration: 0.12, ease: 'power2.out' });
  target.on('pointerover', () => to(1.06));
  target.on('pointerout', () => to(1));
  target.on('pointerdown', () => to(0.92));
  target.on('pointerup', () => to(1.06));
  target.on('pointertap', () => onClick?.());
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
