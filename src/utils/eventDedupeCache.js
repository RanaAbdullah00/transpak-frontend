/**
 * Phase 4 — LRU event dedupe cache for tracking socket replay protection.
 */

const DEFAULT_MAX = 1000;
const DEFAULT_TTL_MS = 60_000;

export function createEventDedupeCache({
  maxEntries = DEFAULT_MAX,
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  const entries = new Map();

  function prune(now = Date.now()) {
    for (const [key, ts] of entries) {
      if (now - ts > ttlMs) entries.delete(key);
    }
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest == null) break;
      entries.delete(oldest);
    }
  }

  return {
    has(eventId) {
      const key = String(eventId || '').trim();
      if (!key) return false;
      const ts = entries.get(key);
      if (ts == null) return false;
      if (Date.now() - ts > ttlMs) {
        entries.delete(key);
        return false;
      }
      return true;
    },

    remember(eventId, at = Date.now()) {
      const key = String(eventId || '').trim();
      if (!key) return;
      entries.set(key, at);
      prune(at);
    },

    clearExpired(now = Date.now()) {
      prune(now);
    },

    get size() {
      return entries.size;
    }
  };
}

/** Shared process-wide cache for socket reconnect replay dedupe. */
export const trackingEventDedupeCache = createEventDedupeCache({ maxEntries: 1500, ttlMs: 60_000 });
