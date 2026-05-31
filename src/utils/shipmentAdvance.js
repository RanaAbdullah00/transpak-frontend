import { normalizeShipmentStatus } from './shipmentStatus.js';

/** Carrier-facing label for the next shipment status step (i18n key under pages.tracking). */
export function advanceStatusLabelKey(nextStatus) {
  const s = normalizeShipmentStatus(nextStatus);
  if (s === 'pickedup') return 'pages.tracking.advancePickedup';
  if (s === 'intransit') return 'pages.tracking.advanceIntransit';
  if (s === 'delivered') return 'pages.tracking.advanceDelivered';
  if (s === 'closed') return 'pages.tracking.advanceDelivered';
  if (s === 'booked') return 'pages.tracking.advanceBooked';
  return 'pages.tracking.advanceStatus';
}
