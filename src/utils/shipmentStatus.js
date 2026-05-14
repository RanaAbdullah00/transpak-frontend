/** Keep in sync with backend `utils/shipmentStatus.js` (canonical values). */
export const SHIPMENT_ORDER = ['posted', 'booked', 'pickedup', 'intransit', 'delivered', 'closed'];

const LEGACY_TO_CANON = {
  posted: 'posted',
  booked: 'booked',
  pickedup: 'pickedup',
  picked: 'pickedup',
  intransit: 'intransit',
  in_transit: 'intransit',
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
