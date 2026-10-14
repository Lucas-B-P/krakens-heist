const STORAGE_KEY = 'krakens-heist:balance';

export class Wallet {
  #balance;
  #listeners = new Set();

  constructor(initialBalance) {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    this.#balance = Number.isFinite(saved) && saved > 0 ? saved : initialBalance;
  }

  get balance() {
    return this.#balance;
  }

  onChange(fn) {
    this.#listeners.add(fn);
    fn(this.#balance);
  }

  debit(amount) {
    if (amount <= 0 || amount > this.#balance + 1e-9) return false;
    this.#set(this.#balance - amount);
    return true;
  }

  credit(amount) {
    if (amount > 0) this.#set(this.#balance + amount);
  }

  #set(value) {
    this.#balance = Math.round(value * 100) / 100;
    localStorage.setItem(STORAGE_KEY, String(this.#balance));
    this.#listeners.forEach((fn) => fn(this.#balance));
  }
}
