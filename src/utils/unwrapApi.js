export function unwrapBody(body) {
  if (body == null) return null;
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return body.data ?? null;
  }
  return body;
}

export function unwrapResponseData(res) {
  if (!res || res.data == null) return {};
  return unwrapBody(res.data) ?? {};
}

/** API list endpoints — never return undefined for .map() callers. */
export function unwrapListResponse(res, { key } = {}) {
  const data = unwrapResponseData(res);
  if (key && data && typeof data === 'object' && !Array.isArray(data)) {
    const inner = data[key];
    return Array.isArray(inner) ? inner : [];
  }
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

/** Coerce API list payloads — never throw on undefined.map(). */
export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'object' && Array.isArray(value.items)) return value.items;
  return [];
}

/** Coerce API object payloads — never assume nested keys exist. */
export function ensureObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** Coerce user roles from API (array, string, or PG text[] string). */
export function ensureRolesArray(value) {
  if (Array.isArray(value)) {
    return value.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean);
  }
  if (value == null) return [];
  const s = String(value).trim();
  if (!s) return [];
  if (s.startsWith('{') && s.endsWith('}')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((r) => r.trim().replace(/^"|"$/g, '').toLowerCase())
      .filter(Boolean);
  }
  return [s.toLowerCase()];
}

/** Admin list endpoints — always return an array (never undefined). */
export function ensureAdminList(data, key) {
  if (key && data && typeof data === 'object' && !Array.isArray(data)) {
    return ensureArray(data[key]);
  }
  return ensureArray(data);
}

/** API `code` from axios err.response.data (e.g. WRONG_PASSWORD, VALIDATION_ERROR). */
export function unwrapErrorCode(err) {
  const d = err?.response?.data;
  const c = d?.code ?? d?.error;
  return typeof c === 'string' && c.length ? c : null;
}

/** Error payload from axios err.response.data */
export function unwrapErrorMessage(err) {
  return unwrapErrorDetail(err).displayMessage;
}

/**
 * @returns {{ message: string, code: string|null, error: string|null, displayMessage: string }}
 */
export function unwrapErrorDetail(err) {
  const d = err?.response?.data;
  if (!d || typeof d !== 'object') {
    if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      const networkMsg =
        'Unable to reach the server. Check backend is running, VITE_API_URL points to Render (https), and CORS allows your Cloudflare Pages domain.';
      return { message: networkMsg, code: 'ERR_NETWORK', error: 'ERR_NETWORK', displayMessage: networkMsg };
    }
    const fallback = String(err?.message || '').trim();
    return { message: fallback, code: null, error: null, displayMessage: fallback };
  }

  const message =
    typeof d.message === 'string' && d.message.trim()
      ? d.message.trim()
      : typeof d.error === 'string' && d.error.trim()
        ? d.error.trim()
        : '';
  const code =
    typeof d.code === 'string' && d.code.trim()
      ? d.code.trim()
      : typeof d.error === 'string' && d.error.trim() && d.error !== message
        ? d.error.trim()
        : null;
  const errorField = typeof d.error === 'string' ? d.error.trim() : null;

  let displayMessage = message;
  if (message && code && !message.includes(code)) {
    displayMessage = `${message} (${code})`;
  } else if (!displayMessage && code) {
    displayMessage = code;
  }
  if (!displayMessage) {
    displayMessage = String(err?.message || '').trim();
  }

  return {
    message,
    code,
    error: errorField || code,
    displayMessage
  };
}
