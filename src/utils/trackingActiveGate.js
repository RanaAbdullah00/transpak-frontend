import { normalizeCoordList, routeFromCityNames, safeCoordPairOrNull, safeStringField } from './mapCoords.js';

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

function validCoord(c) {
  return safeCoordPairOrNull(c);
}

function shellRouteCoords(origin, destination, currentLocation) {
  if (currentLocation) return [currentLocation];
  return routeFromCityNames(origin, destination);
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
  try {
    const origin = safeStringField(
      livePayload?.origin ?? shipmentRow?.origin ?? storeRow?.origin
    );
    const destination = safeStringField(
      livePayload?.destination ?? shipmentRow?.destination ?? storeRow?.destination
    );
    const reportedLoc =
      livePayload?.tracking?.currentLocation ?? livePayload?.tracking?.location ?? null;
    const currentLocation =
      validCoord(livePos) || validCoord(reportedLoc) || validCoord(lastKnownLocation) || null;

    const safeStatus = safeStringField(livePayload?.tracking?.status || status) || 'booked';
    const routeCoords = shellRouteCoords(origin, destination, currentLocation);

    const trackingData = livePayload
      ? {
          ...livePayload,
          refKey: safeStringField(livePayload.refKey ?? refKey),
          origin: safeStringField(livePayload.origin) || origin,
          destination: safeStringField(livePayload.destination) || destination,
          tracking: {
            ...(livePayload.tracking && typeof livePayload.tracking === 'object'
              ? livePayload.tracking
              : {}),
            status: safeStatus,
            currentLocation: currentLocation ?? validCoord(livePayload.tracking?.currentLocation),
            location:
              currentLocation ??
              validCoord(livePayload.tracking?.location ?? livePayload.tracking?.currentLocation)
          },
          liveTrackingMap: {
            coordinates: normalizeCoordList(
              livePayload.liveTrackingMap?.coordinates?.length
                ? livePayload.liveTrackingMap.coordinates
                : routeCoords
            )
          },
          history: Array.isArray(livePayload.history) ? livePayload.history : []
        }
      : {
          refKey: safeStringField(refKey),
          origin,
          destination,
          tracking: {
            status: safeStatus,
            currentLocation: currentLocation ?? undefined,
            locationUnavailable: !currentLocation && !origin && !destination
          },
          liveTrackingMap: { coordinates: normalizeCoordList(routeCoords) },
          history: []
        };

    return { origin, destination, currentLocation, trackingData };
  } catch {
    const origin = '';
    const destination = '';
    return {
      origin,
      destination,
      currentLocation: null,
      trackingData: {
        refKey: safeStringField(refKey),
        origin,
        destination,
        tracking: { status: 'booked', locationUnavailable: true },
        liveTrackingMap: { coordinates: [] },
        history: []
      }
    };
  }
}
