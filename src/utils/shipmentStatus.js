/** Keep in sync with backend `utils/shipmentStatus.js` (canonical values). */
export const SHIPMENT_ORDER = ['posted', 'booked', 'pickedup', 'intransit', 'delivered', 'closed'];

const UUID_TRACK_REF =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reject null/empty/UUID refs — shipment engine routes require load codes. */
export function isValidShipmentTrackRef(ref) {
  if (ref == null) return false;
  if (typeof ref !== 'string' && typeof ref !== 'number') return false;
  const s = String(ref).trim();
  if (!s) return false;
  if (UUID_TRACK_REF.test(s)) return false;
  return true;
}

export function getAuthoritativeTrackRef(row) {
  if (!row || typeof row !== 'object') return null;
  const candidate = row.trackRef ?? row.ref ?? row.code ?? row.loadCode ?? null;
  return isValidShipmentTrackRef(candidate) ? String(candidate).trim() : null;
}

const LEGACY_TO_CANON = {
  posted: 'posted',
  booked: 'booked',
  pickedup: 'pickedup',
  picked: 'pickedup',
  intransit: 'intransit',
  in_transit: 'intransit',
  assigned: 'booked',
  active: 'booked',
  accepted: 'booked',
  delivered: 'delivered',
  closed: 'closed',
  pending: 'posted',
  open: 'posted'
};

export function normalizeShipmentStatus(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (LEGACY_TO_CANON[key]) return LEGACY_TO_CANON[key];
  if (SHIPMENT_ORDER.includes(key)) return key;
  return null;
}

export function nextShipmentStatus(currentRaw) {
  const c = normalizeShipmentStatus(currentRaw) || 'posted';
  const i = SHIPMENT_ORDER.indexOf(c);
  if (i < 0 || i >= SHIPMENT_ORDER.length - 1) return null;
  return SHIPMENT_ORDER[i + 1];
}

export const ADVANCE_LABELS = {
  posted: 'Book load',
  booked: 'Confirm pickup',
  pickedup: 'Start transit',
  intransit: 'Mark delivered',
  delivered: 'Close shipment'
};
