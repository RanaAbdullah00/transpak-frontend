/** Per-widget admin dashboard error labels — never collapse all failures into one generic message. */
export function describeAdminWidgetError(state, t) {
  if (!state || (!state.error && !state.code && !state.httpStatus)) {
    return t('pages.admin.widgetEmpty');
  }

  const status = Number(state?.httpStatus);
  const code = String(state?.code || '').toUpperCase();

  if (status === 401 || code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN') {
    return t('pages.admin.widgetAuthError');
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'FORBIDDEN_ROLE') {
    return t('pages.admin.widgetForbiddenError');
  }
  if (status === 503 || code === 'DATABASE_UNAVAILABLE' || code === 'SCHEMA_OUTDATED') {
    return t('pages.admin.widgetServerError');
  }
  if (status >= 500 || code === 'SERVER_ERROR' || code === 'WIDGET_ERROR') {
    return t('pages.admin.widgetServerError');
  }
  if (status === 404 || code === 'NOT_FOUND') {
    return t('pages.admin.widgetNotFoundError');
  }
  if (!status && (code === 'ERR_NETWORK' || String(state?.error || '').toLowerCase().includes('network'))) {
    return t('pages.admin.widgetNetworkError');
  }

  const msg = String(state?.error || '').trim();
  if (msg && msg !== 'Unavailable' && !/temporarily unavailable/i.test(msg)) {
    return msg;
  }
  return t('pages.admin.widgetDataError');
}
