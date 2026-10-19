import React, { useEffect, useState } from "react";
import { fetchLeaderboard } from "../api/server.js";
import { STARTERS } from "../game/meta.js";
import { t } from "../i18n/i18n.js";

export default function Leaderboard({ myNick, onClose }) {
  const [starter, setStarter] = useState("");
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  // Завантажити актуальні дані таблиці лідерів з урахуванням обраного фільтра стартового покемона
  useEffect(() => {
    let alive = true;
    setRows(null);
    setFailed(false);
    fetchLeaderboard(starter || null)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [starter]);

  return (
    <div className="overlay open">
      <div className="overlay-box hub-box">
        <h2>{t("lb.title")}</h2>

        <label className="auth-field lb-filter">
          <span>{t("lb.filter")}</span>
          <select value={starter} onChange={(e) => setStarter(e.target.value)}>
            <option value="">{t("lb.all")}</option>
            {Object.values(STARTERS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {failed && <p className="auth-error">{t("lb.failed")}</p>}
        {!failed && rows === null && (
          <p className="hub-note">{t("lb.loading")}</p>
        )}
        {rows && rows.length === 0 && (
          <p className="hub-note">{t("lb.empty")}</p>
        )}

        {rows && rows.length > 0 && (
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("lb.player")}</th>
                <th>{t("lb.pokemon")}</th>
                <th>{t("lb.wave")}</th>
                <th>{t("lb.kills")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.nick}
                  className={
                    r.nick.toLowerCase() === (myNick || "").toLowerCase()
                      ? "me"
                      : ""
                  }
                >
                  <td>{i + 1}</td>
                  <td>{r.nick}</td>
                  <td>{STARTERS[r.starter]?.name || r.starter}</td>
                  <td>{r.wave}</td>
                  <td>{r.kills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="hub-footer">
          <button type="button" className="hub-btn primary" onClick={onClose}>
            {t("hub.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
