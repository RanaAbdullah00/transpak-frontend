import api from './api.js';

const MAX_ENTRIES = 400;
/** @type {Map<string, string>} */
const memoryCache = new Map();
/** @type {Map<string, Promise<string>>} */
const inflight = new Map();

function stableKey(target, text) {
  let h = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${target}:${s.length}:${h}`;
}

function cacheSet(key, value) {
  if (memoryCache.size >= MAX_ENTRIES) {
    const first = memoryCache.keys().next().value;
    if (first != null) memoryCache.delete(first);
  }
  memoryCache.set(key, value);
}

/**
 * Backend-proxied translation (LibreTranslate optional). Per-target cache + in-flight dedupe.
 */
export async function translateDynamicText(text, targetLang) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const target = targetLang === 'ur' ? 'ur' : 'en';
  const key = stableKey(target, raw);
  if (memoryCache.has(key)) return memoryCache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const res = await api.post('/translations/runtime', { text: raw, target });
      const payload = res?.data;
      const out =
        typeof payload?.translated === 'string'
          ? payload.translated
          : typeof payload === 'string'
            ? payload
            : raw;
      cacheSet(key, out);
      return out;
    } catch {
      cacheSet(key, raw);
      return raw;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function clearRuntimeTranslationCache() {
  memoryCache.clear();
  inflight.clear();
}
