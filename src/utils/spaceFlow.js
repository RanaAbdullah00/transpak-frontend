/** Map DB space-request status to FlowTimeline step id */
export function spaceStepId(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'request_sent') return 'request_sent';
  if (s === 'active') return 'active';
  if (s === 'in_transit') return 'in_transit';
  if (s === 'completed') return 'completed';
  if (s === 'accepted') return 'active';
  return 'request_sent';
}

export { emitRealtimeRefresh } from './realtimeRefresh.js';
