import { normalizeActiveShipmentList, normalizeActiveShipmentRow } from './activeShipmentModel.js';
import { trackingRefsMatch } from './trackingRefResolver.js';
import {
  hasOptimisticActivation,
  shouldSuppressStaleRestRow
} from './contractActivationLayer.js';

/** @typedef {'rest' | 'hydrate' | 'event' | 'bootstrap'} ShipmentStoreSource */

const rowsByKey = new Map();
let listVersion = 0;
const listeners = new Set();
let bootstrapped = false;
/** Stable immutable snapshot for useSyncExternalStore. */
const EMPTY_SNAPSHOT = Object.freeze([]);
let cachedList = EMPTY_SNAPSHOT;
let cachedListVersion = -1;

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}

function rebuildSnapshot() {
  if (rowsByKey.size === 0) return EMPTY_SNAPSHOT;
  return freezeRows(
    [...rowsByKey.values()].sort((a, b) => (b._storeVersion || 0) - (a._storeVersion || 0))
  );
}

function rowKey(row = {}) {
  const ref = String(
    row.trackRef || row.code || row.loadCode || row.booking_reference || ''
  ).trim();
  if (ref) return ref;
  return String(row.shipmentId || row.id || '').trim();
}

function removeDuplicateKeysForRow(normalized) {
  const ref = rowRef(normalized) || rowKey(normalized);
  if (!ref) return;
  const targetKey = rowKey(normalized);
  for (const [k, existing] of [...rowsByKey.entries()]) {
    if (k === targetKey) continue;
    const existingRef = rowRef(existing) || rowKey(existing);
    if (trackingRefsMatch(existingRef, ref)) {
      rowsByKey.delete(k);
    }
  }
}

function rowVersion(row = {}) {
  const ts = row.updatedAt || row.updated_at;
  const parsed = ts ? new Date(ts).getTime() : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function notify() {
  listVersion += 1;
  const snapshot = getActiveShipmentList();
  listeners.forEach((fn) => {
    try {
      fn(snapshot, listVersion);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

function rowRef(row = {}) {
  return String(row.trackRef || row.code || row.loadCode || '').trim();
}

function upsertRow(row, { source = 'hydrate' } = {}) {
  const normalized = normalizeActiveShipmentRow(row);
  const key = rowKey(normalized);
  if (!key) return false;

  const ref = rowRef(normalized) || key;
  if (source !== 'bootstrap' && shouldSuppressStaleRestRow(normalized, ref)) {
    return false;
  }

  const existing = rowsByKey.get(key);
  const nextVer = rowVersion(normalized) || Date.now();
  const prevVer = existing ? rowVersion(existing) : 0;

  if (existing && nextVer < prevVer && source !== 'bootstrap') {
    return false;
  }

  removeDuplicateKeysForRow(normalized);

  if (
    existing?._storeSource === 'bootstrap' &&
    source !== 'bootstrap' &&
    hasOptimisticActivation(ref)
  ) {
    rowsByKey.set(key, {
      ...existing,
      ...normalized,
      trackingEnabled: true,
      contractActivated: true,
      shipmentStatus: existing.shipmentStatus || normalized.shipmentStatus,
      status: existing.status || normalized.status,
      _storeVersion: Math.max(nextVer, prevVer, existing._storeVersion || 0),
      _storeSource: 'bootstrap'
    });
    return true;
  }

  rowsByKey.set(key, { ...normalized, _storeVersion: nextVer, _storeSource: source });
  return true;
}

/**
 * Replace or merge active shipment rows into the in-memory store.
 * Authoritative writes (confirmed API activation) replace the full active set.
 */
export function upsertActiveShipmentRows(rows = [], { authoritative = false, source = 'hydrate' } = {}) {
  const incoming = normalizeActiveShipmentList(rows);

  if (authoritative) {
    const nextKeys = new Set();
    incoming.forEach((row) => {
      const key = rowKey(row);
      if (key) nextKeys.add(key);
    });
    for (const key of [...rowsByKey.keys()]) {
      if (nextKeys.has(key)) continue;
      const row = rowsByKey.get(key);
      const ref = rowRef(row) || key;
      if (row?._storeSource === 'bootstrap' && hasOptimisticActivation(ref)) continue;
      rowsByKey.delete(key);
    }
  }

  let changed = false;
  incoming.forEach((row) => {
    if (upsertRow(row, { source })) changed = true;
  });

  if (changed || authoritative) {
    if (authoritative) {
      for (const row of incoming) {
        const ref = rowRef(row) || rowKey(row);
        if (ref) {
          const { reconcileOptimisticActivation } = require('./contractActivationLayer.js');
          reconcileOptimisticActivation(ref);
        }
      }
    }
    notify();
  }
  return getActiveShipmentList();
}

export function removeActiveShipment(key) {
  const k = String(key || '').trim();
  if (!k) return getActiveShipmentList();
  let removed = false;
  for (const [storeKey, row] of rowsByKey) {
    if (
      storeKey === k ||
      String(row.shipmentId || '') === k ||
      String(row.trackRef || '') === k ||
      String(row.id || '') === k
    ) {
      rowsByKey.delete(storeKey);
      removed = true;
    }
  }
  if (removed) notify();
  return getActiveShipmentList();
}

export function getActiveShipmentEmptySnapshot() {
  return EMPTY_SNAPSHOT;
}

export function getActiveShipmentList() {
  if (cachedListVersion === listVersion) return cachedList;
  cachedList = rebuildSnapshot();
  cachedListVersion = listVersion;
  return cachedList;
}

export function getActiveShipmentStoreVersion() {
  return listVersion;
}

export function isActiveShipmentStoreBootstrapped() {
  return bootstrapped;
}

export function markActiveShipmentStoreBootstrapped() {
  bootstrapped = true;
}

export function clearActiveShipmentStore() {
  rowsByKey.clear();
  listVersion = 0;
  bootstrapped = false;
  cachedList = EMPTY_SNAPSHOT;
  cachedListVersion = -1;
  notify();
}

export function subscribeActiveShipmentStore(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(getActiveShipmentList(), listVersion);
  return () => listeners.delete(listener);
}
