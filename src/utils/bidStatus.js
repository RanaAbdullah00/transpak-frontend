/** Canonical bid statuses (aligned with backend after migration 013). */
export const BID_STATUS = {
  PENDING_SHIPPER: 'pending_shipper_confirmation',
  COUNTER: 'counter_offered',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export function normalizeBidStatus(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'pending' || s === 'pending_shipper_confirmation') return BID_STATUS.PENDING_SHIPPER;
  if (s === 'suggested' || s === 'countered' || s === 'counter_offered') return BID_STATUS.COUNTER;
  return s;
}

export function isActiveBidStatus(raw) {
  const s = normalizeBidStatus(raw);
  return s === BID_STATUS.PENDING_SHIPPER || s === BID_STATUS.COUNTER;
}

export function isTerminalBidStatus(raw) {
  const s = normalizeBidStatus(raw);
  return (
    s === BID_STATUS.ACCEPTED ||
    s === BID_STATUS.REJECTED ||
    s === BID_STATUS.CANCELLED ||
    s === 'expired'
  );
}

export function isCounterOffered(raw) {
  return normalizeBidStatus(raw) === BID_STATUS.COUNTER;
}

export function isAwaitingShipper(raw) {
  return normalizeBidStatus(raw) === BID_STATUS.PENDING_SHIPPER;
}

export function isBidExpired(bid) {
  if (!bid) return false;
  if (String(bid.status || '').toLowerCase() === 'expired') return true;
  const exp = bid.expiresAt ? new Date(bid.expiresAt).getTime() : null;
  if (!exp || Number.isNaN(exp)) return false;
  if (Date.now() <= exp) return false;
  return isActiveBidStatus(bid.status);
}

export function filterActiveBids(bids) {
  return (Array.isArray(bids) ? bids : []).filter((b) => !isBidExpired(b));
}
