import { unwrapErrorCode, ensureArray, ensureObject, unwrapErrorDetail } from './unwrapApi.js';

export const ADMIN_DASHBOARD_WIDGETS = ['users', 'loads', 'bids', 'shipments', 'audit', 'observability'];

/** Safe defaults for merged admin dashboard live payload. */
export const EMPTY_ADMIN_DASHBOARD = {
  meta: { dbReachable: true, partialFailure: false, widgetMode: true },
  stats: { generatedAt: new Date().toISOString() },
  observability: null,
  recentLoads: [],
  recentBids: [],
  recentShipments: [],
  recentUsers: [],
  recentTrucks: [],
  auditEvents: [],
  recentDisputes: [],
  anyOk: false,
  allFailed: true,
  authRequired: false
};

export function coerceAdminDashboardLive(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_ADMIN_DASHBOARD };
  }
  return {
    meta:
      raw.meta && typeof raw.meta === 'object'
        ? { ...EMPTY_ADMIN_DASHBOARD.meta, ...raw.meta }
        : { ...EMPTY_ADMIN_DASHBOARD.meta },
    stats:
      raw.stats && typeof raw.stats === 'object'
        ? { ...EMPTY_ADMIN_DASHBOARD.stats, ...raw.stats }
        : { ...EMPTY_ADMIN_DASHBOARD.stats },
    observability:
      raw.observability && typeof raw.observability === 'object' ? raw.observability : null,
    recentLoads: ensureArray(raw.recentLoads),
    recentBids: ensureArray(raw.recentBids),
    recentShipments: ensureArray(raw.recentShipments),
    recentUsers: ensureArray(raw.recentUsers),
    recentTrucks: ensureArray(raw.recentTrucks),
    auditEvents: ensureArray(raw.auditEvents),
    recentDisputes: ensureArray(raw.recentDisputes),
    widgetState: raw.widgetState ?? null,
    anyOk: Boolean(raw.anyOk),
    allFailed: Boolean(raw.allFailed),
    authRequired: Boolean(raw.authRequired)
  };
}

const WIDGET_RETRY_MS = [0, 450, 900];
const FALLBACK_RETRY_MS = [0, 800];
const WIDGET_BATCHES = [
  ['users', 'observability'],
  ['loads', 'bids'],
  ['shipments', 'audit']
];

const widgetInflight = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err) {
  const code = String(err?.code || unwrapErrorCode(err) || '').toUpperCase();
  const type = String(err?.errorType || '').toUpperCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'TIMEOUT' ||
    type === 'NETWORK' ||
    type === 'TIMEOUT' ||
    type === 'CORS' ||
    msg.includes('network') ||
    msg.includes('timeout')
  );
}

/** Strip widget envelope — keep stats/lists for merge. */
export function normalizeWidgetPayload(data) {
  if (!data || typeof data !== 'object' || data.ok === false) return null;
  const { ok, widget, durationMs, error, ...rest } = data;
  const payload = Object.keys(rest).length ? { ...rest } : { ...data };
  delete payload.ok;
  delete payload.widget;
  delete payload.durationMs;
  delete payload.error;

  for (const key of [
    'recentLoads',
    'recentBids',
    'recentShipments',
    'recentUsers',
    'recentTrucks',
    'auditEvents',
    'recentDisputes'
  ]) {
    if (key in payload) payload[key] = ensureArray(payload[key]);
  }
  if (payload.stats) payload.stats = ensureObject(payload.stats);
  if (payload.meta) payload.meta = ensureObject(payload.meta);
  if (payload.observability && typeof payload.observability !== 'object') {
    payload.observability = null;
  }
  return payload;
}

function classifyWidgetError(err) {
  const detail = unwrapErrorDetail(err);
  return {
    message: detail.displayMessage || err?.message || 'Unavailable',
    code: detail.code || unwrapErrorCode(err) || err?.code || null,
    httpStatus: detail.httpStatus ?? err?.httpStatus ?? err?.response?.status ?? null,
    endpoint: detail.endpoint || null,
    errorType: detail.errorType || detail.error || null
  };
}

