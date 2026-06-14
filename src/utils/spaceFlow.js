/** Map DB space-request status to FlowTimeline step id */
export function spaceStepId(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'rejected') return 'rejected';
  if (s === 'request_sent') return 'request_sent';
  if (s === 'active') return 'active';
  if (s === 'in_transit') return 'in_transit';
  if (s === 'completed') return 'completed';
  if (s === 'accepted') return 'active';
  return 'request_sent';
}

/** Operation Center "Request sent" — pending lifecycle only. */
export function isOpsRequestSentRow(row) {
  const s = String(row?.status || '').toLowerCase();
  return s === 'request_sent';
}

export function proposedSpacePrice(row) {
  const kg = Number(row?.requestedKg);
  const rate = Number(row?.ratePerKg);
  if (!Number.isFinite(kg) || !Number.isFinite(rate) || kg <= 0 || rate <= 0) return null;
  return Math.round(rate * kg);
}

export { emitRealtimeRefresh } from './realtimeRefresh.js';
export {
  triggerAcceptActivationSync,
  triggerStatusActivationSync,
  resolveAcceptActivationRef
} from './contractActivation.js';
export { hasOptimisticActivation, buildOptimisticTrackingRow } from './contractActivationLayer.js';
// contractStateResolver / contractLatchStore are deprecated — use shipmentUIState + REST only.
