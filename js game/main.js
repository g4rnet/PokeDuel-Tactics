// Вспомогательная функция рандома в диапазоне [min, max]
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Векторные иконки для атак
const TYPE_ICONS = {
  electric: `<svg class="log-icon" viewBox="0 0 24 24" fill="#eab308"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  fire: `<svg class="log-icon" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 23c4.97 0 9-3.58 9-8 0-4.19-3.23-7.6-7.11-9.74-.47-.26-1.06.12-.98.65.38 2.53-.44 4.88-1.91 6.59-1.47-2.12-1.74-4.89-1.02-7.46.15-.55-.38-1.04-.92-.89C6.01 4.97 3 8.99 3 14c0 4.42 4.03 8 9 8z"/></svg>`,
  physical: `<svg class="log-icon" viewBox="0 0 24 24" fill="#64748b"><path d="M19.78 4.22a.75.75 0 00-1.06 0L14 8.94l-1.72-1.72a.75.75 0 00-1.06 1.06l1.72 1.72-5.47 5.47a2.25 2.25 0 000 3.18l.22.22a2.25 2.25 0 003.18 0l5.47-5.47 1.72 1.72a.75.75 0 001.06-1.06L18.56 12l4.72-4.72a.75.75 0 000-1.06l-3.5-3.5z"/></svg>`,
};

// Класс Атаки
class Attack {
  constructor(
    name,
    minDamage,
    maxDamage,
    maxPP,
    cooldownTurns = 0,
    type = "physical",
  ) {
    this.name = name;
    this.minDamage = minDamage;
    this.maxDamage = maxDamage;
    this.maxPP = maxPP;
    this.currentPP = maxPP;
    this.cooldownTurns = cooldownTurns;
    this.currentCD = 0;
    this.type = type;
  }

  updateCooldown() {
    if (this.currentCD > 0) {
      this.currentCD--;
    }
  }

  use() {
    if (this.currentPP > 0) {
      this.currentPP--;
    }
    this.currentCD = this.cooldownTurns;
  }
}

// Класс Покемона
class Pokemon {
  constructor({ name, defaultHP, elHP, elProgressbar, elCard, attacks }) {
    this.name = name;
    this.defaultHP = defaultHP;
    this.damageHP = defaultHP;
    this.elHP = elHP;
    this.elProgressbar = elProgressbar;
    this.elCard = elCard;
    this.attacks = attacks;
  }

  renderHPLabel() {
    this.elHP.innerText = `${this.damageHP} / ${this.defaultHP}`;
  }

  renderProgressbar() {
    const percentage = (this.damageHP / this.defaultHP) * 100;
    this.elProgressbar.style.width = `${percentage}%`;

    this.elProgressbar.classList.remove("low", "critical");
    if (percentage < 60 && percentage >= 20) {
      this.elProgressbar.classList.add("low");
    } else if (percentage < 20) {
      this.elProgressbar.classList.add("critical");
    }
  }

  renderHP() {
    this.renderHPLabel();
    this.renderProgressbar();
  }

  takeDamage(damage) {
    this.damageHP = Math.max(0, this.damageHP - damage);
    this.renderHP();

    this.elCard.classList.add("hit-animation");
    setTimeout(() => this.elCard.classList.remove("hit-animation"), 350);
  }

  reset() {
    this.damageHP = this.defaultHP;
    this.attacks.forEach((attack) => {
      attack.currentPP = attack.maxPP;
      attack.currentCD = 0;
    });
    this.renderHP();
  }
}

// Инициализация
const character = new Pokemon({
  name: "Pikachu",
  defaultHP: 100,
  elHP: document.getElementById("health-character"),
  elProgressbar: document.getElementById("progressbar-character"),
  elCard: document.getElementById("poke-character"),
  attacks: [
    new Attack("Quick Attack", 6, 10, 99, 0, "physical"), // Базовая бессменная атака без КД
    new Attack("Thunder Jolt", 12, 18, 8, 1, "electric"),
    new Attack("Electro Ball", 18, 25, 4, 2, "electric"),
    new Attack("Iron Tail", 24, 32, 2, 3, "physical"),
  ],
});

const enemy = new Pokemon({
  name: "Charmander",
  defaultHP: 100,
  elHP: document.getElementById("health-enemy"),
  elProgressbar: document.getElementById("progressbar-enemy"),
  elCard: document.getElementById("poke-enemy"),
  attacks: [
    new Attack("Scratch", 6, 10, 99, 0, "physical"),
    new Attack("Ember", 12, 18, 8, 1, "fire"),
    new Attack("Dragon Rage", 16, 24, 4, 2, "physical"),
    new Attack("Flame Burst", 24, 32, 2, 3, "fire"),
  ],
});

