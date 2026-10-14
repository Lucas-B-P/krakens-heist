import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { GodrayFilter } from 'pixi-filters/godray';
import { ParticleSystem } from '../util/ParticleSystem.js';
import { WobbleMesh } from '../util/WobbleMesh.js';
import { makeVignetteTexture, rand } from '../util/fx.js';

export class Background extends Container {
  constructor(textures, ctx) {
    super();
    this.ctx = ctx;

    this.mesh = new WobbleMesh({
      texture: textures.bg,
      verticesX: 24,
      verticesY: 14,
      amplitude: 3.5,
      frequency: 7,
      speed: 1.1,
    });

    this.godray = new GodrayFilter({
      angle: 22,
      parallel: true,
      gain: 0.42,
      lacunarity: 2.6,
      alpha: 0.5,
      time: 0,
    });
    this.mesh.filters = [this.godray];

    this.featureTint = new Graphics();
    this.featureTint.alpha = 0;

    this.vignette = new Sprite(makeVignetteTexture());

    this.bubbles = new ParticleSystem(300);
    this.motes = new ParticleSystem(120);

    this.addChild(this.mesh, this.featureTint, this.motes, this.bubbles, this.vignette);
    this.size = { w: 0, h: 0 };
  }

  resize(w, h) {
    this.size = { w, h };
    const tex = this.mesh.texture;
    const s = Math.max(w / tex.width, h / tex.height) * 1.03;
    this.mesh.scale.set(s);
    this.mesh.position.set((w - tex.width * s) / 2, (h - tex.height * s) / 2);

    this.featureTint.clear().rect(0, 0, w, h).fill(0x2a0650);
    this.vignette.width = w;
    this.vignette.height = h;
  }

  setFeatureMode(on) {
    gsap.to(this.featureTint, { alpha: on ? 0.4 : 0, duration: 1.2 });
    gsap.to(this.godray, { gain: on ? 0.55 : 0.42, duration: 1.2 });
  }

  update(dt) {
    const { w, h } = this.size;
    this.mesh.update(dt);
    this.godray.time += dt * 0.3;

    if (Math.random() < dt * 7) {
      const big = Math.random() < 0.15;
      this.bubbles.spawn({
        texture: this.ctx.bubbleTex,
        blendMode: 'normal',
        x: rand(0, w),
        y: h + 20,
        vy: -rand(50, 130) * (big ? 1.4 : 1),
        sway: rand(15, 40),
        swayFreq: rand(1.5, 3),
        life: rand(6, 10),
        scaleStart: big ? rand(0.18, 0.28) : rand(0.05, 0.12),
        alpha: 0.7,
        fadeIn: 0.5,
      });
    }

    if (Math.random() < dt * 4) {
      this.motes.spawn({
        texture: this.ctx.glowTex,
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-8, 8),
        vy: rand(-12, -3),
        life: rand(3, 6),
        scaleStart: rand(0.05, 0.12),
        colorStart: Math.random() < 0.5 ? 0x9ff6ff : 0xffe7a0,
        alpha: 0.7,
        fadeIn: 1,
      });
    }

    this.bubbles.update(dt);
    this.motes.update(dt);
  }
}
