/**
 * Unified tracking UI visibility — LOAD + CAPACITY share identical gating.
 * View layer only; does not modify activation or snapshot engines.
 */
export function resolveTrackingActive({
  contractActivated = false,
  optimisticActivation = false,
  shipmentRowExists = false
} = {}) {
  return Boolean(contractActivated || optimisticActivation || shipmentRowExists);
}

/**
 * Map hydration fallback priority:
 * 1. live GPS / socket payload  2. shipment row  3. store row  4. optimistic shell
 */
export function resolveMapDisplayFields({
  livePayload = null,
  livePos = null,
  lastKnownLocation = null,
  shipmentRow = null,
  storeRow = null,
  status = 'booked',
  refKey = ''
} = {}) {
  const origin =
    livePayload?.origin || shipmentRow?.origin || storeRow?.origin || '';
  const destination =
    livePayload?.destination || shipmentRow?.destination || storeRow?.destination || '';
  const reportedLoc = livePayload?.tracking?.currentLocation ?? livePayload?.tracking?.location;
  const validCoord = (c) =>
    Array.isArray(c) &&
    c.length >= 2 &&
    Number.isFinite(Number(c[0])) &&
    Number.isFinite(Number(c[1])) &&
    c;
  const currentLocation =
    validCoord(livePos) ||
    validCoord(reportedLoc) ||
    validCoord(lastKnownLocation) ||
    null;

  const trackingData = livePayload
    ? {
        ...livePayload,
        origin: livePayload.origin || origin,
        destination: livePayload.destination || destination,
        tracking: {
          ...(livePayload.tracking || {}),
          status: livePayload.tracking?.status || status,
          currentLocation: currentLocation || livePayload.tracking?.currentLocation,
          location: currentLocation || livePayload.tracking?.location
        },
        liveTrackingMap: livePayload.liveTrackingMap || {
          coordinates: currentLocation ? [currentLocation] : []
        }
      }
    : {
        refKey: refKey || '',
        origin,
        destination,
        tracking: {
          status,
          currentLocation: currentLocation || undefined,
          locationUnavailable: !currentLocation && !origin && !destination
        },
        liveTrackingMap: { coordinates: currentLocation ? [currentLocation] : [] },
        history: []
      };

  return { origin, destination, currentLocation, trackingData };
}
