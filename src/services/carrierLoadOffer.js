import { emitRealtimeRefresh } from '../utils/realtimeRefresh.js';

/**
 * Carrier responds to open loads (accept listed fare, counter-offer, or pass).
 */
export async function acceptLoadAtListedFare(request, load) {
  const amount = Number(load?.expectedPrice ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('This load has no listed fare to accept');
    err.statusCode = 400;
    throw err;
  }
  const bid = await request({
    method: 'POST',
    url: '/bids',
    data: { loadId: load.id, amount }
  });
  emitRealtimeRefresh('bids');
  return bid;
}

export async function submitCounterOffer(request, load, counterAmount) {
  const amount = Number(counterAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Enter a valid counter amount');
    err.statusCode = 400;
    throw err;
  }
  const bid = await request({
    method: 'POST',
    url: '/bids',
    data: { loadId: load.id, amount }
  });
  const bidId = bid?.id;
  if (!bidId) return bid;
  await request({
    method: 'PUT',
    url: `/bids/${bidId}/suggest-carrier`,
    data: { amount }
  });
  emitRealtimeRefresh('bids');
  return {
    ...bid,
    status: 'counter_offered',
    flowStatus: 'COUNTER_OFFERED',
    suggestedAmount: amount,
    suggestedBy: 'carrier'
  };
}

export async function rejectLoadForCarrier(request, load) {
  await request({
    method: 'POST',
    url: `/loads/${load.id}/pass`
  });
  emitRealtimeRefresh('loads');
  return { ok: true };
}
