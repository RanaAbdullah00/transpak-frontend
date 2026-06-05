/**
 * Production Stability Layer (PSL) — dedupe, version lock, debounced recompute, tracking gate.
 * Read-model only; does not alter backend FSMs or API contracts.
 */

const EVENT_DEDUPE_MS = 4000;
const RECOMPUTE_DEBOUNCE_MS = 300;
const TRACKING_FETCH_THROTTLE_MS = 800;
const REFRESH_EMIT_DEDUPE_MS = 400;

const seenEventKeys = new Map();
const versionByRef = new Map();
const recomputePending = new Map();
const trackingFetchByRef = new Map();
const refreshEmitAt = new Map();

const SOURCE_PRIORITY = Object.freeze({
  hydrate: 1,
  rest: 2,
  flow: 2,
  fallback: 3,
  socket: 4
});

export function contractEventTimestampBucket(ts) {
  const t = new Date(ts || Date.now()).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor(t / EVENT_DEDUPE_MS);
}

/** `${contractId}-${eventType}-${timestampBucket}` */
export function buildContractEventKey(contractId, eventType, timestamp) {
  const id = String(contractId || '_').trim() || '_';
  const type = String(eventType || 'SYNC').toUpperCase().replace(/\s+/g, '_');
  const bucket = contractEventTimestampBucket(timestamp);
  return `${id}-${type}-${bucket}`;
}

function pruneSeenEventKeys(now) {
  if (seenEventKeys.size <= 500) return;
  for (const [k, exp] of seenEventKeys) {
    if (exp <= now) seenEventKeys.delete(k);
  }
}

/** Reject duplicate contract event keys within EVENT_DEDUPE_MS window. */
export function shouldProcessContractEvent(eventKey) {
  const key = eventKey != null ? String(eventKey).trim() : '';
  if (!key) return true;
  const now = Date.now();
  const exp = seenEventKeys.get(key);
  if (exp && exp > now) return false;
  seenEventKeys.set(key, now + EVENT_DEDUPE_MS);
  pruneSeenEventKeys(now);
  return true;
}

