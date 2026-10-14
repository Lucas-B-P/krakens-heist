export const REELS = 5;
export const ROWS = 3;

export const SYMBOLS = {
  j: { texture: 'sym_j', pays: [0, 0, 3.5, 12, 40] },
  q: { texture: 'sym_q', pays: [0, 0, 4.5, 14, 46] },
  k: { texture: 'sym_k', pays: [0, 0, 7, 21, 64] },
  a: { texture: 'sym_a', pays: [0, 0, 8, 23, 82] },
  chips: { texture: 'sym_chips', pays: [0, 0, 12, 41, 117] },
  pearl: { texture: 'sym_pearl', pays: [0, 0, 17, 58, 164] },
  gold: { texture: 'sym_gold', pays: [0, 0, 21, 82, 234] },
  crown: { texture: 'sym_crown', pays: [0, 0, 41, 117, 410] },
  wild: { texture: 'sym_wild', pays: [0, 0, 41, 164, 820], wild: true },
  scatter: { texture: 'sym_scatter', scatter: true },
  bubble: { bubble: true },
};

/** Peso de cada símbolo por rolo (índice = rolo). */
export const WEIGHTS = {
  j: [22, 22, 22, 22, 22],
  q: [22, 22, 22, 22, 22],
  k: [20, 20, 20, 20, 20],
  a: [20, 20, 20, 20, 20],
  chips: [14, 14, 14, 14, 14],
  pearl: [12, 12, 12, 12, 12],
  gold: [10, 10, 10, 10, 10],
  crown: [8, 8, 8, 8, 8],
  wild: [0, 4, 4, 4, 4],
  scatter: [4, 4, 4, 4, 4],
  bubble: [4, 4, 4, 4, 4],
};

/** Valores das bolhas de multiplicador e suas chances relativas. */
export const BUBBLE_VALUES = [
  [2, 40],
  [3, 25],
  [5, 18],
  [10, 10],
  [25, 5],
  [50, 1.5],
  [100, 0.5],
];

/** Prêmio do scatter (x aposta total) e rodadas grátis por quantidade. */
export const SCATTER = {
  3: { pay: 2, spins: 10 },
  4: { pay: 10, spins: 12 },
  5: { pay: 50, spins: 15 },
};
export const RETRIGGER_SPINS = 5;

export const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 0, 2, 0],
];

export const BET_LEVELS = [0.2, 0.4, 1, 2, 4, 10, 20, 50, 100];

export const BIG_WIN_TIERS = [
  { min: 60, label: 'EPIC WIN' },
  { min: 30, label: 'MEGA WIN' },
  { min: 15, label: 'BIG WIN' },
];
