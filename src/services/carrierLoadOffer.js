import { emitRealtimeRefresh } from '../utils/realtimeRefresh.js';

/**
 * Surface vehicle-type mismatch warning from bid API (when ALLOW_VEHICLE_TYPE_MISMATCH is on).
 * @param {object|null} bid
 * @param {(key: string) => string} t
 * @param {(msg: string) => void} notifyWarn
 */
export function notifyVehicleTypeMismatchIfPresent(bid, t, notifyWarn) {
  if (!bid?.vehicleTypeMismatchWarning || typeof notifyWarn !== 'function') return;
  notifyWarn(t('pages.loads.vehicleTypeMismatchWarning'));
}

/**
 * Carrier responds to open loads (accept listed fare or pass).
 */
function newBidIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `bid-${crypto.randomUUID()}`;
  }
  return `bid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function acceptLoadAtListedFare(request, load, { t, notifyWarn } = {}) {
  const amount = Number(load?.expectedPrice ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('This load has no listed fare to accept');
    err.statusCode = 400;
    throw err;
  }
  const bid = await request({
    method: 'POST',
    url: '/bids',
    data: { loadId: load.id, amount, acceptListedFare: true },
    headers: { 'Idempotency-Key': newBidIdempotencyKey() },
    skipGlobalErrorToast: true
  });
  notifyVehicleTypeMismatchIfPresent(bid, t, notifyWarn);
  emitRealtimeRefresh('bids');
  emitRealtimeRefresh('loads');
  return bid;
}

export async function rejectLoadForCarrier(request, load) {
  await request({
    method: 'POST',
    url: `/loads/${load.id}/pass`
  });
  emitRealtimeRefresh('loads');
  return { ok: true };
}
