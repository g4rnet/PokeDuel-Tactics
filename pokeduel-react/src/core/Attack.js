// ==========================================================
// Attack.js — клас атаки (дані надходять з PokeAPI /move)
// ==========================================================
import { createUsageLimiter } from "../utils/utils.js";

export class Attack {
  /**
   * @param {object} o
   * @param {string} o.name
   * @param {number} o.minDamage
   * @param {number} o.maxDamage
   * @param {number} [o.maxPP=99]          запас PP
   * @param {number} [o.cooldownTurns=0]   кулдаун у ходах
   * @param {string} [o.type='normal']     тип атаки (з API)
   * @param {string} [o.damageClass='physical'] physical | special
   * @param {number} [o.accuracy=100]      точність, % (шанс влучити)
   * @param {number} [o.critChance=10]     шанс крита, %
   * @param {number} [o.maxUses=6]         ліміт використань за бій (замикання)
   * @param {number} [o.chargeGain=15]     скільки енергії дає успішний удар
   * @param {boolean} [o.isUlt=false]      суператака (потрібна повна шкала)
   */
  constructor({
    name,
    minDamage,
    maxDamage,
    maxPP = 99,
    cooldownTurns = 0,
    type = "normal",
    damageClass = "physical",
    accuracy = 100,
    critChance = 10,
    maxUses = 6,
    chargeGain = 15,
    isUlt = false,
  }) {
    this.name = name;
    this.minDamage = minDamage;
    this.maxDamage = maxDamage;
    this.maxPP = maxPP;
    this.currentPP = maxPP;
    this.cooldownTurns = cooldownTurns;
    this.currentCD = 0;
    this.type = type;
    this.damageClass = damageClass; // Визначити тип шкоди для вибору відповідного стата власника
    this.accuracy = accuracy;
    this.critChance = critChance;
    this.chargeGain = chargeGain;
    this.isUlt = isUlt;
    this.justUsed = false; // Запобігти передчасному зменшенню кулдауну в тому ж ходу
    this.limiter = createUsageLimiter(maxUses); // Ізолювати лічильник використань для цієї конкретної кнопки
  }

  get usesLeft() {
    return this.limiter.left();
  }

  // Перевірити наявність PP, відсутність кулдауну та невичерпаність ліміту використань
  isAvailable() {
    return (
      this.currentPP > 0 && this.currentCD === 0 && !this.limiter.isExhausted()
    );
  }

  // Списати PP, зафіксувати використання та встановити кулдаун
  use(ppCost = 1) {
    if (!this.limiter.tryUse()) return false;
    this.currentPP = Math.max(0, this.currentPP - ppCost);
    this.currentCD = this.cooldownTurns;
    this.justUsed = this.cooldownTurns > 0;
    return true;
  }

  // Зменшити значення кулдауну наприкінці ходу власника
  tickCooldown() {
    if (this.justUsed) {
      this.justUsed = false;
      return;
    }
    if (this.currentCD > 0) this.currentCD--;
  }

  increaseMaxUses(amount) {
    this.limiter.increaseLimit(amount);
  }

  // Відновити початкові значення PP, скинути кулдаун і ліміти перед початком бою
  resetForBattle() {
    this.currentPP = this.maxPP;
    this.currentCD = 0;
    this.justUsed = false;
    this.limiter.reset();
  }
}
