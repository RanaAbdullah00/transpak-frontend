import { emitRealtimeRefresh } from '../utils/realtimeRefresh.js';

/**
 * Carrier responds to open loads (accept listed fare or counter-offer).
 * Uses existing bid API — carriers do not use the Place Bid page flow.
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
  return { ...bid, status: 'suggested', suggestedAmount: amount, suggestedBy: 'carrier' };
}
