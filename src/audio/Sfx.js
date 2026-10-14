import { Music } from '../util/Music.js';

const MUTE_KEY = 'krakens-heist:muted';
const VOLUME_KEY = 'krakens-heist:sfx-volume';

const rand = (min, max) => min + Math.random() * (max - min);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Frequência de `semi` semitons acima do Lá 440. */
const note = (semi) => 440 * 2 ** (semi / 12);

/** Formantes (F1, F2) das vogais a, e, i, o, u — base da "fala" do polvo. */
const VOWELS = { a: [800, 1200], e: [450, 1900], i: [320, 2500], o: [480, 850], u: [330, 750] };

/**
 * Efeitos sonoros sintetizados em tempo real com Web Audio (nenhum arquivo para baixar).
 * Sons "ambientes" passam por um passa-baixa que dá a sensação de estar debaixo d'água.
 * O AudioContext só é criado/liberado no primeiro gesto do jogador.
 */
class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    const saved = Number(localStorage.getItem(VOLUME_KEY) ?? 0.8);
    this.volume = Number.isFinite(saved) ? clamp01(saved) : 0.8;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  unlock() {
    if (!this.ctx) this.#init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.ctx?.state === 'running';
  }

  get now() {
    return this.ctx.currentTime;
  }

  setMuted(muted) {
    this.muted = muted;
    this.#applyVolume();
  }

  setVolume(v) {
    this.volume = clamp01(v);
    localStorage.setItem(VOLUME_KEY, String(this.volume));
    this.#applyVolume();
  }

  #init() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.water = ctx.createBiquadFilter();
    this.water.type = 'lowpass';
    this.water.frequency.value = 2200;
    this.water.Q.value = 0.8;
    this.water.connect(this.master);

    this.voiceBus = ctx.createBiquadFilter();
    this.voiceBus.type = 'lowpass';
    this.voiceBus.frequency.value = 4200;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1800;
    presence.Q.value = 0.9;
    presence.gain.value = 6;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 2.6;
    this.voiceBus.connect(presence).connect(voiceGain).connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.#applyVolume();
  }

  #applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }

  // ---------- blocos básicos ----------

  #env(t, dur, peak, attack = 0.005, out = this.master) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }

  #tone(t, { type = 'sine', freq, freqEnd, dur, gain = 0.2, attack = 0.005, out = this.master }) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    o.connect(this.#env(t, dur, gain, attack, out));
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  #noise(t, { dur, gain = 0.2, type = 'bandpass', freq = 1000, freqEnd, q = 1, attack = 0.005, out = this.master }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    src.connect(f).connect(this.#env(t, dur, gain, attack, out));
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** Bolha: seno curto com o tom subindo rápido. */
  #bubble(t, size = 1, gain = 0.12) {
    const f = rand(380, 700) / size;
    this.#tone(t, { freq: f, freqEnd: f * rand(2.2, 3), dur: 0.05 + 0.04 * size, gain, attack: 0.004, out: this.water });
  }

  /** Sino com parciais inarmônicas (moedas, brilhos, baús). */
  #bell(t, freq, { gain = 0.15, dur = 1, out = this.master } = {}) {
    [
      [1, 1],
      [2.01, 0.45],
      [3.9, 0.2],
      [5.4, 0.1],
    ].forEach(([ratio, amp]) => this.#tone(t, { freq: freq * ratio, dur: dur / ratio ** 0.4, gain: gain * amp, out }));
  }

  #thud(t, { freq = 130, gain = 0.45, dur = 0.25 } = {}) {
    this.#tone(t, { freq, freqEnd: freq * 0.4, dur, gain, attack: 0.003, out: this.water });
    this.#noise(t, { dur: 0.08, gain: gain * 0.5, type: 'lowpass', freq: 900, out: this.water });
  }

  // ---------- efeitos do jogo ----------

  click() {
    if (!this.ready) return;
    const t = this.now;
    this.#tone(t, { freq: 900, freqEnd: 520, dur: 0.07, gain: 0.12 });
    this.#bubble(t + 0.02, 0.7, 0.06);
  }

  /** Arranque dos rolos: redemoinho + catraca acelerando + bolhas, e liga o "motor" contínuo. */
  spinStart() {
    if (!this.ready) return;
    const t = this.now;
    this.#noise(t, { dur: 0.6, gain: 0.3, freq: 250, freqEnd: 1600, q: 1.5, attack: 0.08, out: this.water });
    for (let i = 0; i < 9; i++) {
      const dt = 0.22 * (1 - Math.sqrt(1 - i / 9));
      this.#noise(t + dt, { dur: 0.03, gain: 0.18, freq: 2200, q: 3, out: this.water });
    }
    for (let i = 0; i < 7; i++) this.#bubble(t + rand(0, 0.45), rand(0.6, 1.6), 0.1);
    this.#startChurn();
  }

  /** Para o motor quando o último rolo trava. */
  spinStop() {
    const c = this.churn;
    if (!c) return;
    this.churn = null;
    clearInterval(c.timer);
    const t = this.now;
    c.out.gain.setTargetAtTime(0.0001, t, 0.06);
    c.sources.forEach((s) => s.stop(t + 0.4));
  }

  #startChurn() {
    this.spinStop();
    const ctx = this.ctx;
    const t = this.now;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 0.25);
    out.connect(this.water);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 1.4;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.09;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.07;
    lfo.connect(lfoDepth).connect(pulse.gain);
    src.connect(band).connect(pulse).connect(out);

    const hum = ctx.createOscillator();
    hum.frequency.value = 62;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.06;
    hum.connect(humGain).connect(out);

    [src, lfo, hum].forEach((s) => s.start(t));
    const timer = setInterval(() => {
      if (this.ready && Math.random() < 0.55) this.#bubble(this.now, rand(0.6, 1.8), 0.07);
    }, 110);
    this.churn = { out, timer, sources: [src, lfo, hum] };
  }

  reelStop(index) {
    if (!this.ready) return;
    const t = this.now;
    this.#thud(t, { freq: 120 + index * 8, gain: 0.4 });
    this.#noise(t, { dur: 0.05, gain: 0.12, freq: 3000, q: 2, out: this.water });
    this.#bubble(t + 0.03, 1.2, 0.08);
  }

  /** Baú caindo: pancada grave + sino que sobe a cada baú (1º, 2º, 3º...). */
  scatterLand(count) {
    if (!this.ready) return;
    const t = this.now;
    this.#thud(t, { freq: 95, gain: 0.55, dur: 0.35 });
    const semi = [3, 7, 10, 15, 19][Math.min(count, 5) - 1];
    this.#bell(t + 0.02, note(semi), { gain: 0.22, dur: 1.6 });
    this.#bell(t + 0.02, note(semi + 12), { gain: 0.08, dur: 1.2 });
    for (let i = 0; i < 4; i++) this.#bubble(t + rand(0, 0.3), rand(0.8, 1.5), 0.08);
  }

  /** Riser de suspense enquanto um rolo segura a antecipação. */
  anticipation(on) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now;
    if (!on) {
      const r = this.riser;
      this.riser = null;
      if (!r) return;
      r.out.gain.setTargetAtTime(0.0001, t, 0.08);
      r.sources.forEach((s) => s.stop(t + 0.5));
      return;
    }
    if (this.riser) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.13, t + 1.5);
    out.connect(this.master);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(3000, t + 4);

    const trem = ctx.createGain();
    trem.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(4, t);
    lfo.frequency.linearRampToValueAtTime(14, t + 4);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth).connect(trem.gain);

    const sources = [lfo];
    [1, 1.007, 0.5].forEach((ratio) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110 * ratio, t);
      o.frequency.exponentialRampToValueAtTime(440 * ratio, t + 4);
      o.connect(lp);
      sources.push(o);
    });
    lp.connect(trem).connect(out);
    sources.forEach((s) => s.start(t));
    this.riser = { out, sources };
  }

  /**
   * Contagem de moedas com o tom subindo a cada tique. `step` continua de onde a contagem
   * anterior parou, então ganhos em sequência (linha → multiplicador) vão ficando mais agudos.
   * @returns {{ step: number, cancel: () => void }}
   */
  roll(duration, step = 0, rise = 0.5) {
    const ticks = Math.max(1, Math.round(duration / 0.075));
    if (!this.ready) return { step: step + ticks * rise, cancel() {} };
    const ctx = this.ctx;
    const t0 = this.now;
    const bus = ctx.createGain();
    bus.connect(this.master);

    for (let k = 0; k < ticks; k++) {
      const s = Math.min(step + k * rise, 30);
      const t = t0 + (k * duration) / ticks;
      this.#tone(t, { freq: note(3 + s), dur: 0.09, gain: 0.07, out: bus });
      this.#tone(t, { freq: note(3 + s) * 2.01, dur: 0.06, gain: 0.03, out: bus });
    }
    if (duration > 0.3) {
      const s = Math.min(step, 30);
      this.#tone(t0, {
        type: 'triangle',
        freq: note(-9 + s),
        freqEnd: note(-9 + Math.min(step + ticks * rise, 30)),
        dur: duration,
        gain: 0.05,
        attack: duration * 0.6,
        out: bus,
      });
    }
    return {
      step: step + ticks * rise,
      cancel: () => {
        bus.gain.setTargetAtTime(0.0001, this.now, 0.03);
        setTimeout(() => bus.disconnect(), 300);
      },
    };
  }

  /** Acorde de fechamento de um ganho; mais agudo quanto maior o combo. */
  winStinger(step = 0) {
    if (!this.ready) return;
    const t = this.now;
    const base = 3 + Math.min(step, 24) * 0.5;
    [0, 4, 7, 12].forEach((s, i) => this.#bell(t + i * 0.055, note(base + s), { gain: 0.12, dur: 0.9 }));
  }

  bubblePop(index = 0) {
    if (!this.ready) return;
    const t = this.now;
    this.#bubble(t, 1.6, 0.18);
    this.#tone(t, { freq: 200, freqEnd: 900, dur: 0.12, gain: 0.12, out: this.water });
    this.#bell(t + 0.02, note(10 + index * 2), { gain: 0.1, dur: 0.6 });
  }

  /** Multiplicador batendo no valor: estrondo + brilho. */
  multiplier() {
    if (!this.ready) return;
    const t = this.now;
    this.#tone(t, { freq: 110, freqEnd: 35, dur: 0.7, gain: 0.55, attack: 0.004, out: this.water });
    this.#noise(t, { dur: 0.45, gain: 0.3, type: 'lowpass', freq: 1400, freqEnd: 200, out: this.water });
    this.#noise(t, { dur: 0.35, gain: 0.12, freq: 3000, freqEnd: 8000, q: 0.7 });
    [15, 19, 22, 27].forEach((s) => this.#bell(t + 0.03, note(s), { gain: 0.08, dur: 1.4 }));
  }

  /** Abertura das rodadas grátis: brilho mágico subindo + acorde. */
  featureStart() {
    if (!this.ready) return;
    const t = this.now;
    this.#noise(t, { dur: 1.2, gain: 0.18, freq: 300, freqEnd: 5000, q: 1.2, attack: 0.9 });
    [3, 5, 7, 10, 12, 15, 17, 19, 22, 24].forEach((s, i) => this.#bell(t + 0.3 + i * 0.07, note(s), { gain: 0.09, dur: 0.8 }));
    [3, 7, 10, 15].forEach((s) =>
      this.#tone(t + 0.9, { type: 'triangle', freq: note(s - 12), dur: 2.2, gain: 0.07, attack: 0.15 }),
    );
    for (let i = 0; i < 12; i++) this.#bubble(t + rand(0, 1.4), rand(0.6, 1.8), 0.08);
  }

  // ---------- sequência do scatter ----------

  /** Rufar de tambor acelerando + riser, enquanto os baús acendem. */
  scatterTrigger(duration = 1.8) {
    if (!this.ready) return;
    const t = this.now;
    this.#noise(t, { dur: duration, gain: 0.22, freq: 200, freqEnd: 6000, q: 1.5, attack: duration * 0.9 });
    [3, 7, 10].forEach((s) =>
      this.#tone(t, { type: 'sawtooth', freq: note(s - 24), freqEnd: note(s - 12), dur: duration, gain: 0.04, attack: duration * 0.85 }),
    );
    let dt = 0;
    for (let i = 0; dt < duration; i++) {
      this.#thud(t + dt, { freq: 70 + i * 1.5, gain: 0.12 + (dt / duration) * 0.25, dur: 0.12 });
      dt += Math.max(0.035, 0.16 * (1 - dt / duration));
    }
  }

  /** Brilho de cada baú acendendo (sobe de nota a cada um). */
  chestFlare(index) {
    if (!this.ready) return;
    const t = this.now;
    const semi = [3, 7, 10, 15, 19][Math.min(index, 4)];
    this.#bell(t, note(semi + 12), { gain: 0.16, dur: 1.4 });
    this.#noise(t, { dur: 0.5, gain: 0.1, freq: 2000, freqEnd: 9000, q: 0.8 });
    this.#thud(t, { freq: 100, gain: 0.35 });
  }

  whoosh(duration = 0.6) {
    if (!this.ready) return;
    const t = this.now;
    this.#noise(t, { dur: duration, gain: 0.28, freq: 400, freqEnd: 3500, q: 2, attack: duration * 0.7, out: this.water });
  }

  /** Baú chacoalhando antes de abrir: batidas de madeira acelerando. */
  chestRattle(duration = 0.9) {
    if (!this.ready) return;
    const t = this.now;
    let dt = 0;
    while (dt < duration) {
      this.#noise(t + dt, { dur: 0.05, gain: 0.25, freq: rand(500, 900), q: 6, out: this.water });
      this.#tone(t + dt, { freq: rand(160, 220), freqEnd: 90, dur: 0.06, gain: 0.15, out: this.water });
      dt += Math.max(0.04, 0.13 * (1 - dt / duration));
    }
  }

  /** Explosão do baú: estrondo, prato, acorde brilhante e chuva de moedas. */
  chestBurst() {
    if (!this.ready) return;
    const t = this.now;
    this.#tone(t, { freq: 90, freqEnd: 28, dur: 1.2, gain: 0.7, attack: 0.003, out: this.water });
    this.#noise(t, { dur: 0.6, gain: 0.4, type: 'lowpass', freq: 2000, freqEnd: 150, out: this.water });
    this.#noise(t, { dur: 2.2, gain: 0.16, type: 'highpass', freq: 5000, q: 0.5 });
    [3, 7, 10, 15, 19, 22].forEach((s, i) => this.#bell(t + i * 0.03, note(s + 12), { gain: 0.09, dur: 2 }));
    [3, 10, 15].forEach((s) => this.#tone(t, { type: 'triangle', freq: note(s - 12), dur: 2.5, gain: 0.08, attack: 0.05 }));
    for (let i = 0; i < 40; i++) {
      const dt = 0.05 + Math.random() ** 1.6 * 1.8;
      const f = note(rand(20, 34));
      this.#tone(t + dt, { freq: f, dur: 0.12, gain: 0.05 });
      this.#tone(t + dt, { freq: f * 1.5, dur: 0.08, gain: 0.025 });
    }
    for (let i = 0; i < 10; i++) this.#bubble(t + rand(0, 1), rand(0.5, 1.8), 0.1);
  }

  /** Letra do título caindo (escala pentatônica subindo). */
  letterPop(index) {
    if (!this.ready) return;
    const scale = [0, 2, 4, 7, 9];
    const semi = 15 + scale[index % 5] + 12 * Math.floor(index / 5);
    this.#tone(this.now, { type: 'triangle', freq: note(Math.min(semi, 40)), dur: 0.18, gain: 0.08 });
  }

  /** Número de rodadas cravado na tela. */
  spinsSlam() {
    if (!this.ready) return;
    const t = this.now;
    this.#thud(t, { freq: 85, gain: 0.6, dur: 0.6 });
    this.#noise(t, { dur: 1.4, gain: 0.12, type: 'highpass', freq: 6000, q: 0.5 });
    [0, 4, 7, 12, 16].forEach((s, i) =>
      [1, 1.004].forEach((d) => this.#tone(t + i * 0.02, { type: 'sawtooth', freq: note(s - 9) * d, dur: 1.4, gain: 0.035, attack: 0.02 })),
    );
    [15, 19, 22, 27].forEach((s) => this.#bell(t, note(s), { gain: 0.1, dur: 1.6 }));
  }

  /** Fanfarra do big win. */
  bigWin() {
    if (!this.ready) return;
    const t = this.now;
    [
      [0, 3, 0.14],
      [0.15, 7, 0.14],
      [0.3, 10, 0.14],
      [0.45, 15, 0.9],
    ].forEach(([dt, s, dur]) => {
      [1, 1.005].forEach((d) => this.#tone(t + dt, { type: 'sawtooth', freq: note(s - 12) * d, dur, gain: 0.07, attack: 0.02 }));
      this.#bell(t + dt, note(s), { gain: 0.08, dur: dur + 0.4 });
    });
    this.#thud(t + 0.45, { freq: 90, gain: 0.5, dur: 0.5 });
  }

  /** Troca de nível (BIG → MEGA → EPIC). */
  bigWinTier(level) {
    if (!this.ready) return;
    const t = this.now;
    this.#thud(t, { freq: 80, gain: 0.55, dur: 0.6 });
    const base = 3 + level * 5;
    [0, 4, 7, 12, 16].forEach((s, i) => this.#bell(t + i * 0.04, note(base + s), { gain: 0.1, dur: 1.2 }));
  }

  // ---------- voz do polvo ----------

  /** "Fala" de desenho animado: sílabas com formantes de vogais e um tremido borbulhante. */
  speak(text, { pitch = 1 } = {}) {
    if (!this.ready) return;
    const letters = text.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();
    if (/(ha|he|hi|ho){2,}/.test(letters)) return this.laugh(pitch);

    const vowels = letters.replace(/[^aeiou]/g, '') || 'aeo';
    const count = Math.min(9, Math.max(2, vowels.length));
    Music.duck(count * 0.16 + 0.3);
    let t = this.now + 0.02;
    const base = 165 * pitch;
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const dur = last ? 0.22 : rand(0.08, 0.14);
      const f = base * (last ? 1.35 : rand(0.85, 1.2));
      this.#syllable(t, vowels[i % vowels.length], f, dur);
      t += dur + rand(0.02, 0.05);
    }
    this.#bubble(t, 1.4, 0.1);
  }

  laugh(pitch = 1) {
    if (!this.ready) return;
    Music.duck(1);
    let t = this.now + 0.02;
    for (let i = 0; i < 5; i++) {
      const f = (270 - i * 18) * pitch;
      this.#syllable(t, i % 2 ? 'e' : 'a', f, 0.09);
      this.#noise(t, { dur: 0.06, gain: 0.05, freq: 1800, q: 1, out: this.voiceBus });
      t += 0.14;
    }
    this.#bubble(t, 1.2, 0.1);
  }

  #syllable(t, vowel, freq, dur) {
    const ctx = this.ctx;
    const [f1, f2] = VOWELS[vowel] ?? VOWELS.a;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.linearRampToValueAtTime(freq * rand(0.88, 1.12), t + dur);

    const wobble = ctx.createOscillator();
    wobble.frequency.value = rand(24, 32);
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = freq * 0.07;
    wobble.connect(wobbleDepth).connect(o.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.015);
    env.gain.setValueAtTime(0.5, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(this.voiceBus);

    [
      [f1, 7, 1],
      [f2, 11, 0.6],
    ].forEach(([f, q, amp]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(bp).connect(g).connect(env);
    });

    [o, wobble].forEach((s) => {
      s.start(t);
      s.stop(t + dur + 0.05);
    });
  }
}

export const sfx = new Sfx();
