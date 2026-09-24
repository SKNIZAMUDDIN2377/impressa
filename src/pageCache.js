const pageCache = new Map();

export function setPageCache(key, data) {
  pageCache.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

export function getPageCache(key) {
  return pageCache.get(key) || null;
}

export function hasPageCache(key) {
  return pageCache.has(key);
}

export function clearPageCache(key) {
  if (key) {
    pageCache.delete(key);
    return;
  }

  pageCache.clear();
}

export default pageCache;