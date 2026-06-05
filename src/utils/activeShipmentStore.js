import { normalizeActiveShipmentList, normalizeActiveShipmentRow } from './activeShipmentModel.js';

/** @typedef {'rest' | 'hydrate' | 'event' | 'bootstrap'} ShipmentStoreSource */

const rowsByKey = new Map();
let listVersion = 0;
const listeners = new Set();
let bootstrapped = false;

function rowKey(row = {}) {
  return (
    String(row.shipmentId || '').trim() ||
    String(row.trackRef || row.code || '').trim() ||
    String(row.id || '').trim() ||
    ''
  );
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

function upsertRow(row, { source = 'hydrate' } = {}) {
  const normalized = normalizeActiveShipmentRow(row);
  const key = rowKey(normalized);
  if (!key) return false;

  const existing = rowsByKey.get(key);
  const nextVer = rowVersion(normalized) || Date.now();
  const prevVer = existing ? rowVersion(existing) : 0;

  if (existing && nextVer < prevVer && source !== 'bootstrap') {
    return false;
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
      if (!nextKeys.has(key)) rowsByKey.delete(key);
    }
  }

  let changed = false;
  incoming.forEach((row) => {
    if (upsertRow(row, { source })) changed = true;
  });

  if (changed || authoritative) notify();
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

export function getActiveShipmentList() {
  return [...rowsByKey.values()].sort(
    (a, b) => (b._storeVersion || 0) - (a._storeVersion || 0)
  );
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
  notify();
}

export function subscribeActiveShipmentStore(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(getActiveShipmentList(), listVersion);
  return () => listeners.delete(listener);
}
