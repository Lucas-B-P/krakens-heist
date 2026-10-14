import { Container, Sprite } from 'pixi.js';
import { makeShineTexture } from '../util/fx.js';

const SHINE_PERIOD = 4.5;

export class Logo extends Container {
  constructor(texture, width) {
    super();
    const s = width / texture.width;

    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(s);

    // Faixa de brilho que atravessa o logo, recortada pelo próprio logo.
    this.maskSprite = new Sprite(texture);
    this.maskSprite.anchor.set(0.5);
    this.maskSprite.scale.set(s);

    this.shine = new Sprite(makeShineTexture());
    this.shine.anchor.set(0.5);
    this.shine.blendMode = 'add';
    this.shine.alpha = 0.75;
    this.shine.height = texture.height * s * 1.6;
    this.shine.width = 120;
    this.shine.rotation = 0.35;

    this.shineLayer = new Container();
    this.shineLayer.addChild(this.shine);
    this.shineLayer.mask = this.maskSprite;

    this.addChild(this.sprite, this.shineLayer, this.maskSprite);
    this.halfW = (texture.width * s) / 2;
    this.time = Math.random() * SHINE_PERIOD;
  }

  update(dt) {
    this.time += dt;
    this.sprite.y = this.maskSprite.y = Math.sin(this.time * 1.4) * 5;
    this.shineLayer.y = this.sprite.y;

    const k = (this.time % SHINE_PERIOD) / 1.2;
    this.shine.visible = k <= 1;
    this.shine.x = -this.halfW - 150 + k * (this.halfW * 2 + 300);
  }
}
