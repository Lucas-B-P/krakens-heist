// Empacota animações em um sprite sheet (WebP ou PNG + JSON no formato do PixiJS).
//
// Cada animação pode ser um vídeo ou uma pasta de quadros (em ordem alfabética):
//   art/kraken_frames/idle.mp4                       (vídeo: .mp4 .webm .mov)
//   art/kraken_frames/win/001.png 002.png ...        (quadros: .png .jpg .webp)
// O nome do arquivo/pasta é o nome da animação (idle, win, anticipation).
//
// Uso: npm run sheet -- [--in pasta] [--out public/assets/kraken/kraken_sheet]
//                       [--height 600] [--fps idle=12,*=20] [--key auto|green|black|none]
//                       [--guide img] [--format webp|png] [--quality 90]
//
// --fps aceita um número para todas ou "animação=fps" separados por vírgula ('*' = demais).
// O idle é mais lento (só pisca) para economizar memória; reações rápidas pedem mais quadros.
// Animações que não cabem numa imagem de 4096px são divididas em várias páginas.
//
// --key remove o fundo: 'green' (chroma key), 'black' (vídeo com fundo preto) ou
// 'none' (PNG já transparente). 'auto' detecta pela cor dos cantos de cada quadro.
// --guide imagem.png: silhueta transparente com o mesmo enquadramento do vídeo (ex.: a
// imagem usada para gerá-lo). Protege partes escuras do personagem no modo 'black'.
// Todos os quadros recebem o MESMO recorte (a união de todos), para o personagem
// não "tremer" entre um quadro e outro.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { blackKey, chromaKey } from './chroma.mjs';

const MAX_SIZE = 4096;
const PAD = 2;
const VIDEO = /\.(mp4|webm|mov)$/i;
const IMAGE = /\.(png|jpe?g|webp)$/i;

function args() {
  const out = {
    in: 'art/kraken_frames',
    out: 'public/assets/kraken/kraken_sheet',
    height: 600,
    fps: 'idle=12,*=20',
    key: 'auto',
    format: 'webp',
    quality: 90,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'chroma') out.key = 'green';
    else out[key] = ['height', 'quality'].includes(key) ? Number(argv[++i]) : argv[++i];
  }
  return out;
}

function fpsTable(spec) {
  const table = { '*': 12 };
  for (const part of String(spec).split(',')) {
    const [a, b] = part.split('=');
    if (b === undefined) table['*'] = Number(a);
    else table[a.trim()] = Number(b);
  }
  return (anim) => table[anim] ?? table['*'];
}

const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

function detectKey(data, width, height) {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((p) => p * 4);
  if (corners.every((i) => data[i + 3] < 128)) return 'none';
  const avg = (c) => corners.reduce((s, i) => s + data[i + c], 0) / 4;
  const [r, g, b] = [avg(0), avg(1), avg(2)];
  if (g - Math.max(r, b) > 60) return 'green';
  if (Math.max(r, g, b) < 40) return 'black';
  return 'none';
}

const guideCache = new Map();
async function guideMask(file, width, height) {
  const key = `${width}x${height}`;
  if (!guideCache.has(key)) {
    const alpha = await sharp(file).ensureAlpha().resize(width, height, { fit: 'fill' }).extractChannel(3).raw().toBuffer();
    guideCache.set(key, Uint8Array.from(alpha, (a) => (a > 128 ? 1 : 0)));
  }
  return guideCache.get(key);
}

