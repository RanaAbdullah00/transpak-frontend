import { normalizeCoordList } from './mapCoords.js';
import { normalizeShipmentStatus } from './shipmentStatus.js';
import { advanceStatusLabelKey } from './shipmentAdvance.js';
import { isDemoPresentationMode } from './demoBidLayer.js';

/** Presentation-only driver interpolation when real GPS/socket coords are unavailable. */
const phaseByRef = new Map();

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateRoute(route, progress) {
  try {
    const coords = normalizeCoordList(route);
    if (!coords.length) return null;
    if (coords.length === 1) return coords[0];
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    const totalSegs = coords.length - 1;
    const pos = p * totalSegs;
    const seg = Math.min(Math.floor(pos), totalSegs - 1);
    const t = pos - seg;
    const a = coords[seg];
    const b = coords[seg + 1];
    if (!a || !b) return coords[0] ?? null;
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  } catch {
    return null;
  }
}

export function statusToDemoProgress(status) {
  const s = normalizeShipmentStatus(status) || 'booked';
  const map = {
    posted: 0.02,
    booked: 0.1,
    pickedup: 0.28,
    intransit: 0.58,
    delivered: 0.92,
    closed: 1
  };
  return map[s] ?? 0.1;
}

/**
 * Smooth demo marker along route for jury presentation.
 * Does not replace real GPS — only used when no live driver coords exist.
 */
export function resolveDemoDriverPosition({ refKey, routeCoords, status, animate = true } = {}) {
  try {
  const coords = normalizeCoordList(routeCoords);
  if (!coords.length) return null;

  const key = String(refKey || '').trim() || 'default';
  const base = statusToDemoProgress(status);
  let progress = base;

  if (animate && coords.length >= 2) {
    const now = Date.now();
    let entry = phaseByRef.get(key);
    if (!entry || entry.status !== status) {
      entry = { start: now, status };
      phaseByRef.set(key, entry);
    }
    const elapsed = (now - entry.start) / 1000;
    const creep = Math.min(0.14, elapsed * 0.0035);
    progress = Math.min(0.97, base + creep);
  }

  return interpolateRoute(coords, progress) || coords[0];
  } catch {
    return null;
  }
}

export function shouldUseDemoTracking({ trackingActive, hasLiveDriver, routeCoords } = {}) {
  if (!trackingActive) return false;
  if (hasLiveDriver) return false;
  return normalizeCoordList(routeCoords).length >= 1;
}

function demoPresentationStepIndex(status) {
  const s = normalizeShipmentStatus(status) || 'booked';
  const rank = { booked: 1, pickedup: 2, intransit: 3, delivered: 4, closed: 4 };
  return rank[s] ?? 1;
}

function presentationStepLabel(step, t) {
  if (step === 'accepted') {
    return typeof t === 'function' ? t('demo.timelineAccepted') : 'Accepted';
  }
  return typeof t === 'function' ? t(advanceStatusLabelKey(step)) : step;
}

/** Default status steps for dashboard timeline when API history is empty. */
export function buildPresentationStatusTimeline(status, t) {
  try {
    const current = normalizeShipmentStatus(status) || 'booked';
    const steps = isDemoPresentationMode()
      ? ['booked', 'accepted', 'pickedup', 'intransit', 'delivered']
      : ['booked', 'pickedup', 'intransit', 'delivered'];
    const currentIdx = isDemoPresentationMode()
      ? demoPresentationStepIndex(current)
      : Math.max(0, steps.indexOf(current));
    const nowLabel = typeof t === 'function' ? t('pages.tracking.timelineUpdate') : 'Update';

    return steps.map((step, idx) => ({
      label: presentationStepLabel(step, t),
      time: idx <= currentIdx ? nowLabel : '',
      done: idx <= currentIdx,
      note: null
    }));
  } catch {
    return [];
  }
}
