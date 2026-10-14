import { MeshPlane } from 'pixi.js';

/**
 * Malha que ondula como se estivesse debaixo d'água.
 * `weight(u, v)` (0..1) define quanto cada ponto da imagem se mexe.
 */
export class WobbleMesh extends MeshPlane {
  constructor({
    texture,
    verticesX = 12,
    verticesY = 12,
    amplitude = 6,
    frequency = 3,
    speed = 2,
    weight = () => 1,
  }) {
    super({ texture, verticesX, verticesY });
    this.amplitude = amplitude;
    this.frequency = frequency;
    this.speed = speed;
    this.weight = weight;
    this.time = Math.random() * 10;
    this.texW = texture.width;
    this.texH = texture.height;
    this.base = Float32Array.from(this.geometry.getBuffer('aPosition').data);
  }

  update(dt) {
    this.time += dt;
    const buffer = this.geometry.getBuffer('aPosition');
    const d = buffer.data;
    const b = this.base;
    const t = this.time * this.speed;

    for (let i = 0; i < b.length; i += 2) {
      const u = b[i] / this.texW;
      const v = b[i + 1] / this.texH;
      const s = this.weight(u, v) * this.amplitude;
      d[i] = b[i] + Math.sin(t + v * this.frequency + u * 2) * s;
      d[i + 1] = b[i + 1] + Math.cos(t * 0.7 + u * this.frequency) * s * 0.4;
    }
    buffer.update();
  }
}
