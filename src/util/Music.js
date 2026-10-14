import gsap from 'gsap';

const MUTE_KEY = 'krakens-heist:muted';
const VOLUME_KEY = 'krakens-heist:volume';

/**
 * Música de fundo em loop com fade. Navegadores só liberam áudio após um gesto do jogador.
 * Mudo e volume do jogador valem para todas as faixas. `stop()` pausa sem voltar ao início,
 * então `play()` depois continua de onde parou.
 */
export class Music {
  static #all = new Set();

  constructor(src, volume = 0.55) {
    Music.#all.add(this);
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0;
    this.volume = volume;
    this.level = { v: 0 };
    this.duckLevel = { v: 1 };
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    const saved = Number(localStorage.getItem(VOLUME_KEY) ?? 1);
    this.userVolume = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
    this.stopped = false;
  }

  /** Abaixa todas as músicas por `seconds` (ex.: enquanto o polvo fala) e volta suavemente. */
  static duck(seconds, level = 0.35) {
    for (const m of Music.#all) {
      gsap.killTweensOf(m.duckLevel);
      gsap
        .timeline()
        .to(m.duckLevel, { v: level, duration: 0.12, onUpdate: () => m.#apply() })
        .to(m.duckLevel, { v: 1, duration: 0.5, delay: seconds, onUpdate: () => m.#apply() });
    }
  }

  get playing() {
    return !this.audio.paused;
  }

  /** Tenta tocar; resolve `false` se o navegador bloquear o autoplay. Chame dentro de um gesto para garantir. */
  play(fade = 1.5) {
    this.stopped = false;
    return this.audio.play().then(
      () => {
        this.#fadeTo(this.volume, fade);
        return true;
      },
      () => false,
    );
  }

  stop(fade = 1.2) {
    this.stopped = true;
    return new Promise((resolve) => {
      this.#fadeTo(0, fade, () => {
        this.audio.pause();
        resolve();
      });
    });
  }

  setMuted(muted) {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    for (const m of Music.#all) {
      m.muted = muted;
      m.#apply();
    }
  }

  /** Volume escolhido pelo jogador (0–1), salvo e aplicado sobre o volume base de cada faixa. */
  setUserVolume(v) {
    const userVolume = Math.min(1, Math.max(0, v));
    localStorage.setItem(VOLUME_KEY, String(userVolume));
    for (const m of Music.#all) {
      m.userVolume = userVolume;
      m.#apply();
    }
  }

  rewind() {
    this.audio.currentTime = 0;
  }

  #fadeTo(v, duration, onComplete) {
    gsap.killTweensOf(this.level);
    gsap.to(this.level, {
      v,
      duration,
      ease: 'sine.inOut',
      onUpdate: () => this.#apply(),
      onComplete,
    });
  }

  #apply() {
    const v = this.muted ? 0 : this.level.v * this.userVolume * this.duckLevel.v;
    this.audio.volume = Math.min(1, Math.max(0, v));
  }
}
