export function unwrapBody(body) {
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return body.data;
  }
  return body;
}

export function unwrapResponseData(res) {
  if (!res || res.data == null) return {};
  return unwrapBody(res.data) ?? {};
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
