import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../audio/Sfx.js';
import { pick } from '../util/fx.js';

const LINES = {
  win: ['É MEU!', 'TESOURO!', 'HEHEHE!', 'QUE BELEZA!', 'MAIS OURO!', 'PERFEITO!'],
  big: ['HAHAHA!', 'EU SOU RICO!', 'GOLPE DE MESTRE!', 'O COFRE É NOSSO!'],
  scatter: ['HORA DO ASSALTO!', 'OS BAÚS SÃO MEUS!', 'HAHAHA, BAÚS!'],
  tease: ['VAI... VAI...!', 'MAIS UM BAÚ...!', 'QUASE LÁ...!'],
};

class SpeechBubble extends Container {
  constructor() {
    super();
    this.bg = new Graphics();
    this.text = new Text({
      text: '',
      style: { fontFamily: '"Lilita One", sans-serif', fontSize: 40, fill: '#3b0d57', letterSpacing: 1 },
    });
    this.text.anchor.set(0.5);
    this.addChild(this.bg, this.text);
    this.visible = false;
  }

  show(text, hold = 1.6) {
    this.text.text = text;
    const w = Math.max(180, this.text.width + 60);
    const h = 84;
    this.bg
      .clear()
      .poly([-w * 0.25, h / 2 - 4, -w * 0.38, h / 2 + 34, -w * 0.08, h / 2 - 4])
      .fill(0xfffbe8)
      .stroke({ color: 0xffd34d, width: 4 })
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(0xfffbe8)
      .stroke({ color: 0xffd34d, width: 4 })
      .rect(-w * 0.36, h / 2 - 8, w * 0.27, 8)
      .fill(0xfffbe8);

    gsap.killTweensOf([this, this.scale]);
    this.visible = true;
    this.alpha = 1;
    gsap.fromTo(this.scale, { x: 0.2, y: 0.2 }, { x: 1, y: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    gsap.to(this, { alpha: 0, duration: 0.3, delay: hold, onComplete: () => (this.visible = false) });
  }
}

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

    this.bubble = new SpeechBubble();
    this.bubble.position.set(visual.width * this.baseScale * 0.32, -height - 75);

    this.addChild(this.shadow, this.lean, this.bubble);
    this.time = 0;
  }

  /** Fala uma frase do tipo `kind` (win, big, scatter, tease): balão + voz sintetizada. */
  say(kind) {
    const now = performance.now();
    if (kind === 'win' && now - (this.lastSay ?? -1e9) < 3500) return;
    this.lastSay = now;
    const text = pick(LINES[kind] ?? LINES.win);
    this.bubble.show(text, kind === 'tease' ? 1.4 : 2.2);
    sfx.speak(text, { pitch: kind === 'big' || kind === 'scatter' ? 1.12 : 1 });
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
