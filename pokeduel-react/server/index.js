// ==========================================================
// PokeDuel server — акаунти, хмарне збереження, таблиця лідерів
// Express + libSQL (@libsql/client).
//   - Production: хмарна база даних Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
//   - Local dev:  звичайний файл SQLite (server/pokeduel.db) — налаштування не потрібне
// Паролі хешуються за допомогою scrypt з node:crypto.
// ==========================================================
import express from "express";
import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DIST_DIR = process.env.DIST_DIR || path.join(__dirname, "..", "dist");
const SESSION_DAYS = 60;

// Має збігатися з STARTERS у src/game/meta.js
const STARTERS = [
  "pikachu",
  "charmander",
  "bulbasaur",
  "squirtle",
  "gastly",
  "heracross",
];
const MAX_WAVE = 500; // Ліміт перевірки на валідність

// ---------- БД ----------
const REMOTE_URL = process.env.TURSO_DATABASE_URL;

function localDbUrl() {
  // DB_FILE=/some/path.db перевизначає шлях за замовчуванням server/pokeduel.db
  if (process.env.DB_FILE) return `file:${process.env.DB_FILE}`;
  const rel = path.relative(process.cwd(), path.join(__dirname, "pokeduel.db"));
  return `file:${rel.split(path.sep).join("/")}`; // Специфікація шлях із прямими слешами працює і в Windows
}

const db = createClient(
  REMOTE_URL
    ? { url: REMOTE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: localDbUrl() },
);

if (
  !REMOTE_URL &&
  (process.env.NODE_ENV === "production" || process.env.RENDER)
) {
  console.warn(
    "⚠️  TURSO_DATABASE_URL не задано: використовується локальний файл. На безкоштовному хостингу цей файл стирається " +
      "під час кожного перезапуску, через що всі акаунти будуть втрачені. Налаштуйте TURSO_DATABASE_URL та TURSO_AUTH_TOKEN.",
  );
}

if (!REMOTE_URL) {
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
}

