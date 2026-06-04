import { normalizeTracking } from '../adapters/normalize.js';
import { evaluateTrackingSequence, trackingEventTimestamp } from './trackingSequencer.js';
import { smoothTrackingCoordinates } from './trackingSmoothing.js';
import {
  getCachedTrackingPayload,
  updateTrackingCache
} from './trackingCache.js';
import { mergeTrackingPayload, shouldApplyTrackingUpdate } from './trackingMerge.js';

function isValidTrackingPacket(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (!raw.tracking || typeof raw.tracking !== 'object') return false;
  return true;
}

function extractCoords(payload) {
  const loc = payload?.tracking?.currentLocation ?? payload?.tracking?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;
  const lat = Number(loc[0]);
  const lng = Number(loc[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function withCoords(payload, coords) {
  if (!coords) return payload;
  return {
    ...payload,
    ts: payload.ts ?? trackingEventTimestamp(payload) ?? Date.now(),
    tracking: {
      ...(payload.tracking || {}),
      currentLocation: coords,
      location: coords,
      locationUnavailable: false
    }
  };
}

/**
 * Safe merge pipeline for socket/REST tracking payloads.
 * @param {string} shipmentRef
 * @param {object|null} prev
 * @param {object|null} incoming raw or normalized-ish payload
 * @param {{ source?: 'socket'|'rest' }} opts
 */
export function processTrackingPipeline(shipmentRef, prev, incoming, opts = {}) {
  const source = opts.source === 'rest' ? 'rest' : 'socket';
  const key = String(shipmentRef || '').trim();
  if (!key || !incoming) {
    return { applied: false, payload: prev, reason: 'empty' };
  }

  if (!isValidTrackingPacket(incoming)) {
    return { applied: false, payload: prev, reason: 'invalid_shape' };
  }

  const normalizedIn = normalizeTracking(incoming) || incoming;
  const allowCatchUp = Boolean(opts.allowCatchUp);
  const seq = evaluateTrackingSequence(key, normalizedIn, { allowCatchUp });
  if (seq.action === 'drop') {
    const cached = getCachedTrackingPayload(key);
    return { applied: false, payload: prev || cached, reason: seq.reason };
  }

  let prepared = normalizedIn;
  const rawCoords = extractCoords(prepared);
  if (rawCoords) {
    const smoothed = smoothTrackingCoordinates(key, rawCoords);
    if (!smoothed) {
      const cached = getCachedTrackingPayload(key);
      return { applied: false, payload: prev || cached, reason: 'jitter_filtered' };
    }
    prepared = withCoords(prepared, smoothed);
  }

  const baseline = prev || getCachedTrackingPayload(key);
  const merged = baseline
    ? mergeTrackingPayload(baseline, prepared)
    : normalizeTracking(prepared);

  if (!merged) {
    return { applied: false, payload: baseline, reason: 'merge_failed' };
  }

  if (baseline && !shouldApplyTrackingUpdate(baseline, merged)) {
    return { applied: false, payload: baseline, reason: 'no_ui_delta' };
  }

  updateTrackingCache(key, merged, source);
  return { applied: true, payload: merged, reason: null };
}

/** Hydrate hook state from session cache without clearing on remount. */
export function hydrateTrackingFromCache(shipmentRef, prev) {
  const cached = getCachedTrackingPayload(shipmentRef);
  if (!cached) return prev;
  if (!prev) return cached;
  return mergeTrackingPayload(prev, cached);
}
