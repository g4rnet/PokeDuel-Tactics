// ==========================================================
// Pokemon.js — універсальний клас бійця (герой та вороги)
// ==========================================================
import { chance, random, sleep } from "../utils/utils.js";
import { Attack } from "./Attack.js";
import { getTypeMultiplier } from "./typeChart.js";
import { t, typeName } from "../i18n/i18n.js";

export const MAX_CHARGE = 100; // Повна шкала суператаки
export const CRIT_MULTIPLIER = 1.5; // Базовий множник критичного удару

// Періодична шкода: частка від макс. HP за хід та тривалість у ходах
export const STATUS_INFO = {
  poison: {
    icon: "☠️",
    get label() {
      return t("status.poison");
    },
    rate: 0.06,
    turns: 4,
  },
  burn: {
    icon: "🔥",
    get label() {
      return t("status.burn");
    },
    rate: 0.05,
    turns: 3,
  },
};

export const AURAS = {
  "fire-coat": {
    icon: "🔥",
    get name() {
      return t("aura.fire-coat.name");
    },
    get desc() {
      return t("aura.fire-coat.desc");
    },
  },
  "thick-hide": {
    icon: "🪨",
    get name() {
      return t("aura.thick-hide.name");
    },
    get desc() {
      return t("aura.thick-hide.desc");
    },
  },
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class Pokemon {
  constructor({
    name,
    types,
    level = 1,
    maxHP = 100,
    spriteUrl,
    stats,
    attacks,
    root,
    damageMultiplier = 1,
    aura = null,
    isBoss = false,
  }) {
    this.name = name;
    this.types = types;
    this.stats = stats;
    this.level = level;
    this.maxHP = maxHP;
    this.hp = maxHP;
    this.attacks = attacks;
    this.aura = aura; // 'fire-coat' | 'thick-hide' | null
    this.isBoss = isBoss;
    this.phase = 1;

    // Бонуси (змінюються під дією посилень, талантів або предметів)
    this.damageMultiplier = damageMultiplier;
    this.critBonus = 0;
    this.critDamageBonus = 0; // Талант Offense: збільшити силу крита
    this.accuracyBonus = 0;
    this.lowAccuracyBonus = 0; // Талант Offense 3: бонус для атак із точністю < 85%
    this.vampirism = 0;
    this.startCharge = 0;
    this.charge = 0;
    this.isGuarding = false;
    this.perfectGuardArmed = false;
    this.dotReduction = 0; // Талант Survival 2: зменшити шкоду від статусів на 50%

    // Предмети та таланти (ініціалізуються з game.js)
    this.firstMoveBonus = 0; // Choice Scarf: +0.25 до першої атаки
    this.firstMovePPCost = 1; // Choice Scarf: витрата PP
    this.restorePPOnSuper = false; // Талант Offense 2
    this.innatePoison = 0; // Пасивна здатність стартовика (Gastly)
    this.physicalBonus = 0; // Пасивна здатність стартовика (Heracross)

    // Синергетичні карти: id -> true
    this.flags = {};
    this.passives = []; // Обрані карти (для відображення іконок та кодексу)

    // Бойовий стан
    this.statuses = {}; // { poison: залишок_ходів, burn: ... }
    this.lastMoveType = null;
    this.firstMoveUsed = false;
    this.superUsed = false;

    // Резервна атака на випадок вичерпання решти варіантів
    this.struggle = new Attack({
      name: t("struggle"),
      minDamage: 3,
      maxDamage: 5,
      maxPP: Infinity,
      type: "normal",
      maxUses: Infinity,
      accuracy: 100,
      critChance: 0,
      chargeGain: 0,
    });

    // Кешувати DOM-елементи картки для оптимізації рендерингу
    this.dom = {
      root,
      lvl: root.querySelector(".lvl"),
      sprite: root.querySelector(".sprite"),
      name: root.querySelector(".name"),
      hp: root.querySelector(".hp .text"),
      bar: root.querySelector(".health"),
      charge: root.querySelector(".charge-fill"),
      typeTag: root.querySelector(".type-tag"),
      auraTag: root.querySelector(".aura-tag"),
      statusTag: root.querySelector(".status-tag"),
      passives: root.querySelector(".passives"),
    };

    this.dom.root.classList.remove(
      "fainted",
      "hit-animation",
      "miss-animation",
    );
    this.dom.sprite.src = spriteUrl;
    this.dom.sprite.alt = name;
    this.dom.name.textContent = isBoss ? `👑 ${name}` : name;
    if (this.dom.typeTag)
      this.dom.typeTag.textContent = types.map(typeName).join(" / ");
    if (this.dom.auraTag) {
      const a = AURAS[aura];
      this.dom.auraTag.textContent = a ? `${a.icon} ${a.name}` : "";
      this.dom.auraTag.title = a ? a.desc : "";
    }
    this.render();
  }

  get isFainted() {
    return this.hp <= 0;
  }

  // Оновити весь інтерфейс картки бійця
  render() {
    this.renderLevel();
    this.renderHP();
    this.renderCharge();
    this.renderStatuses();
    this.renderPassives();
  }

  renderLevel() {
    this.dom.lvl.textContent = t("hud.lvl", { n: this.level });
  }

  renderHP() {
    this.dom.hp.textContent = `${this.hp} / ${this.maxHP}`;
    const percent = (this.hp / this.maxHP) * 100;
    this.dom.bar.style.width = `${percent}%`;
    this.dom.bar.classList.remove("low", "critical");
    if (percent < 20) this.dom.bar.classList.add("critical");
    else if (percent < 60) this.dom.bar.classList.add("low");
  }

  renderCharge() {
    if (!this.dom.charge) return;
    this.dom.charge.style.width = `${(this.charge / MAX_CHARGE) * 100}%`;
    this.dom.charge.classList.toggle("ready", this.charge >= MAX_CHARGE);
  }

  renderStatuses() {
    if (!this.dom.statusTag) return;
    this.dom.statusTag.textContent = Object.entries(this.statuses)
      .map(
        ([k, turns]) =>
          `${STATUS_INFO[k].icon} ${STATUS_INFO[k].label} (${turns})`,
      )
      .join("  ");
  }

  // Відобразити іконки активних пасивних карт під шкалою HP
  renderPassives() {
    if (!this.dom.passives) return;
    this.dom.passives.innerHTML = "";
    this.passives.forEach((card) => {
      const el = document.createElement("span");
      el.className = "passive-icon";
      el.textContent = card.icon;
      el.title = `${card.title}: ${typeof card.desc === "function" ? card.desc(this) : card.desc}`;
      this.dom.passives.appendChild(el);
    });
  }

  // Застосувати отриману шкоду та відтворити анімацію удару чи втрати свідомості
  async takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.renderHP();
    this.dom.root.classList.add("hit-animation");
    if (this.isFainted) this.dom.root.classList.add("fainted");
    await sleep(350);
    this.dom.root.classList.remove("hit-animation");
    return this.isFainted;
  }

  // Відтворити візуальну анімацію ухилення від атаки
  async dodge() {
    this.dom.root.classList.add("miss-animation");
    await sleep(350);
    this.dom.root.classList.remove("miss-animation");
  }

  heal(amount) {
    this.hp = Math.min(this.maxHP, this.hp + amount);
    this.renderHP();
  }

  increaseMaxHP(amount) {
    this.maxHP += amount;
    this.heal(amount);
  }

  levelUp() {
    this.level++;
    this.renderLevel();
  }

  addCharge(amount) {
    this.charge = Math.min(MAX_CHARGE, this.charge + amount);
    this.renderCharge();
  }

  hasCard(id) {
    return Boolean(this.flags[id]);
  }

  addPassive(card) {
    this.passives.push(card);
    this.renderPassives();
  }

  applyStatus(name) {
    this.statuses[name] = STATUS_INFO[name].turns; // Повторне накладення оновлює тривалість ефекту
    this.renderStatuses();
  }

  clearStatuses() {
    this.statuses = {};
    this.renderStatuses();
  }

  // Опрацювати періодичну шкоду від статусів наприкінці ходу
  async tickStatuses() {
    const names = Object.keys(this.statuses);
    if (names.length === 0) return { damage: 0, names };
    let total = 0;
    names.forEach((name) => {
      total += Math.max(
        1,
        Math.round(
          this.maxHP * STATUS_INFO[name].rate * (1 - this.dotReduction),
        ),
      );
      this.statuses[name]--;
      if (this.statuses[name] <= 0) delete this.statuses[name];
    });
    this.renderStatuses();
    await this.takeDamage(total);
    return { damage: total, names };
  }

  // Підготувати бійця до нового раунду (зберегти HP, скинути тимчасові стани)
  resetForBattle() {
    this.attacks.forEach((a) => a.resetForBattle());
    this.charge = this.startCharge;
    this.isGuarding = false;
    this.perfectGuardArmed = false;
    this.statuses = {};
    this.lastMoveType = null;
    this.firstMoveUsed = false;
    this.superUsed = false;
    this.dom.root.classList.remove(
      "fainted",
      "hit-animation",
      "miss-animation",
    );
    this.render();
  }

  // Повністю скинути параметри бійця для нового забігу
  reset() {
    this.hp = this.maxHP;
    this.resetForBattle();
  }

  // Дозволити використання суператаки лише при заповненій шкалі
  canUse(attack) {
    return attack.isAvailable() && (!attack.isUlt || this.charge >= MAX_CHARGE);
  }

  getAvailableAttacks() {
    return this.attacks.filter((a) => this.canUse(a));
  }

  tickCooldowns() {
    this.attacks.forEach((a) => a.tickCooldown());
  }

  // Розрахувати реальну точність атаки з урахуванням модифікаторів
  getEffectiveAccuracy(attack) {
    const lowBonus = attack.accuracy < 85 ? this.lowAccuracyBonus : 0;
    return clamp(attack.accuracy + this.accuracyBonus + lowBonus, 1, 100);
  }

  // Виконати повноцінну атаку по цілі з розрахунком точності, ефективності типів та критичного удару
  async useAttack(attack, defender) {
    const isLastPP = attack.currentPP === 1; // Перевірити наявність єдиного заряду PP для таланту Desperate Power
    const prevType = this.lastMoveType;
    const useScarf = this.firstMoveBonus > 0 && !this.firstMoveUsed;

    attack.use(useScarf ? this.firstMovePPCost : 1);
    this.firstMoveUsed = true;
    this.lastMoveType = attack.type;
    if (attack.isUlt) this.charge = 0; // Суператака повністю обнуляє шкалу заряду
    this.renderCharge();

    const result = {
      attacker: this,
      defender,
      attack,
      missed: false,
      crit: false,
      effectiveness: 1,
      damage: 0,
      notes: [], // Додаткові нотатки для логу бою
    };

    // Перевірити влучання атаки за її ефективною точністю
    const accuracy = this.getEffectiveAccuracy(attack);
    result.accuracy = accuracy;
    if (!chance(accuracy / 100)) {
      result.missed = true;
      await defender.dodge();
      return result;
    }

    // Визначити множник типу згідно з даними PokeAPI (0 — імунітет, 4 — подвійна перевага)
    result.effectiveness = getTypeMultiplier(attack.type, defender.types);
    if (result.effectiveness === 0) {
      await defender.dodge();
      return result;
    }

    // Розрахувати базову шкоду на основі співвідношення характеристик і типів
    const [atkKey, defKey] =
      attack.damageClass === "special"
        ? ["specialAttack", "specialDefense"]
        : ["attack", "defense"];
    const statRatio = clamp(
      this.stats[atkKey] / defender.stats[defKey],
      0.7,
      1.4,
    );
    const base = random(attack.minDamage, attack.maxDamage);

    // Визначити наявність крита (Overload гарантує крит; Thick Hide повністю блокує)
    const overload =
      this.flags.overload && attack.type === "electric" && prevType === "water";
    let crit = overload || chance((attack.critChance + this.critBonus) / 100);
    if (crit && defender.aura === "thick-hide") {
      crit = false;
      result.notes.push(t("note.thickHide"));
    } else if (overload) {
      result.notes.push(t("note.overload"));
    }
    result.crit = crit;

    let finalDamage =
      base *
      statRatio *
      result.effectiveness *
      (crit ? CRIT_MULTIPLIER * (1 + this.critDamageBonus) : 1) *
      this.damageMultiplier;

    if (this.flags.desperate && isLastPP) {
      finalDamage *= 1.5;
      result.notes.push(t("note.desperate"));
    }
    if (
      this.flags.shatter &&
      (attack.type === "rock" || attack.type === "ground")
    ) {
      if (defender.isGuarding) {
        finalDamage *= 1.4;
        result.notes.push(t("note.shatter"));
      } else {
        finalDamage *= 0.9;
      }
    }
    if (useScarf) {
      finalDamage *= 1 + this.firstMoveBonus;
      result.notes.push(t("note.scarf"));
    }
    if (this.physicalBonus && attack.damageClass === "physical") {
      finalDamage *= 1 + this.physicalBonus;
    }

    // Застосувати захисну стійку цілі для зменшення отриманої шкоди
    let reflected = 0;
    if (defender.isGuarding) {
      if (defender.perfectGuardArmed) {
        reflected = Math.round(finalDamage * 0.25); // Perfect Guard: відбити частину шкоди назад
      }
      finalDamage *= 0.45;
      defender.isGuarding = false;
      defender.perfectGuardArmed = false;
      result.guarded = true;
    }
    result.damage = Math.max(1, Math.round(finalDamage));

    // Накопичити енергію суператаки та перевірити талант відновлення PP
    this.addCharge(attack.chargeGain);
    if (this.restorePPOnSuper && result.effectiveness > 1 && !this.superUsed) {
      this.superUsed = true;
      if (attack.currentPP < attack.maxPP) {
        attack.currentPP++;
        result.notes.push(t("note.talentPP", { m: attack.name }));
      }
    }

    await defender.takeDamage(result.damage);

    // Застосувати ефекти вампіризму, отрути та відбиття шкоди після влучання
    if (this.vampirism > 0) {
      const healed = Math.round(result.damage * this.vampirism);
      if (healed > 0) this.heal(healed);
    }

    const poisonChance = Math.max(
      this.flags.venom && attack.damageClass === "physical" ? 0.2 : 0,
      this.innatePoison,
    );
    if (poisonChance > 0 && !defender.isFainted && chance(poisonChance)) {
      defender.applyStatus("poison");
      result.notes.push(t("note.poisoned", { d: defender.name }));
    }

    if (defender.aura === "fire-coat" && attack.damageClass === "physical") {
      this.applyStatus("burn");
      result.notes.push(t("note.burned", { a: this.name }));
    }

    if (reflected > 0) {
      result.notes.push(t("note.reflect", { n: reflected }));
      await this.takeDamage(reflected);
    }
    return result;
  }
}
