// ==========================================================
// meta.js — мета-прогресія: BP, список стартових покемонів, предмети, таланти тренера
// ==========================================================

import { t } from "../i18n/i18n.js";

const META_KEY = "pokeduel_meta_save_v1";

/** Список стартових покемонів. `pokeId` — ідентифікатор у PokeAPI, `passive` додає унікальний стиль кожному стартовику. */
export const STARTERS = {
  pikachu: {
    id: "pikachu",
    pokeId: 25,
    name: "Pikachu",
    cost: 0,
    get blurb() {
      return t("starter.pikachu");
    },
  },
  charmander: {
    id: "charmander",
    pokeId: 4,
    name: "Charmander",
    cost: 60,
    get blurb() {
      return t("starter.charmander");
    },
  },
  bulbasaur: {
    id: "bulbasaur",
    pokeId: 1,
    name: "Bulbasaur",
    cost: 60,
    get blurb() {
      return t("starter.bulbasaur");
    },
  },
  squirtle: {
    id: "squirtle",
    pokeId: 7,
    name: "Squirtle",
    cost: 60,
    get blurb() {
      return t("starter.squirtle");
    },
  },
  gastly: {
    id: "gastly",
    pokeId: 92,
    name: "Gastly",
    cost: 120,
    get blurb() {
      return t("starter.gastly");
    },
    passive: { poisonChance: 0.25 },
  },
  heracross: {
    id: "heracross",
    pokeId: 214,
    name: "Heracross",
    cost: 120,
    get blurb() {
      return t("starter.heracross");
    },
    passive: { physicalBonus: 0.15 },
  },
};

/** Утримувані предмети (один слот). */
export const ITEMS = {
  leftovers: {
    id: "leftovers",
    get name() {
      return t("item.leftovers.name");
    },
    cost: 30,
    get desc() {
      return t("item.leftovers.desc");
    },
  },
  scarf: {
    id: "scarf",
    get name() {
      return t("item.scarf.name");
    },
    cost: 40,
    get desc() {
      return t("item.scarf.desc");
    },
  },
  sash: {
    id: "sash",
    get name() {
      return t("item.sash.name");
    },
    cost: 50,
    get desc() {
      return t("item.sash.desc");
    },
  },
  expshare: {
    id: "expshare",
    get name() {
      return t("item.expshare.name");
    },
    cost: 40,
    get desc() {
      return t("item.expshare.desc");
    },
  },
};

/** Дерево ліцензії тренера: 3 гілки, по 3 рівні в кожній. cost[i] — ціна рівня i+1. */
export const TALENTS = {
  offense: {
    get name() {
      return t("talent.offense.name");
    },
    icon: "⚔️",
    cost: [40, 90, 160],
    get levels() {
      return [1, 2, 3].map((i) => t(`talent.offense.${i}`));
    },
  },
  survival: {
    get name() {
      return t("talent.survival.name");
    },
    icon: "🛡️",
    cost: [40, 90, 160],
    get levels() {
      return [1, 2, 3].map((i) => t(`talent.survival.${i}`));
    },
  },
  tactics: {
    get name() {
      return t("talent.tactics.name");
    },
    icon: "🎲",
    cost: [40, 90, 160],
    get levels() {
      return [1, 2, 3].map((i) => t(`talent.tactics.${i}`));
    },
  },
};

export const defaultMeta = {
  bp: 0,
  unlockedStarters: ["pikachu"],
  selectedStarter: "pikachu",
  unlockedItems: [],
  equippedItem: null,
  unlockedTalents: { offense: 0, survival: 0, tactics: 0 },
};

const freshDefault = () => ({
  ...defaultMeta,
  unlockedStarters: [...defaultMeta.unlockedStarters],
  unlockedItems: [],
  unlockedTalents: { ...defaultMeta.unlockedTalents },
});

// Завантажити мета-дані прогресії з локального сховища з обробкою застарілих форматів
export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return freshDefault();
    const saved = JSON.parse(raw);
    const base = freshDefault();
    const meta = {
      ...base,
      ...saved,
      unlockedTalents: {
        ...base.unlockedTalents,
        ...(saved.unlockedTalents || {}),
      },
    };
    // Старі збереження не містили unlockedItems: екіпірований предмет вважається купленим.
    if (!Array.isArray(saved.unlockedItems))
      meta.unlockedItems = meta.equippedItem ? [meta.equippedItem] : [];
    return meta;
  } catch (e) {
    console.error("Failed to load meta progression", e);
    return freshDefault();
  }
}

// Зберегти стан мета-прогресії у локальному сховищі
export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error("Failed to save meta progression", e);
  }
}

// Повністю очистити локальне збереження (використовується при виході з акаунта)
export function clearLocalMeta() {
  try {
    localStorage.removeItem(META_KEY);
  } catch (e) {
    console.error("Failed to clear meta progression", e);
  }
}

// Розрахувати зароблені BP за завершений забіг на основі хвиль, кліків і переможених ворогів
export function calculateEarnedBP({
  wave,
  clicks,
  kills = 0,
  won = false,
  item = null,
}) {
  let bp = wave * 12 + kills * 8 + Math.floor(clicks / 5);
  if (won) bp += 50;
  if (item === "expshare") bp = Math.round(bp * 1.2);
  return bp;
}

// Придбати нового стартового покемона за BP
export function buyStarter(meta, id) {
  const s = STARTERS[id];
  if (!s || meta.unlockedStarters.includes(id) || meta.bp < s.cost) return null;
  return {
    ...meta,
    bp: meta.bp - s.cost,
    unlockedStarters: [...meta.unlockedStarters, id],
  };
}

// Придбати новий предмет у крамниці
export function buyItem(meta, id) {
  const it = ITEMS[id];
  if (!it || meta.unlockedItems.includes(id) || meta.bp < it.cost) return null;
  return {
    ...meta,
    bp: meta.bp - it.cost,
    unlockedItems: [...meta.unlockedItems, id],
  };
}

// Підвищити рівень обраного таланти тренера за BP
export function upgradeTalent(meta, branch) {
  const t = TALENTS[branch];
  const level = meta.unlockedTalents[branch];
  if (!t || level >= t.cost.length) return null;
  const price = t.cost[level];
  if (meta.bp < price) return null;
  return {
    ...meta,
    bp: meta.bp - price,
    unlockedTalents: { ...meta.unlockedTalents, [branch]: level + 1 },
  };
}
