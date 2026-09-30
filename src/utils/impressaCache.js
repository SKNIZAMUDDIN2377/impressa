// ==========================================
// IMPRESSA IN-MEMORY CACHE
// ==========================================

const cache = new Map();

export const getCache = (key) => {
  return cache.get(key) || null;
};

export const setCache = (key, value) => {
  cache.set(key, value);
};

export const removeCache = (key) => {
  cache.delete(key);
};

export const clearCache = () => {
  cache.clear();
};