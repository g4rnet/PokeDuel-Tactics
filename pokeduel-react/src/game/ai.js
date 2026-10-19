// ==========================================================
// ai.js — вибір ходу ШІ: атака або Guard, ланцюжки планів
// ==========================================================
import { getTypeMultiplier } from "../core/typeChart.js";
import { t } from "../i18n/i18n.js";

// Обчислити співвідношення характеристик атаки й захисту для визначення базової сили удару
const statRatioFor = (attack, attacker, defender) => {
  const [atkKey, defKey] =
    attack.damageClass === "special"
      ? ["specialAttack", "specialDefense"]
      : ["attack", "defense"];
  return Math.min(
    1.4,
    Math.max(0.7, attacker.stats[atkKey] / defender.stats[defKey]),
  );
};

// Оцінити середню шкоду атаки для відображення в намірах противника
export function estimateDamage(attack, attacker, defender) {
  const eff = getTypeMultiplier(attack.type, defender.types);
  if (eff === 0) return 0;
  const avg = (attack.minDamage + attack.maxDamage) / 2;
  return Math.round(
    avg *
      statRatioFor(attack, attacker, defender) *
      eff *
      attacker.damageMultiplier,
  );
}

// Розрахувати пріоритет атаки на основі її ефективності, точності та можливості добити ціль
function scoreAttack(attack, attacker, defender) {
  const effectiveness = getTypeMultiplier(attack.type, defender.types);
  if (effectiveness === 0) return -1;

  const statRatio = statRatioFor(attack, attacker, defender);
  const expected =
    ((attack.minDamage + attack.maxDamage) / 2) *
    statRatio *
    effectiveness *
    (attack.accuracy / 100) *
    attacker.damageMultiplier;

  const finishBonus =
    attack.minDamage * statRatio * effectiveness >= defender.hp ? 8 : 0;
  const typeBonus = effectiveness > 1 ? 5 : 0;
  const accuracyPenalty = attack.accuracy < 80 ? 5 : 0;
  return expected + finishBonus + typeBonus - accuracyPenalty;
}

// Обрати найбільш вигідну атаку серед доступних варіантів із невеликим елементом випадковості
function chooseAttack(enemy, hero) {
  const options = enemy.getAvailableAttacks();
  if (options.length === 0) return enemy.struggle;

  const scored = options
    .map((attack) => ({ attack, score: scoreAttack(attack, enemy, hero) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return enemy.struggle;
  const topScore = scored[0].score;
  const nearBest = scored.filter((item) => item.score >= topScore * 0.78);
  return nearBest[Math.floor(Math.random() * nearBest.length)].attack;
}

// Сформувати наступну дію противника з урахуванням обмежень на повторну захисну стійку
export function chooseEnemyAction(
  enemy,
  hero,
  { wave = 1, lastKind = null } = {},
) {
  const guardChance = wave <= 5 ? 0.2 : 0.12;
  const canGuard = !enemy.isGuarding && lastKind !== "guard";
  if (canGuard && Math.random() < guardChance) return { kind: "guard" };
  const attack = chooseAttack(enemy, hero);
  return {
    kind: "attack",
    attack,
    damage: estimateDamage(attack, enemy, hero),
  };
}

// Заповнити чергу запланованих дій противника до потрібного розміру
export function fillPlan(plan, length, enemy, hero, wave) {
  while (plan.length < length) {
    const lastKind = plan.length ? plan[plan.length - 1].kind : null;
    plan.push(chooseEnemyAction(enemy, hero, { wave, lastKind }));
  }
  return plan;
}

// Сформувати текстовий опис дії для відображення в інтерфейсі
export const describeAction = (action) =>
  action.kind === "guard"
    ? t("plan.guard")
    : `${action.attack.name} (~${action.damage})`;
