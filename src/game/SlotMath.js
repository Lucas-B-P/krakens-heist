import {
  BUBBLE_VALUES,
  PAYLINES,
  REELS,
  ROWS,
  SCATTER,
  SYMBOLS,
  WEIGHTS,
} from './config.js';

const SYMBOL_IDS = Object.keys(WEIGHTS);

function weightedPick(entries, rng) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

const REEL_TABLES = Array.from({ length: REELS }, (_, reel) =>
  SYMBOL_IDS.map((id) => [id, WEIGHTS[id][reel]]).filter(([, w]) => w > 0),
);

/** Símbolo aleatório para um rolo (usado também nas faixas que giram). */
export function randomSymbol(reel, rng = Math.random) {
  return weightedPick(REEL_TABLES[reel], rng);
}

export function randomBubbleValue(rng = Math.random) {
  return weightedPick(BUBBLE_VALUES, rng);
}

/**
 * Gera a grade de um giro. Cada célula: { id, value? } (value só para bolhas).
 * grid[reel][row]
 */
export function spinGrid(rng = Math.random) {
  const grid = [];
  for (let reel = 0; reel < REELS; reel++) {
    const column = [];
    let hasScatter = false;
    for (let row = 0; row < ROWS; row++) {
      let id = randomSymbol(reel, rng);
      while (id === 'scatter' && hasScatter) id = randomSymbol(reel, rng);
      if (id === 'scatter') hasScatter = true;
      column.push(id === 'bubble' ? { id, value: randomBubbleValue(rng) } : { id });
    }
    grid.push(column);
  }
  return grid;
}

function evaluateLine(grid, line, lineIndex) {
  const cells = line.map((row, reel) => grid[reel][row].id);

  let wildRun = 0;
  while (wildRun < REELS && cells[wildRun] === 'wild') wildRun++;
  const wildPay = SYMBOLS.wild.pays[wildRun - 1] ?? 0;

  const base = cells.find((id) => id !== 'wild');
  let symbolPay = 0;
  let symbolRun = 0;
  if (base && SYMBOLS[base].pays) {
    while (symbolRun < REELS && (cells[symbolRun] === base || cells[symbolRun] === 'wild')) symbolRun++;
    symbolPay = SYMBOLS[base].pays[symbolRun - 1] ?? 0;
  }

  if (wildPay === 0 && symbolPay === 0) return null;
  const useWild = wildPay >= symbolPay;
  const count = useWild ? wildRun : symbolRun;
  return {
    line: lineIndex,
    symbol: useWild ? 'wild' : base,
    count,
    pay: useWild ? wildPay : symbolPay,
    positions: line.slice(0, count).map((row, reel) => [reel, row]),
  };
}

/**
 * Avalia o giro.
 * @param {number} bet aposta total
 * @param {number} carriedMultiplier multiplicador acumulado (rodadas grátis)
 */
export function evaluate(grid, bet, carriedMultiplier = 0) {
  const lineBet = bet / PAYLINES.length;
  const lineWins = [];
  for (let i = 0; i < PAYLINES.length; i++) {
    const win = evaluateLine(grid, PAYLINES[i], i);
    if (win) lineWins.push({ ...win, amount: win.pay * lineBet });
  }

  const scatters = [];
  const bubbles = [];
  grid.forEach((column, reel) =>
    column.forEach((cell, row) => {
      if (cell.id === 'scatter') scatters.push([reel, row]);
      if (cell.id === 'bubble') bubbles.push({ reel, row, value: cell.value });
    }),
  );

  const lineTotal = lineWins.reduce((sum, w) => sum + w.amount, 0);
  const bubbleSum = bubbles.reduce((sum, b) => sum + b.value, 0);
  const multiplier = lineTotal > 0 ? Math.max(1, bubbleSum + carriedMultiplier) : 1;

  const scatterInfo = SCATTER[Math.min(5, scatters.length)];
  const scatterWin = scatterInfo ? scatterInfo.pay * bet : 0;
  const freeSpins = scatterInfo ? scatterInfo.spins : 0;

  return {
    grid,
    lineWins,
    lineTotal,
    bubbles,
    bubbleSum,
    multiplier,
    scatters,
    scatterWin,
    freeSpins,
    total: lineTotal * multiplier + scatterWin,
  };
}
