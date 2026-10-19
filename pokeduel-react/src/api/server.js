// ==========================================================
// server.js — PokeDuel backend (accounts, cloud save, leaderboard)
// ==========================================================

const TOKEN_KEY = "pokeduel_token";
const NICK_KEY = "pokeduel_nick";
const GUEST_KEY = "pokeduel_guest";
const API = import.meta.env?.VITE_API_URL || "";

// Абстрагувати роботу з localStorage для обробки помилок доступу в середовищах без підтримки сховища
const ls = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  del: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const getToken = () => ls.get(TOKEN_KEY);
export const getSavedNick = () => ls.get(NICK_KEY);
export const isGuest = () => ls.get(GUEST_KEY) === "1";
export const setGuest = (v) => (v ? ls.set(GUEST_KEY, "1") : ls.del(GUEST_KEY));

// Зберегти стан сесії користувача у локальному сховищі
function saveSession(token, nick) {
  ls.set(TOKEN_KEY, token);
  ls.set(NICK_KEY, nick);
  ls.del(GUEST_KEY);
}

// Очистити дані поточної сесії при виході з облікового запису
export function clearSession() {
  ls.del(TOKEN_KEY);
  ls.del(NICK_KEY);
}

class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// Виконати стандартизований HTTP-запит до бекенду з підтримкою авторизації та обробки помилок
async function request(method, path, body, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(data?.error || "unknown", res.status);
  return data;
}

// Зареєструвати нового користувача та ініціалізувати сесію
export async function register(nick, password, meta) {
  const data = await request("POST", "/register", { nick, password, meta });
  saveSession(data.token, data.nick);
  return data;
}

// Автентифікувати користувача в системі
export async function login(nick, password) {
  const data = await request("POST", "/login", { nick, password });
  saveSession(data.token, data.nick);
  return data;
}

// Завершити сеанс користувача на серверах та локально
export async function logout() {
  try {
    await request("POST", "/logout", undefined, { auth: true });
  } catch {
    /* ignore */
  }
  clearSession();
}

export const fetchMe = () => request("GET", "/me", undefined, { auth: true });

export const saveMetaToServer = (meta) =>
  request("PUT", "/meta", { meta }, { auth: true });

export const submitRun = ({ starter, wave, kills, clicks }) =>
  request("POST", "/runs", { starter, wave, kills, clicks }, { auth: true });

export async function fetchLeaderboard(starter = null) {
  const qs = starter ? `?starter=${encodeURIComponent(starter)}` : "";
  const data = await request("GET", `/leaderboard${qs}`);
  return data.rows;
}
