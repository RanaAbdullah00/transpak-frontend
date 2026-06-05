import { shouldEmitRealtimeRefresh } from './productionStabilityLayer.js';

/** Notify dashboards / lists to refetch after a mutation. */
export function emitRealtimeRefresh(scope = 'all', meta = {}) {
  if (typeof window === 'undefined') return;
  if (!shouldEmitRealtimeRefresh(scope, meta)) return;
  window.dispatchEvent(
    new CustomEvent('tp:realtime-refresh', { detail: { scope, ...meta } })
  );
}
