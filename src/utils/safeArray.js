/** Null-safe list/object helpers — prevents undefined.map / .length crashes in production. */

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'object' && Array.isArray(value.items)) return value.items;
  return [];
}

export function ensureObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function ensureNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Admin list API responses — always returns an array. */
export function ensureAdminListResponse(data, { key } = {}) {
  if (key && data && typeof data === 'object' && !Array.isArray(data)) {
    return ensureArray(data[key]);
  }
  return ensureArray(data);
}

/** Default empty admin dashboard live shape (lists never undefined). */
export const EMPTY_ADMIN_DASHBOARD_LIVE = Object.freeze({
  meta: { dbReachable: true, partialFailure: false, widgetMode: true },
  stats: { generatedAt: new Date(0).toISOString() },
  observability: null,
  recentLoads: [],
  recentBids: [],
  recentShipments: [],
  recentUsers: [],
  auditEvents: [],
  recentDisputes: [],
  anyOk: false,
  allFailed: true,
  authRequired: false
});

export function normalizeAdminDashboardLive(raw) {
  const data = ensureObject(raw);
  const stats = ensureObject(data.stats);
  return {
    meta: { ...EMPTY_ADMIN_DASHBOARD_LIVE.meta, ...ensureObject(data.meta) },
    stats: {
      ...stats,
      generatedAt: stats.generatedAt || new Date().toISOString()
    },
    observability:
      data.observability != null && typeof data.observability === 'object'
        ? data.observability
        : null,
    recentLoads: ensureArray(data.recentLoads),
    recentBids: ensureArray(data.recentBids),
    recentShipments: ensureArray(data.recentShipments),
    recentUsers: ensureArray(data.recentUsers),
    auditEvents: ensureArray(data.auditEvents),
    recentDisputes: ensureArray(data.recentDisputes),
    widgetState: data.widgetState ?? null,
    anyOk: Boolean(data.anyOk),
    allFailed: Boolean(data.allFailed),
    authRequired: Boolean(data.authRequired)
  };
}
