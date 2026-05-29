import { unwrapErrorCode } from './unwrapApi.js';

export const ADMIN_DASHBOARD_WIDGETS = ['users', 'loads', 'bids', 'shipments', 'audit', 'observability'];

const WIDGET_RETRY_MS = [0, 450, 900];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function legacyStatsPayload(legacy) {
  const totalUsers = Number(legacy?.totalUsers ?? 0);
  return {
    meta: { dbReachable: true, partialFailure: false, legacy: true },
    stats: {
      totalUsers,
      activeUsers: 0,
      totalLoads: Number(legacy?.totalLoads ?? 0),
      openLoads: 0,
      totalBids: Number(legacy?.totalBids ?? 0),
      activeShipments: Number(legacy?.activeShipments ?? 0),
      completedShipments: 0,
      openDisputes: 0,
      pendingVerification: 0,
      shipperAccounts: 0,
      carrierAccounts: 0,
      incompleteProfiles: 0,
      registeredTrucks: 0,
      notificationsToday: 0,
      generatedAt: new Date().toISOString()
    },
    observability: {
      uptimeSeconds: 0,
      serverStartedAt: null,
      websocketConnections: 0
    },
    recentLoads: [],
    recentBids: [],
    recentShipments: [],
    recentUsers: [],
    auditEvents: []
  };
}

/**
 * Fetch a single admin dashboard widget (isolated; retries with backoff).
 */
export async function fetchAdminWidget(request, widget, { maxAttempts = 3 } = {}) {
  const id = String(widget || '').trim().toLowerCase();
  if (!ADMIN_DASHBOARD_WIDGETS.includes(id)) {
    throw new Error(`Unknown admin widget: ${id}`);
  }

  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (WIDGET_RETRY_MS[attempt]) await sleep(WIDGET_RETRY_MS[attempt]);
    try {
      const data = await request({
        url: `/admin/dashboard/widgets/${id}`,
        skipGlobalErrorToast: true
      });
      if (data?.ok === false) {
        const err = new Error(data?.error?.message || 'Widget unavailable');
        err.code = data?.error?.code || 'WIDGET_ERROR';
        err.widget = id;
        err.attempt = attempt + 1;
        lastError = err;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[admin-widget]', id, 'degraded', err.code, `attempt ${attempt + 1}`);
        }
        continue;
      }
      return { widget: id, data, error: null, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      lastError.widget = id;
      lastError.attempt = attempt + 1;
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[admin-widget]', id, 'failed', unwrapErrorCode(err) || err.message, `attempt ${attempt + 1}`);
      }
    }
  }

  throw lastError || new Error('Widget fetch failed');
}

export async function fetchAllAdminWidgets(request, { onWidget } = {}) {
  const results = {};
  await Promise.all(
    ADMIN_DASHBOARD_WIDGETS.map(async (widget) => {
      const base = { widget, loading: false, data: null, error: null, attempts: 0 };
      if (onWidget) onWidget(widget, { ...base, loading: true });
      try {
        const out = await fetchAdminWidget(request, widget);
        results[widget] = { ...base, data: out.data, attempts: out.attempts };
        if (onWidget) onWidget(widget, results[widget]);
      } catch (err) {
        results[widget] = {
          ...base,
          error: err?.message || 'Unavailable',
          code: err?.code || unwrapErrorCode(err),
          attempts: err?.attempt || 0
        };
        if (onWidget) onWidget(widget, results[widget]);
      }
    })
  );
  return results;
}

/** Merge per-widget payloads into legacy dashboard shape for existing UI. */
export function mergeAdminDashboardWidgets(widgetState) {
  const stats = { generatedAt: new Date().toISOString() };
  let meta = { dbReachable: true, partialFailure: false, widgetMode: true };
  let observability = null;
  let recentLoads = [];
  let recentBids = [];
  let recentShipments = [];
  let recentUsers = [];
  let auditEvents = [];
  let recentDisputes = [];

  const users = widgetState?.users?.data;
  if (users?.stats) Object.assign(stats, users.stats);
  if (users?.partialFailure) meta = { ...meta, partialFailure: true };
  if (users?.recentUsers) recentUsers = users.recentUsers;

  const loads = widgetState?.loads?.data;
  if (loads?.stats) Object.assign(stats, loads.stats);
  if (loads?.partialFailure) meta = { ...meta, partialFailure: true };
  if (loads?.recentLoads) recentLoads = loads.recentLoads;

  const bids = widgetState?.bids?.data;
  if (bids?.stats) Object.assign(stats, bids.stats);
  if (bids?.partialFailure) meta = { ...meta, partialFailure: true };
  if (bids?.recentBids) recentBids = bids.recentBids;

  const shipments = widgetState?.shipments?.data;
  if (shipments?.stats) Object.assign(stats, shipments.stats);
  if (shipments?.partialFailure) meta = { ...meta, partialFailure: true };
  if (shipments?.recentShipments) recentShipments = shipments.recentShipments;

  const audit = widgetState?.audit?.data;
  if (audit?.auditEvents) auditEvents = audit.auditEvents;
  if (audit?.recentDisputes) recentDisputes = audit.recentDisputes;

  const obs = widgetState?.observability?.data;
  if (obs?.meta) meta = { ...meta, ...obs.meta };
  if (obs?.observability) observability = obs.observability;

  const anyOk = ADMIN_DASHBOARD_WIDGETS.some((w) => widgetState?.[w]?.data);
  const allFailed = ADMIN_DASHBOARD_WIDGETS.every((w) => widgetState?.[w]?.error && !widgetState?.[w]?.data);

  return {
    meta,
    stats,
    observability,
    recentLoads,
    recentBids,
    recentShipments,
    recentUsers,
    auditEvents,
    recentDisputes,
    widgetState,
    anyOk,
    allFailed
  };
}

/**
 * Legacy monolithic fetch — kept for fallback when widget routes are unavailable.
 */
export async function fetchAdminDashboard(request) {
  const paths = ['/admin/dashboard/live', '/admin/dashboard', '/admin/stats'];
  let lastError = null;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const isLegacy = path === '/admin/stats';
    try {
      const data = await request({ url: path, skipGlobalErrorToast: true });
      if (isLegacy) return legacyStatsPayload(data);
      return data;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      const code = unwrapErrorCode(err);
      const isNotFound = status === 404 || code === 'NOT_FOUND';
      if (!isNotFound && !isLegacy) throw err;
      if (isLegacy) throw err;
    }
  }

  throw lastError;
}

/**
 * Preferred Phase 3 loader — parallel isolated widgets with monolithic fallback.
 */
export async function fetchAdminDashboardResilient(request, { onWidget } = {}) {
  const widgetState = await fetchAllAdminWidgets(request, { onWidget });
  const merged = mergeAdminDashboardWidgets(widgetState);
  if (merged.anyOk) {
    return merged;
  }

  try {
    const legacy = await fetchAdminDashboard(request);
    return {
      ...legacy,
      widgetState,
      anyOk: true,
      allFailed: false,
      meta: { ...(legacy.meta || {}), fallback: 'monolithic' }
    };
  } catch {
    return { ...merged, allFailed: true };
  }
}
