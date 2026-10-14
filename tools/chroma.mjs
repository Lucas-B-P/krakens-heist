/** Remove o verde: pixels "muito verdes" viram transparentes e as bordas perdem o reflexo verde. */
export function chromaKey(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenness = g - Math.max(r, b);

    if (greenness > 90) {
      data[i + 3] = 0;
    } else if (greenness > 30) {
      data[i + 3] = Math.round(255 * (1 - (greenness - 30) / 60));
      data[i + 1] = Math.max(r, b);
    } else if (greenness > 12) {
      data[i + 1] = Math.max(r, b) + 12;
    }
  }
}

/**
 * Fundo que ficou "preso" (entre a corrente e o corpo, entre tentáculos curvados) não
 * encosta na borda e escapa do preenchimento. Com a silhueta original, um bolsão escuro
 * vira fundo se ao menos 30% dele estiver fora dela; a boca aberta e as lapelas também
 * são preto quase puro, mas ficam inteiras dentro da silhueta. Sem silhueta, só bolsões
 * praticamente 100% preto puro são removidos.
 */
function removeEnclosedHoles(lum, bg, width, height, { low, protect, minSize }) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = [];

  for (let start = 0; start < n; start++) {
    if (seen[start] || bg[start] || lum[start] > low) continue;

    members.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let pure = 0;
    let outside = 0;
    while (top > 0) {
      const p = stack[--top];
      members.push(p);
      if (lum[p] <= 3) pure++;
      if (protect && !protect[p]) outside++;
      const x = p % width;
      const visit = (q) => {
        if (!seen[q] && !bg[q] && lum[q] <= low) {
          seen[q] = 1;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < n - width) visit(p + width);
    }

    const size = members.length;
    if (size < minSize) continue;
    const isHole = protect ? outside / size >= 0.3 : pure / size >= 0.95;
    if (isHole) {
      for (const p of members) bg[p] = 1;
    }
  }
}

/**
 * Pontinhos soltos e escuros (borrão de movimento ou ruído de compressão perto do
 * fundo) viram fundo. Pedaços claros, como moedas voando, são mantidos.
 */
function removeDarkSpecks(lum, bg, width, height, { high, maxSize }) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || bg[start]) continue;
    members.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let sum = 0;
    while (top > 0 && members.length <= maxSize) {
      const p = stack[--top];
      members.push(p);
      sum += lum[p];
      const x = p % width;
      const visit = (q) => {
        if (!seen[q] && !bg[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < n - width) visit(p + width);
    }
    if (members.length > maxSize) {
      // Componente grande (o próprio personagem): termina de marcar sem guardar.
      while (top > 0) {
        const p = stack[--top];
        const x = p % width;
        const visit = (q) => {
          if (!seen[q] && !bg[q]) {
            seen[q] = 1;
            stack[top++] = q;
          }
        };
        if (x > 0) visit(p - 1);
        if (x < width - 1) visit(p + 1);
        if (p >= width) visit(p - width);
        if (p < n - width) visit(p + width);
      }
      continue;
    }
    if (sum / members.length < high) for (const p of members) bg[p] = 1;
  }
}

/**
 * Remove um fundo de cor sólida (vídeos sem canal alfa: preto, verde ou a transição
 * entre os dois). Só apaga o fundo ligado às bordas da imagem, para não furar partes
 * escuras do personagem (chapéu, máscara, colete). O contorno ganha alfa suave e tem a
 * mistura com a cor do fundo compensada.
 *
 * `protect` (opcional, 1 byte por pixel) marca a silhueta original do personagem:
 * ali só pixels quase idênticos ao fundo podem ser removidos, o que evita "vazar" por
 * roupas escuras sem impedir que uma parte que se moveu (ex.: a pérola jogada) deixe o
 * lugar vazio.
 */
