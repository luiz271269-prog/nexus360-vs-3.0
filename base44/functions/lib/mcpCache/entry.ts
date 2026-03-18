// MCP-style cache com TTL (30min)
const cache = new Map();
const TTL_MS = 30 * 60 * 1000; // 30 minutos

export function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

export function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}