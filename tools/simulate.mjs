// Simulação de Monte Carlo para conferir o RTP (retorno ao jogador) do jogo.
import { RETRIGGER_SPINS } from '../src/game/config.js';
import { evaluate, spinGrid } from '../src/game/SlotMath.js';

const SPINS = Number(process.argv[2] ?? 1_000_000);
const BET = 1;

let paid = 0;
let hits = 0;
let features = 0;
let featureWin = 0;
let maxWin = 0;

for (let i = 0; i < SPINS; i++) {
  const res = evaluate(spinGrid(), BET);
  let win = res.total;
  if (win > 0) hits++;

  if (res.freeSpins > 0) {
    features++;
    let left = res.freeSpins;
    let carried = 0;
    let fsWin = 0;
    while (left > 0) {
      left--;
      const fs = evaluate(spinGrid(), BET, carried);
      carried += fs.bubbleSum;
      fsWin += fs.total;
      if (fs.freeSpins > 0) left += RETRIGGER_SPINS;
    }
    featureWin += fsWin;
    win += fsWin;
  }

  paid += win;
  maxWin = Math.max(maxWin, win);
}

console.log(`giros:            ${SPINS.toLocaleString('pt-BR')}`);
console.log(`RTP:              ${((paid / (SPINS * BET)) * 100).toFixed(2)}%`);
console.log(`  base:           ${(((paid - featureWin) / SPINS) * 100).toFixed(2)}%`);
console.log(`  rodadas grátis: ${((featureWin / SPINS) * 100).toFixed(2)}%`);
console.log(`hit rate:         ${((hits / SPINS) * 100).toFixed(2)}%`);
console.log(`feature a cada:   1 em ${Math.round(SPINS / Math.max(1, features))}`);
console.log(`maior prêmio:     ${maxWin.toFixed(1)}x`);
