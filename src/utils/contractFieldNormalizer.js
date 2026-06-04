/**
 * Normalizes carrier + ref fields across Flow A (loads/bids) and Flow B (capacity).
 */
export function normalizeContractFields(input = {}) {
  const assignedCarrierId =
    input.assignedCarrierId ??
    input.assigned_carrier_id ??
    input.carrierId ??
    input.carrier_id ??
    null;

  const ref =
    input.ref ??
    input.code ??
    input.loadCode ??
    input.shipmentRef ??
    input.refKey ??
    input.trackRef ??
    null;

  return {
    ...input,
    assignedCarrierId,
    ref
  };
}