/** Lê o quadro, reduz para uma resolução de trabalho e remove o fundo. */
async function loadFrame(file, workHeight, keyMode, guide) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize({ height: workHeight, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mode = keyMode === 'auto' ? detectKey(data, info.width, info.height) : keyMode;
  if (mode === 'green') chromaKey(data);
  else if (mode === 'black') {
    const protect = guide ? await guideMask(guide, info.width, info.height) : null;
    blackKey(data, info.width, info.height, { protect });
  }
  return { data, width: info.width, height: info.height, mode };
}

async function extractVideo(file, fps, tmp) {
  const dir = path.join(tmp, path.parse(file).name);
  await mkdir(dir, { recursive: true });
  execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${fps}`, path.join(dir, '%04d.png')]);
  return (await readdir(dir)).sort(naturalSort).map((f) => path.join(dir, f));
}

function alphaBounds({ data, width, height }) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

const opts = args();
const fpsFor = fpsTable(opts.fps);
const tmp = await mkdtemp(path.join(tmpdir(), 'kraken-sheet-'));
const entries = (await readdir(opts.in, { withFileTypes: true })).sort((a, b) => naturalSort(a.name, b.name));

const raw = [];
const animations = {};
try {
  for (const entry of entries) {
    let files;
    let anim;
    if (entry.isDirectory()) {
      anim = entry.name;
      files = (await readdir(path.join(opts.in, anim)))
        .filter((f) => IMAGE.test(f))
        .sort(naturalSort)
        .map((f) => path.join(opts.in, anim, f));
    } else if (VIDEO.test(entry.name)) {
      anim = path.parse(entry.name).name;
      files = await extractVideo(path.join(opts.in, entry.name), fpsFor(anim), tmp);
    } else {
      continue;
    }
    if (!files.length) continue;

    animations[anim] = [];
    const modes = new Set();
    for (const [i, file] of files.entries()) {
      const name = `${anim}_${String(i).padStart(3, '0')}`;
      const frame = await loadFrame(file, Math.round(opts.height * 1.3), opts.key, opts.guide);
      modes.add(frame.mode);
      raw.push({ name, ...frame });
      animations[anim].push(name);
    }
    console.log(`✓ ${anim}: ${files.length} quadros (fundo: ${[...modes].join('/')})`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (!raw.length) {
  console.error(`Nenhuma animação em ${opts.in} (ex.: ${opts.in}/idle.mp4 ou ${opts.in}/idle/001.png).`);
  process.exit(1);
}

// O recorte comum só faz sentido se todas as animações tiverem o mesmo enquadramento.
const sizes = new Map();
for (const f of raw) {
  const anim = f.name.replace(/_\d+$/, '');
  if (!sizes.has(anim)) sizes.set(anim, `${f.width}x${f.height}`);
}
if (new Set(sizes.values()).size > 1) {
  console.error('As animações têm proporções diferentes e o personagem ficaria em tamanhos diferentes:');
  for (const [anim, size] of sizes) console.error(`  ${anim}: ${size}`);
  console.error('Gere todos os vídeos com a mesma proporção (ex.: 3:4) a partir da mesma imagem inicial.');
  process.exit(1);
}

// Recorte comum: união das áreas visíveis de todos os quadros.
const union = raw.map(alphaBounds).reduce((u, b) => ({
  x0: Math.min(u.x0, b.x0),
  y0: Math.min(u.y0, b.y0),
  x1: Math.max(u.x1, b.x1),
  y1: Math.max(u.y1, b.y1),
}));
const frames = [];
for (const f of raw) {
  const x0 = Math.max(0, union.x0);
  const y0 = Math.max(0, union.y0);
  const w = Math.min(f.width, union.x1 + 1) - x0;
  const h = Math.min(f.height, union.y1 + 1) - y0;
  const { data, info } = await sharp(f.data, { raw: { width: f.width, height: f.height, channels: 4 } })
    .extract({ left: x0, top: y0, width: w, height: h })
    .resize({ height: opts.height, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  frames.push({ name: f.name, data, width: info.width, height: info.height });
}

// Uma ou mais páginas (imagem + JSON) por animação, todas com a mesma célula: cada quadro
// fica centralizado e apoiado na base. A página principal é a do 'idle' e lista as outras
// em meta.related_multi_packs, que o PixiJS carrega junto automaticamente. Cada página
// guarda o fps da sua animação em meta.fps.
const cellW = Math.max(...frames.map((f) => f.width));
const cellH = Math.max(...frames.map((f) => f.height));
const cols = Math.max(1, Math.floor((MAX_SIZE + PAD) / (cellW + PAD)));
const ext = opts.format === 'png' ? 'png' : 'webp';
const outDir = path.dirname(opts.out);
const base = path.basename(opts.out);

const animNames = Object.keys(animations).sort((a, b) => (a === 'idle' ? -1 : b === 'idle' ? 1 : naturalSort(a, b)));
const perPage = cols * Math.max(1, Math.floor((MAX_SIZE + PAD) / (cellH + PAD)));
const pages = [];
for (const anim of animNames) {
  const all = animations[anim];
  for (let k = 0; k * perPage < all.length; k++) {
    const file = pages.length === 0 ? base : `${base}-${anim}${k > 0 ? `-${k + 1}` : ''}`;
    pages.push({ anim, file, names: all.slice(k * perPage, (k + 1) * perPage) });
  }
}

await mkdir(outDir, { recursive: true });
for (const old of await readdir(outDir)) {
  if (old === base + path.extname(old) || old.startsWith(`${base}-`)) await rm(path.join(outDir, old), { force: true });
}

const byName = new Map(frames.map((f) => [f.name, f]));
for (const [p, { anim, file, names }] of pages.entries()) {
  const sheetW = Math.min(names.length, cols) * (cellW + PAD) - PAD;
  const sheetH = Math.ceil(names.length / cols) * (cellH + PAD) - PAD;

  const json = { frames: {}, animations: { [anim]: names }, meta: {} };
  const composites = names.map((name, i) => {
    const f = byName.get(name);
    const x = (i % cols) * (cellW + PAD);
    const y = Math.floor(i / cols) * (cellH + PAD);
    json.frames[name] = {
      frame: { x, y, w: cellW, h: cellH },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cellW, h: cellH },
      sourceSize: { w: cellW, h: cellH },
    };
    return {
      input: f.data,
      raw: { width: f.width, height: f.height, channels: 4 },
      left: x + Math.round((cellW - f.width) / 2),
      top: y + (cellH - f.height),
    };
  });

  json.meta = { image: `${file}.${ext}`, format: 'RGBA8888', size: { w: sheetW, h: sheetH }, scale: '1', fps: fpsFor(anim) };
  if (p === 0 && pages.length > 1) json.meta.related_multi_packs = pages.slice(1).map((pg) => `${pg.file}.json`);

  const canvas = sharp({
    create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites);
  const encoded = ext === 'png' ? canvas.png({ compressionLevel: 9 }) : canvas.webp({ quality: opts.quality, alphaQuality: 100 });
  await encoded.toFile(path.join(outDir, `${file}.${ext}`));
  await writeFile(path.join(outDir, `${file}.json`), JSON.stringify(json, null, 2));

  console.log(`✓ ${file}.${ext} (${sheetW}x${sheetH}) — ${anim}: ${names.length} quadros`);
}
console.log(`Célula ${cellW}x${cellH}. Carregue ${opts.out}.json no jogo.`);