export function colorKey(data, width, height, { bg: bgColor = [0, 0, 0], protect = null } = {}) {
  const n = width * height;
  const [br, bgG, bb] = bgColor;
  const brightness = Math.max(br, bgG, bb);
  // Fundo escuro pede limiares justos (roupas pretas ficam a poucos tons dele);
  // fundo verde forte fica longe de tudo no personagem e tem mais ruído de compressão.
  const low = Math.round(Math.min(40, Math.max(6, brightness * 0.4)));
  const high = low + 34;
  const protectedLow = brightness < 30 ? 3 : Math.round(low / 2);

  const lum = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    lum[p] = Math.max(Math.abs(data[i] - br), Math.abs(data[i + 1] - bgG), Math.abs(data[i + 2] - bb));
  }

  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const seed = (p) => {
    if (!bg[p] && lum[p] <= (protect?.[p] ? protectedLow : low)) {
      bg[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0) seed(p - 1);
    if (x < width - 1) seed(p + 1);
    if (p >= width) seed(p - width);
    if (p < n - width) seed(p + width);
  }

  removeEnclosedHoles(lum, bg, width, height, { low, protect, minSize: Math.round(n * 0.00004) + 8 });
  removeDarkSpecks(lum, bg, width, height, { high, maxSize: Math.round(n * 0.0002) + 8 });

  // Distância (1 ou 2 px) até o fundo, para suavizar o contorno; o 2º anel só conta
  // quando é bem escuro (halo de borrão de movimento misturado ao fundo).
  const ring = new Uint8Array(n);
  const neighbors = (p, fn) => {
    const x = p % width;
    if (x > 0) fn(p - 1);
    if (x < width - 1) fn(p + 1);
    if (p >= width) fn(p - width);
    if (p < n - width) fn(p + width);
  };
  for (let p = 0; p < n; p++) {
    if (!bg[p]) continue;
    neighbors(p, (q) => {
      if (!bg[q]) ring[q] = 1;
    });
  }
  const mid = (low + high) / 2;
  for (let p = 0; p < n; p++) {
    if (ring[p] !== 1) continue;
    neighbors(p, (q) => {
      if (!bg[q] && !ring[q] && lum[q] < mid) ring[q] = 2;
    });
  }

  const greenBg = bgG - Math.max(br, bb) > 15;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (bg[p]) {
      data[i + 3] = 0;
      continue;
    }
    if (ring[p] && lum[p] < high) {
      // Pixel observado = cor * a + fundo * (1 - a): recupera a cor sem o fundo misturado.
      const a = Math.max(0.05, (lum[p] - low) / (high - low));
      const ae = Math.max(a, 0.5);
      data[i + 3] = Math.round(255 * a);
      data[i] = clampByte((data[i] - br * (1 - ae)) / ae);
      data[i + 1] = clampByte((data[i + 1] - bgG * (1 - ae)) / ae);
      data[i + 2] = clampByte((data[i + 2] - bb * (1 - ae)) / ae);
    }
    if (greenBg) {
      // Tira o reflexo verde que o fundo deixa no contorno.
      const cap = Math.max(data[i], data[i + 2]) + 12;
      if (data[i + 1] > cap) data[i + 1] = cap;
    }
  }
}

const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** Fundo preto (atalho de `colorKey`). */
export function blackKey(data, width, height, options = {}) {
  colorKey(data, width, height, { ...options, bg: [0, 0, 0] });
}

/**
 * Cor do fundo de um quadro: mediana de amostras nas bordas (ignorando o canto
 * superior direito, onde ferramentas de IA costumam pôr a marca d'água).
 */
export function estimateBackground(data, width, height) {
  const samples = [];
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let t = 0; t < 1; t += 0.02) {
    add(Math.round(t * (width - 1)), height - 2);
    add(1, Math.round(t * (height - 1)));
    if (t > 0.3) add(width - 2, Math.round(t * (height - 1)));
    if (t < 0.5) add(Math.round(t * (width - 1)), 1);
  }
  return [0, 1, 2].map((c) => {
    const v = samples.map((s) => s[c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
}
