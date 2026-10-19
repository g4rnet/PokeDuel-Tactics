// ==========================================================
// ui.js — вся робота з DOM: кнопки, лог, оверлей, HUD
// ==========================================================
import { MAX_CHARGE } from "../core/Pokemon.js";
import { getTypeMultiplier } from "../core/typeChart.js";
import { t, typeName } from "../i18n/i18n.js";

const $ = (id) => document.getElementById(id);

// Кольори 18 типів PokeAPI; іконка — кольоровий значок потрібного типу
const TYPE_COLORS = {
  normal: "#a8a77a",
  fire: "#ef4444",
  water: "#3b82f6",
  electric: "#eab308",
  grass: "#22c55e",
  ice: "#67e8f9",
  fighting: "#c2410c",
  poison: "#a855f7",
  ground: "#d4a64a",
  flying: "#818cf8",
  psychic: "#ec4899",
  bug: "#84cc16",
  rock: "#a16207",
  ghost: "#6d28d9",
  dragon: "#4f46e5",
  dark: "#475569",
  steel: "#94a3b8",
  fairy: "#f9a8d4",
};

export const typeIcon = (type) =>
  `<svg class="log-icon" viewBox="0 0 24 24" fill="${TYPE_COLORS[type] || "#64748b"}"><title>${typeName(type)}</title><circle cx="12" cy="12" r="9"/></svg>`;

export function setTurn(text, color) {
  $("turn-indicator").innerText = text;
  $("turn-indicator").style.borderColor = color;
}

export const renderWave = (wave) => {
  $("wave-badge").textContent = t("hud.wave", { n: wave });
};
export const renderClicks = (total) => {
  $("click-counter").textContent = t("hud.clicks", { n: total });
};
export const clearLogs = () => {
  $("logs").innerHTML = "";
};

// Додати повідомлення на початок логу
export function logMessage(html) {
  const $p = document.createElement("p");
  $p.innerHTML = html;
  $("logs").insertBefore($p, $("logs").firstChild);
  while ($("logs").children.length > 80) $("logs").lastElementChild.remove();
}

// Відформатувати результат атаки з урахуванням промаху, крита та ефективності
export function logAttack(result) {
  const {
    attacker,
    defender,
    attack,
    missed,
    crit,
    effectiveness,
    damage,
    guarded,
    accuracy,
  } = result;
  const icon = typeIcon(attack.type);

  if (effectiveness === 0) {
    logMessage(
      `${icon} <span>${t("log.immune", { a: attacker.name, m: attack.name, d: defender.name })}</span>`,
    );
    return;
  }

  if (missed) {
    logMessage(
      `${icon} <span>${t("log.miss", { a: attacker.name, m: attack.name, acc: accuracy ?? attack.accuracy })}</span>`,
    );
    return;
  }

  const tags = [];
  if (guarded)
    tags.push(`<b style="color:#0284c7">${t("log.tag.guarded")}</b>`);
  if (crit) tags.push(`<b style="color:#d97706">${t("log.tag.crit")}</b>`);
  if (effectiveness > 1)
    tags.push(`<b style="color:#16a34a">${t("log.tag.super")}</b>`);
  if (effectiveness > 0 && effectiveness < 1)
    tags.push(`<b style="color:#64748b">${t("log.tag.weak")}</b>`);
  if (attack.isUlt)
    tags.push(`<b style="color:#7c3aed">${t("log.tag.ult")}</b>`);

  logMessage(
    `${icon} <span>${t("log.hit", { a: attacker.name, m: attack.name, d: defender.name, dmg: damage, hp: defender.hp, max: defender.maxHP })} ${tags.join(" ")}</span>`,
  );
  (result.notes || []).forEach((note) =>
    logMessage(`<span class="log-note">${note}</span>`),
  );
}

