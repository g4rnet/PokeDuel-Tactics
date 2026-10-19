// ==========================================================
// utils.js — допоміжні функції та замикання (Завдання 1)
// ==========================================================

/** Випадкове ціле число в діапазоні [min, max]. */
export const random = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Повертає true з імовірністю p (p від 0 до 1). */
export const chance = (p) => Math.random() < p;

/** Проміс-пауза: зручно для таймаутів ходів ШІ та анімацій (async/await). */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Вибирає n випадкових унікальних елементів із масиву. */
export const pickRandom = (array, n) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = random(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

/**
 * ЗАМИКАННЯ №1: лічильник кліків по кнопках гри.
 * Змінні total та perButton доступні лише всередині функції,
 * а ззовні з ними можна працювати лише через повернені методи.
 * @returns {{track: function(string): number, getTotal: function(): number, getCount: function(string): number}}
 */
export function createClickTracker() {
  let total = 0; // Загальна кількість кліків (приватний стан)
  const perButton = new Map(); // Кліки по кожній кнопці окремо

  return {
    track(label) {
      total++;
      perButton.set(label, (perButton.get(label) || 0) + 1);
      console.log(
        `[Клік #${total}] Кнопка "${label}" — натискань на неї: ${perButton.get(label)}. Загалом кліків: ${total}`,
      );
      return total;
    },
    getTotal: () => total,
    getCount: (label) => perButton.get(label) || 0,
  };
}

/**
 * ЗАМИКАННЯ №2: ліміт використань однієї кнопки (атаки) за бій.
 * Кожен виклик створює НОВИЙ ізольований стан (used, limit),
 * тому кожна атака має власний незалежний лічильник.
 * @param {number} initialLimit Максимум використань за бій (може бути Infinity)
 */
export function createUsageLimiter(initialLimit) {
  let limit = initialLimit;
  let used = 0;

  return {
    /** Спробувати витратити одне використання. false — ліміт вичерпано. */
    tryUse() {
      if (used >= limit) return false;
      used++;
      return true;
    },
    left: () => Math.max(0, limit - used),
    isExhausted: () => used >= limit,
    increaseLimit(amount) {
      limit += amount;
    },
    /** Новий бій — лічильник використань скидається. */
    reset() {
      used = 0;
    },
  };
}
