import { normalizeShipmentStatus } from './shipmentStatus.js';

/** Carrier-facing label for the next shipment status step (i18n key under pages.tracking). */
export function advanceStatusLabelKey(nextStatus) {
  const s = normalizeShipmentStatus(nextStatus);
  if (s === 'booked') return 'pages.tracking.advanceInTransit';
  if (s === 'pickedup') return 'pages.tracking.advanceInTransit';
  if (s === 'intransit') return 'pages.tracking.advanceDelivered';
  if (s === 'delivered') return 'pages.tracking.advanceClosed';
  if (s === 'closed') return 'pages.tracking.advanceClosed';
  return 'pages.tracking.advanceStatus';
}
