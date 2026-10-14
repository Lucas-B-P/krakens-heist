// Converte a arte gerada (fundo verde chroma-key) em PNGs transparentes e otimizados.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { chromaKey } from './chroma.mjs';

const SRC = 'art';
const OUT = 'public/assets';

const KEYED = [
  { file: 'kraken', fit: { height: 900 } },
  { file: 'logo', fit: { width: 900 } },
  ...['wild', 'scatter', 'crown', 'gold', 'pearl', 'chips', 'a', 'k', 'q', 'j'].map((s) => ({
    file: `sym_${s}`,
    fit: { width: 256, height: 256 },
  })),
];

await mkdir(OUT, { recursive: true });

for (const { file, fit } of KEYED) {
  const { data, info } = await sharp(`${SRC}/${file}.jpg`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  chromaKey(data);

  const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  await sharp(trimmed)
    .trim({ threshold: 1 })
    .resize({ ...fit, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${file}.png`);

  console.log(`✓ ${file}.png`);
}

await sharp(`${SRC}/bg.jpg`).jpeg({ quality: 88 }).toFile(`${OUT}/bg.jpg`);
console.log('✓ bg.jpg');
