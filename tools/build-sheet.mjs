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
// --key remove o fundo: 'auto' (padrão) mede a cor sólida do fundo em cada quadro, então
// funciona com preto, verde ou um fundo que muda de cor no meio do vídeo. Também aceita
// 'green' (chroma key clássico), 'black' ou 'none' (PNG já transparente).
// --guide imagem.png: a imagem inicial usada para gerar os vídeos. Alinha o personagem
// de todas as animações pelo primeiro quadro (mesmo tamanho e posição) e protege partes
// escuras dele ao remover fundos pretos.
//
// <pasta>/sheet.json (opcional) guarda ajustes por animação:
//   "erase": retângulos apagados, em coordenadas 0..1 (x0, y0, x1, y1) do vídeo, como
//            a marca d'água de uma ferramenta de IA;
//   "trim":  segundos descartados no início/fim (ex.: uma transição de fundo no final).
//   { "erase": { "anticipation": [[0.64, 0, 1, 0.11]] },
//     "trim":  { "anticipation": { "end": 0.1 } } }
//
// Todos os quadros recebem o MESMO recorte (a união de todos), para o personagem
// não "tremer" entre um quadro e outro.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { chromaKey, colorKey, estimateBackground } from './chroma.mjs';

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

function backgroundLabel([r, g, b]) {
  if (Math.max(r, g, b) < 30) return 'preto';
  if (g - Math.max(r, b) > 15) return 'verde';
  return 'cor sólida';
}

