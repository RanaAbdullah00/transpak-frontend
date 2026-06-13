/** Shared completed-shipment history fetch with fallbacks — never throws. */

const COMPLETED_STATUSES = new Set(['closed', 'delivered']);

function isNotFoundError(err) {
  const status = err?.response?.status;
  const code = String(err?.response?.data?.code || '').toUpperCase();
  return status === 404 || code === 'NOT_FOUND';
}

/**
 * @param {Function} request - useApi request
 * @param {{ roles?: string[] }} [opts]
 * @returns {Promise<{ rows: object[], error: null | { retryable: boolean, message: string } }>}
 */
export async function fetchCompletedShipmentRows(request, opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles : [];

  try {
    const history = await request({ url: '/shipments/history', skipGlobalErrorToast: true });
    if (Array.isArray(history) && history.length > 0) {
      return { rows: history, error: null };
    }
  } catch (err) {
    if (!isNotFoundError(err)) {
      return {
        rows: [],
        error: { retryable: true, message: err?.message || 'history_failed' }
      };
    }
  }

  try {
    const data = await request({ url: '/shipments/completed', skipGlobalErrorToast: true });
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (err) {
    if (isNotFoundError(err) && roles.includes('shipper')) {
      try {
        const mine = await request({ url: '/loads/mine', skipGlobalErrorToast: true });
        const rows = (Array.isArray(mine) ? mine : []).filter((l) =>
          COMPLETED_STATUSES.has(String(l.status || '').toLowerCase())
        );
        return { rows, error: null };
      } catch (fallbackErr) {
        return {
          rows: [],
          error: { retryable: true, message: fallbackErr?.message || 'fallback_failed' }
        };
      }
    }
    if (isNotFoundError(err)) {
      return { rows: [], error: null };
    }
    return {
      rows: [],
      error: { retryable: true, message: err?.message || 'completed_failed' }
    };
  }
}

export function saveHistoryCache(userId, rows) {
  if (!userId || !Array.isArray(rows)) return;
  try {
    sessionStorage.setItem(historyCacheKey(userId), JSON.stringify(rows.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function loadHistoryCache(userId) {
  try {
    const raw = sessionStorage.getItem(historyCacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function historyCacheKey(userId) {
  return userId ? `tp:history:cache:${userId}` : 'tp:history:cache';
}

export { COMPLETED_STATUSES };
