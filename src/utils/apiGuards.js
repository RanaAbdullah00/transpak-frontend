/** Null-safe helpers for API payloads — prevents undefined.map / undefined.length crashes. */

export function ensureArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value == null) return fallback;
  if (typeof value === 'object' && Array.isArray(value.items)) return value.items;
  return fallback;
}

export function ensureObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback;
}

/** Coerce list API responses: raw array, { items }, or null. */
export function coerceApiList(data) {
  return ensureArray(data, []);
}

/** Coerce paginated fleet/list payloads. */
export function coercePaginatedList(data) {
  const items = ensureArray(data, []);
  if (Array.isArray(data)) return { items, total: items.length };
  const obj = ensureObject(data);
  const list = ensureArray(obj.items, []);
  return { items: list, total: Number(obj.total) || list.length };
}
