import { Container, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { BET_LEVELS, BIG_WIN_TIERS, RETRIGGER_SPINS } from './game/config.js';
import { evaluate, spinGrid } from './game/SlotMath.js';
import { Wallet } from './game/Wallet.js';
import { ParticleSystem } from './util/ParticleSystem.js';
import {
  makeBubbleTexture,
  makeCoinTexture,
  makeGlowTexture,
  makeRaysTexture,
  pick,
  plainStyle,
  rand,
  wait,
  waitUnless,
} from './util/fx.js';
import { Background } from './view/Background.js';
import { BigWin } from './view/BigWin.js';
import { FeatureBanner } from './view/FeatureBanner.js';
import { Hud } from './view/Hud.js';
import { Kraken } from './view/Kraken.js';
import { CELL, DESIGN_H, DESIGN_W, KRAKEN, LOGO, REELS_X, REELS_Y } from './view/layout.js';
import { Logo } from './view/Logo.js';
import { REELS_H, REELS_W, ReelSet } from './view/ReelSet.js';
import { ScreenFx } from './view/ScreenFx.js';
import { SettingsPanel } from './view/SettingsPanel.js';
import { SidePanel } from './view/SidePanel.js';
import { bubbleColor } from './view/SymbolView.js';
import { WinDisplay } from './view/WinDisplay.js';

const AUTO_SPINS = 25;
const START_BALANCE = 1000;
const BIG_WIN_MIN = Math.min(...BIG_WIN_TIERS.map((t) => t.min));
const REELS_CENTER = { x: REELS_X + REELS_W / 2, y: REELS_Y + REELS_H / 2 };

export class Game {
  /** Com `intro: true` o jogo fica escondido e sem input até `start()` (tela inicial por cima). */
  /** `music` toca no jogo base e `featureMusic` nas rodadas grátis. */
  constructor(app, textures, krakenVisual, { intro = false, music = null, featureMusic = null } = {}) {
    this.app = app;
    this.music = music;
    this.featureMusic = featureMusic;
    this.track = music;
    this.krakenVisual = krakenVisual;
    this.ctx = {
      textures,
      glowTex: makeGlowTexture(),
      bubbleTex: makeBubbleTexture(),
      coinTex: makeCoinTexture(),
      raysTex: makeRaysTexture(),
    };

    this.wallet = new Wallet(START_BALANCE);
    this.betIndex = 2;
    this.turbo = false;
    this.autoLeft = 0;
    this.busy = false;
    this.slamRequested = false;
    this.skipRequested = false;
    this.fs = null;
    this.winLoop = null;
    this.size = { w: 0, h: 0 };
    this.started = !intro;

    this.#buildScene();
    this.#bindInput();
    if (intro) this.shaker.visible = this.hud.visible = false;

    this.wallet.onChange((b) => this.hud.setBalance(b));
    this.hud.setBet(this.bet);
    this.hud.setBalance(this.wallet.balance);

    app.ticker.add((t) => this.update(Math.min(t.deltaMS / 1000, 0.05)));
  }

  get bet() {
    return BET_LEVELS[this.betIndex];
  }

  #buildScene() {
    const { ctx } = this;
    this.background = new Background(ctx.textures, ctx);

    this.kraken = new Kraken(this.krakenVisual, KRAKEN.height);
    this.kraken.position.set(KRAKEN.x, KRAKEN.y);

    this.reels = new ReelSet(ctx);
    this.reels.position.set(REELS_X, REELS_Y);

    this.logo = new Logo(ctx.textures.logo, LOGO.width);
    this.logo.position.set(LOGO.x, LOGO.y);

    this.panel = new SidePanel(ctx);

    this.winDisplay = new WinDisplay();
    this.winDisplay.position.set(REELS_CENTER.x, REELS_CENTER.y);

    this.fx = new ParticleSystem(800);
    this.flyers = new Container();

    this.shaker = new Container();
    this.shaker.addChild(this.kraken, this.reels, this.logo, this.panel, this.winDisplay, this.flyers, this.fx);
    this.screenFx = new ScreenFx(this.shaker);

    this.hud = new Hud({
      onSpin: () => this.onSpinPressed(),
      onBet: (d) => this.changeBet(d),
      onAuto: () => this.toggleAuto(),
      onTurbo: () => this.toggleTurbo(),
      onMute: () => this.toggleMute(),
      onSettings: () => this.settings.open(),
    });
    this.hud.setMuted(this.music?.muted ?? false);

    this.bigWin = new BigWin(ctx);
    this.banner = new FeatureBanner(ctx);

    this.settings = new SettingsPanel({
      music: this.music,
      isTurbo: () => this.turbo,
      onTurbo: () => this.toggleTurbo(),
      onMute: () => this.toggleMute(),
      onResetBalance: () => this.resetBalance(),
    });

    this.world = new Container();
    this.world.addChild(this.shaker, this.hud, this.bigWin, this.banner, this.settings);
    this.app.stage.addChild(this.background, this.world);
  }

  #bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat || !this.started || this.settings.isOpen) return;
      e.preventDefault();
      if (this.bigWin.visible) this.bigWin.skip();
      else if (this.banner.isOpen) this.banner.skip();
      else this.onSpinPressed();
    });
  }

  /** Revela rolos, painel e HUD; o Kraken volta para a cena do jogo (pode estar emprestado à tela inicial). */
  start() {
    if (this.started) return;
    this.started = true;
    this.shaker.addChildAt(this.kraken, 0);
    this.shaker.visible = this.hud.visible = true;
    this.hud.setMuted(this.music?.muted ?? false);

    const { reels, logo, panel, hud } = this;
    gsap.from(reels, { alpha: 0, y: reels.y + 80, duration: 0.7, ease: 'back.out(1.3)' });
    gsap.from(logo.scale, { x: 0, y: 0, duration: 0.7, ease: 'back.out(1.8)', delay: 0.1 });
    gsap.from(panel, { alpha: 0, x: panel.x + 160, duration: 0.7, ease: 'power3.out', delay: 0.15 });
    gsap.from(hud, { alpha: 0, y: hud.y + 140, duration: 0.7, ease: 'power3.out', delay: 0.2 });
  }

  // ---------- controles ----------

  onSpinPressed() {
    if (!this.started) return;
    if (this.fs) {
      this.slamRequested = true;
      this.skipRequested = true;
      return;
    }
    if (this.busy) {
      this.slamRequested = true;
      this.skipRequested = true;
      return;
    }
    if (this.autoLeft > 0) {
      this.autoLeft = 0;
      this.hud.setAuto(0);
      return;
    }
    this.playRound();
  }

  changeBet(delta) {
    if (this.busy) return;
    this.betIndex = Math.min(BET_LEVELS.length - 1, Math.max(0, this.betIndex + delta));
    this.hud.setBet(this.bet);
  }

  toggleAuto() {
    if (this.autoLeft > 0) {
      this.autoLeft = 0;
      this.hud.setAuto(0);
      return;
    }
    this.autoLeft = AUTO_SPINS;
    this.hud.setAuto(this.autoLeft);
    if (!this.busy) this.#nextAuto();
  }

  toggleTurbo() {
    this.turbo = !this.turbo;
    this.hud.setTurbo(this.turbo);
  }

  toggleMute() {
    if (!this.music) return;
    this.music.setMuted(!this.music.muted);
    if (!this.music.muted && this.track && !this.track.playing && this.started) this.track.play();
    this.hud.setMuted(this.music.muted);
    this.settings.refresh();
  }

  /** Troca a faixa com crossfade; a anterior só pausa, então volta de onde parou. */
  #switchMusic(next, { rewind = false } = {}) {
    const prev = this.track;
    if (!next || next === prev) return;
    this.track = next;
    prev?.stop(1);
    if (rewind) next.rewind();
    next.play(1.2);
  }

  /** Volta o saldo para o valor inicial; recusa durante giros e rodadas grátis. */
  resetBalance() {
    if (this.busy || this.fs) return false;
    this.wallet.reset(START_BALANCE);
    return true;
  }

  #nextAuto() {
    if (this.autoLeft <= 0 || this.busy) return;
    this.autoLeft--;
    this.hud.setAuto(this.autoLeft);
    this.playRound();
  }

  // ---------- fluxo do jogo ----------

  async playRound() {
    if (this.busy || this.fs) return;
    if (!this.wallet.debit(this.bet)) {
      this.banner.toast('SALDO INSUFICIENTE');
      this.autoLeft = 0;
      this.hud.setAuto(0);
      return;
    }

    this.busy = true;
    this.hud.setLocked(true);
    this.hud.setWin(0);

    const result = await this.#spinOnce(0);
    await this.#present(result);
    if (result.freeSpins > 0) await this.#runFreeSpins(result.freeSpins);

    this.busy = false;
    this.hud.setLocked(false);
    this.#startWinLoop(result);

    if (this.autoLeft > 0) {
      await wait(this.turbo ? 0.25 : 0.6);
      this.#nextAuto();
    } else {
      this.hud.setAuto(0);
    }
  }

  async #spinOnce(carriedMultiplier) {
    this.#stopWinLoop();
    this.winDisplay.hide(true);
    this.slamRequested = false;
    this.skipRequested = false;

    const result = evaluate(spinGrid(), this.bet, carriedMultiplier);

    this.hud.setSpinning(true);
    await this.reels.spin(result.grid, {
      turbo: this.turbo,
      slam: () => this.slamRequested,
      onReelStop: (i, column, symbols) => this.#onReelStop(i, column, symbols),
      onAnticipation: (on) => this.kraken.setAnticipation(on),
    });
    this.hud.setSpinning(false);
    this.skipRequested = false;
    return result;
  }

  #onReelStop(reel, column, symbols) {
    column.forEach((cell, row) => {
      if (cell.id !== 'scatter' && cell.id !== 'bubble') return;
      const p = this.#cellCenter(reel, row);
      this.#sparkle(p.x, p.y, cell.id === 'scatter' ? 0xffd34d : 0x7cf3ff, 24);
      if (cell.id === 'scatter') {
        this.screenFx.addShake(6);
        this.screenFx.shockwave(p.x, p.y, { amplitude: 14, wavelength: 90, speed: 600, radius: 220 });
      }
    });
  }

  async #present(result) {
    const { lineWins, bubbles, multiplier, total, scatters, lineTotal, scatterWin } = result;
    const skip = () => this.skipRequested;

    // Nas rodadas grátis, toda bolha soma ao multiplicador acumulado.
    if (this.fs && bubbles.length) {
      await this.#flyBubbles(bubbles, this.panel.multiplierPoint(), (value) => {
        this.fs.multiplier += value;
        this.panel.setMultiplier(this.fs.multiplier, true);
      });
    }

    if (total <= 0) return;

    let shown = 0;
    const positions = lineWins.flatMap((w) => w.positions);

    if (lineTotal > 0) {
      this.reels.drawLines(lineWins);
      this.reels.highlight(scatterWin > 0 ? [...positions, ...scatters] : positions);
      this.kraken.celebrate();
      shown = lineTotal;
      await this.winDisplay.count(0, lineTotal, skip() ? 0.05 : 0.7);
      await waitUnless(0.45, skip);

      if (multiplier > 1) {
        if (!this.fs) {
          await this.#flyBubbles(bubbles, this.winDisplay.multiplierPoint(), () => {
            this.screenFx.addShake(3);
          });
        }
        await this.winDisplay.slamMultiplier(multiplier);
        this.screenFx.addShake(14);
        this.screenFx.shockwave(REELS_CENTER.x, REELS_CENTER.y, { amplitude: 36, wavelength: 180, radius: 900 });
        this.#sparkle(REELS_CENTER.x, REELS_CENTER.y, 0xff5df0, 60);
        const target = lineTotal * multiplier;
        await this.winDisplay.count(shown, target, skip() ? 0.05 : 1);
        shown = target;
      }
    }

    if (scatterWin > 0) {
      if (lineTotal === 0) this.reels.highlight(scatters, 4);
      await this.winDisplay.count(shown, shown + scatterWin, skip() ? 0.05 : 0.5);
    }

    this.wallet.credit(total);
    if (this.fs) {
      this.fs.win += total;
      this.hud.setWin(this.fs.win);
    } else {
      this.hud.setWin(total);
    }

    if (total >= BIG_WIN_MIN * this.bet) {
      this.winDisplay.hide();
      this.kraken.celebrate(3);
      this.screenFx.addShake(18);
      await this.bigWin.play(total, this.bet);
    } else {
      await waitUnless(this.fs ? 0.7 : 0.35, skip);
    }
  }

  async #runFreeSpins(count) {
    this.#stopWinLoop();
    this.kraken.celebrate(2);
    this.#switchMusic(this.featureMusic, { rewind: true });
    await wait(0.6);
    await this.banner.intro(count);

    this.fs = { left: count, played: 0, multiplier: 0, win: 0 };
    this.hud.setLocked(true, true);
    this.hud.setWin(0);
    this.background.setFeatureMode(true);
    this.panel.setMode(true);
    this.panel.setSpins(0, count);
    this.panel.setMultiplier(0);
    await wait(0.6);

    while (this.fs.left > 0) {
      this.fs.left--;
      this.fs.played++;
      this.panel.setSpins(this.fs.played, this.fs.played + this.fs.left);

      const result = await this.#spinOnce(this.fs.multiplier);
      await this.#present(result);

      if (result.freeSpins > 0) {
        this.fs.left += RETRIGGER_SPINS;
        this.panel.setSpins(this.fs.played, this.fs.played + this.fs.left);
        await this.banner.toast(`+${RETRIGGER_SPINS} RODADAS GRÁTIS`);
      }
      this.reels.clearWins();
      await wait(this.turbo ? 0.15 : 0.35);
    }

    const won = this.fs.win;
    await this.banner.outro(won);
    this.#switchMusic(this.music);
    this.fs = null;
    this.background.setFeatureMode(false);
    this.panel.setMode(false);
    this.hud.setLocked(true, false);
    this.hud.setWin(won, false);
  }

  // ---------- efeitos ----------

  #cellCenter(reel, row) {
    return { x: REELS_X + reel * CELL + CELL / 2, y: REELS_Y + row * CELL + CELL / 2 };
  }

  #sparkle(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(120, 420);
      this.fx.spawn({
        texture: this.ctx.glowTex,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.4, 0.9),
        scaleStart: rand(0.12, 0.3),
        scaleEnd: 0,
        colorStart: 0xffffff,
        colorEnd: color,
        drag: 0.9,
      });
    }
  }

  /** Bolhas saem dos rolos e voam até `target`, estourando ao chegar. */
  async #flyBubbles(bubbles, target, onArrive) {
    const flights = bubbles.map((b, k) => {
      const start = this.#cellCenter(b.reel, b.row);
      const symbol = this.reels.symbolAt(b.reel, b.row);
      if (symbol) symbol.bubble.visible = false;

      const flyer = new Container();
      const sprite = new Sprite(this.ctx.bubbleTex);
      sprite.anchor.set(0.5);
      sprite.scale.set((CELL * 0.82) / this.ctx.bubbleTex.width);
      const label = new Text({
        text: `x${b.value}`,
        style: plainStyle(50, bubbleColor(b.value), { stroke: { color: '#063a5c', width: 7, join: 'round' } }),
      });
      label.anchor.set(0.5);
      flyer.addChild(sprite, label);
      flyer.position.set(start.x, start.y);
      this.flyers.addChild(flyer);

      const midX = (start.x + target.x) / 2 + rand(-120, 120);
      const midY = Math.min(start.y, target.y) - rand(80, 180);

      return gsap
        .timeline({ delay: k * 0.18 })
        .to(flyer.scale, { x: 1.3, y: 1.3, duration: 0.2, ease: 'back.out(3)' })
        .to(flyer, { x: midX, y: midY, duration: 0.3, ease: 'power1.out' })
        .to(flyer, { x: target.x, y: target.y, duration: 0.32, ease: 'power2.in' })
        .to(flyer.scale, { x: 0.5, y: 0.5, duration: 0.32, ease: 'power2.in' }, '<')
        .add(() => {
          this.#sparkle(target.x, target.y, 0x7cf3ff, 30);
          onArrive?.(b.value);
          flyer.destroy({ children: true });
        });
    });
    await Promise.all(flights);
  }

  #startWinLoop(result) {
    const wins = result?.lineWins ?? [];
    if (!wins.length) return;

    const token = {};
    this.winLoop = token;
    let i = 0;
    const step = () => {
      if (this.winLoop !== token) return;
      this.winDisplay.hide();
      const w = wins[i % wins.length];
      this.reels.clearWins();
      this.reels.drawLines([w]);
      this.reels.highlight(w.positions, 1);
      i++;
      this.winLoopCall = gsap.delayedCall(1.4, step);
    };
    this.winLoopCall = gsap.delayedCall(1.6, step);
  }

  #stopWinLoop() {
    this.winLoop = null;
    this.winLoopCall?.kill();
    this.reels.clearWins();
  }

  // ---------- loop ----------

  #resize() {
    const { width: w, height: h } = this.app.screen;
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.background.resize(w, h);
    const s = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.world.scale.set(s);
    this.world.position.set((w - DESIGN_W * s) / 2, (h - DESIGN_H * s) / 2);
  }

  update(dt) {
    this.#resize();
    this.background.update(dt);
    this.kraken.update(dt);
    this.logo.update(dt);
    this.reels.update(dt);
    this.panel.update(dt);
    this.fx.update(dt);
    this.hud.update(dt);
    this.bigWin.update(dt);
    this.banner.update(dt);
    this.screenFx.update(dt);
  }
}