export function extractContractVersion(input = {}, source = 'rest') {
  const row = input.restRow || input.dispatch?.payload || input;
  const ts =
    row?.updatedAt ??
    row?.statusUpdatedAt ??
    row?.shipmentUpdatedAt ??
    input.dispatch?.ts ??
    input.dispatch?.notification?.createdAt ??
    row?.createdAt ??
    null;
  if (ts != null) {
    const n = new Date(ts).getTime();
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (source === 'socket' || source === 'flow') return Date.now();
  return Date.now();
}

/**
 * Version lock + socket/REST priority.
 * socket < REST on initial hydrate; socket > REST on live equal-version races.
 */
export function shouldApplyContractUpdate(ref, incomingVersion, source = 'rest') {
  const key = String(ref || '').trim();
  if (!key) return true;

  const current = versionByRef.get(key);
  if (!current) {
    versionByRef.set(key, { version: incomingVersion, source, at: Date.now() });
    return true;
  }

  if (incomingVersion > current.version) {
    versionByRef.set(key, { version: incomingVersion, source, at: Date.now() });
    return true;
  }
  if (incomingVersion < current.version) return false;

  const incomingPri = SOURCE_PRIORITY[source] ?? 2;
  const currentPri = SOURCE_PRIORITY[current.source] ?? 2;
  if (incomingPri > currentPri) {
    versionByRef.set(key, { version: incomingVersion, source, at: Date.now() });
    return true;
  }
  return false;
}

export function recordContractVersion(ref, version, source) {
  const key = String(ref || '').trim();
  if (!key) return;
  versionByRef.set(key, { version, source, at: Date.now() });
}

export function getContractVersionState(ref) {
  const key = String(ref || '').trim();
  return key ? versionByRef.get(key) ?? null : null;
}

function mergeRecomputeInput(prev, next) {
  if (!prev) return { ...next };
  const merged = { ...prev, ...next };
  const prevPri = SOURCE_PRIORITY[prev.source] ?? 0;
  const nextPri = SOURCE_PRIORITY[next.source] ?? 0;
  if (nextPri >= prevPri) {
    merged.source = next.source;
    if (next.dispatch) merged.dispatch = next.dispatch;
    if (next.restRow) merged.restRow = next.restRow;
  } else {
    merged.source = prev.source;
    if (prev.dispatch) merged.dispatch = prev.dispatch;
    if (prev.restRow) merged.restRow = prev.restRow;
  }
  merged.role = next.role ?? prev.role;
  return merged;
}

/** Debounced single recompute per contract — merges burst triggers into one run. */
export function scheduleContractRecompute(ref, input, runner) {
  const key = String(ref || '').trim();
  if (!key || typeof runner !== 'function') return;

  const prev = recomputePending.get(key);
  const merged = mergeRecomputeInput(prev?.input, input);

  if (prev?.timer) clearTimeout(prev.timer);

  const timer = setTimeout(() => {
    recomputePending.delete(key);
    void runner(merged);
  }, RECOMPUTE_DEBOUNCE_MS);

  recomputePending.set(key, { timer, input: merged });
}

/** One in-flight fetchTrack per ref; throttle + coalesce pending requests. */
export function scheduleThrottledTrackingFetch(ref, fetchFn) {
  const key = String(ref || '').trim();
  if (!key || typeof fetchFn !== 'function') return;

  let row = trackingFetchByRef.get(key);
  if (!row) {
    row = { inFlight: false, pending: false, lastAt: 0, generation: 0, throttleTimer: null };
    trackingFetchByRef.set(key, row);
  }

  const run = async () => {
    if (row.inFlight) {
      row.pending = true;
      return;
    }
    row.inFlight = true;
    row.pending = false;
    const gen = ++row.generation;
    row.lastAt = Date.now();
    try {
      await fetchFn();
    } finally {
      if (gen === row.generation) row.inFlight = false;
      if (row.pending) {
        row.pending = false;
        const since = Date.now() - row.lastAt;
        const delay = Math.max(0, TRACKING_FETCH_THROTTLE_MS - since);
        if (row.throttleTimer) clearTimeout(row.throttleTimer);
        row.throttleTimer = setTimeout(() => {
          row.throttleTimer = null;
          scheduleThrottledTrackingFetch(key, fetchFn);
        }, delay);
      }
    }
  };

  if (row.inFlight) {
    row.pending = true;
    return;
  }

  const elapsed = Date.now() - row.lastAt;
  if (elapsed < TRACKING_FETCH_THROTTLE_MS) {
    if (row.throttleTimer) clearTimeout(row.throttleTimer);
    row.throttleTimer = setTimeout(() => {
      row.throttleTimer = null;
      void run();
    }, TRACKING_FETCH_THROTTLE_MS - elapsed);
    return;
  }

  void run();
}

export function bumpTrackingFetchGeneration(ref) {
  const key = String(ref || '').trim();
  if (!key) return;
  const row = trackingFetchByRef.get(key);
  if (!row) return;
  row.generation += 1;
  row.inFlight = false;
  row.pending = false;
  if (row.throttleTimer) {
    clearTimeout(row.throttleTimer);
    row.throttleTimer = null;
  }
}

/** Collapse duplicate tp:realtime-refresh emissions for shipment scopes. */
export function shouldEmitRealtimeRefresh(scope = 'all', meta = {}) {
  if (scope !== 'shipments' && scope !== 'all') return true;
  const key = `${scope}|${meta.dispatchType || ''}|${meta.contractSync ? '1' : '0'}|${meta.atomicSync ? '1' : '0'}`;
  const now = Date.now();
  const last = refreshEmitAt.get(key) || 0;
  if (now - last < REFRESH_EMIT_DEDUPE_MS) return false;
  refreshEmitAt.set(key, now);
  return true;
}

export function clearProductionStabilityLayer() {
  seenEventKeys.clear();
  versionByRef.clear();
  refreshEmitAt.clear();
  recomputePending.forEach(({ timer }) => clearTimeout(timer));
  recomputePending.clear();
  trackingFetchByRef.forEach((row) => {
    if (row.throttleTimer) clearTimeout(row.throttleTimer);
  });
  trackingFetchByRef.clear();
}
