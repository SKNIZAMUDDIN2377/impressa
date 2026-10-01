// ==========================================
// IMPRESSA CACHE
// In-memory Map, plus optional persistence in localStorage
// for the Home feed only (so Home paints instantly after a
// reload). Persisted entries expire after 24 hours.
// ==========================================

const memory = new Map();

const STORAGE_PREFIX = "impressa_cache_v1:";

// Only keys starting with one of these are saved to localStorage
const PERSISTED_KEY_PREFIXES = ["home_feed_v2_"];

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const MAX_ENTRY_CHARS = 500000;

const shouldPersist = (key) =>
  typeof key === "string" &&
  PERSISTED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed.t !== "number" ||
      Date.now() - parsed.t > MAX_AGE_MS
    ) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }

    return parsed.v ?? null;
  } catch (error) {
    return null;
  }
};

const removeStored = (key) => {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (error) {
    // ignore
  }
};

// Drop every other persisted entry (e.g. another account's feed)
const purgeOtherStored = (exceptKey) => {
  try {
    const doomed = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);

      if (
        storageKey &&
        storageKey.startsWith(STORAGE_PREFIX) &&
        storageKey !== STORAGE_PREFIX + exceptKey
      ) {
        doomed.push(storageKey);
      }
    }

    doomed.forEach((storageKey) => localStorage.removeItem(storageKey));
  } catch (error) {
    // ignore
  }
};

const writeStored = (key, value) => {
  let text;

  try {
    text = JSON.stringify({ t: Date.now(), v: value });
  } catch (error) {
    return;
  }

  if (text.length > MAX_ENTRY_CHARS) {
    removeStored(key);
    return;
  }

  try {
    localStorage.setItem(STORAGE_PREFIX + key, text);
  } catch (error) {
    // Storage is full: clear other cached feeds and retry once
    purgeOtherStored(key);

    try {
      localStorage.setItem(STORAGE_PREFIX + key, text);
    } catch (retryError) {
      // give up quietly: the in-memory copy still works
    }
  }
};

export const getCache = (key) => {
  if (memory.has(key)) {
    return memory.get(key) || null;
  }

  if (shouldPersist(key)) {
    const stored = readStored(key);

    if (stored !== null) {
      memory.set(key, stored);
      return stored || null;
    }
  }

  return null;
};

export const setCache = (key, value) => {
  memory.set(key, value);

  if (shouldPersist(key)) {
    writeStored(key, value);
  }
};

export const removeCache = (key) => {
  memory.delete(key);

  removeStored(key);
};

export const clearCache = () => {
  memory.clear();

  try {
    const doomed = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);

      if (storageKey && storageKey.startsWith(STORAGE_PREFIX)) {
        doomed.push(storageKey);
      }
    }

    doomed.forEach((storageKey) => localStorage.removeItem(storageKey));
  } catch (error) {
    // ignore
  }
};