/** Pinta retângulos (coordenadas 0..1) com a cor do fundo, para sumirem junto com ele. */
function paintRects(data, width, height, rects, [r, g, b]) {
  for (const [x0, y0, x1, y1] of rects) {
    const xa = Math.floor(x0 * width);
    const xb = Math.ceil(x1 * width);
    const ya = Math.floor(y0 * height);
    const yb = Math.ceil(y1 * height);
    for (let y = Math.max(0, ya); y < Math.min(height, yb); y++) {
      for (let x = Math.max(0, xa); x < Math.min(width, xb); x++) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
  }
}

/** Lê o quadro numa resolução de trabalho e remove o fundo. */
async function loadFrame(file, workHeight, { keyMode, erase, protect }) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize({ height: workHeight, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const opaque = [0, width - 1, (height - 1) * width, height * width - 1].some((p) => data[p * 4 + 3] > 128);
  let label = 'transparente';
  if (keyMode === 'green') {
    chromaKey(data);
    label = 'verde';
  } else if (keyMode !== 'none' && opaque) {
    const bg = keyMode === 'black' ? [0, 0, 0] : estimateBackground(data, width, height);
    if (erase?.length) paintRects(data, width, height, erase, bg);
    colorKey(data, width, height, { bg, protect: protect?.width === width ? protect.mask : null });
    label = backgroundLabel(bg);
  }
  return { data, width, height, label };
}

/**
 * Silhueta da imagem-guia na resolução de trabalho, com margem em volta: o que sai da
 * pose original (pérola jogada, moedas voando) não pode ser cortado no alinhamento.
 * A margem vazia some depois, no recorte comum.
 */
async function loadGuide(file, workHeight) {
  const marginX = Math.round(workHeight * 0.25);
  const marginTop = Math.round(workHeight * 0.25);
  const marginBottom = Math.round(workHeight * 0.1);
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .resize({ height: workHeight })
    .extend({
      left: marginX,
      right: marginX,
      top: marginTop,
      bottom: marginBottom,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = Uint8Array.from(data, (a) => (a > 128 ? 1 : 0));
  const rgba = { data: Buffer.alloc(mask.length * 4), width: info.width, height: info.height };
  mask.forEach((m, p) => (rgba.data[p * 4 + 3] = m ? 255 : 0));
  return { mask, width: info.width, height: info.height, bounds: alphaBounds(rgba) };
}

/**
 * Cada vídeo pode enquadrar o personagem de um jeito (mais zoom, mais margem). O primeiro
 * quadro de cada animação é a imagem inicial usada na IA, então alinhá-lo à guia deixa o
 * personagem com o mesmo tamanho e posição em todas as animações.
 */
function alignmentTo(guide, first) {
  const f = alphaBounds(first);
  const g = guide.bounds;
  const scale = (g.y1 - g.y0 + 1) / (f.y1 - f.y0 + 1);
  return {
    scale,
    offsetX: (g.x0 + g.x1) / 2 - ((f.x0 + f.x1) / 2) * scale,
    offsetY: g.y0 - f.y0 * scale,
  };
}

/** Silhueta da guia levada para o espaço do quadro original (inverso do alinhamento). */
function guideInFrame(guide, align, width, height) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = Math.round(y * align.scale + align.offsetY);
    if (gy < 0 || gy >= guide.height) continue;
    for (let x = 0; x < width; x++) {
      const gx = Math.round(x * align.scale + align.offsetX);
      if (gx >= 0 && gx < guide.width) mask[y * width + x] = guide.mask[gy * guide.width + gx];
    }
  }
  return { mask, width };
}

/** Reposiciona o quadro já recortado no espaço da guia. */
async function applyAlignment(frame, align, guide) {
  const w = Math.max(1, Math.round(frame.width * align.scale));
  const h = Math.max(1, Math.round(frame.height * align.scale));
  const scaled = await sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .resize(w, h, { fit: 'fill' })
    .raw()
    .toBuffer();
  const out = Buffer.alloc(guide.width * guide.height * 4);
  const ox = Math.round(align.offsetX);
  const oy = Math.round(align.offsetY);
  for (let y = 0; y < h; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= guide.height) continue;
    const x0 = Math.max(0, -ox);
    const x1 = Math.min(w, guide.width - ox);
    if (x1 <= x0) continue;
    scaled.copy(out, (ty * guide.width + x0 + ox) * 4, (y * w + x0) * 4, (y * w + x1) * 4);
  }
  return { data: out, width: guide.width, height: guide.height };
}

async function extractVideo(file, fps, tmp) {
  const dir = path.join(tmp, path.parse(file).name);
  await mkdir(dir, { recursive: true });
  execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${fps}`, path.join(dir, '%04d.png')]);
  return (await readdir(dir)).sort(naturalSort).map((f) => path.join(dir, f));
}

async function readSettings(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`Erro lendo ${file}: ${err.message}`);
  }
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

const workHeight = Math.round(opts.height * 1.3);
const guide = opts.guide ? await loadGuide(opts.guide, workHeight) : null;
const settings = await readSettings(path.join(opts.in, 'sheet.json'));

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
    const trim = settings.trim?.[anim];
    if (trim) {
      const fps = fpsFor(anim);
      files = files.slice(Math.round((trim.start ?? 0) * fps), files.length - Math.round((trim.end ?? 0) * fps));
    }
    if (!files.length) continue;

    const erase = settings.erase?.[anim] ?? [];
    const frameOpts = { keyMode: opts.key, erase };

    let align = null;
    let protect = null;
    if (guide) {
      const first = await loadFrame(files[0], workHeight, frameOpts);
      align = alignmentTo(guide, first);
      protect = guideInFrame(guide, align, first.width, first.height);
    }

    animations[anim] = [];
    const labels = new Set();
    for (const [i, file] of files.entries()) {
      const name = `${anim}_${String(i).padStart(3, '0')}`;
      let frame = await loadFrame(file, workHeight, { ...frameOpts, protect });
      labels.add(frame.label);
      if (align) frame = await applyAlignment(frame, align, guide);
      raw.push({ name, ...frame });
      animations[anim].push(name);
    }
    const scaleInfo = align ? `, escala ${align.scale.toFixed(2)}` : '';
    const eraseInfo = erase.length ? `, ${erase.length} área(s) apagada(s)` : '';
    console.log(`✓ ${anim}: ${files.length} quadros (fundo: ${[...labels].join('/')}${scaleInfo}${eraseInfo})`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (!raw.length) {
  console.error(`Nenhuma animação em ${opts.in} (ex.: ${opts.in}/idle.mp4 ou ${opts.in}/idle/001.png).`);
  process.exit(1);
}

// Sem guia não há como alinhar: o recorte comum só funciona se todas as animações
// tiverem o mesmo enquadramento.
const sizes = new Map();
for (const f of raw) {
  const anim = f.name.replace(/_\d+$/, '');
  if (!sizes.has(anim)) sizes.set(anim, `${f.width}x${f.height}`);
}
if (new Set(sizes.values()).size > 1) {
  console.error('As animações têm proporções diferentes e o personagem ficaria em tamanhos diferentes:');
  for (const [anim, size] of sizes) console.error(`  ${anim}: ${size}`);
  console.error('Use --guide com a imagem inicial ou gere todos os vídeos com a mesma proporção.');
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
