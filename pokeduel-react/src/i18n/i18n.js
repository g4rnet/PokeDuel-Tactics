// ==========================================================
// i18n.js — вибір мови (uk / en) та всі текстові рядки інтерфейсу
// Мова зберігається в localStorage; при її зміні сторінка перезавантажується
// (тексти гри рендериться імперативно, тому перезавантаження — найбезпечніший варіант).
// Імена покемонів та атак надходять із PokeAPI й залишаються англійською.
// ==========================================================

const LANG_KEY = "pokeduel_lang";
export const LANGS = ["uk", "en"];

export function getLang() {
  try {
    const l = localStorage.getItem(LANG_KEY);
    return LANGS.includes(l) ? l : null;
  } catch (e) {
    return null;
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    console.error("Failed to save language", e);
  }
}

let current = getLang() || "uk";
export const currentLang = () => current;
export function applyLang(lang) {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

/** t('key', {var: value}) — замінює змінні {var}; якщо ключ відсутній, шукає в en або повертає сам ключ. */
export function t(key, vars = {}) {
  const str = DICT[current]?.[key] ?? DICT.en[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `{${k}}`,
  );
}

export const typeName = (type) =>
  t(`type.${type}`) === `type.${type}` ? type : t(`type.${type}`);

const en = {
  // language screen
  "lang.title": "Choose your language",
  "lang.subtitle": "You can change it later with the 🌐 button.",
  "lang.switch": "🌐 Language",
  // types
  "type.normal": "normal",
  "type.fire": "fire",
  "type.water": "water",
  "type.electric": "electric",
  "type.grass": "grass",
  "type.ice": "ice",
  "type.fighting": "fighting",
  "type.poison": "poison",
  "type.ground": "ground",
  "type.flying": "flying",
  "type.psychic": "psychic",
  "type.bug": "bug",
  "type.rock": "rock",
  "type.ghost": "ghost",
  "type.dragon": "dragon",
  "type.dark": "dark",
  "type.steel": "steel",
  "type.fairy": "fairy",
  // HUD
  "hud.wave": "Wave {n}",
  "hud.clicks": "Clicks: {n}",
  "hud.hub": "🏆 Trainer Hub (BP: {bp})",
  "hud.codex": "📜 Deck / Codex",
  "hud.yourTurn": "Your Turn!",
  "hud.resetTitle": "Reset Game",
  "hud.lvl": "Lv. {n}",
  // controls
  "ctl.guard": "🛡 Guard — reduce next hit by 55%",
  "ctl.dmg": "DMG*",
  "ctl.dmgTitle":
    "Damage after your damage bonus; enemy defense and type effectiveness can still change the result",
  "ctl.accTitle": "Final hit chance, including upgrades",
  "ctl.critTitle": "Final critical-hit chance",
  "ctl.crit": "crit",
  "ctl.cd": "CD: {n}",
  "ctl.pp": "{cur}/{max} PP",
  "ctl.left": "Left: {n}",
  "ctl.ready": "READY",
  "ctl.immune": "⛔ IMMUNE",
  "ctl.immuneTitle": "This move cannot affect {name} because of type immunity.",
  // turn texts
  "turn.plans": "Enemy plans: {plan}",
  "turn.enemy": "{name}'s Turn...",
  "turn.cleared": "Wave cleared!",
  "turn.ended": "Battle Ended!",
  struggle: "Struggle",
  // statuses / auras
  "status.poison": "Poison",
  "status.burn": "Burn",
  "aura.fire-coat.name": "Fire Coat",
  "aura.fire-coat.desc": "Physical attackers get burned.",
  "aura.thick-hide.name": "Thick Hide",
  "aura.thick-hide.desc": "Immune to critical hits.",
  "plan.guard": "Guard",
  // attack log
  "log.immune": "<b>{a}</b> used <b>{m}</b>, but it doesn't affect {d}...",
  "log.miss":
    "<b>{a}</b> used <b>{m}</b> but <b>missed</b>! Hit chance was <b>{acc}%</b>.",
  "log.hit":
    '<b>{a}</b> used <b>{m}</b> dealing <b style="color:#e11d48">{dmg} DMG</b> to {d}! [{hp}/{max}]',
  "log.tag.guarded": "Guarded!",
  "log.tag.crit": "💥 Critical hit!",
  "log.tag.super": "Super effective!",
  "log.tag.weak": "Not very effective...",
  "log.tag.ult": "ULT!",
  "note.thickHide": "🪨 Thick Hide blocked the critical hit!",
  "note.overload": "⚡ Overload: guaranteed critical hit!",
  "note.desperate": "🔥 Desperate Power: +50% damage!",
  "note.shatter": "🪨 Shatter: +40% against a guarding enemy!",
  "note.scarf": "🧣 Choice Scarf boosted the first move!",
  "note.talentPP": "🎯 Trainer Talent: +1 PP for {m}!",
  "note.poisoned": "☠️ {d} was poisoned!",
  "note.burned": "🔥 Fire Coat burned {a}!",
  "note.reflect": "✨ Perfect Guard reflected {n} damage!",
  "log.statusDmg":
    "{icons} <b>{name}</b> took <b>{dmg}</b> status damage. [{hp}/{max}]",
  // game log
  "game.guardHeal": "✨ Trainer Talent: Guard healed <b>{n}</b> HP!",
  "game.guardBrace":
    "🛡️ <b>{name}</b> braces for the incoming attack. The next hit will deal 55% less damage.",
  "game.perfectReady":
    "✨ <b>Perfect Guard</b> is ready: a strong hit will be partly reflected!",
  "game.sash": "✨ <b>Focus Sash</b> saved {name} from fainting, leaving 1 HP!",
  "game.phase2":
    "👑 <b>{name}</b> enters <b>Phase 2</b>! Its attacks are stronger and its Ult is charged!",
  "game.enemyGuard":
    "🛡️ <b>{name}</b> uses <b>Guard</b>. Your next hit will deal 55% less damage.",
  "game.leftovers": "🍎 <b>Leftovers</b> healed {name} for {n} HP.",
  "game.exhausted":
    "😵 <b>{name}</b> is exhausted and has to use <b>Struggle</b>!",
  "game.waveStart":
    "🌊 <b>Wave {w}</b>: {boss}{name} ({types}) appears! HP {hp}",
  "game.bossPrefix": "👑 BOSS ",
  "game.trainers":
    "⚠️ Trainers are here! ENEMY PLANS now show a chain of 2 actions.",
  "game.tip":
    "💡 <b>Tip:</b> The amber turn badge previews the enemy plan. Use Guard to reduce the next hit by 55%.",
  "game.fainted": "🏆 <b>{name}</b> fainted! Wave {w} cleared.",
  "game.recovered": "💚 {name} recovered {n} HP after the battle.",
  "game.cardTaken": "✨ Card taken: <b>{title}</b>",
  "game.heroFainted": "💀 <b>{name}</b> fainted on wave {w}.",
  // overlays
  "ov.loading": "Loading...",
  "ov.preparing": "Preparing your Pokemon...",
  "ov.looking": "Wave {w}: looking for an opponent...",
  "ov.scouting": "Scouting the next opponent...",
  "ov.apiError": "PokeAPI error",
  "ov.retry": "Retry",
  "ov.retryDesc": "Try to load the data again",
  "ov.restartTitle": "Restart Battle?",
  "ov.restartText":
    "Are you sure you want to restart? Your current run progress will be lost.",
  "ov.restartYes": "Yes, Restart",
  "ov.restartYesDesc": "Start over from Wave 1",
  "ov.cancel": "Cancel",
  "ov.cancelDesc": "Continue fighting",
  "ov.codexTitle": "📜 Deck / Codex",
  "ov.codexText":
    "Wave {w}. Active cards this run: {a}. Unlocked {u} of {total} card types.",
  "ov.close": "Close",
  "ov.closeDesc": "Back to battle",
  "ov.locked": "??? Locked Card",
  "ov.unlocksAt": "Unlocks at Wave {w}",
  "ov.draftTitle": "Wave {w} cleared!",
  "ov.draftText": "Choose a card.",
  "ov.scout": " 🔭 Scout: the next enemy is {types} type.",
  "ov.scoutFail": " 🔭 Scout failed to find the next enemy.",
  "ov.reroll": "Reroll",
  "ov.rerollDesc": "Get new cards (once per run)",
  "ov.defeat": "Defeat",
  "ov.defeatText":
    "You reached wave {w} and defeated {k} Pokemon. Best wave: {b}. BP earned: {bp}.",
  "ov.tryAgain": "Try again",
  "ov.tryAgainDesc": "Start a new run",
  // errors
  "err.noEnemy": "Could not get a suitable enemy from PokeAPI",
  "err.noMoves": "{name}: not enough damaging moves",
  // categories
  "cat.offense": "⚔ Offense",
  "cat.defense": "🛡 Defense",
  "cat.tactics": "🧠 Tactics",
  // cards
  "card.heal.title": "Berry Feast",
  "card.heal.desc":
    "Fully restores HP ({n}). Talent Survival 3: also cures all statuses.",
  "card.maxhp.title": "Vitality Growth",
  "card.maxhp.desc": "Increases Max HP by +30 and heals current wounds.",
  "card.crit.title": "Eagle Eye",
  "card.crit.desc": "Increases Critical Hit chance by +12%.",
  "card.accuracy.title": "Focused Mind",
  "card.accuracy.desc": "Increases accuracy of all moves by +10%.",
  "card.endurance.title": "Stamina Boost",
  "card.endurance.desc": "Adds +3 uses to every move per battle.",
  "card.vampirism.title": "Vampiric Touch",
  "card.vampirism.desc": "Restores 15% of dealt damage as HP.",
  "card.overclock.title": "Overcharge",
  "card.overclock.desc": "Start each battle with +25% Ult charge.",
  "card.overload.title": "Overload",
  "card.overload.desc":
    "An Electric move used right after a Water move is a guaranteed critical hit.",
  "card.shatter.title": "Shatter",
  "card.shatter.desc":
    "Rock/Ground moves deal +40% to guarding enemies, but -10% to all other targets.",
  "card.perfectGuard.title": "Perfect Guard",
  "card.perfectGuard.desc":
    "Guard when ENEMY PLANS shows more than {n} damage: reflect 25% of the hit.",
  "card.desperate.title": "Desperate Power",
  "card.desperate.desc": "A move with only 1 PP left deals +50% damage.",
  "card.venom.title": "Venomous Strike",
  "card.venom.desc":
    "Physical attacks have a 20% chance to poison. -5% accuracy for all moves.",
  "card.glassCannon.title": "Glass Cannon",
  "card.glassCannon.desc": "All attacks deal +35% damage. Max HP -20%.",
  // meta: starters / items / talents
  "starter.pikachu": "Balanced electric starter.",
  "starter.charmander": "Fire. Strong special attacks.",
  "starter.bulbasaur": "Grass/Poison. Sturdy and steady.",
  "starter.squirtle": "Water. Good defense.",
  "starter.gastly": "Ghost. Every hit has a 25% chance to poison.",
  "starter.heracross": "Fighting/Bug. Physical moves deal +15% damage.",
  "item.leftovers.name": "Leftovers",
  "item.leftovers.desc": "Restores 3% max HP at the end of every turn.",
  "item.scarf.name": "Choice Scarf",
  "item.scarf.desc":
    "First move of each battle deals +25% damage, but spends 2x PP.",
  "item.sash.name": "Focus Sash",
  "item.sash.desc": "Once per run, survive a lethal hit with 1 HP.",
  "item.expshare.name": "Exp Share",
  "item.expshare.desc": "+20% BP from a run, but -15% max HP.",
  "talent.offense.name": "Offense",
  "talent.offense.1": "Critical hits deal +3% more damage.",
  "talent.offense.2":
    "Crit bonus rises to +5%. First super-effective hit each battle restores 1 PP of that move.",
  "talent.offense.3":
    "Crit bonus rises to +7%. Moves under 85% accuracy get +10% accuracy.",
  "talent.survival.name": "Survival",
  "talent.survival.1": "Guard also restores 3% max HP.",
  "talent.survival.2": "Poison and burn deal 50% less damage to you.",
  "talent.survival.3": "Berry Feast also cures all negative statuses.",
  "talent.tactics.name": "Tactics & Draft",
  "talent.tactics.1": "Reroll: refresh the offered cards once per run.",
  "talent.tactics.2": "Draft Expansion: choose from 3 cards instead of 2.",
  "talent.tactics.3": "Scout: see the type of the next wave's enemy.",
  // hub
  "hub.title": "🏆 Trainer Hub",
  "hub.bp": "Battle Points (BP): ",
  "hub.note": "Loadout changes apply from the next run.",
  "hub.tab.starters": "🐣 Starters",
  "hub.tab.items": "📦 Held Items",
  "hub.tab.talents": "🌳 Trainer License",
  "hub.selected": "Selected",
  "hub.select": "Select",
  "hub.unlock": "Unlock — {n} BP",
  "hub.equip": "Equip",
  "hub.unequip": "Unequip",
  "hub.slotNote": "1 item slot. A second slot is not unlocked yet.",
  "hub.upgrade": "Upgrade — {n} BP",
  "hub.mastered": "Mastered",
  "hub.newRun": "Start new run with this loadout",
  "hub.close": "Close & Continue",
  // accounts + leaderboard
  "auth.login": "Log in",
  "auth.register": "Sign up",
  "auth.nick": "Nickname",
  "auth.password": "Password",
  "auth.hint":
    "Nickname: 3–20 letters, digits, _ or -. Password: at least 6 characters. Your current progress on this device will be moved to the new account.",
  "auth.doLogin": "Log in",
  "auth.doRegister": "Create account",
  "auth.guest": "Play as guest",
  "auth.guestNote":
    "Guests can play, but their results are not added to the leaderboard and progress is saved only in this browser.",
  "auth.logout": "Log out",
  "auth.signin": "Log in / Sign up",
  "auth.err.bad_nick": "Bad nickname: use 3–20 letters, digits, _ or -.",
  "auth.err.bad_password": "Password must be 6–100 characters.",
  "auth.err.nick_taken": "This nickname is already taken.",
  "auth.err.bad_credentials": "Wrong nickname or password.",
  "auth.err.too_many_requests":
    "Too many attempts. Try again in a few minutes.",
  "auth.err.network": "Cannot reach the server. Check your connection.",
  "auth.err.unknown": "Something went wrong. Try again.",
  "lb.open": "🏅 Leaderboard",
  "lb.title": "🏅 Leaderboard",
  "lb.filter": "Pokemon",
  "lb.all": "All Pokemon",
  "lb.player": "Player",
  "lb.pokemon": "Pokemon",
  "lb.wave": "Wave",
  "lb.kills": "Defeated",
  "lb.loading": "Loading…",
  "lb.empty": "No results yet. Be the first!",
  "lb.failed": "Could not load the leaderboard.",
  "lb.saved": "Result sent to the leaderboard.",
};

const uk = {
  "lang.title": "Оберіть мову",
  "lang.subtitle": "Її можна змінити пізніше кнопкою 🌐.",
  "lang.switch": "🌐 Мова",
  "type.normal": "звичайний",
  "type.fire": "вогняний",
  "type.water": "водяний",
  "type.electric": "електричний",
  "type.grass": "трав'яний",
  "type.ice": "крижаний",
  "type.fighting": "бойовий",
  "type.poison": "отруйний",
  "type.ground": "земляний",
  "type.flying": "літаючий",
  "type.psychic": "психічний",
  "type.bug": "комаха",
  "type.rock": "кам'яний",
  "type.ghost": "привид",
  "type.dragon": "драконовий",
  "type.dark": "темний",
  "type.steel": "сталевий",
  "type.fairy": "чарівний",
  "hud.wave": "Хвиля {n}",
  "hud.clicks": "Кліки: {n}",
  "hud.hub": "🏆 Хаб тренера (BP: {bp})",
  "hud.codex": "📜 Колода / Кодекс",
  "hud.yourTurn": "Ваш хід!",
  "hud.resetTitle": "Скинути гру",
  "hud.lvl": "Рів. {n}",
  "ctl.guard": "🛡 Захист — зменшити наступний удар на 55%",
  "ctl.dmg": "УРН*",
  "ctl.dmgTitle":
    "Шкода з вашим бонусом; захист ворога та ефективність типів можуть змінити результат",
  "ctl.accTitle": "Остаточний шанс влучання з урахуванням покращень",
  "ctl.critTitle": "Остаточний шанс критичного удару",
  "ctl.crit": "крит",
  "ctl.cd": "КД: {n}",
  "ctl.pp": "{cur}/{max} PP",
  "ctl.left": "Лишилось: {n}",
  "ctl.ready": "ГОТОВО",
  "ctl.immune": "⛔ ІМУНІТЕТ",
  "ctl.immuneTitle": "Цей хід не діє на {name} через імунітет типу.",
  "turn.plans": "План ворога: {plan}",
  "turn.enemy": "Хід {name}...",
  "turn.cleared": "Хвилю пройдено!",
  "turn.ended": "Бій завершено!",
  struggle: "Відчай",
  "status.poison": "Отрута",
  "status.burn": "Опік",
  "aura.fire-coat.name": "Вогняний покрив",
  "aura.fire-coat.desc": "Фізичні атакуючі отримують опік.",
  "aura.thick-hide.name": "Товста шкура",
  "aura.thick-hide.desc": "Імунітет до критичних ударів.",
  "plan.guard": "Захист",
  "log.immune": "<b>{a}</b> використав <b>{m}</b>, але це не діє на {d}...",
  "log.miss":
    "<b>{a}</b> використав <b>{m}</b>, але <b>схибив</b>! Шанс влучання був <b>{acc}%</b>.",
  "log.hit":
    '<b>{a}</b> використав <b>{m}</b> — {d} отримує <b style="color:#e11d48">{dmg} шкоди</b>! [{hp}/{max}]',
  "log.tag.guarded": "Захищено!",
  "log.tag.crit": "💥 Критичний удар!",
  "log.tag.super": "Дуже ефективно!",
  "log.tag.weak": "Малоефективно...",
  "log.tag.ult": "УЛЬТА!",
  "note.thickHide": "🪨 Товста шкура заблокувала критичний удар!",
  "note.overload": "⚡ Перевантаження: гарантований критичний удар!",
  "note.desperate": "🔥 Відчайдушна сила: +50% шкоди!",
  "note.shatter": "🪨 Розлом: +40% проти ворога в захисті!",
  "note.scarf": "🧣 Шарф вибору підсилив перший хід!",
  "note.talentPP": "🎯 Талант тренера: +1 PP для {m}!",
  "note.poisoned": "☠️ {d} отруєно!",
  "note.burned": "🔥 Вогняний покрив обпік {a}!",
  "note.reflect": "✨ Ідеальний захист відбив {n} шкоди!",
  "log.statusDmg":
    "{icons} <b>{name}</b> отримав <b>{dmg}</b> шкоди від статусів. [{hp}/{max}]",
  "game.guardHeal": "✨ Талант тренера: Захист вилікував <b>{n}</b> HP!",
  "game.guardBrace":
    "🛡️ <b>{name}</b> готується до удару. Наступний удар завдасть на 55% менше шкоди.",
  "game.perfectReady":
    "✨ <b>Ідеальний захист</b> готовий: сильний удар буде частково відбито!",
  "game.sash":
    "✨ <b>Пояс фокусу</b> врятував {name} від поразки, залишивши 1 HP!",
  "game.phase2":
    "👑 <b>{name}</b> входить у <b>Фазу 2</b>! Його атаки сильніші, а ульта заряджена!",
  "game.enemyGuard":
    "🛡️ <b>{name}</b> використовує <b>Захист</b>. Ваш наступний удар завдасть на 55% менше шкоди.",
  "game.leftovers": "🍎 <b>Залишки їжі</b> вилікували {name} на {n} HP.",
  "game.exhausted":
    "😵 <b>{name}</b> виснажений і мусить використати <b>Відчай</b>!",
  "game.waveStart":
    "🌊 <b>Хвиля {w}</b>: {boss}{name} ({types}) з'являється! HP {hp}",
  "game.bossPrefix": "👑 БОС ",
  "game.trainers":
    "⚠️ З'явилися тренери! План ворога тепер показує ланцюжок із 2 дій.",
  "game.tip":
    "💡 <b>Порада:</b> Бурштиновий бейдж ходу показує план ворога. Захист зменшує наступний удар на 55%.",
  "game.fainted": "🏆 <b>{name}</b> переможено! Хвилю {w} пройдено.",
  "game.recovered": "💚 {name} відновив {n} HP після бою.",
  "game.cardTaken": "✨ Карту обрано: <b>{title}</b>",
  "game.heroFainted": "💀 <b>{name}</b> програв на хвилі {w}.",
  "ov.loading": "Завантаження...",
  "ov.preparing": "Готуємо вашого покемона...",
  "ov.looking": "Хвиля {w}: шукаємо суперника...",
  "ov.scouting": "Розвідуємо наступного суперника...",
  "ov.apiError": "Помилка PokeAPI",
  "ov.retry": "Повторити",
  "ov.retryDesc": "Спробувати завантажити дані ще раз",
  "ov.restartTitle": "Перезапустити бій?",
  "ov.restartText":
    "Ви впевнені, що хочете перезапустити? Прогрес поточного забігу буде втрачено.",
  "ov.restartYes": "Так, перезапустити",
  "ov.restartYesDesc": "Почати з хвилі 1",
  "ov.cancel": "Скасувати",
  "ov.cancelDesc": "Продовжити бій",
  "ov.codexTitle": "📜 Колода / Кодекс",
  "ov.codexText":
    "Хвиля {w}. Активних карт у забігу: {a}. Відкрито {u} з {total} типів карт.",
  "ov.close": "Закрити",
  "ov.closeDesc": "Назад до бою",
  "ov.locked": "??? Закрита карта",
  "ov.unlocksAt": "Відкривається на хвилі {w}",
  "ov.draftTitle": "Хвилю {w} пройдено!",
  "ov.draftText": "Оберіть карту.",
  "ov.scout": " 🔭 Розвідка: наступний ворог має тип {types}.",
  "ov.scoutFail": " 🔭 Розвідці не вдалося знайти наступного ворога.",
  "ov.reroll": "Реролл",
  "ov.rerollDesc": "Отримати нові карти (раз за забіг)",
  "ov.defeat": "Поразка",
  "ov.defeatText":
    "Ви дійшли до хвилі {w} і перемогли {k} покемонів. Найкраща хвиля: {b}. Отримано BP: {bp}.",
  "ov.tryAgain": "Спробувати ще",
  "ov.tryAgainDesc": "Почати новий забіг",
  "err.noEnemy": "Не вдалося отримати відповідного ворога з PokeAPI",
  "err.noMoves": "{name}: недостатньо атакуючих ходів",
  "cat.offense": "⚔ Атака",
  "cat.defense": "🛡 Захист",
  "cat.tactics": "🧠 Тактика",
  "card.heal.title": "Бенкет ягід",
  "card.heal.desc":
    "Повністю відновлює HP ({n}). Талант Виживання 3: також знімає всі статуси.",
  "card.maxhp.title": "Зростання життєвості",
  "card.maxhp.desc": "Збільшує макс. HP на +30 і лікує поточні рани.",
  "card.crit.title": "Орлине око",
  "card.crit.desc": "Збільшує шанс критичного удару на +12%.",
  "card.accuracy.title": "Зосередженість",
  "card.accuracy.desc": "Збільшує точність усіх ходів на +10%.",
  "card.endurance.title": "Витривалість",
  "card.endurance.desc": "Додає +3 використання до кожного ходу за бій.",
  "card.vampirism.title": "Вампірський дотик",
  "card.vampirism.desc": "Відновлює 15% завданої шкоди як HP.",
  "card.overclock.title": "Перезаряд",
  "card.overclock.desc": "Починайте кожен бій із +25% заряду ульти.",
  "card.overload.title": "Перевантаження",
  "card.overload.desc":
    "Електричний хід одразу після водяного — гарантований критичний удар.",
  "card.shatter.title": "Розлом",
  "card.shatter.desc":
    "Кам'яні/земляні ходи завдають +40% ворогам у захисті, але -10% усім іншим.",
  "card.perfectGuard.title": "Ідеальний захист",
  "card.perfectGuard.desc":
    "Захист, коли в плані ворога понад {n} шкоди: відбиває 25% удару.",
  "card.desperate.title": "Відчайдушна сила",
  "card.desperate.desc": "Хід, у якого лишився лише 1 PP, завдає +50% шкоди.",
  "card.venom.title": "Отруйний удар",
  "card.venom.desc":
    "Фізичні атаки мають 20% шанс отруїти. -5% точності всіх ходів.",
  "card.glassCannon.title": "Скляна гармата",
  "card.glassCannon.desc": "Усі атаки завдають +35% шкоди. Макс. HP -20%.",
  "starter.pikachu": "Збалансований електричний стартовик.",
  "starter.charmander": "Вогонь. Сильні спеціальні атаки.",
  "starter.bulbasaur": "Трава/Отрута. Міцний і стійкий.",
  "starter.squirtle": "Вода. Хороший захист.",
  "starter.gastly": "Привид. Кожен удар має 25% шанс отруїти.",
  "starter.heracross": "Бій/Комаха. Фізичні ходи завдають +15% шкоди.",
  "item.leftovers.name": "Залишки їжі",
  "item.leftovers.desc": "Відновлює 3% макс. HP наприкінці кожного ходу.",
  "item.scarf.name": "Шарф вибору",
  "item.scarf.desc":
    "Перший хід кожного бою завдає +25% шкоди, але витрачає 2x PP.",
  "item.sash.name": "Пояс фокусу",
  "item.sash.desc": "Раз за забіг переживіть смертельний удар із 1 HP.",
  "item.expshare.name": "Розподіл досвіду",
  "item.expshare.desc": "+20% BP за забіг, але -15% макс. HP.",
  "talent.offense.name": "Атака",
  "talent.offense.1": "Критичні удари завдають на +3% більше шкоди.",
  "talent.offense.2":
    "Бонус крита зростає до +5%. Перший надефективний удар за бій відновлює 1 PP цього ходу.",
  "talent.offense.3":
    "Бонус крита зростає до +7%. Ходи з точністю нижче 85% отримують +10% точності.",
  "talent.survival.name": "Виживання",
  "talent.survival.1": "Захист також відновлює 3% макс. HP.",
  "talent.survival.2": "Отрута й опік завдають вам на 50% менше шкоди.",
  "talent.survival.3": "Бенкет ягід також знімає всі негативні статуси.",
  "talent.tactics.name": "Тактика та драфт",
  "talent.tactics.1": "Реролл: один раз за забіг оновіть запропоновані карти.",
  "talent.tactics.2": "Розширення драфту: вибір із 3 карт замість 2.",
  "talent.tactics.3": "Розвідка: бачите тип ворога наступної хвилі.",
  "hub.title": "🏆 Хаб тренера",
  "hub.bp": "Очки тренера (BP): ",
  "hub.note": "Зміни спорядження діють з наступного забігу.",
  "hub.tab.starters": "🐣 Стартовики",
  "hub.tab.items": "📦 Предмети",
  "hub.tab.talents": "🌳 Ліцензія тренера",
  "hub.selected": "Обрано",
  "hub.select": "Обрати",
  "hub.unlock": "Відкрити — {n} BP",
  "hub.equip": "Екіпірувати",
  "hub.unequip": "Зняти",
  "hub.slotNote": "1 слот предмета. Другий слот ще не відкрито.",
  "hub.upgrade": "Покращити — {n} BP",
  "hub.mastered": "Майстерність",
  "hub.newRun": "Почати новий забіг із цим спорядженням",
  "hub.close": "Закрити й продовжити",
  // accounts + leaderboard
  "auth.login": "Вхід",
  "auth.register": "Реєстрація",
  "auth.nick": "Нікнейм",
  "auth.password": "Пароль",
  "auth.hint":
    "Нікнейм: 3–20 літер, цифр, _ або -. Пароль: щонайменше 6 символів. Ваш поточний прогрес на цьому пристрої перенесеться в новий акаунт.",
  "auth.doLogin": "Увійти",
  "auth.doRegister": "Створити акаунт",
  "auth.guest": "Грати як гість",
  "auth.guestNote":
    "Гості можуть грати, але їхні результати не потрапляють до таблиці лідерів, а прогрес зберігається лише в цьому браузері.",
  "auth.logout": "Вийти",
  "auth.signin": "Вхід / Реєстрація",
  "auth.err.bad_nick": "Некоректний нікнейм: 3–20 літер, цифр, _ або -.",
  "auth.err.bad_password": "Пароль має бути від 6 до 100 символів.",
  "auth.err.nick_taken": "Цей нікнейм уже зайнятий.",
  "auth.err.bad_credentials": "Неправильний нікнейм або пароль.",
  "auth.err.too_many_requests": "Забагато спроб. Спробуйте за кілька хвилин.",
  "auth.err.network": "Немає зв'язку із сервером. Перевірте підключення.",
  "auth.err.unknown": "Щось пішло не так. Спробуйте ще раз.",
  "lb.open": "🏅 Таблиця лідерів",
  "lb.title": "🏅 Таблиця лідерів",
  "lb.filter": "Покемон",
  "lb.all": "Усі покемони",
  "lb.player": "Гравець",
  "lb.pokemon": "Покемон",
  "lb.wave": "Хвиля",
  "lb.kills": "Перемог",
  "lb.loading": "Завантаження…",
  "lb.empty": "Результатів ще немає. Будьте першим!",
  "lb.failed": "Не вдалося завантажити таблицю лідерів.",
  "lb.saved": "Результат надіслано до таблиці лідерів.",
};

const DICT = { en, uk };
