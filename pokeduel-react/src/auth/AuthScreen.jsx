import React, { useState } from "react";
import logoImg from "../assets/Pokemon_logo.png";
import { login, register, setGuest } from "../api/server.js";
import { t } from "../i18n/i18n.js";

export default function AuthScreen({
  onAuth,
  onGuest,
  onShowLeaderboard,
  localMeta,
}) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Обробити відправку форми автентифікації чи реєстрації з урахуванням стану завантаження
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        const data = await register(nick.trim(), password, localMeta);
        onAuth({ nick: data.nick, meta: data.meta, isNew: true });
      } else {
        const data = await login(nick.trim(), password);
        onAuth({ nick: data.nick, meta: data.meta, isNew: false });
      }
    } catch (err) {
      const key = `auth.err.${err.code}`;
      const msg = t(key);
      setError(msg === key ? t("auth.err.unknown") : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="body lang-screen">
      <form className="lang-box auth-box" onSubmit={submit}>
        <img className="logo" src={logoImg} alt="Pokemon" />
        <div className="hub-tabs">
          {["login", "register"].map((m) => (
            <button
              key={m}
              type="button"
              className={"hub-tab" + (mode === m ? " active" : "")}
              onClick={() => {
                setMode(m);
                setError("");
              }}
            >
              {t(`auth.${m}`)}
            </button>
          ))}
        </div>

        <label className="auth-field">
          <span>{t("auth.nick")}</span>
          <input
            type="text"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={20}
            autoComplete="username"
            required
          />
        </label>
        <label className="auth-field">
          <span>{t("auth.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={100}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
          />
        </label>
        {mode === "register" && <p className="hub-note">{t("auth.hint")}</p>}
        {error && <p className="auth-error">{error}</p>}

        <div className="lang-buttons">
          <button type="submit" className="hub-btn primary" disabled={busy}>
            {busy
              ? "…"
              : t(mode === "register" ? "auth.doRegister" : "auth.doLogin")}
          </button>
        </div>
        <div className="auth-links">
          <button
            type="button"
            className="hub-btn"
            onClick={() => {
              setGuest(true);
              onGuest();
            }}
          >
            {t("auth.guest")}
          </button>
          <button type="button" className="hub-btn" onClick={onShowLeaderboard}>
            {t("lb.open")}
          </button>
        </div>
        <p className="hub-note">{t("auth.guestNote")}</p>
      </form>
    </div>
  );
}
