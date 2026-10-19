// ==========================================================
// waves.js — стартові покемони, вороги хвиль та баланс складності
// ==========================================================
import { Pokemon, AURAS } from "../core/Pokemon.js";
import { t } from "../i18n/i18n.js";
import { loadFighter, prettify } from "../api/fighters.js";
import { fetchPokemon, POKEMON_POOL } from "../api/api.js";
import { random } from "../utils/utils.js";
import { loadTypeRelations, getTypeMultiplier } from "../core/typeChart.js";

// Список ідентифікаторів стартових покемонів у PokeAPI
export const STARTER_IDS = [1, 4, 7, 25];

// Централізувати конфігурацію балансу для спрощення налаштування складності
export const DIFFICULTY = {
  heroHP: { base: 100, perBaseStat: 1.8 },
  heroDamageMultiplier: 1.25,
  enemyHP: { base: 60, perBaseStat: 1.3, scale: 0.72, perWave: 0.08 },
  enemyDamage: { start: 0.68, perWave: 0.035 },
  enemyChargeFactor: 0.6,
  postWaveHealPercent: 0.35,
  boss: { hpFactor: 1.5, damageFactor: 1.1, phase2Damage: 1.25 },
};

// Завантажити інформацію про доступних стартових покемонів для екрана вибору
export async function loadStarterOptions() {
  const list = await Promise.all(STARTER_IDS.map((id) => fetchPokemon(id)));
  return list.map((data) => ({
    id: data.id,
    name: prettify(data.name),
    types: data.types.map((t) => t.type.name),
    spriteUrl:
      data.sprites.other?.["official-artwork"]?.front_default ||
      data.sprites.front_default,
  }));
}

// Створити екземпляр бійця гравця з обмеженням на 6 використань кожної атаки
export async function createHero(root, starterId) {
  const data = await loadFighter(starterId, 6);
  const { base, perBaseStat } = DIFFICULTY.heroHP;
  return new Pokemon({
    ...data,
    root,
    level: 1,
    maxHP: Math.round(base + data.stats.hp * perBaseStat),
    damageMultiplier: DIFFICULTY.heroDamageMultiplier,
  });
}

export const isBossWave = (wave) => wave >= 15 && wave % 5 === 0;

export const planLengthForWave = (wave) => (wave >= 11 ? 2 : 1);

const AURA_IDS = Object.keys(AURAS);

// Підібрати параметри наступного противника без створення DOM-елементів для забезпечення роботи механіки розвідки
export async function rollEnemy(
  wave,
  { previousName = "", heroId = 0, heroAttacks = [], heroTypes = [] } = {},
) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const id = random(POKEMON_POOL.min, POKEMON_POOL.max);
    if (id === heroId) continue;
    try {
      const data = await loadFighter(id, Infinity);
      if (data.name === previousName) continue;

      const allTypes = [
        ...new Set([
          ...heroTypes,
          ...data.types,
          ...data.attacks.map((a) => a.type),
        ]),
      ];
      await loadTypeRelations(allTypes);

      // Запобігти утворенню тупикових ситуацій через повну нездійсненність атак гравця
      if (heroAttacks.length > 0) {
        const hasValidAttack = heroAttacks.some(
          (attack) => getTypeMultiplier(attack.type, data.types) > 0,
        );
        if (!hasValidAttack) continue;
      }

      data.attacks.forEach((a) => {
        a.chargeGain = Math.round(a.chargeGain * DIFFICULTY.enemyChargeFactor);
      });

      data.aura = wave >= 6 ? AURA_IDS[random(0, AURA_IDS.length - 1)] : null;
      data.isBoss = isBossWave(wave);
      return data;
    } catch (error) {
      console.warn(
        "Не вдалося зібрати ворога, пробуємо іншого:",
        error.message,
      );
    }
  }
  throw new Error(t("err.noEnemy"));
}

// Ініціалізувати екземпляр ворога та розрахувати його характеристики згідно з поточною хвилею
export function buildEnemy(data, wave, root) {
  const { base, perBaseStat, scale, perWave } = DIFFICULTY.enemyHP;
  const bossHP = data.isBoss ? DIFFICULTY.boss.hpFactor : 1;
  const bossDmg = data.isBoss ? DIFFICULTY.boss.damageFactor : 1;
  return new Pokemon({
    ...data,
    root,
    level: wave,
    maxHP: Math.round(
      (base + data.stats.hp * perBaseStat) *
        scale *
        (1 + perWave * (wave - 1)) *
        bossHP,
    ),
    damageMultiplier:
      (DIFFICULTY.enemyDamage.start +
        DIFFICULTY.enemyDamage.perWave * (wave - 1)) *
      bossDmg,
  });
}

export async function createEnemy(wave, root, opts) {
  return buildEnemy(await rollEnemy(wave, opts), wave, root);
}
