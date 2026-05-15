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
    if (err?.message === 'Network Error') {
      return 'Unable to reach the server. In production set VITE_API_URL=https://transpak-backend.onrender.com when building the frontend. Check Render DATABASE_URL and CORS for your Cloudflare Pages URL.';
    }
    return err?.message || '';
  }
  if (typeof d.message === 'string') return d.message;
  if (typeof d.error === 'string') return d.error;
  return err?.message || '';
}
