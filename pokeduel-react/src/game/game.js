// ==========================================================
// game.js — ігровий цикл, хвилі, драфт, статуси, мета-збірка
// ==========================================================
import { sleep, createClickTracker } from "../utils/utils.js";
import {
  createHero,
  rollEnemy,
  buildEnemy,
  planLengthForWave,
  DIFFICULTY,
} from "./waves.js";
import { chooseEnemyAction, fillPlan, describeAction } from "./ai.js";
import {
  rollDraft,
  UPGRADE_POOL,
  CATEGORIES,
  PERFECT_GUARD_THRESHOLD,
} from "./upgrades.js";
import { STARTERS, calculateEarnedBP } from "./meta.js";
import { MAX_CHARGE, AURAS } from "../core/Pokemon.js";
import * as ui from "../ui/ui.js";
import { t, typeName } from "../i18n/i18n.js";

const tracker = createClickTracker();

// Виключити картки з разовим ефектом із відображення пасивних іконок
const INSTANT_CARDS = new Set(["heal", "maxhp"]);

// Налаштування мета-прогресії (оновлюються з App через updateConfig)
let config = {
  starter: "pikachu",
  item: null,
  talents: { offense: 0, survival: 0, tactics: 0 },
  onRunEnd: () => {},
};

const state = {
  runId: 0,
  wave: 1,
  bestWave: 1,
  kills: 0,
  clicksAtStart: 0,
  starter: "pikachu",
  hero: null,
  heroId: 0,
  enemy: null,
  plan: [], // Черга дій противника (ENEMY PLANS)
  prefetch: null, // { wave, promise } — попередньо підібраний ворог (Scout)
  rerollUsed: false,
  isPlayerTurn: false,
  isGameOver: false,
  sashUsed: false,
};

const isStale = (runId) => runId !== state.runId;
const talent = (branch) => config.talents?.[branch] || 0;

function trackClick(label) {
  ui.renderClicks(tracker.track(label));
}

function refreshControls() {
  ui.renderControls(
    state.hero,
    state.isPlayerTurn && !state.isGameOver,
    onAttackClick,
    onGuardClick,
    state.enemy,
  );
}

// Застосувати ефекти предметів, талантів та пасивних здібностей стартовика
function applyLoadout(hero) {
  if (config.item === "expshare") {
    hero.maxHP = Math.round(hero.maxHP * 0.85);
    hero.hp = hero.maxHP;
  }
  if (config.item === "scarf") {
    hero.firstMoveBonus = 0.25;
    hero.firstMovePPCost = 2;
  }

  const off = talent("offense");
  hero.critDamageBonus = [0, 0.03, 0.05, 0.07][off];
  hero.restorePPOnSuper = off >= 2;
  hero.lowAccuracyBonus = off >= 3 ? 10 : 0;

  if (talent("survival") >= 2) hero.dotReduction = 0.5;

  const passive = STARTERS[config.starter]?.passive || {};
  hero.innatePoison = passive.poisonChance || 0;
  hero.physicalBonus = passive.physicalBonus || 0;

  hero.renderHP();
}

function onAttackClick(attack) {
  trackClick(attack.name);
  handlePlayerAttack(attack);
}

async function onGuardClick() {
  if (!state.isPlayerTurn || state.isGameOver || !state.hero) return;
  const { hero, runId } = state;
  trackClick("Guard");

  if (talent("survival") >= 1) {
    const healAmount = Math.round(hero.maxHP * 0.03);
    hero.heal(healAmount);
    ui.logMessage(t("game.guardHeal", { n: healAmount }));
  }

  hero.isGuarding = true;
  const planned = state.plan[0];
  hero.perfectGuardArmed = Boolean(
    hero.flags.perfectGuard &&
    planned?.kind === "attack" &&
    planned.damage > PERFECT_GUARD_THRESHOLD,
  );
  state.isPlayerTurn = false;
  ui.logMessage(t("game.guardBrace", { name: hero.name }));
  if (hero.perfectGuardArmed) {
    ui.logMessage(t("game.perfectReady"));
  }
  refreshControls();
  await finishPlayerAction(runId);
}

async function handlePlayerAttack(attack) {
  const { hero, enemy, runId } = state;
  if (!state.isPlayerTurn || state.isGameOver || !hero.canUse(attack)) return;

  state.isPlayerTurn = false;
  refreshControls();

  const result = await hero.useAttack(attack, enemy);
  if (isStale(runId)) return;

  ui.logAttack(result);
  hero.tickCooldowns();
  checkBossPhase();
  refreshControls();

  if (enemy.isFainted) return onWaveCleared(runId);
  await finishPlayerAction(runId);
}