function isAbortError(err) {
  return (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    String(err?.message || '').toLowerCase() === 'canceled'
  );
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

  const inflightKey = `widget:${id}`;
  if (widgetInflight.has(inflightKey)) {
    return widgetInflight.get(inflightKey);
  }

  const run = (async () => {
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (WIDGET_RETRY_MS[attempt]) await sleep(WIDGET_RETRY_MS[attempt]);
    try {
      const data = await request({
        url: `/admin/dashboard/widgets/${id}`,
        skipGlobalErrorToast: true
      });
      if (data?.ok === false) {
        const err = new Error(data?.error?.message || 'Widget query failed');
        err.code = data?.error?.code || 'WIDGET_ERROR';
        err.widget = id;
        err.attempt = attempt + 1;
        err.httpStatus = 200;
        lastError = err;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[admin-widget]', id, 'degraded', err.code, `attempt ${attempt + 1}`);
        }
        continue;
      }
      const normalized = normalizeWidgetPayload(data);
      return { widget: id, data: normalized, error: null, attempts: attempt + 1 };
    } catch (err) {
      if (isAbortError(err)) {
        lastError = err;
        lastError.widget = id;
        if (attempt + 1 < maxAttempts) continue;
      }
      lastError = err;
      lastError.widget = id;
      lastError.attempt = attempt + 1;
      const classified = classifyWidgetError(err);
      lastError.httpStatus = classified.httpStatus;
      lastError.code = classified.code;
      lastError.message = classified.message;
      lastError.endpoint = classified.endpoint;
      lastError.errorType = classified.errorType;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[admin-widget]', id, 'failed', classified.code || classified.message, `attempt ${attempt + 1}`);
      }
    }
  }

  throw lastError || new Error('Widget fetch failed');
  })();

  widgetInflight.set(inflightKey, run);
  try {
    return await run;
  } finally {
    widgetInflight.delete(inflightKey);
  }
}

async function fetchWidgetWithHandler(request, widget, onWidget) {
  const base = { widget, loading: false, data: null, error: null, attempts: 0 };
  if (onWidget) onWidget(widget, { ...base, loading: true });
  try {
    const out = await fetchAdminWidget(request, widget);
    const result = { ...base, data: out.data, attempts: out.attempts };
    if (onWidget) onWidget(widget, result);
    return { widget, result };
  } catch (err) {
    const classified = classifyWidgetError(err);
    const result = {
      ...base,
      error: classified.message,
      code: classified.code,
      httpStatus: classified.httpStatus,
      endpoint: classified.endpoint,
      errorType: classified.errorType,
      attempts: err?.attempt || 0
    };
    if (onWidget) onWidget(widget, result);
    return { widget, result };
  }
}

