const I18N_KEY_RE = /^[a-z][a-z0-9]*(\.[a-zA-Z0-9_]+)+$/;
const CNIC_LIKE_RE = /^\d{5}-\d{7}-\d{1}$/;

function humanizeSegment(segment) {
  return String(segment || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Strip internal i18n keys and raw slug labels before UI render.
 * @param {string} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function sanitizeUILabel(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  if (I18N_KEY_RE.test(raw)) {
    const parts = raw.split('.');
    return humanizeSegment(parts[parts.length - 1]) || fallback;
  }

  if (CNIC_LIKE_RE.test(raw)) return raw;

  if (/[_]/.test(raw)) {
    return humanizeSegment(raw) || fallback;
  }

  if (/-/.test(raw) && !CNIC_LIKE_RE.test(raw)) {
    return humanizeSegment(raw) || fallback;
  }

  return raw;
}

/**
 * @param {string} key
 * @param {string} resolved
 * @param {string} [fallback]
 */
export function sanitizeTranslationResult(key, resolved, fallback = '') {
  const out = String(resolved ?? '').trim();
  if (!out || out === String(key || '').trim()) {
    return sanitizeUILabel(key, fallback);
  }
  return sanitizeUILabel(out, fallback);
}
