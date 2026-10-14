import { FillGradient, Texture } from 'pixi.js';
import gsap from 'gsap';

export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const wait = (seconds) => new Promise((resolve) => gsap.delayedCall(seconds, resolve));

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Espera `seconds`, mas termina antes se `cancel()` ficar verdadeiro. */
export async function waitUnless(seconds, cancel) {
  const end = performance.now() + seconds * 1000;
  while (performance.now() < end && !cancel()) await nextFrame();
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmt = (value) => money.format(value);

export function lerpColor(a, b, t) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}

// ---------- texturas geradas em canvas ----------

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  return Texture.from(canvas);
}

export function makeGlowTexture(size = 128) {
  return canvasTexture(size, size, (ctx, w) => {
    const r = w / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

export function makeBubbleTexture(size = 160) {
  return canvasTexture(size, size, (ctx, w) => {
    const r = w / 2;
    const body = ctx.createRadialGradient(r * 0.8, r * 0.75, r * 0.1, r, r, r * 0.96);
    body.addColorStop(0, 'rgba(180,250,255,0.10)');
    body.addColorStop(0.7, 'rgba(90,200,255,0.28)');
    body.addColorStop(1, 'rgba(200,250,255,0.85)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(r, r, r * 0.94, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = w * 0.025;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(r * 0.62, r * 0.5, r * 0.26, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 1.42, r * 1.38, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function makeCoinTexture(size = 96) {
  return canvasTexture(size, size, (ctx, w) => {
    const r = w / 2;
    const rim = ctx.createLinearGradient(0, 0, w, w);
    rim.addColorStop(0, '#fff3b0');
    rim.addColorStop(0.5, '#e8a317');
    rim.addColorStop(1, '#8a5200');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(r, r, r * 0.96, 0, Math.PI * 2);
    ctx.fill();

    const face = ctx.createRadialGradient(r * 0.7, r * 0.6, 2, r, r, r * 0.78);
    face.addColorStop(0, '#fffbe0');
    face.addColorStop(0.6, '#ffcc33');
    face.addColorStop(1, '#d48a00');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(r, r, r * 0.76, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b06e00';
    ctx.font = `bold ${w * 0.6}px "Lilita One", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', r, r * 1.04);
  });
}

export function makeRaysTexture(size = 1024, rays = 20) {
  return canvasTexture(size, size, (ctx, w) => {
    const r = w / 2;
    const fade = ctx.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, 'rgba(255,255,255,0.9)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fade;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const half = (Math.PI / rays) * 0.55;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r, a - half, a + half);
      ctx.closePath();
      ctx.fill();
    }
  });
}

export function makeShineTexture(width = 256, height = 256) {
  return canvasTexture(width, height, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeVignetteTexture(size = 512) {
  return canvasTexture(size, size, (ctx, w) => {
    const r = w / 2;
    const g = ctx.createRadialGradient(r, r, r * 0.45, r, r, r * 1.05);
    g.addColorStop(0, 'rgba(0,8,16,0)');
    g.addColorStop(1, 'rgba(0,8,16,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

// ---------- estilos de texto ----------

export function goldFill() {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#fffbe0' },
      { offset: 0.45, color: '#ffd34d' },
      { offset: 1, color: '#ff8a00' },
    ],
    textureSpace: 'local',
  });
}

export function aquaFill() {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#ffffff' },
      { offset: 0.5, color: '#7cf3ff' },
      { offset: 1, color: '#d24dff' },
    ],
    textureSpace: 'local',
  });
}

export function goldStyle(fontSize, extra = {}) {
  return {
    fontFamily: '"Lilita One", sans-serif',
    fontSize,
    fill: goldFill(),
    stroke: { color: '#3b0d57', width: Math.max(4, Math.round(fontSize * 0.1)), join: 'round' },
    letterSpacing: Math.round(fontSize * 0.03),
    ...extra,
  };
}

export function plainStyle(fontSize, color = '#ffffff', extra = {}) {
  return {
    fontFamily: '"Lilita One", sans-serif',
    fontSize,
    fill: color,
    stroke: { color: '#06263a', width: Math.max(3, Math.round(fontSize * 0.08)), join: 'round' },
    ...extra,
  };
}
