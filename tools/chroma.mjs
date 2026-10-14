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
 * Remove fundo preto (vídeos sem canal alfa). Só apaga o preto ligado às bordas
 * da imagem, para não furar partes escuras do personagem (chapéu, máscara, colete).
 * O contorno ganha alfa suave e tem o escurecimento do fundo compensado.
 *
 * `protect` (opcional, 1 byte por pixel) marca a silhueta original do personagem:
 * ali só o preto absoluto pode ser removido, o que evita "vazar" por roupas escuras
 * sem impedir que uma parte que se moveu (ex.: a pérola jogada) deixe o lugar vazio.
 */
export function blackKey(data, width, height, { low = 6, high = 40, protect = null } = {}) {
  const n = width * height;
  const lum = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    lum[p] = Math.max(data[i], data[i + 1], data[i + 2]);
  }

  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const seed = (p) => {
    if (!bg[p] && lum[p] <= (protect?.[p] ? 3 : low)) {
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

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (bg[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % width;
    const nearBg =
      (x > 0 && bg[p - 1]) || (x < width - 1 && bg[p + 1]) || (p >= width && bg[p - width]) || (p < n - width && bg[p + width]);
    if (nearBg && lum[p] < high) {
      const a = Math.max(0.05, (lum[p] - low) / (high - low));
      const k = 1 / Math.max(a, 0.5);
      data[i + 3] = Math.round(255 * a);
      data[i] = Math.min(255, data[i] * k);
      data[i + 1] = Math.min(255, data[i + 1] * k);
      data[i + 2] = Math.min(255, data[i + 2] * k);
    }
  }
}
