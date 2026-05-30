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

/** Resolve full request URL from axios config. */
export function resolveRequestUrl(config) {
  if (!config) return '';
  const url = String(config.url || '');
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(config.baseURL || '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

/**
 * Classify transport-layer failures (CORS, timeout, no response).
 * @returns {{ type: string, code: string, httpStatus: number|null, endpoint: string, displayMessage: string }|null}
 */
export function classifyTransportFailure(err, config) {
  const endpoint = resolveRequestUrl(config);
  const httpStatus = err?.response?.status ?? null;

  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return {
      type: 'TIMEOUT',
      code: 'TIMEOUT',
      httpStatus,
      endpoint,
      displayMessage: `Timeout contacting ${endpoint || 'API'} — no response within limit`
    };
  }

  if (err?.code === 'ERR_NETWORK' || (!err?.response && err?.request)) {
    return {
      type: 'CORS',
      code: 'ERR_NETWORK',
      httpStatus: null,
      endpoint,
      displayMessage: `Network/CORS failure: ${endpoint || 'API'} — no HTTP response (verify VITE_API_URL and Render CORS allowlist)`
    };
  }

  if (httpStatus === 401) {
    return {
      type: 'AUTH',
      code: 'UNAUTHORIZED',
      httpStatus: 401,
      endpoint,
      displayMessage: `Auth required: ${endpoint || 'API'} (HTTP 401)`
    };
  }

  if (httpStatus === 403) {
    return {
      type: 'FORBIDDEN',
      code: 'FORBIDDEN',
      httpStatus: 403,
      endpoint,
      displayMessage: `Forbidden: ${endpoint || 'API'} (HTTP 403)`
    };
  }

  if (httpStatus != null && httpStatus >= 500) {
    return {
      type: 'SERVER',
      code: 'SERVER_ERROR',
      httpStatus,
      endpoint,
      displayMessage: `Server error: ${endpoint || 'API'} (HTTP ${httpStatus})`
    };
  }

  return null;
}

/** Structured API error for UI — endpoint, status, type, message. */
export function formatStructuredApiError(err) {
  const detail = unwrapErrorDetail(err);
  let type = detail.errorType || detail.error || null;
  if (type === 'CORS_OR_NETWORK' || type === 'FORBIDDEN') {
    type = type === 'FORBIDDEN' ? 'AUTH' : 'CORS';
  }
  if (!type && detail.httpStatus === 401) type = 'AUTH';
  if (!type && detail.httpStatus === 403) type = 'AUTH';
  if (!type && detail.httpStatus != null && detail.httpStatus >= 500) type = 'SERVER';
  if (!type && detail.code === 'TIMEOUT') type = 'TIMEOUT';
  if (!type && detail.code === 'ERR_NETWORK') type = 'NETWORK';
  return {
    endpoint: detail.endpoint || resolveRequestUrl(err?.config) || '',
    status: detail.httpStatus ?? err?.response?.status ?? null,
    type: type || (detail.httpStatus ? 'SERVER' : 'NETWORK'),
    message: detail.displayMessage || detail.message || String(err?.message || '').trim()
  };
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
  const transport = classifyTransportFailure(err, err?.config);
  if (transport) {
    return {
      message: transport.displayMessage,
      code: transport.code,
      error: transport.type,
      displayMessage: transport.displayMessage,
      httpStatus: transport.httpStatus,
      endpoint: transport.endpoint,
      errorType: transport.type,
      type: transport.type
    };
  }

  const d = err?.response?.data;
  if (!d || typeof d !== 'object') {
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

  const endpoint = resolveRequestUrl(err?.config);
  const httpStatus = err?.response?.status ?? null;
  if (endpoint && httpStatus && !displayMessage.includes(String(httpStatus))) {
    displayMessage = `${displayMessage} — ${endpoint} (HTTP ${httpStatus})`;
  } else if (endpoint && !displayMessage.includes(endpoint)) {
    displayMessage = `${displayMessage} — ${endpoint}`;
  }

  const bodyEndpoint = typeof d?.endpoint === 'string' ? d.endpoint.trim() : '';
  const bodyType = typeof d?.type === 'string' ? d.type.trim().toUpperCase() : '';
  const bodyStatus = d?.status != null ? Number(d.status) : null;

  return {
    message,
    code,
    error: errorField || code,
    displayMessage: bodyEndpoint && !displayMessage.includes(bodyEndpoint)
      ? `${displayMessage} — ${bodyEndpoint}${bodyStatus ? ` (HTTP ${bodyStatus})` : ''}`
      : displayMessage,
    httpStatus: Number.isFinite(bodyStatus) ? bodyStatus : httpStatus,
    endpoint: bodyEndpoint || endpoint,
    type: bodyType || (httpStatus === 401 || httpStatus === 403 ? 'AUTH' : httpStatus >= 500 ? 'SERVER' : code || null),
    errorType: bodyType || (httpStatus === 401 || httpStatus === 403 ? 'AUTH' : httpStatus >= 500 ? 'SERVER' : code || null)
  };
}
