import { sanitizeProductText } from './userErrors.js';

/** Admin widget errors — product-only copy (no endpoints, HTTP codes, or infra). */
export function describeAdminWidgetError(state, t) {
  if (!state || (!state.error && !state.code && !state.httpStatus)) {
    return t('pages.admin.widgetEmpty');
  }

  const status = Number(state?.httpStatus);
  const code = String(state?.code || '').toUpperCase();
  const rawMsg = sanitizeProductText(state?.error);

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
  if (
    !status &&
    (code === 'ERR_NETWORK' ||
      code === 'TIMEOUT' ||
      state?.errorType === 'NETWORK' ||
      state?.errorType === 'CORS' ||
      state?.errorType === 'TIMEOUT' ||
      String(state?.error || '').toLowerCase().includes('network'))
  ) {
    return t('pages.admin.widgetNetworkError');
  }

  return rawMsg || t('pages.admin.widgetDataError');
}
