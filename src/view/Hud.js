import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { fmt, goldStyle, plainStyle } from '../util/fx.js';
import { Button, SpinButton } from './Button.js';
import { DESIGN_W, HUD_Y } from './layout.js';

export class Hud extends Container {
  constructor({ onSpin, onBet, onAuto, onTurbo }) {
    super();
    const barH = 1080 - HUD_Y;

    const fill = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: '#06314a' },
        { offset: 1, color: '#010b12' },
      ],
      textureSpace: 'local',
    });
    this.bar = new Graphics()
      .rect(-400, HUD_Y, DESIGN_W + 800, barH + 200)
      .fill(fill)
      .rect(-400, HUD_Y, DESIGN_W + 800, 4)
      .fill(0xffd34d);
    this.addChild(this.bar);

    this.balance = this.#field('SALDO', 230, 44);
    this.betField = this.#field('APOSTA', 640, 44);
    this.win = this.#field('GANHO', 1035, 52);

    this.minus = new Button({ width: 62, height: 62, label: '–', fontSize: 40, onClick: () => onBet(-1) });
    this.minus.position.set(490, 1012);
    this.plus = new Button({ width: 62, height: 62, label: '+', fontSize: 40, onClick: () => onBet(1) });
    this.plus.position.set(790, 1012);

    this.auto = new Button({ width: 150, height: 64, label: 'AUTO', onClick: onAuto });
    this.auto.position.set(1410, 1008);

    this.turbo = new Button({ width: 150, height: 64, label: 'TURBO', onClick: onTurbo });
    this.turbo.position.set(1830, 1008);

    this.spin = new SpinButton({ radius: 86, onClick: onSpin });
    this.spin.position.set(1625, 985);

    this.addChild(this.minus, this.plus, this.auto, this.turbo, this.spin);
    this.winValue = 0;
  }

  #field(label, x, size) {
    const l = new Text({ text: label, style: plainStyle(22, '#8fd8ff') });
    l.anchor.set(0.5);
    l.position.set(x, HUD_Y + 34);
    const v = new Text({ text: fmt(0), style: goldStyle(size) });
    v.anchor.set(0.5);
    v.position.set(x, HUD_Y + 90);
    this.addChild(l, v);
    return v;
  }

  setBalance(value) {
    this.balance.text = fmt(value);
  }

  setBet(value) {
    this.betField.text = fmt(value);
    gsap.fromTo(this.betField.scale, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' });
  }

  setWin(value, animate = true) {
    gsap.killTweensOf(this, 'winValue');
    if (!animate || value === 0) {
      this.winValue = value;
      this.win.text = fmt(value);
      return;
    }
    gsap.to(this, {
      winValue: value,
      duration: 0.8,
      ease: 'power1.out',
      onUpdate: () => (this.win.text = fmt(this.winValue)),
    });
    gsap.fromTo(this.win.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  }

  setSpinning(on) {
    this.spin.setSpinning(on);
  }

  setAuto(count) {
    this.auto.setActive(count > 0);
    this.auto.setLabel(count > 0 ? 'PARAR' : 'AUTO');
    this.spin.setAutoCount(count);
  }

  setTurbo(on) {
    this.turbo.setActive(on);
  }

  /** Trava aposta durante giros/rodadas grátis. */
  setLocked(locked, feature = false) {
    this.minus.enabled = !locked;
    this.plus.enabled = !locked;
    this.auto.enabled = !feature;
    this.spin.enabled = !feature;
  }

  update(dt) {
    this.spin.update(dt);
  }
}
