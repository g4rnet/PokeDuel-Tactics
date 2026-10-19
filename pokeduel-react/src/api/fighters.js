// ==========================================================
// fighters.js — збирає бійців (Pokemon + Attack) з даних PokeAPI
// ==========================================================
import { fetchPokemon, fetchMove } from "./api.js";
import { loadTypeRelations } from "../core/typeChart.js";
import { Attack } from "../core/Attack.js";
import { t } from "../i18n/i18n.js";

// Форматувати ідентифікатор у читабельний рядок
export const prettify = (slug) =>
  slug
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

// Виключити нестандартні рухи для збереження логіки покрокового бою
const EXCLUDED_MOVES = new Set([
  "explosion",
  "self-destruct",
  "hyper-beam",
  "giga-impact",
  "solar-beam",
  "solar-blade",
  "skull-bash",
  "sky-attack",
  "razor-wind",
  "fly",
  "dig",
  "bounce",
  "dive",
  "focus-punch",
  "last-resort",
  "dream-eater",
  "fling",
  "future-sight",
  "doom-desire",
  "counter",
  "mirror-coat",
  "bide",
  "metal-burst",
  "sucker-punch",
  "belch",
  "synchronoise",
  "spit-up",
  "struggle",
  "fake-out",
  "first-impression",
  "steel-beam",
  "mind-blown",
  "shadow-force",
  "phantom-force",
  "freeze-shock",
  "ice-burn",
  "geomancy",
  "meteor-beam",
  "electro-shot",
]);

// Перевірити придатність рухів за наявністю шкоди та відсутністю статусних ефектів
const isUsableMove = (move) =>
  move.power > 0 &&
  move.damage_class.name !== "status" &&
  !EXCLUDED_MOVES.has(move.name);

// Визначити параметри слотів атак для забезпечення збалансованої кривої сили
const SLOTS = [
  { cooldownTurns: 0, ppCap: 99, chargeGain: 12, power: [0.18, 0.28] },
  { cooldownTurns: 1, ppCap: 8, chargeGain: 20, power: [0.18, 0.28] },
  { cooldownTurns: 2, ppCap: 4, chargeGain: 25, power: [0.18, 0.28] },
  { cooldownTurns: 3, ppCap: 2, chargeGain: 25, power: [0.18, 0.28] },
  {
    cooldownTurns: 0,
    ppCap: 1,
    chargeGain: 0,
    power: [0.32, 0.42],
    isUlt: true,
  },
];

// Завантажити деталі рухів пакетно для оптимізації мережевих запитів
async function loadUsableMoves(pokemonData, needed = 8) {
  const allNames = pokemonData.moves.map((m) => m.move.name);
  const sampleCount = Math.min(40, allNames.length);
  const names =
    sampleCount === allNames.length || sampleCount <= 1
      ? allNames
      : Array.from(
          { length: sampleCount },
          (_, i) =>
            allNames[
              Math.round((i * (allNames.length - 1)) / (sampleCount - 1))
            ],
        );
  const usable = [];
  for (let i = 0; i < names.length && usable.length < needed; i += 10) {
    const batch = await Promise.all(names.slice(i, i + 10).map(fetchMove));
    usable.push(...batch.filter(isUsableMove));
  }
  return usable;
}

// Підібрати атаки з урахуванням точності та STAB-бонусу для прогнозованої бойової сили
function pickByPower(moves, pokemonTypes) {
  const unique = [...new Map(moves.map((move) => [move.name, move])).values()];
  const scored = unique
    .filter(
      (move) =>
        move.power >= 25 && (move.accuracy == null || move.accuracy >= 70),
    )
    .map((move) => ({
      move,
      score:
        move.power *
        (move.accuracy == null ? 1 : move.accuracy / 100) *
        (pokemonTypes.includes(move.type.name) ? 1.18 : 1),
    }))
    .sort((a, b) => a.score - b.score);

  if (scored.length < 5) {
    const fallback = [...unique].sort((a, b) => a.power - b.power);
    while (fallback.length < 5 && unique.length)
      fallback.push(unique[fallback.length % unique.length]);
    return [0, 0.25, 0.5, 0.75, 1].map(
      (q) =>
        fallback[
          Math.min(fallback.length - 1, Math.round(q * (fallback.length - 1)))
        ],
    );
  }

  // Вибрати атаки різної потужності для створення збалансованого набору
  const chosen = [0, 0.25, 0.5, 0.75, 1].map(
    (q) => scored[Math.round(q * (scored.length - 1))].move,
  );
  return chosen;
}

// Створити екземпляр атаки на основі конфігурації слота
function buildAttack(move, slot, maxUses) {
  const [lo, hi] = slot.power;
  return new Attack({
    name: prettify(move.name),
    minDamage: Math.max(1, Math.round(move.power * lo)),
    maxDamage: Math.max(2, Math.round(move.power * hi)),
    maxPP: Math.min(move.pp ?? slot.ppCap, slot.ppCap),
    cooldownTurns: slot.cooldownTurns,
    type: move.type.name,
    damageClass: move.damage_class.name,
    accuracy: move.accuracy ?? 100,
    critChance: 10 + (move.meta?.crit_rate ?? 0) * 10,
    chargeGain: slot.chargeGain,
    isUlt: Boolean(slot.isUlt),
    maxUses,
  });
}

// Завантажити повний набір даних бійця з PokeAPI
export async function loadFighter(idOrName, maxUses) {
  const data = await fetchPokemon(idOrName);

  const moves = await loadUsableMoves(data);
  if (moves.length < 5) throw new Error(t("err.noMoves", { name: data.name }));
  const types = data.types.map((t) => t.type.name);
  const attacks = pickByPower(moves, types).map((move, i) =>
    buildAttack(move, SLOTS[i], maxUses),
  );

  // Завантажити таблицю ефективності для коректного розрахунку шкоди типів
  await loadTypeRelations([...types, ...attacks.map((a) => a.type)]);

  const stat = (name) => data.stats.find((s) => s.stat.name === name).base_stat;

  return {
    name: prettify(data.name),
    types,
    spriteUrl:
      data.sprites.other?.["official-artwork"]?.front_default ||
      data.sprites.front_default,
    stats: {
      hp: stat("hp"),
      attack: stat("attack"),
      defense: stat("defense"),
      specialAttack: stat("special-attack"),
      specialDefense: stat("special-defense"),
      speed: stat("speed"),
    },
    attacks,
  };
}