// Завершити хід гравця: обробити періодичну шкоду та передати хід противнику
async function finishPlayerAction(runId) {
  const { hero } = state;
  const tick = await hero.tickStatuses();
  if (isStale(runId)) return;
  if (tick.damage > 0) {
    ui.logMessage(
      t("log.statusDmg", {
        icons: tick.names.map((n) => (n === "poison" ? "☠️" : "🔥")).join(""),
        name: hero.name,
        dmg: tick.damage,
        hp: hero.hp,
        max: hero.maxHP,
      }),
    );
  }
  if (hero.hp <= 0 && (await handleHeroDown(runId))) return;
  refreshControls();
  await enemyTurn(runId);
}

async function handleHeroDown(runId) {
  const { hero } = state;
  if (config.item === "sash" && !state.sashUsed) {
    state.sashUsed = true;
    hero.hp = 1;
    hero.dom.root.classList.remove("fainted");
    hero.renderHP();
    ui.logMessage(t("game.sash", { name: hero.name }));
    return false;
  }
  hero.hp = 0;
  hero.renderHP();
  onDefeat(runId);
  return true;
}

function checkBossPhase() {
  const { enemy } = state;
  if (!enemy?.isBoss || enemy.phase !== 1 || enemy.hp <= 0) return;
  if (enemy.hp > enemy.maxHP / 2) return;
  enemy.phase = 2;
  enemy.damageMultiplier *= DIFFICULTY.boss.phase2Damage;
  enemy.charge = MAX_CHARGE;
  enemy.renderCharge();
  ui.logMessage(t("game.phase2", { name: enemy.name }));
}

async function enemyTurn(runId) {
  const { hero, enemy } = state;
  ui.setTurn(t("turn.enemy", { name: enemy.name }), "#f87171");

  await sleep(1000);
  if (isStale(runId)) return;

  let action =
    state.plan.shift() || chooseEnemyAction(enemy, hero, { wave: state.wave });
  if (action.kind === "attack" && !enemy.canUse(action.attack)) {
    action = chooseEnemyAction(enemy, hero, { wave: state.wave });
  }

  if (action.kind === "guard") {
    enemy.isGuarding = true;
    ui.logMessage(t("game.enemyGuard", { name: enemy.name }));
  } else {
    const result = await enemy.useAttack(action.attack, hero);
    if (isStale(runId)) return;
    ui.logAttack(result);
  }
  enemy.tickCooldowns();

  if (enemy.isFainted) return onWaveCleared(runId);
  if (hero.hp <= 0 && (await handleHeroDown(runId))) return;

  const tick = await enemy.tickStatuses();
  if (isStale(runId)) return;
  if (tick.damage > 0) {
    ui.logMessage(
      t("log.statusDmg", {
        icons: tick.names.map((n) => (n === "poison" ? "☠️" : "🔥")).join(""),
        name: enemy.name,
        dmg: tick.damage,
        hp: enemy.hp,
        max: enemy.maxHP,
      }),
    );
  }
  if (enemy.isFainted) return onWaveCleared(runId);
  checkBossPhase();

  if (config.item === "leftovers" && hero.hp > 0 && hero.hp < hero.maxHP) {
    const before = hero.hp;
    hero.heal(Math.round(hero.maxHP * 0.03));
    ui.logMessage(
      t("game.leftovers", { name: hero.name, n: hero.hp - before }),
    );
  }

  beginPlayerTurn();
}

async function beginPlayerTurn() {
  const runId = state.runId;
  const { hero, enemy } = state;
  state.isPlayerTurn = true;

  fillPlan(state.plan, planLengthForWave(state.wave), enemy, hero, state.wave);
  ui.setTurn(
    t("turn.plans", { plan: state.plan.map(describeAction).join(" → ") }),
    "#f59e0b",
  );
  refreshControls();

  if (hero.getAvailableAttacks().length === 0) {
    ui.logMessage(t("game.exhausted", { name: hero.name }));
    await sleep(800);
    if (isStale(runId)) return;
    handlePlayerAttack(hero.struggle);
  }
}

function showLoading(text) {
  ui.showOverlay({ title: t("ov.loading"), text, choices: [] });
}

function showLoadError(error, retry) {
  console.error(error);
  ui.showOverlay({
    title: t("ov.apiError"),
    text: error.message,
    choices: [
      {
        title: t("ov.retry"),
        desc: t("ov.retryDesc"),
        onClick: () => {
          trackClick("Retry");
          retry();
        },
      },
    ],
  });
}

