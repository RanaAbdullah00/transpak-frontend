/** Per-widget admin dashboard error labels — endpoint + status + type, never generic. */
function formatStructuredWidgetError(state) {
  const endpoint = state?.endpoint ? String(state.endpoint) : '';
  const status = state?.httpStatus != null ? Number(state.httpStatus) : null;
  const type = String(state?.errorType || state?.code || 'SERVER').toUpperCase();
  const message = String(state?.error || '').trim();
  const statusPart = status != null && Number.isFinite(status) ? ` (HTTP ${status})` : '';
  const base = endpoint ? `${type}: ${endpoint}${statusPart}` : type;
  return message && !message.includes(endpoint) ? `${base} — ${message}` : base || message;
}

export function describeAdminWidgetError(state, t) {
  if (!state || (!state.error && !state.code && !state.httpStatus)) {
    return t('pages.admin.widgetEmpty');
  }

  const msg = String(state?.error || '').trim();
  if (msg && msg !== 'Unavailable' && !/temporarily unavailable/i.test(msg)) {
    if (state?.endpoint && !msg.includes(String(state.endpoint))) {
      return formatStructuredWidgetError(state);
    }
    if (state?.errorType && !msg.toUpperCase().includes(String(state.errorType).toUpperCase())) {
      return formatStructuredWidgetError(state);
    }
    return msg;
  }

  const status = Number(state?.httpStatus);
  const code = String(state?.code || '').toUpperCase();
  const endpoint = state?.endpoint ? String(state.endpoint) : '';

  if (status === 401 || code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN') {
    return endpoint
      ? `AUTH: ${endpoint} (HTTP 401) — ${t('pages.admin.widgetAuthError')}`
      : t('pages.admin.widgetAuthError');
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'FORBIDDEN_ROLE') {
    return endpoint
      ? `AUTH: ${endpoint} (HTTP 403) — ${t('pages.admin.widgetForbiddenError')}`
      : t('pages.admin.widgetForbiddenError');
  }
  if (status === 503 || code === 'DATABASE_UNAVAILABLE' || code === 'SCHEMA_OUTDATED') {
    return endpoint
      ? `SERVER: ${endpoint} (HTTP ${status || 503}) — ${t('pages.admin.widgetServerError')}`
      : t('pages.admin.widgetServerError');
  }
  if (status >= 500 || code === 'SERVER_ERROR' || code === 'WIDGET_ERROR') {
    return endpoint
      ? `SERVER: ${endpoint} (HTTP ${status}) — ${t('pages.admin.widgetServerError')}`
      : t('pages.admin.widgetServerError');
  }
  if (status === 404 || code === 'NOT_FOUND') {
    return endpoint
      ? `SERVER: ${endpoint} (HTTP 404) — ${t('pages.admin.widgetNotFoundError')}`
      : t('pages.admin.widgetNotFoundError');
  }
  if (
    !status &&
    (code === 'ERR_NETWORK' ||
      code === 'TIMEOUT' ||
      state?.errorType === 'NETWORK' ||
      state?.errorType === 'CORS' ||
      state?.errorType === 'TIMEOUT' ||
      String(state?.error || '').toLowerCase().includes('network'))
  ) {
    const kind =
      state?.errorType === 'TIMEOUT' || code === 'TIMEOUT'
        ? 'TIMEOUT'
        : state?.errorType === 'CORS' || code === 'ERR_NETWORK'
          ? 'CORS'
          : 'NETWORK';
    return endpoint
      ? `${kind}: ${endpoint} — no HTTP response`
      : t('pages.admin.widgetNetworkError');
  }

  return formatStructuredWidgetError(state) || t('pages.admin.widgetDataError');
}
