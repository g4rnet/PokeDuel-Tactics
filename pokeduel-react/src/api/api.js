const BASE_URL = "https://pokeapi.co/api/v2";

// Зберігати кешовані проміси запитів для уникнення повторних мережевих викликів
const cache = new Map();

// Виконати GET-запит із кешуванням та повторною спробою на випадок тимчасових зяпанів мережі
function getJSON(path) {
  if (!cache.has(path)) {
    const request = (async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(`${BASE_URL}${path}`);
          if (!response.ok)
            throw new Error(`PokeAPI ${response.status}: ${path}`);
          return await response.json();
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    })();

    // Очистити кеш у разі помилки для забезпечення можливості повторного виклику
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return cache.get(path);
}

// Отримати базові дані покемона (стати, типи, спрайти, рухи)
export const fetchPokemon = (idOrName) => getJSON(`/pokemon/${idOrName}`);

// Отримати характеристики здібності (сила, точність, тип)
export const fetchMove = (name) => getJSON(`/move/${name}`);

// Отримати матрицю ефективності типів для розрахунку шкоди
export const fetchType = (name) => getJSON(`/type/${name}`);

// Обмежити вибір противників виключно першим поколінням для балансу гри
export const POKEMON_POOL = { min: 1, max: 151 };