function requestReset() {
  if (state.hero && !state.isGameOver) {
    ui.showOverlay({
      title: t("ov.restartTitle"),
      text: t("ov.restartText"),
      choices: [
        {
          title: t("ov.restartYes"),
          desc: t("ov.restartYesDesc"),
          onClick: () => {
            trackClick("Confirm Reset");
            startRun();
          },
        },
        {
          title: t("ov.cancel"),
          desc: t("ov.cancelDesc"),
          onClick: () => ui.hideOverlay(),
        },
      ],
    });
  } else {
    startRun();
  }
}

// Відобразити кодекс зібраних та заблокованих карток
function openCodex() {
  const owned = (state.hero?.passives || []).map((c) => ({
    title: `✔ ${c.title}`,
    icon: c.icon,
    desc: typeof c.desc === "function" ? c.desc(state.hero) : c.desc,
  }));
  const pool = UPGRADE_POOL.map((up) => {
    const isUnlocked = up.unlockedAtWave <= state.wave;
    return {
      title: isUnlocked ? up.title : t("ov.locked"),
      icon: isUnlocked ? up.icon : "🔒",
      tag: isUnlocked ? CATEGORIES[up.category].label : "",
      tagClass: isUnlocked ? CATEGORIES[up.category].css : "",
      desc: isUnlocked
        ? typeof up.desc === "function"
          ? up.desc(state.hero || { maxHP: 100 })
          : up.desc
        : t("ov.unlocksAt", { w: up.unlockedAtWave }),
      isLocked: !isUnlocked,
    };
  });

  ui.showOverlay({
    title: t("ov.codexTitle"),
    text: t("ov.codexText", {
      w: state.wave,
      a: owned.length,
      u: pool.filter((c) => !c.isLocked).length,
      total: UPGRADE_POOL.length,
    }),
    choices: [
      ...owned,
      ...pool,
      {
        title: t("ov.close"),
        icon: "❌",
        desc: t("ov.closeDesc"),
        onClick: () => ui.hideOverlay(),
      },
    ],
  });
}

function startRun() {
  const runId = ++state.runId;
  state.wave = 1;
  state.kills = 0;
  state.starter = config.starter;
  state.clicksAtStart = tracker.getTotal();
  state.isGameOver = false;
  state.isPlayerTurn = false;
  state.sashUsed = false;
  state.rerollUsed = false;
  state.prefetch = null;
  state.plan = [];
  ui.clearLogs();

  const starterId = STARTERS[config.starter]?.pokeId ?? 25;
  beginRun(runId, starterId);
}

async function beginRun(runId, starterId) {
  showLoading(t("ov.preparing"));
  try {
    const hero = await createHero(
      document.getElementById("poke-character"),
      starterId,
    );
    if (isStale(runId)) return;

    applyLoadout(hero);
    state.hero = hero;
    state.heroId = starterId;
    state.enemy = null;
    await startWave(runId);
  } catch (error) {
    if (!isStale(runId)) showLoadError(error, () => beginRun(runId, starterId));
  }
}

function rollNextEnemy(wave) {
  return rollEnemy(wave, {
    previousName: state.enemy?.name,
    heroId: state.heroId,
    heroAttacks: state.hero?.attacks || [],
    heroTypes: state.hero?.types || [],
  });
}

async function startWave(runId) {
  showLoading(t("ov.looking", { w: state.wave }));

  let data = null;
  if (state.prefetch?.wave === state.wave) {
    try {
      data = await state.prefetch.promise;
    } catch (e) {
      data = null;
    }
  }
  state.prefetch = null;
  if (isStale(runId)) return;
  if (!data) data = await rollNextEnemy(state.wave);
  if (isStale(runId)) return;

  const enemy = buildEnemy(
    data,
    state.wave,
    document.getElementById("poke-enemy"),
  );
  state.enemy = enemy;
  state.plan = [];
  state.hero.resetForBattle();

  ui.hideOverlay();
  ui.renderWave(state.wave);
  ui.logMessage(
    t("game.waveStart", {
      w: state.wave,
      boss: enemy.isBoss ? t("game.bossPrefix") : "",
      name: enemy.name,
      types: enemy.types.map(typeName).join("/"),
      hp: enemy.maxHP,
    }),
  );
  if (enemy.aura) {
    const a = AURAS[enemy.aura];
    ui.logMessage(`${a.icon} <b>${a.name}</b>: ${a.desc}`);
  }
  if (state.wave === 11) {
    ui.logMessage(t("game.trainers"));
  }
  if (state.wave === 1) {
    ui.logMessage(t("game.tip"));
  }
  beginPlayerTurn();
}

