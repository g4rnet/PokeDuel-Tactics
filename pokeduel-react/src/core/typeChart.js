// ==========================================================
// typeChart.js — ефект типів з PokeAPI (/type/{name})
// ==========================================================
import { fetchType } from "../api/api.js";

// Кеш: тип атаки -> множини типів, по яких він б'є ×2 / ×0.5 / ×0
const relations = new Map();

// Завантажити таблиці ефективності для унікальних типів з бекенду (з кешуванням повторних запитів)
export async function loadTypeRelations(typeNames) {
  await Promise.all(
    [...new Set(typeNames)].map(async (name) => {
      if (relations.has(name)) return;
      const { damage_relations: r } = await fetchType(name);
      const names = (list) => new Set(list.map((t) => t.name));
      relations.set(name, {
        double: names(r.double_damage_to),
        half: names(r.half_damage_to),
        none: names(r.no_damage_to),
      });
    }),
  );
}

// Обчислити підсумковий множник шкоди атаки по захиснику з урахуванням усіх його типів
export function getTypeMultiplier(attackType, defenderTypes) {
  const rel = relations.get(attackType);
  if (!rel) return 1;
  return defenderTypes.reduce((mult, type) => {
    if (rel.none.has(type)) return mult * 0;
    if (rel.double.has(type)) return mult * 2;
    if (rel.half.has(type)) return mult * 0.5;
    return mult;
  }, 1);
}
