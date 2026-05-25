/** Client-side bidding window helpers (mirrors backend loadDeadline). */

export function isLoadBiddingOpen(load) {
  if (!load) return false;
  const status = String(load.status || '').toLowerCase();
  if (status !== 'open') return false;
  const deadlineMs = load.deadline ? new Date(load.deadline).getTime() : null;
  if (deadlineMs != null && !Number.isNaN(deadlineMs)) {
    return Date.now() <= deadlineMs;
  }
  return true;
}

export function filterOpenLoads(loads) {
  return (Array.isArray(loads) ? loads : []).filter(isLoadBiddingOpen);
}
