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
 * Carrier responds to open loads (accept listed fare, counter-offer, or pass).
 */
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
    data: { loadId: load.id, amount },
    skipGlobalErrorToast: true
  });
  notifyVehicleTypeMismatchIfPresent(bid, t, notifyWarn);
  emitRealtimeRefresh('bids');
  emitRealtimeRefresh('loads');
  return bid;
}

export async function submitCounterOffer(request, load, counterAmount, { t, notifyWarn } = {}) {
  const amount = Number(counterAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Enter a valid counter amount');
    err.statusCode = 400;
    throw err;
  }
  const bid = await request({
    method: 'POST',
    url: '/bids',
    data: { loadId: load.id, amount },
    skipGlobalErrorToast: true
  });
  notifyVehicleTypeMismatchIfPresent(bid, t, notifyWarn);
  const bidId = bid?.id;
  if (!bidId) return bid;
  const updated = await request({
    method: 'PUT',
    url: `/bids/${bidId}/suggest-carrier`,
    data: { amount },
    skipGlobalErrorToast: true
  });
  emitRealtimeRefresh('bids');
  emitRealtimeRefresh('loads');
  return updated || bid;
}

export async function rejectLoadForCarrier(request, load) {
  await request({
    method: 'POST',
    url: `/loads/${load.id}/pass`
  });
  emitRealtimeRefresh('loads');
  return { ok: true };
}
