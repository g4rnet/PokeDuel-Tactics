// ==========================================================
// upgrades.js — картки драфту: базові покращення + синергії
// ==========================================================
import { pickRandom } from "../utils/utils.js";
import { t } from "../i18n/i18n.js";

export const PERFECT_GUARD_THRESHOLD = 30; // Поріг шкоди в ENEMY PLANS для спрацьовування Perfect Guard

export const CATEGORIES = {
  offense: {
    get label() {
      return t("cat.offense");
    },
    css: "cat-offense",
  },
  defense: {
    get label() {
      return t("cat.defense");
    },
    css: "cat-defense",
  },
  tactics: {
    get label() {
      return t("cat.tactics");
    },
    css: "cat-tactics",
  },
};

const hasType = (h, ...types) => h.attacks.some((a) => types.includes(a.type));

/**
 * Структура картки:
 *  category   — offense | defense | tactics (для групування на екрані драфту)
 *  unique     — унікальна синергія (надається один раз за забіг)
 *  requires   — (hero) => bool: умова відображення картки лише при користі для бійця
 *  apply      — (hero, ctx) => void, ctx = { talents }
 */
export const UPGRADE_POOL = [
  // Базові картки
  {
    id: "heal",
    icon: "🍓",
    get title() {
      return t("card.heal.title");
    },
    category: "defense",
    unlockedAtWave: 1,
    desc: (h) => t("card.heal.desc", { n: h.maxHP }),
    apply: (h, ctx) => {
      h.heal(h.maxHP);
      if (ctx?.talents?.survival >= 3) h.clearStatuses();
    },
  },
  {
    id: "maxhp",
    icon: "❤️",
    get title() {
      return t("card.maxhp.title");
    },
    category: "defense",
    unlockedAtWave: 1,
    desc: (h) => t("card.maxhp.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => h.increaseMaxHP(30),
  },
  {
    id: "crit",
    icon: "💥",
    get title() {
      return t("card.crit.title");
    },
    category: "offense",
    unlockedAtWave: 2,
    desc: (h) => t("card.crit.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.critBonus += 12;
    },
  },
  {
    id: "accuracy",
    icon: "🎯",
    get title() {
      return t("card.accuracy.title");
    },
    category: "tactics",
    unlockedAtWave: 2,
    desc: (h) => t("card.accuracy.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.accuracyBonus += 10;
    },
  },
  {
    id: "endurance",
    icon: "🔋",
    get title() {
      return t("card.endurance.title");
    },
    category: "tactics",
    unlockedAtWave: 3,
    desc: (h) => t("card.endurance.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => h.attacks.forEach((a) => a.increaseMaxUses(3)),
  },
  {
    id: "vampirism",
    icon: "🦇",
    get title() {
      return t("card.vampirism.title");
    },
    category: "defense",
    unlockedAtWave: 4,
    desc: (h) => t("card.vampirism.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.vampirism += 0.15;
    },
  },
  {
    id: "overclock",
    icon: "⚡",
    get title() {
      return t("card.overclock.title");
    },
    category: "tactics",
    unlockedAtWave: 5,
    desc: (h) => t("card.overclock.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.startCharge = Math.min(100, h.startCharge + 25);
    },
  },

  // Картки синергій
  {
    id: "overload",
    icon: "🌩️",
    get title() {
      return t("card.overload.title");
    },
    category: "tactics",
    unique: true,
    unlockedAtWave: 2,
    desc: (h) => t("card.overload.desc", { n: PERFECT_GUARD_THRESHOLD }),
    requires: (h) => hasType(h, "electric") && hasType(h, "water"),
    apply: (h) => {
      h.flags.overload = true;
    },
  },
  {
    id: "shatter",
    icon: "🪨",
    get title() {
      return t("card.shatter.title");
    },
    category: "offense",
    unique: true,
    unlockedAtWave: 3,
    desc: (h) => t("card.shatter.desc", { n: PERFECT_GUARD_THRESHOLD }),
    requires: (h) => hasType(h, "rock", "ground"),
    apply: (h) => {
      h.flags.shatter = true;
    },
  },
  {
    id: "perfectGuard",
    icon: "✨",
    get title() {
      return t("card.perfectGuard.title");
    },
    category: "defense",
    unique: true,
    unlockedAtWave: 2,
    desc: (h) => t("card.perfectGuard.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.flags.perfectGuard = true;
    },
  },
  {
    id: "desperate",
    icon: "🔥",
    get title() {
      return t("card.desperate.title");
    },
    category: "offense",
    unique: true,
    unlockedAtWave: 2,
    desc: (h) => t("card.desperate.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.flags.desperate = true;
    },
  },
  {
    id: "venom",
    icon: "☠️",
    get title() {
      return t("card.venom.title");
    },
    category: "tactics",
    unique: true,
    unlockedAtWave: 3,
    desc: (h) => t("card.venom.desc", { n: PERFECT_GUARD_THRESHOLD }),
    requires: (h) => h.attacks.some((a) => a.damageClass === "physical"),
    apply: (h) => {
      h.flags.venom = true;
      h.accuracyBonus -= 5;
    },
  },
  {
    id: "glassCannon",
    icon: "💎",
    get title() {
      return t("card.glassCannon.title");
    },
    category: "offense",
    unique: true,
    unlockedAtWave: 3,
    desc: (h) => t("card.glassCannon.desc", { n: PERFECT_GUARD_THRESHOLD }),
    apply: (h) => {
      h.flags.glassCannon = true;
      h.damageMultiplier *= 1.35;
      h.maxHP = Math.max(1, Math.round(h.maxHP * 0.8));
      h.hp = Math.min(h.hp, h.maxHP);
      h.renderHP();
    },
  },
];

// Перевірити доступність картки з урахуванням раунду, унікальності та умов героя
export function isEligible(card, hero, wave) {
  if (card.unlockedAtWave > wave) return false;
  if (card.unique && hero.hasCard(card.id)) return false;
  if (card.requires && !card.requires(hero)) return false;
  return true;
}

// Згенерувати набір карток для драфту з обов'язковим різноманіттям категорій
export function rollDraft(count, wave, hero) {
  const eligible = UPGRADE_POOL.filter((c) => isEligible(c, hero, wave));
  const cats = pickRandom(Object.keys(CATEGORIES), count);
  const chosen = [];
  cats.forEach((cat) => {
    const options = eligible.filter(
      (c) => c.category === cat && !chosen.includes(c),
    );
    if (options.length) chosen.push(pickRandom(options, 1)[0]);
  });
  if (chosen.length < count) {
    const rest = eligible.filter((c) => !chosen.includes(c));
    chosen.push(...pickRandom(rest, count - chosen.length));
  }
  return chosen;
}