export async function fetchAllAdminWidgets(request, { onWidget, widgets } = {}) {
  const results = {};
  const targetWidgets =
    widgets && widgets.length
      ? widgets.filter((w) => ADMIN_DASHBOARD_WIDGETS.includes(w))
      : ADMIN_DASHBOARD_WIDGETS;

  const batches =
    widgets && widgets.length
      ? [targetWidgets]
      : WIDGET_BATCHES;

  for (const batch of batches) {
    const batchWidgets = batch.filter((w) => targetWidgets.includes(w));
    if (!batchWidgets.length) continue;
    const settled = await Promise.all(
      batchWidgets.map((widget) => fetchWidgetWithHandler(request, widget, onWidget))
    );
    for (const { widget, result } of settled) {
      results[widget] = result;
    }
  }
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
  let recentTrucks = [];
  let auditEvents = [];
  let recentDisputes = [];

  const users = ensureObject(widgetState?.users?.data);
  if (users.stats) Object.assign(stats, ensureObject(users.stats));
  if (users.partialFailure) meta = { ...meta, partialFailure: true };
  recentUsers = ensureArray(users.recentUsers);

  const loads = ensureObject(widgetState?.loads?.data);
  if (loads.stats) Object.assign(stats, ensureObject(loads.stats));
  if (loads.partialFailure) meta = { ...meta, partialFailure: true };
  recentLoads = ensureArray(loads.recentLoads);

  const bids = ensureObject(widgetState?.bids?.data);
  if (bids.stats) Object.assign(stats, ensureObject(bids.stats));
  if (bids.partialFailure) meta = { ...meta, partialFailure: true };
  recentBids = ensureArray(bids.recentBids);

  const shipments = ensureObject(widgetState?.shipments?.data);
  if (shipments.stats) Object.assign(stats, ensureObject(shipments.stats));
  if (shipments.partialFailure) meta = { ...meta, partialFailure: true };
  recentShipments = ensureArray(shipments.recentShipments);

  const audit = ensureObject(widgetState?.audit?.data);
  auditEvents = ensureArray(audit.auditEvents);
  recentDisputes = ensureArray(audit.recentDisputes);

  const obs = ensureObject(widgetState?.observability?.data);
  if (obs.meta) meta = { ...meta, ...ensureObject(obs.meta) };
  if (obs.observability && typeof obs.observability === 'object') {
    observability = obs.observability;
  }

  const anyOk = ADMIN_DASHBOARD_WIDGETS.some((w) => widgetState?.[w]?.data);
  const allFailed = ADMIN_DASHBOARD_WIDGETS.every((w) => widgetState?.[w]?.error && !widgetState?.[w]?.data);
  const authRequired =
    allFailed &&
    ADMIN_DASHBOARD_WIDGETS.every((w) => {
      const st = widgetState?.[w];
      const code = String(st?.code || '').toUpperCase();
      return (
        st?.httpStatus === 401 ||
        code === 'UNAUTHORIZED' ||
        code === 'INVALID_TOKEN' ||
        code === 'AUTH_INVALID'
      );
    });

  return coerceAdminDashboardLive({
    meta,
    stats,
    observability,
    recentLoads,
    recentBids,
    recentShipments,
    recentUsers,
    recentTrucks,
    auditEvents,
    recentDisputes,
    widgetState,
    anyOk,
    allFailed,
    authRequired
  });
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

    for (let attempt = 0; attempt < FALLBACK_RETRY_MS.length; attempt++) {
      if (FALLBACK_RETRY_MS[attempt]) await sleep(FALLBACK_RETRY_MS[attempt]);
      try {
        const data = await request({ url: path, skipGlobalErrorToast: true });
        if (isLegacy) return coerceAdminDashboardLive(legacyStatsPayload(data));
        return coerceAdminDashboardLive(data);
      } catch (err) {
        lastError = err;
        const status = err?.response?.status;
        const code = unwrapErrorCode(err);
        const isNotFound = status === 404 || code === 'NOT_FOUND';
        if (isNotFound && !isLegacy) break;
        if (isLegacy) break;
        if (isNetworkError(err) && attempt + 1 < FALLBACK_RETRY_MS.length) continue;
        if (!isNetworkError(err) && !isNotFound) break;
      }
    }
  }

  throw lastError;
}

/**
 * Preferred Phase 3 loader — parallel isolated widgets with monolithic fallback.
 */
export async function fetchAdminDashboardResilient(request, { onWidget, widgets, skipFallback = false } = {}) {
  const widgetState = await fetchAllAdminWidgets(request, { onWidget, widgets });
  const merged = mergeAdminDashboardWidgets(widgetState);
  if (merged.anyOk || skipFallback) {
    return merged;
  }
  if (merged.authRequired) {
    return merged;
  }

  try {
    const legacy = await fetchAdminDashboard(request);
    return coerceAdminDashboardLive({
      ...legacy,
      widgetState,
      anyOk: true,
      allFailed: false,
      meta: { ...(legacy.meta || {}), fallback: 'monolithic' }
    });
  } catch {
    return coerceAdminDashboardLive({ ...merged, allFailed: true });
  }
}
