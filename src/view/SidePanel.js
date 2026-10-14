import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { aquaFill, goldStyle, plainStyle } from '../util/fx.js';
import { PANEL } from './layout.js';

export class SidePanel extends Container {
  constructor(ctx) {
    super();
    const { w, h } = PANEL;
    const cx = w / 2;

    this.bg = new Graphics()
      .roundRect(0, 0, w, h, 26)
      .fill({ color: 0x021521, alpha: 0.72 })
      .stroke({ width: 4, color: 0xffd34d, alpha: 0.85 });

    // ----- modo normal -----
    this.base = new Container();
    const title = this.#text('MULTIPLICADORES', goldStyle(34), cx, 46);

    const bubble = new Sprite(ctx.bubbleTex);
    bubble.anchor.set(0.5);
    bubble.scale.set(0.75);
    bubble.position.set(cx, 145);
    this.baseBubble = bubble;
    const bubbleText = this.#text('x2 - x100', plainStyle(34, '#7cf3ff'), cx, 145);

    const desc = this.#text(
      'As bolhas multiplicam todos os ganhos do giro!',
      plainStyle(23, '#e6f7ff', { wordWrap: true, wordWrapWidth: w - 50, align: 'center' }),
      cx,
      245,
    );

    const divider = new Graphics().rect(30, 300, w - 60, 2).fill({ color: 0xffd34d, alpha: 0.5 });

    const chest = new Sprite(ctx.textures.sym_scatter);
    chest.anchor.set(0.5);
    chest.scale.set(120 / chest.texture.width);
    chest.position.set(cx, 375);
    this.baseChest = chest;

    const fsTitle = this.#text('3+ BAÚS', goldStyle(36), cx, 455);
    const fsDesc = this.#text('= RODADAS GRÁTIS', plainStyle(24, '#e6f7ff'), cx, 495);

    this.base.addChild(title, bubble, bubbleText, desc, divider, chest, fsTitle, fsDesc);

    // ----- modo rodadas grátis -----
    this.fs = new Container();
    this.fs.alpha = 0;
    this.fs.visible = false;
    const fsHeader = this.#text('RODADAS GRÁTIS', goldStyle(36), cx, 50);
    this.spinsText = this.#text('0 / 0', goldStyle(76), cx, 135);
    const multLabel = this.#text('MULTIPLICADOR', plainStyle(28, '#e6f7ff'), cx, 250);

    const multBubble = new Sprite(ctx.bubbleTex);
    multBubble.anchor.set(0.5);
    multBubble.scale.set(1.25);
    multBubble.position.set(cx, 370);
    this.multBubble = multBubble;

    this.multText = new Text({
      text: 'x0',
      style: {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: 82,
        fill: aquaFill(),
        stroke: { color: '#2a0650', width: 10, join: 'round' },
      },
    });
    this.multText.anchor.set(0.5);
    this.multText.position.set(cx, 370);
    const hint = this.#text('Cada bolha soma!', plainStyle(22, '#a8eaff'), cx, 490);

    this.fs.addChild(fsHeader, this.spinsText, multLabel, multBubble, this.multText, hint);

    this.addChild(this.bg, this.base, this.fs);
    this.position.set(PANEL.x, PANEL.y);
    this.time = 0;
  }

  #text(text, style, x, y) {
    const t = new Text({ text, style });
    t.anchor.set(0.5);
    t.position.set(x, y);
    return t;
  }

  setMode(freeSpins) {
    const show = freeSpins ? this.fs : this.base;
    const hide = freeSpins ? this.base : this.fs;
    show.visible = true;
    gsap.to(hide, { alpha: 0, duration: 0.3, onComplete: () => (hide.visible = false) });
    gsap.to(show, { alpha: 1, duration: 0.4, delay: 0.2 });
  }

  setSpins(current, total) {
    this.spinsText.text = `${current} / ${total}`;
    gsap.fromTo(this.spinsText.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2)' });
  }

  setMultiplier(value, bump = false) {
    this.multText.text = `x${value}`;
    if (bump) {
      gsap.fromTo(this.multText.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      gsap.fromTo(this.multBubble.scale, { x: 1.6, y: 1.6 }, { x: 1.25, y: 1.25, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    }
  }

  /** Ponto (no pai) onde as bolhas chegam nas rodadas grátis. */
  multiplierPoint() {
    return { x: this.x + this.multText.x, y: this.y + this.multText.y };
  }

  update(dt) {
    this.time += dt;
    this.baseBubble.y = 145 + Math.sin(this.time * 2) * 6;
    this.baseChest.rotation = Math.sin(this.time * 1.5) * 0.05;
    this.multBubble.rotation = Math.sin(this.time * 1.2) * 0.06;
  }
}
