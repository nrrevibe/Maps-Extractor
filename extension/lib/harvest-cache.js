/**
 * lib/harvest-cache.js
 * Domain-level cache for the Tab Harvester.
 * Skips domains already visited within TTL (default 7 days).
 * Uses chrome.storage.local under the key 'harvest_domain_cache'.
 */

const HarvestCache = (() => {

  const STORAGE_KEY = 'harvest_domain_cache';
  const DEFAULT_TTL_DAYS = 7;

  function getDomain(url) {
    try {
      let d = url.toLowerCase().replace('www.', '');
      if (d.includes('//')) d = d.split('//')[1];
      if (d.includes('/')) d = d.split('/')[0];
      if (d.includes('?')) d = d.split('?')[0];
      return d.trim();
    } catch (e) {
      return url;
    }
  }

  async function getCache() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, res => {
        resolve(res[STORAGE_KEY] || {});
      });
    });
  }

  async function setCache(cache) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY]: cache }, resolve);
    });
  }

  async function isCached(url, ttlDays = DEFAULT_TTL_DAYS) {
    const domain = getDomain(url);
    const cache = await getCache();
    const entry = cache[domain];
    if (!entry) return false;
    const ageMs = Date.now() - entry.ts;
    return ageMs < ttlDays * 24 * 60 * 60 * 1000;
  }

  async function markCached(url) {
    const domain = getDomain(url);
    const cache = await getCache();
    cache[domain] = { ts: Date.now() };
    await setCache(cache);
  }

  async function clearExpired(ttlDays = DEFAULT_TTL_DAYS) {
    const cache = await getCache();
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
    const cleaned = {};
    for (const [domain, entry] of Object.entries(cache)) {
      if (entry.ts > cutoff) cleaned[domain] = entry;
    }
    await setCache(cleaned);
  }

  async function clearAll() {
    await setCache({});
  }

  return { isCached, markCached, clearExpired, clearAll, getDomain };
})();