// Перемалювати кнопки атак героя з урахуванням PP, кулдаунів та заряду ульти
export function renderControls(hero, canAct, onAttack, onGuard, enemy = null) {
  const $box = $("control-buttons");
  $box.innerHTML = "";

  const guard = document.createElement("button");
  guard.type = "button";
  guard.className = "button-guard";
  guard.textContent = t("ctl.guard");
  guard.disabled = !canAct || hero.isGuarding;
  guard.addEventListener("click", onGuard);
  $box.appendChild(guard);

  hero.attacks.forEach((attack) => {
    const $btn = document.createElement("button");
    $btn.type = "button";
    $btn.className = "button-attack" + (attack.isUlt ? " ult" : "");

    const status =
      attack.currentCD > 0
        ? `<span class="badge-cd">${t("ctl.cd", { n: attack.currentCD })}</span>`
        : `<span class="badge-pp">${t("ctl.pp", { cur: attack.currentPP, max: attack.maxPP })}</span>`;
    const left = attack.usesLeft === Infinity ? "∞" : attack.usesLeft;
    const ult = attack.isUlt
      ? `<span class="badge-ult">${hero.charge >= MAX_CHARGE ? t("ctl.ready") : hero.charge + "%"}</span>`
      : "";
    const effectiveAccuracy = hero.getEffectiveAccuracy(attack);
    const effectiveMinDamage = Math.max(
      1,
      Math.round(attack.minDamage * hero.damageMultiplier),
    );
    const effectiveMaxDamage = Math.max(
      effectiveMinDamage,
      Math.round(attack.maxDamage * hero.damageMultiplier),
    );
    const effectiveCrit = Math.min(100, attack.critChance + hero.critBonus);
    const matchup = enemy ? getTypeMultiplier(attack.type, enemy.types) : 1;
    const matchupBadge =
      matchup === 0
        ? `<span class="badge-matchup immune">${t("ctl.immune")}</span>`
        : matchup > 1
          ? `<span class="badge-matchup good">✦ ×${matchup}</span>`
          : matchup < 1
            ? `<span class="badge-matchup bad">↓ ×${matchup}</span>`
            : "";
    if (matchup === 0) $btn.title = t("ctl.immuneTitle", { name: enemy.name });

    $btn.innerHTML = `
      <span class="attack-info"><span class="move-icon" aria-hidden="true">${attack.isUlt ? "✦" : attack.damageClass === "special" ? "✧" : "⚔"}</span>${typeIcon(attack.type)} ${attack.name}</span>
      <div class="attack-stats">
        <span class="badge-dmg" title="${t("ctl.dmgTitle")}">${effectiveMinDamage}-${effectiveMaxDamage} ${t("ctl.dmg")}</span>
        <span class="badge-acc" title="${t("ctl.accTitle")}">🎯 ${effectiveAccuracy}%</span>
        <span class="badge-crit" title="${t("ctl.critTitle")}">💥 ${effectiveCrit}% ${t("ctl.crit")}</span>
        ${matchupBadge}
        ${status}
        <span class="badge-uses">${t("ctl.left", { n: left })}</span>
        ${ult}
      </div>`;

    $btn.disabled = !canAct || !hero.canUse(attack);
    $btn.addEventListener("click", () => onAttack(attack));
    $box.appendChild($btn);
  });
}

// Відобразити універсальне вікно оверлею (драфт покращень або поразка)
export function showOverlay({ title, text, choices }) {
  $("overlay-title").textContent = title;
  $("overlay-text").textContent = text;

  const $choices = $("overlay-choices");
  $choices.innerHTML = "";
  choices.forEach(
    ({
      title: t,
      desc,
      image,
      icon = "✨",
      onClick,
      isLocked,
      tag,
      tagClass = "",
    }) => {
      const $b = document.createElement("button");
      $b.type = "button";
      $b.className = "choice" + (isLocked ? " locked" : "");
      $b.disabled = Boolean(isLocked);
      $b.innerHTML = `${image ? `<img src="${image}" alt="${t}">` : `<span class="choice-icon" aria-hidden="true">${icon}</span>`}<b>${t}</b>${tag ? `<small class="choice-tag ${tagClass}">${tag}</small>` : ""}<span>${desc}</span>`;
      if (onClick && !isLocked) $b.addEventListener("click", onClick);
      $choices.appendChild($b);
    },
  );
  $("overlay").classList.add("open");
}

export const hideOverlay = () => $("overlay").classList.remove("open");