await db.batch(
  [
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nick TEXT NOT NULL,
        nick_key TEXT NOT NULL UNIQUE,
        salt TEXT NOT NULL,
        hash TEXT NOT NULL,
        meta TEXT,
        created_at INTEGER NOT NULL
       )`,
    `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
       )`,
    `CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        starter TEXT NOT NULL,
        wave INTEGER NOT NULL,
        kills INTEGER NOT NULL,
        clicks INTEGER NOT NULL,
        created_at INTEGER NOT NULL
       )`,
    "CREATE INDEX IF NOT EXISTS idx_runs_wave ON runs(wave DESC, created_at ASC)",
    "CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id)",
  ],
  "write",
);

// Допоміжні функції: кожен запит тепер асинхронний (база даних працює через мережу)
const run = (sql, args = []) => db.execute({ sql, args });
const one = async (sql, args = []) => {
  const row = (await run(sql, args)).rows[0];
  return row ? { ...row } : null; // Звичайний об'єкт
};
const all = async (sql, args = []) =>
  (await run(sql, args)).rows.map((r) => ({ ...r }));

const Q = {
  userByNick: "SELECT * FROM users WHERE nick_key = ?",
  insertUser:
    "INSERT INTO users (nick, nick_key, salt, hash, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  insertSession:
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  sessionUser: `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ?`,
  deleteSession: "DELETE FROM sessions WHERE token_hash = ?",
  purgeSessions: "DELETE FROM sessions WHERE expires_at <= ?",
  saveMeta: "UPDATE users SET meta = ? WHERE id = ?",
  insertRun:
    "INSERT INTO runs (user_id, starter, wave, kills, clicks, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  // Один рядок на гравця: їхній найкращий забіг (найвища хвиля; збіги -> більше вбивств, далі найраніший за часом)
  // args: [starter, starter, limit]
  leaderboard: `SELECT nick, starter, wave, kills, created_at FROM (
        SELECT u.nick, r.starter, r.wave, r.kills, r.created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY r.user_id
                 ORDER BY r.wave DESC, r.kills DESC, r.created_at ASC
               ) AS rn
        FROM runs r JOIN users u ON u.id = r.user_id
        WHERE (? IS NULL OR r.starter = ?)
       ) WHERE rn = 1
       ORDER BY wave DESC, kills DESC, created_at ASC
       LIMIT ?`,
};

// ---------- Допоміжні утиліти ----------
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const now = () => Date.now();
// SQLite NOCASE опрацьовує лише ASCII, тому кириличні нікнейми порівнюються за допомогою нижнього регістру ключа
const nickKey = (n) => n.toLocaleLowerCase("en-US");

// Express 4 самостійно не перехоплює помилки з асинхронних обробників
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, salt, hash) {
  const a = Buffer.from(hashPassword(password, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await run(Q.insertSession, [
    sha256(token),
    userId,
    now() + SESSION_DAYS * 86400_000,
  ]);
  return token;
}

// Нікнейм: 3-20 символів, букви (включно з українськими/кириличними), цифри, _ та -
const NICK_RE = /^[\p{L}\p{N}_-]{3,20}$/u;

// Дуже простий обмежувач запитів у пам'яті (rate limiter за IP + група маршрутів)
const hits = new Map();
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const t = now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max)
      return res.status(429).json({ error: "too_many_requests" });
    arr.push(t);
    hits.set(key, arr);
    next();
  };
}
setInterval(() => {
  const t = now();
  for (const [k, arr] of hits)
    if (!arr.some((x) => t - x < 3600_000)) hits.delete(k);
  run(Q.purgeSessions, [t]).catch((e) =>
    console.error("не вдалося очистити сесії:", e.message),
  );
}, 600_000).unref();

const auth = wrap(async (req, res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "unauthorized" });
  const user = await one(Q.sessionUser, [sha256(token), now()]);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  req.user = user;
  req.tokenHash = sha256(token);
  next();
});

const safeJson = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

// Обмежити хмарне збереження коректною структурою, щоб ніхто не завантажував сміття чи зайві дані
function sanitizeMeta(m) {
  if (!m || typeof m !== "object") return null;
  const int = (v, max) =>
    Math.max(0, Math.min(max, Number.isFinite(+v) ? Math.floor(+v) : 0));
  const list = (v, allowed) =>
    Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : [];
  const talents = m.unlockedTalents || {};
  const selected = STARTERS.includes(m.selectedStarter)
    ? m.selectedStarter
    : "pikachu";
  const items = ["leftovers", "scarf", "sash", "expshare"];
  const unlockedStarters = list(m.unlockedStarters, STARTERS);
  if (!unlockedStarters.includes("pikachu"))
    unlockedStarters.unshift("pikachu");
  return {
    bp: int(m.bp, 1_000_000),
    unlockedStarters,
    selectedStarter: unlockedStarters.includes(selected) ? selected : "pikachu",
    unlockedItems: list(m.unlockedItems, items),
    equippedItem: items.includes(m.equippedItem) ? m.equippedItem : null,
    unlockedTalents: {
      offense: int(talents.offense, 3),
      survival: int(talents.survival, 3),
      tactics: int(talents.tactics, 3),
    },
  };
}

// ---------- Додаток ----------
const app = express();
app.set("trust proxy", 1); // Працює позаду проксі сервісу (наприклад, nginx або хостингу)
app.use(express.json({ limit: "20kb" }));

const authLimiter = rateLimit("auth", 20, 10 * 60_000);

// Проста перевірка статусу, яка не чіпає базу даних (зручно для перевірки працездатності хостингом)
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post(
  "/api/register",
  authLimiter,
  wrap(async (req, res) => {
    const nick = String(req.body?.nick ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!NICK_RE.test(nick)) return res.status(400).json({ error: "bad_nick" });
    if (password.length < 6 || password.length > 100)
      return res.status(400).json({ error: "bad_password" });
    if (await one(Q.userByNick, [nickKey(nick)]))
      return res.status(409).json({ error: "nick_taken" });

    const salt = crypto.randomBytes(16).toString("hex");
    const meta = sanitizeMeta(req.body?.meta); // Прогрес, набраний у режимі гостя, переноситься
    let info;
    try {
      info = await run(Q.insertUser, [
        nick,
        nickKey(nick),
        salt,
        hashPassword(password, salt),
        meta ? JSON.stringify(meta) : null,
        now(),
      ]);
    } catch (e) {
      // Двоє користувачів реєструють однаковий нікнейм водночас
      if (/UNIQUE|constraint/i.test(String(e?.message)))
        return res.status(409).json({ error: "nick_taken" });
      throw e;
    }
    const token = await createSession(Number(info.lastInsertRowid));
    res.json({ token, nick, meta });
  }),
);

app.post(
  "/api/login",
  authLimiter,
  wrap(async (req, res) => {
    const nick = String(req.body?.nick ?? "").trim();
    const password = String(req.body?.password ?? "");
    const user = one(Q.userByNick, [nickKey(nick)]);
    const resolvedUser = await user;
    // Однакова помилка для "користувача не знайдено" та "неправильного пароля"
    if (
      !resolvedUser ||
      !verifyPassword(password, resolvedUser.salt, resolvedUser.hash)
    ) {
      return res.status(401).json({ error: "bad_credentials" });
    }
    const token = await createSession(resolvedUser.id);
    res.json({
      token,
      nick: resolvedUser.nick,
      meta: safeJson(resolvedUser.meta),
    });
  }),
);

app.post(
  "/api/logout",
  auth,
  wrap(async (req, res) => {
    await run(Q.deleteSession, [req.tokenHash]);
    res.json({ ok: true });
  }),
);

app.get("/api/me", auth, (req, res) => {
  res.json({ nick: req.user.nick, meta: safeJson(req.user.meta) });
});

app.put(
  "/api/meta",
  auth,
  rateLimit("meta", 120, 60_000),
  wrap(async (req, res) => {
    const meta = sanitizeMeta(req.body?.meta);
    if (!meta) return res.status(400).json({ error: "bad_meta" });
    await run(Q.saveMeta, [JSON.stringify(meta), req.user.id]);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/runs",
  auth,
  rateLimit("runs", 60, 60_000),
  wrap(async (req, res) => {
    const { starter, wave, kills, clicks } = req.body || {};
    const w = Math.floor(+wave),
      k = Math.floor(+kills),
      c = Math.floor(+clicks) || 0;
    if (!STARTERS.includes(starter))
      return res.status(400).json({ error: "bad_starter" });
    if (
      !(w >= 1 && w <= MAX_WAVE) ||
      !(k >= 0 && k <= w) ||
      c < 0 ||
      c > 1_000_000
    ) {
      return res.status(400).json({ error: "bad_run" });
    }
    await run(Q.insertRun, [req.user.id, starter, w, k, c, now()]);
    res.json({ ok: true });
  }),
);

app.get(
  "/api/leaderboard",
  rateLimit("lb", 120, 60_000),
  wrap(async (req, res) => {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50));
    const starter = STARTERS.includes(req.query.starter)
      ? req.query.starter
      : null;
    res.json({ rows: await all(Q.leaderboard, [starter, starter, limit]) });
  }),
);

// ---------- Роздача зібраної гри (npm run build -> dist/) ----------
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) =>
    res.sendFile(path.join(DIST_DIR, "index.html")),
  );
}

// ---------- Обробка помилок ----------
app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({ error: status === 500 ? "server_error" : "bad_request" });
});

app.listen(PORT, () =>
  console.log(`Сервер PokeDuel працює на http://localhost:${PORT}`),
);
