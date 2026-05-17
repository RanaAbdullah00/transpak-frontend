export function unwrapBody(body) {
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return body.data;
  }
  return body;
}

export function unwrapResponseData(res) {
  return unwrapBody(res?.data);
}

/** API `code` from axios err.response.data (e.g. WRONG_PASSWORD, VALIDATION_ERROR). */
export function unwrapErrorCode(err) {
  const c = err?.response?.data?.code;
  return typeof c === 'string' && c.length ? c : null;
}

/** Error payload from axios err.response.data */
export function unwrapErrorMessage(err) {
  const d = err?.response?.data;
  if (!d) {
    if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      return 'Unable to reach the server. Check backend is running, VITE_API_URL points to Render (https), and CORS allows your Cloudflare Pages URL.';
    }
    return err?.message || '';
  }
  if (typeof d.message === 'string') return d.message;
  if (typeof d.error === 'string') return d.error;
  return err?.message || '';
}