// UI Элементы
const $controlButtons = document.getElementById("control-buttons");
const $turnIndicator = document.getElementById("turn-indicator");
const $btnReset = document.getElementById("btn-reset");
const $logs = document.getElementById("logs");

let isPlayerTurn = true;
let isGameOver = false;

// Вывод
function addLog(attacker, defender, attack, damage) {
  const { name: attackerName } = attacker;
  const { name: defenderName, damageHP, defaultHP } = defender;
  const { name: attackName, type } = attack;

  const icon = TYPE_ICONS[type] || TYPE_ICONS.physical;
  const text = `${icon} <span><b>${attackerName}</b> used <b>${attackName}</b> dealing <b style="color:#e11d48">${damage} DMG</b> to ${defenderName}! [${damageHP}/${defaultHP}]</span>`;

  const $p = document.createElement("p");
  $p.innerHTML = text;
  $logs.insertBefore($p, $logs.firstChild);
}

// Кнопки управления
function renderControlButtons() {
  $controlButtons.innerHTML = "";

  character.attacks.forEach((attack) => {
    const { name, currentPP, maxPP, currentCD, minDamage, maxDamage } = attack;

    const $btn = document.createElement("button");
    $btn.className = "button-attack";

    let statusBadge = `<span class="badge-pp">${currentPP}/${maxPP} PP</span>`;
    if (currentCD > 0) {
      statusBadge = `<span class="badge-cd">CD: ${currentCD} turns</span>`;
    }

    $btn.innerHTML = `
      <span class="attack-info">${name}</span>
      <div class="attack-stats">
        <span class="badge-dmg">${minDamage}-${maxDamage} DMG</span>
        ${statusBadge}
      </div>
    `;

    if (
      attack.currentPP === 0 ||
      attack.currentCD > 0 ||
      !isPlayerTurn ||
      isGameOver
    ) {
      $btn.disabled = true;
    }

    $btn.addEventListener("click", () => handlePlayerAttack(attack));
    $controlButtons.appendChild($btn);
  });
}

// Ход игрока
function handlePlayerAttack(attack) {
  if (
    !isPlayerTurn ||
    isGameOver ||
    attack.currentPP <= 0 ||
    attack.currentCD > 0
  )
    return;

  attack.use();
  const damage = random(attack.minDamage, attack.maxDamage);

  enemy.takeDamage(damage);
  addLog(character, enemy, attack, damage);

  if (checkBattleEnd()) return;

  // Переход хода
  isPlayerTurn = false;
  $turnIndicator.innerText = "Charmander's Turn...";
  $turnIndicator.style.borderColor = "#f87171";
  renderControlButtons();

  setTimeout(handleEnemyTurn, 1000);
}

// Ход Соперника
function handleEnemyTurn() {
  if (isGameOver) return;

  // Снижение КД
  enemy.attacks.forEach((a) => a.updateCooldown());

  const availableAttacks = enemy.attacks.filter(
    (a) => a.currentPP > 0 && a.currentCD === 0,
  );

  let chosenAttack =
    availableAttacks.length > 0
      ? availableAttacks[random(0, availableAttacks.length - 1)]
      : enemy.attacks[0];

  chosenAttack.use();
  const damage = random(chosenAttack.minDamage, chosenAttack.maxDamage);

  character.takeDamage(damage);
  addLog(enemy, character, chosenAttack, damage);

  if (checkBattleEnd()) return;

  // Возвращаем ход и снижаем КД
  character.attacks.forEach((a) => a.updateCooldown());

  isPlayerTurn = true;
  $turnIndicator.innerText = "Your Turn!";
  $turnIndicator.style.borderColor = "#ffc55b";
  renderControlButtons();
}

// Проверка окончания боя
function checkBattleEnd() {
  if (character.damageHP === 0 || enemy.damageHP === 0) {
    isGameOver = true;
    renderControlButtons();

    const winner = character.damageHP > 0 ? character.name : enemy.name;
    const loser = character.damageHP === 0 ? character.name : enemy.name;

    const { name: winnerName } = winnerObj;
    const { name: loserName } = loserObj;

    $turnIndicator.innerText = "Battle Ended!";

    setTimeout(() => {
      alert(`🏆 Battle Over! ${loserName} fainted. ${winnerName} wins!`);
    }, 200);

    return true;
  }
  return false;
}

// Перезапуск боя
$btnReset.addEventListener("click", () => {
  character.reset();
  enemy.reset();
  isPlayerTurn = true;
  isGameOver = false;
  $turnIndicator.innerText = "Your Turn!";
  $turnIndicator.style.borderColor = "#ffc55b";
  $logs.innerHTML = "";
  renderControlButtons();
});

// Запуск
function init() {
  character.renderHP();
  enemy.renderHP();
  renderControlButtons();
}

init();
