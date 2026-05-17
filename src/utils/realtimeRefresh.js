/** Notify dashboards / lists to refetch after a mutation. */
export function emitRealtimeRefresh(scope = 'all') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:realtime-refresh', { detail: { scope } }));
}