async function onWaveCleared(runId) {
  const { hero, enemy } = state;
  state.kills++;
  ui.setTurn(t("turn.cleared"), "#4ade80");
  ui.logMessage(t("game.fainted", { name: enemy.name, w: state.wave }));
  state.bestWave = Math.max(state.bestWave, state.wave);
  hero.isGuarding = false;
  hero.perfectGuardArmed = false;

  await sleep(900);
  if (isStale(runId)) return;

  const before = hero.hp;
  hero.heal(Math.round(hero.maxHP * DIFFICULTY.postWaveHealPercent));
  ui.logMessage(t("game.recovered", { name: hero.name, n: hero.hp - before }));

  const nextWave = state.wave + 1;
  const promise = rollNextEnemy(nextWave);
  promise.catch(() => {});
  state.prefetch = { wave: nextWave, promise };

  let scoutText = "";
  if (talent("tactics") >= 3) {
    showLoading(t("ov.scouting"));
    try {
      const next = await promise;
      if (isStale(runId)) return;
      scoutText = t("ov.scout", {
        types: next.types.map(typeName).join(" / ").toUpperCase(),
      });
    } catch (e) {
      scoutText = t("ov.scoutFail");
    }
  }
  showDraft(runId, scoutText);
}

// Відобразити вікно вибору карток покращень після зачистки хвилі
function showDraft(runId, scoutText = "") {
  const { hero } = state;
  const count = talent("tactics") >= 2 ? 3 : 2;
  const cards = rollDraft(count, state.wave, hero);

  const choices = cards.map((up) => ({
    title: up.title,
    icon: up.icon,
    tag: CATEGORIES[up.category].label,
    tagClass: CATEGORIES[up.category].css,
    desc: typeof up.desc === "function" ? up.desc(hero) : up.desc,
    onClick: () => {
      trackClick(`Card: ${up.title}`);
      up.apply(hero, { talents: config.talents });
      if (!INSTANT_CARDS.has(up.id)) hero.addPassive(up);
      hero.levelUp();
      ui.logMessage(t("game.cardTaken", { title: up.title }));
      state.wave++;
      startWave(runId).catch((error) => {
        if (!isStale(runId)) showLoadError(error, () => startWave(runId));
      });
    },
  }));

  if (talent("tactics") >= 1 && !state.rerollUsed) {
    choices.push({
      title: t("ov.reroll"),
      icon: "🎲",
      desc: t("ov.rerollDesc"),
      onClick: () => {
        trackClick("Reroll");
        state.rerollUsed = true;
        showDraft(runId, scoutText);
      },
    });
  }

  ui.showOverlay({
    title: t("ov.draftTitle", { w: state.wave }),
    text: `${t("ov.draftText")}${scoutText}`,
    choices,
  });
}

function onDefeat(runId) {
  if (isStale(runId)) return;
  state.isGameOver = true;
  ui.setTurn(t("turn.ended"), "#f87171");
  ui.logMessage(
    t("game.heroFainted", { name: state.hero.name, w: state.wave }),
  );
  refreshControls();

  const clicks = tracker.getTotal() - state.clicksAtStart;
  const earned = calculateEarnedBP({
    wave: state.wave,
    clicks,
    kills: state.kills,
    won: false,
    item: config.item,
  });

  try {
    config.onRunEnd?.({
      wave: state.wave,
      clicks,
      kills: state.kills,
      earned,
      starter: state.starter,
      won: false,
    });
  } catch (err) {
    console.error("Error in onRunEnd callback:", err);
  }

  ui.showOverlay({
    title: t("ov.defeat"),
    text: t("ov.defeatText", {
      w: state.wave,
      k: state.kills,
      b: state.bestWave,
      bp: earned,
    }),
    choices: [
      {
        title: t("ov.tryAgain"),
        desc: t("ov.tryAgainDesc"),
        onClick: () => {
          trackClick("Try again");
          startRun();
        },
      },
    ],
  });
}

export function updateConfig(partial) {
  config = { ...config, ...partial };
}

export function restartRun() {
  startRun();
}

export function initGame(initial = {}) {
  config = { ...config, ...initial };
  document.getElementById("btn-reset").onclick = requestReset;
  document.getElementById("btn-codex").onclick = openCodex;
  startRun();
}
