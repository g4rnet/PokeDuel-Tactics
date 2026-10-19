// ==========================================================
// App.jsx — PokeDuel: Tactics (EN/UK)
// ==========================================================
import React, { useEffect, useRef, useState } from "react";
import logoImg from "./assets/Pokemon_logo.png";
import { initGame, updateConfig, restartRun } from "./game/game.js";
import {
  loadMeta,
  saveMeta,
  clearLocalMeta,
  STARTERS,
  ITEMS,
  TALENTS,
  buyStarter,
  buyItem,
  upgradeTalent,
} from "./game/meta.js";
import "./css/style-reset.css";
import "./css/style.css";
import "./css/style-extra.css";
import "./css/style-cards.css";
import { getLang, setLang, applyLang, t } from "./i18n/i18n.js";
import {
  getToken,
  getSavedNick,
  isGuest,
  setGuest,
  clearSession,
  logout,
  fetchMe,
  saveMetaToServer,
  submitRun,
} from "./api/server.js";
import AuthScreen from "./auth/AuthScreen.jsx";
import Leaderboard from "./auth/Leaderboard.jsx";

// Відобразити екран вибору мови під час першого відвідування
function LanguageScreen({ onPick }) {
  return (
    <div className="body lang-screen">
      <div className="lang-box">
        <img className="logo" src={logoImg} alt="Pokemon" />
        <h2>Оберіть мову / Choose your language</h2>
        <div className="lang-buttons">
          <button type="button" className="hub-btn primary" onClick={() => onPick("uk")}>
            🇺🇦 Українська
          </button>
          <button type="button" className="hub-btn primary" onClick={() => onPick("en")}>
            🇬🇧 English
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(getLang());
  if (!lang) {
    return (
      <LanguageScreen
        onPick={(l) => {
          setLang(l);
          applyLang(l);
          setLangState(l);
        }}
      />
    );
  }
  applyLang(lang);
  return <Root />;
}

// Визначити необхідний до відображення стан: відновлення сесії, екран авторизації чи саму гру
function Root() {
  const [session, setSession] = useState(() => {
    if (getToken()) return { status: "checking" };
    if (isGuest()) return { status: "ready", user: null, meta: loadMeta() };
    return { status: "auth" };
  });
  const [showLb, setShowLb] = useState(false);

  const restore = () => {
    setSession({ status: "checking" });
    fetchMe()
      .then(({ nick, meta }) => {
        if (meta) saveMeta(meta); // Дані з сервера є джерелом істини
        setSession({ status: "ready", user: { nick }, meta: loadMeta() });
      })
      .catch((err) => {
        if (err.status === 401) {
          clearSession();
          setSession({ status: "auth" });
        } else {
          setSession({ status: "offline" });
        }
      });
  };

  useEffect(() => {
    if (session.status === "checking") restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let screen;
  if (session.status === "ready") {
    screen = (
      <Game
        user={session.user}
        initialMeta={session.meta}
        onShowLeaderboard={() => setShowLb(true)}
      />
    );
  } else if (session.status === "auth") {
    screen = (
      <AuthScreen
        localMeta={loadMeta()}
        onShowLeaderboard={() => setShowLb(true)}
        onGuest={() => setSession({ status: "ready", user: null, meta: loadMeta() })}
        onAuth={({ nick, meta }) => {
          if (meta) saveMeta(meta);
          setSession({ status: "ready", user: { nick }, meta: loadMeta() });
        }}
      />
    );
  } else if (session.status === "offline") {
    screen = (
      <div className="body lang-screen">
        <div className="lang-box">
          <p className="auth-error">{t("auth.err.network")}</p>
          <div className="lang-buttons">
            <button type="button" className="hub-btn primary" onClick={restore}>
              ↻
            </button>
            <button
              type="button"
              className="hub-btn"
              onClick={() => {
                clearSession();
                setGuest(true);
                setSession({ status: "ready", user: null, meta: loadMeta() });
              }}
            >
              {t("auth.guest")}
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    screen = <div className="body lang-screen" />; // Перевірка збереженої сесії
  }

  return (
    <>
      {screen}
      {showLb && (
        <Leaderboard
          myNick={session.user?.nick || getSavedNick()}
          onClose={() => setShowLb(false)}
        />
      )}
    </>
  );
}

function Game({ user, initialMeta, onShowLeaderboard }) {
  const [meta, setMeta] = useState(initialMeta);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [tab, setTab] = useState("starters");
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const userRef = useRef(user);
  userRef.current = user;

  // Ініціювати гру одноразово; надалі конфігурація оновлюється через updateConfig
  useEffect(() => {
    try {
      const m = metaRef.current;
      initGame({
        starter: m.selectedStarter,
        item: m.equippedItem,
        talents: m.unlockedTalents,
        onRunEnd: ({ earned, starter, wave, kills, clicks }) => {
          setMeta((prev) => ({ ...prev, bp: prev.bp + earned }));
          // Потрапляти до таблиці лідерів можуть лише авторизовані гравці
          if (userRef.current) {
            submitRun({ starter, wave, kills, clicks }).catch((err) =>
              console.error("Failed to submit run", err),
            );
          }
        },
      });
    } catch (err) {
      console.error("Game initialization error:", err);
    }
  }, []);

  // Будь-яка зміна мета-даних: зберегти та передати в гру (застосується з наступного забігу)
  useEffect(() => {
    saveMeta(meta);
    updateConfig({
      starter: meta.selectedStarter,
      item: meta.equippedItem,
      talents: meta.unlockedTalents,
    });
  }, [meta]);

  // Хмарне збереження для авторизованих гравців із затримкою (debounced)
  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => {
      saveMetaToServer(meta).catch((err) => {
        if (err.status === 401) {
          clearSession();
          window.location.reload();
        } else {
          console.error("Failed to sync progress", err);
        }
      });
    }, 800);
    return () => clearTimeout(id);
  }, [meta, user]);

  const handleLogout = async () => {
    await logout();
    clearLocalMeta();
    window.location.reload();
  };

  const handleSignIn = () => {
    setGuest(false);
    window.location.reload();
  };

  const apply = (updated) => {
    if (updated) setMeta(updated);
  };

  return (
    <div className="body">
      <header>
        <img
          className="logo"
          title={t("hud.resetTitle")}
          id="btn-reset"
          src={logoImg}
          alt="Pokemon"
        />
        <div className="hud">
          <span className="wave-badge" id="wave-badge">
            {t("hud.wave", { n: 1 })}
          </span>
          <span className="click-counter" id="click-counter">
            {t("hud.clicks", { n: 0 })}
          </span>
          {/* Кнопка Хабу Тренера */}
          <button
            className="codex-btn"
            onClick={() => setIsHubOpen(true)}
            style={{ borderColor: "#aa3bff", color: "#aa3bff" }}
          >
            {t("hud.hub", { bp: meta.bp })}
          </button>
          <button className="codex-btn" id="btn-codex">
            {t("hud.codex")}
          </button>
          <button className="codex-btn" onClick={onShowLeaderboard}>
            {t("lb.open")}
          </button>
          {user ? (
            <>
              <span className="auth-user">👤 {user.nick}</span>
              <button className="codex-btn" onClick={handleLogout}>
                {t("auth.logout")}
              </button>
            </>
          ) : (
            <button className="codex-btn" onClick={handleSignIn}>
              {t("auth.signin")}
            </button>
          )}
          <button
            className="codex-btn"
            onClick={() => {
              setLang(getLang() === "uk" ? "en" : "uk");
              window.location.reload();
            }}
          >
            {t("lang.switch")}: {getLang() === "uk" ? "EN" : "UA"}
          </button>
        </div>
      </header>

      <div className="playground">
        {/* Герой */}
        <div className="pokemon character" id="poke-character">
          <span className="lvl">Lv. 1</span>
          <span className="type-tag"></span>
          <img src="" className="sprite" alt="" />
          <div className="details">
            <h2 className="name" id="name-character"></h2>
            <div className="tags-row">
              <span className="aura-tag"></span>
              <span className="status-tag"></span>
            </div>
            <div className="hp">
              <div className="bar">
                <div
                  className="health"
                  id="progressbar-character"
                  style={{ width: "100%" }}
                ></div>
              </div>
              <div className="charge" title="Ult charge">
                <div className="charge-fill"></div>
              </div>
              <span className="text" id="health-character"></span>
            </div>
            <div className="passives" id="passives-hero"></div>
          </div>
        </div>

        <div className="control-panel">
          <div id="turn-indicator" className="turn-badge">
            {t("hud.yourTurn")}
          </div>
          <div className="control" id="control-buttons"></div>
        </div>

        {/* Ворог */}
        <div className="pokemon enemy" id="poke-enemy">
          <span className="lvl">Lv. 1</span>
          <span className="type-tag"></span>
          <img src="" className="sprite" alt="" />
          <div className="details">
            <h2 className="name" id="name-enemy"></h2>
            <div className="tags-row">
              <span className="aura-tag"></span>
              <span className="status-tag"></span>
            </div>
            <div className="hp">
              <div className="bar">
                <div
                  className="health"
                  id="progressbar-enemy"
                  style={{ width: "100%" }}
                ></div>
              </div>
              <div className="charge" title="Ult charge">
                <div className="charge-fill"></div>
              </div>
              <span className="text" id="health-enemy"></span>
            </div>
            <div className="passives" id="passives-enemy"></div>
          </div>
        </div>
      </div>

      <div id="logs" className="logs-container"></div>

      {/* Модальне вікно гри (оверлей) */}
      <div id="overlay" className="overlay">
        <div className="overlay-box">
          <h2 id="overlay-title"></h2>
          <p id="overlay-text"></p>
          <div id="overlay-choices" className="choices"></div>
        </div>
      </div>

      {/* Модальне вікно Хабу Тренера */}
      {isHubOpen && (
        <div className="overlay open">
          <div className="overlay-box hub-box">
            <h2>{t("hub.title")}</h2>
            <p>
              {t("hub.bp")}<b>{meta.bp}</b>
            </p>
            <p className="hub-note">{t("hub.note")}</p>

            <div className="hub-tabs">
              {[
                ["starters", t("hub.tab.starters")],
                ["items", t("hub.tab.items")],
                ["talents", t("hub.tab.talents")],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={"hub-tab" + (tab === id ? " active" : "")}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "starters" && (
              <div className="hub-grid">
                {Object.values(STARTERS).map((s) => {
                  const owned = meta.unlockedStarters.includes(s.id);
                  const selected = meta.selectedStarter === s.id;
                  return (
                    <div key={s.id} className={"hub-card" + (selected ? " selected" : "")}>
                      <b>{s.name}</b>
                      <span>{s.blurb}</span>
                      {owned ? (
                        <button
                          type="button"
                          className="hub-btn"
                          disabled={selected}
                          onClick={() => apply({ ...meta, selectedStarter: s.id })}
                        >
                          {selected ? t("hub.selected") : t("hub.select")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="hub-btn buy"
                          disabled={meta.bp < s.cost}
                          onClick={() => apply(buyStarter(meta, s.id))}
                        >
                          {t("hub.unlock", { n: s.cost })}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "items" && (
              <div className="hub-grid">
                {Object.values(ITEMS).map((it) => {
                  const owned = meta.unlockedItems.includes(it.id);
                  const equipped = meta.equippedItem === it.id;
                  return (
                    <div key={it.id} className={"hub-card" + (equipped ? " selected" : "")}>
                      <b>{it.name}</b>
                      <span>{it.desc}</span>
                      {owned ? (
                        <button
                          type="button"
                          className="hub-btn"
                          onClick={() => apply({ ...meta, equippedItem: equipped ? null : it.id })}
                        >
                          {equipped ? t("hub.unequip") : t("hub.equip")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="hub-btn buy"
                          disabled={meta.bp < it.cost}
                          onClick={() => apply(buyItem(meta, it.id))}
                        >
                          {t("hub.unlock", { n: it.cost })}
                        </button>
                      )}
                    </div>
                  );
                })}
                <p className="hub-note">{t("hub.slotNote")}</p>
              </div>
            )}

            {tab === "talents" && (
              <div className="hub-grid talents">
                {Object.entries(TALENTS).map(([branch, tl]) => {
                  const level = meta.unlockedTalents[branch];
                  const maxed = level >= tl.cost.length;
                  return (
                    <div key={branch} className="hub-card">
                      <b>
                        {tl.icon} {tl.name} — {t("hud.lvl", { n: level })}/{tl.cost.length}
                      </b>
                      <ul className="talent-levels">
                        {tl.levels.map((text, i) => (
                          <li key={i} className={i < level ? "done" : ""}>
                            {i < level ? "✔ " : `${i + 1}. `}
                            {text}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="hub-btn buy"
                        disabled={maxed || meta.bp < tl.cost[level]}
                        onClick={() => apply(upgradeTalent(meta, branch))}
                      >
                        {maxed ? t("hub.mastered") : t("hub.upgrade", { n: tl.cost[level] })}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="hub-footer">
              <button
                type="button"
                className="hub-btn"
                onClick={() => {
                  setIsHubOpen(false);
                  restartRun();
                }}
              >
                {t("hub.newRun")}
              </button>
              <button type="button" className="hub-btn primary" onClick={() => setIsHubOpen(false)}>
                {t("hub.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="catch_screen"></div>
    </div>
  );
}