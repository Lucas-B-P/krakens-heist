import { Container, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { SYMBOLS } from '../game/config.js';
import { plainStyle } from '../util/fx.js';
import { CELL } from './layout.js';

const LOW = new Set(['j', 'q', 'k', 'a']);
const GLOW_COLORS = { wild: 0xffd34d, scatter: 0xffc94d, bubble: 0x7cf3ff };

export function bubbleColor(value) {
  if (value >= 50) return '#ff5df0';
  if (value >= 10) return '#ffd34d';
  if (value >= 5) return '#7cff9b';
  return '#ffffff';
}

export class SymbolView extends Container {
  constructor(ctx) {
    super();
    this.ctx = ctx;

    this.glow = new Sprite(ctx.glowTex);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    this.glow.scale.set(1.9);

    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);

    this.bubble = new Container();
    const bubbleSprite = new Sprite(ctx.bubbleTex);
    bubbleSprite.anchor.set(0.5);
    bubbleSprite.scale.set((CELL * 0.82) / ctx.bubbleTex.width);
    this.valueText = new Text({ text: '', style: plainStyle(50, '#ffffff', { stroke: { color: '#063a5c', width: 7, join: 'round' } }) });
    this.valueText.anchor.set(0.5);
    this.bubble.addChild(bubbleSprite, this.valueText);

    this.content = new Container();
    this.content.addChild(this.sprite, this.bubble);
    this.addChild(this.glow, this.content);

    this.cell = null;
    this.phase = Math.random() * Math.PI * 2;
  }

  set(cell) {
    this.cell = cell;
    this.reset();

    if (cell.id === 'bubble') {
      this.sprite.visible = false;
      this.bubble.visible = true;
      this.valueText.text = `x${cell.value}`;
      this.valueText.style.fill = bubbleColor(cell.value);
      this.valueText.style.fontSize = cell.value >= 100 ? 40 : 50;
    } else {
      this.sprite.visible = true;
      this.bubble.visible = false;
      const tex = this.ctx.textures[SYMBOLS[cell.id].texture];
      this.sprite.texture = tex;
      const fill = LOW.has(cell.id) ? 0.72 : 0.86;
      this.sprite.scale.set((CELL * fill) / Math.max(tex.width, tex.height));
    }
    this.glow.tint = GLOW_COLORS[cell.id] ?? 0xfff2c0;
  }

  get isSpecial() {
    return this.cell && (this.cell.id === 'scatter' || this.cell.id === 'wild' || this.cell.id === 'bubble');
  }

  reset() {
    gsap.killTweensOf(this.content.scale);
    gsap.killTweensOf(this.glow);
    gsap.killTweensOf(this);
    this.content.scale.set(1);
    this.content.rotation = 0;
    this.glow.alpha = 0;
    this.alpha = 1;
  }

  update(time) {
    if (this.bubble.visible) {
      this.bubble.y = Math.sin(time * 2.2 + this.phase) * 4;
      this.bubble.rotation = Math.sin(time * 1.3 + this.phase) * 0.06;
    }
  }

  land() {
    if (!this.isSpecial) return;
    gsap.fromTo(this.content.scale, { x: 1.25, y: 0.8 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    gsap.fromTo(this.glow, { alpha: 1 }, { alpha: 0, duration: 0.7 });
  }

  win(repeat = 3) {
    gsap.killTweensOf(this.content.scale);
    gsap.killTweensOf(this.glow);
    gsap.fromTo(
      this.content.scale,
      { x: 1, y: 1 },
      { x: 1.14, y: 1.14, duration: 0.28, yoyo: true, repeat, ease: 'sine.inOut' },
    );
    gsap.fromTo(this.glow, { alpha: 0 }, { alpha: 0.85, duration: 0.28, yoyo: true, repeat, ease: 'sine.inOut' });
  }

  dim(on) {
    gsap.to(this, { alpha: on ? 0.32 : 1, duration: 0.25 });
  }
}
