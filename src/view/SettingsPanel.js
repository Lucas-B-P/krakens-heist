import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { sfx } from '../audio/Sfx.js';
import { goldStyle, plainStyle } from '../util/fx.js';
import { bindPress, Button } from './Button.js';
import { DESIGN_H, DESIGN_W } from './layout.js';

const W = 760;
const H = 720;
const LABEL_X = -W / 2 + 60;
const CONTROL_X = W / 2 - 60;
const SLIDER_W = 300;

/**
 * Janela de configurações: som, volume da música, giro turbo e restaurar saldo.
 * `onResetBalance()` deve retornar `false` se não puder restaurar agora (giro em andamento).
 */
export class SettingsPanel extends Container {
  constructor({ music, isTurbo, onTurbo, onMute, onResetBalance }) {
    super();
    this.music = music;
    this.isTurbo = isTurbo;
    this.visible = false;

    this.overlay = new Graphics().rect(-2000, -2000, DESIGN_W + 4000, DESIGN_H + 4000).fill({ color: 0x000000, alpha: 0.6 });
    this.overlay.eventMode = 'static';
    this.overlay.on('pointertap', () => this.close());

    this.box = new Container();
    this.box.position.set(DESIGN_W / 2, DESIGN_H / 2);
    this.box.eventMode = 'static';

    const grad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#0a4466' },
        { offset: 1, color: '#03192a' },
      ],
      textureSpace: 'local',
    });
    const bg = new Graphics()
      .roundRect(-W / 2, -H / 2, W, H, 34)
      .fill(grad)
      .stroke({ color: 0xffd34d, width: 5 });

    const title = new Text({ text: 'CONFIGURAÇÕES', style: goldStyle(56) });
    title.anchor.set(0.5);
    title.y = -H / 2 + 62;

    const divider = new Graphics().rect(-W / 2 + 50, -H / 2 + 112, W - 100, 3).fill({ color: 0xffd34d, alpha: 0.5 });

    this.closeBtn = new Container();
    this.closeBtn.addChild(
      new Graphics().circle(0, 0, 30).fill(0x8a1c3a).stroke({ color: 0xffd34d, width: 3 }),
      new Graphics().moveTo(-10, -10).lineTo(10, 10).moveTo(10, -10).lineTo(-10, 10).stroke({ color: 0xffffff, width: 5, cap: 'round' }),
    );
    this.closeBtn.position.set(W / 2 - 18, -H / 2 + 18);
    bindPress(this.closeBtn, () => this.close());

    this.box.addChild(bg, title, divider);

    this.soundToggle = this.#toggle(-170, 'SOM', () => !this.music.muted, () => onMute());
    this.volume = this.#slider(-80, 'MÚSICA', () => this.music.userVolume, (v) => this.music.setUserVolume(v));
    this.sfxVolume = this.#slider(10, 'EFEITOS', () => sfx.volume, (v) => sfx.setVolume(v), () => sfx.click());
    this.turboToggle = this.#toggle(100, 'GIRO TURBO', () => this.isTurbo(), () => onTurbo());

    this.#label('SALDO DE TESTE', 195);
    this.resetBtn = new Button({
      width: 300,
      height: 64,
      label: 'RESTAURAR R$ 1.000',
      fontSize: 24,
      onClick: () => {
        const ok = onResetBalance();
        this.#flash(ok ? 'Saldo restaurado!' : 'Aguarde o giro terminar', ok ? '#7cff6b' : '#ff8a8a');
      },
    });
    this.resetBtn.position.set(CONTROL_X - 150, 195);

    this.feedback = new Text({ text: '', style: plainStyle(24, '#7cff6b') });
    this.feedback.anchor.set(0.5);
    this.feedback.position.set(0, H / 2 - 50);
    this.feedback.alpha = 0;

    this.box.addChild(this.resetBtn, this.feedback, this.closeBtn);
    this.addChild(this.overlay, this.box);

    this.onKey = (e) => {
      if (e.code === 'Escape' && this.visible) this.close();
    };
    window.addEventListener('keydown', this.onKey);
  }

  get isOpen() {
    return this.visible;
  }

  open() {
    if (this.visible) return;
    this.refresh();
    this.visible = true;
    gsap.fromTo(this.overlay, { alpha: 0 }, { alpha: 1, duration: 0.25 });
    gsap.fromTo(this.box.scale, { x: 0.7, y: 0.7 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(1.8)' });
    gsap.fromTo(this.box, { alpha: 0 }, { alpha: 1, duration: 0.2 });
  }

  close() {
    if (!this.visible || this.closing) return;
    this.closing = true;
    gsap.to(this.overlay, { alpha: 0, duration: 0.2 });
    gsap.to(this.box.scale, { x: 0.8, y: 0.8, duration: 0.2, ease: 'power2.in' });
    gsap.to(this.box, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => {
        this.visible = false;
        this.closing = false;
      },
    });
  }

  /** Sincroniza os controles com o estado atual (ex.: mudo ou turbo alterados pelo HUD). */
  refresh() {
    this.soundToggle.refresh();
    this.turboToggle.refresh();
    this.volume.refresh();
    this.sfxVolume.refresh();
  }

  #label(text, y) {
    const t = new Text({ text, style: plainStyle(32, '#d9f6ff') });
    t.anchor.set(0, 0.5);
    t.position.set(LABEL_X, y);
    this.box.addChild(t);
  }

  #toggle(y, label, get, onClick) {
    this.#label(label, y);
    const sw = new Container();
    const track = new Graphics();
    const knob = new Graphics().circle(0, 0, 24).fill(0xffffff).stroke({ color: 0x06263a, width: 2 });
    const state = new Text({ text: '', style: plainStyle(22) });
    state.anchor.set(1, 0.5);
    state.x = -70;
    sw.addChild(track, knob, state);
    sw.position.set(CONTROL_X - 50, y);
    this.box.addChild(sw);

    const refresh = (animate = false) => {
      const on = get();
      track.clear().roundRect(-50, -26, 100, 52, 26).fill(on ? 0x22c55e : 0x33475a).stroke({ color: 0xffd34d, width: 3 });
      const x = on ? 24 : -24;
      if (animate) gsap.to(knob, { x, duration: 0.2, ease: 'power2.out' });
      else knob.x = x;
      state.text = on ? 'LIGADO' : 'DESLIGADO';
      state.style.fill = on ? '#7cff6b' : '#8aa4b8';
    };
    bindPress(sw, () => {
      onClick();
      refresh(true);
    });
    refresh();
    return { refresh: () => refresh() };
  }

  /** `onRelease` roda ao soltar (ex.: tocar um som de amostra no volume escolhido). */
  #slider(y, label, get, set, onRelease) {
    this.#label(label, y);
    const slider = new Container();
    slider.position.set(CONTROL_X - SLIDER_W, y);
    const track = new Graphics().roundRect(0, -8, SLIDER_W, 16, 8).fill(0x33475a).stroke({ color: 0xffd34d, width: 2 });
    const fill = new Graphics();
    const knob = new Graphics().circle(0, 0, 22).fill(0xffd34d).stroke({ color: 0x3b0d57, width: 3 });
    const pct = new Text({ text: '', style: plainStyle(22) });
    pct.anchor.set(1, 0.5);
    pct.x = -16;
    slider.addChild(track, fill, knob, pct);
    this.box.addChild(slider);

    slider.eventMode = 'static';
    slider.cursor = 'pointer';
    slider.hitArea = { contains: (x, yy) => x >= -20 && x <= SLIDER_W + 20 && yy >= -30 && yy <= 30 };

    const refresh = () => {
      const v = get();
      knob.x = v * SLIDER_W;
      fill.clear().roundRect(0, -8, Math.max(16, v * SLIDER_W), 16, 8).fill(0x2fd8ff);
      pct.text = `${Math.round(v * 100)}%`;
    };
    const setFrom = (e) => {
      const x = slider.toLocal(e.global).x;
      set(Math.min(1, Math.max(0, x / SLIDER_W)));
      refresh();
    };
    let dragging = false;
    slider.on('pointerdown', (e) => {
      dragging = true;
      setFrom(e);
    });
    slider.on('globalpointermove', (e) => dragging && setFrom(e));
    const stop = () => {
      if (dragging) onRelease?.();
      dragging = false;
    };
    slider.on('pointerup', stop);
    slider.on('pointerupoutside', stop);
    refresh();
    return { refresh };
  }

  #flash(text, color) {
    this.feedback.text = text;
    this.feedback.style.fill = color;
    gsap.killTweensOf(this.feedback);
    gsap.fromTo(this.feedback, { alpha: 1 }, { alpha: 0, duration: 0.6, delay: 1.6 });
  }
}
