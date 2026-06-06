/**
 * Tracking socket readiness — join only after connection is fully established.
 */
export function isTrackingSocketReady(socketStatus, socket = null) {
  const status = String(socketStatus || '').toLowerCase();
  return status === 'connected' || status === 'ready' || Boolean(socket?.connected);
}

export function dispatchSocketReady(meta = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:socket-ready', { detail: meta }));
}
