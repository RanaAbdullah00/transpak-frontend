import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import Map from '../Map.jsx';
import Loader from '../ui/Loader.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeCoordList, routeFromCityNames, toLatLngPair } from '../../utils/mapCoords.js';
import { useMapRoute } from '../../hooks/useMapRoute.js';

const TrackingMap = ({
  route = [],
  currentLocation,
  trackingData = null,
  originName = '',
  destinationName = '',
  liveDriver = false,
  geoError = null,
  trackingActive = false
}) => {
  const { t, isUrdu } = useLanguage();

  const resolvedOrigin = originName || trackingData?.origin || '';
  const resolvedDestination = destinationName || trackingData?.destination || '';

  if (!trackingData && !resolvedOrigin && !resolvedDestination && !route?.length) {
    return (
      <div className="tp-map-card tp-map-card--empty rounded-3 border p-3 text-muted small" role="status">
        {t('pages.tracking.noCoords')}
      </div>
    );
  }

  const hasLiveRoute =
    normalizeCoordList(trackingData?.liveTrackingMap?.coordinates).length > 0 ||
    normalizeCoordList(route).length > 0;

  const {
    coordinates: orsCoords = [],
    loading: orsLoading = false,
    usedFallback: orsFallback = false
  } = useMapRoute({
    origin: resolvedOrigin,
    destination: resolvedDestination,
    enabled: Boolean(resolvedOrigin && resolvedDestination && !hasLiveRoute)
  });

  const coords = useMemo(() => {
    try {
      const fromData = normalizeCoordList(trackingData?.liveTrackingMap?.coordinates);
      if (fromData.length > 0) return fromData;
      const fromRoute = normalizeCoordList(route);
      if (fromRoute.length > 0) return fromRoute;
      const ors = normalizeCoordList(orsCoords);
      if (ors.length >= 2) return ors;
      return routeFromCityNames(resolvedOrigin, resolvedDestination);
    } catch {
      return [];
    }
  }, [
    trackingData?.liveTrackingMap?.coordinates,
    route,
    resolvedOrigin,
    resolvedDestination,
    orsCoords
  ]);

  const mapInvalidateKey = useMemo(
    () =>
      [
        trackingActive ? '1' : '0',
        resolvedOrigin,
        resolvedDestination,
        coords.length,
        currentLocation?.[0],
        currentLocation?.[1]
      ].join('|'),
    [trackingActive, resolvedOrigin, resolvedDestination, coords.length, currentLocation]
  );

  const hasRenderableCoords = coords.length >= 1;
  const pickup = coords.length >= 1 ? coords[0] : null;
  const delivery = coords.length >= 2 ? coords[coords.length - 1] : null;
  const rawCurrent = trackingData?.tracking?.currentLocation ?? currentLocation;
  const driverCoords = toLatLngPair(rawCurrent);
  const driverLat = driverCoords?.[0];
  const driverLng = driverCoords?.[1];
  const hasDriverCoords = driverLat != null && driverLng != null;
  const driver = useMemo(() => {
    if (hasDriverCoords) return [driverLat, driverLng];
    return null;
  }, [hasDriverCoords, driverLat, driverLng]);
  const locationUnavailable =
    Boolean(trackingData?.tracking?.locationUnavailable) && !driver && !hasDriverCoords;

  if (!hasRenderableCoords && !orsLoading && !trackingActive) {
    return (
      <Card className={`tp-map-card h-100 ${isUrdu ? 'tp-rtl' : ''}`}>
        <h6 className="mb-2">{t('pages.trackingMap.title')}</h6>
        <div
          className="tp-map-card tp-map-card--empty rounded-3 border p-4 text-center text-muted small"
          role="status"
          style={{ minHeight: 220 }}
        >
          <div className="placeholder-glow mb-3 mx-auto" style={{ maxWidth: 280 }}>
            <span className="placeholder col-12 rounded d-block" style={{ height: 120 }} />
          </div>
          <Loader />
          <p className="mb-0 mt-2">{t('pages.tracking.waitingForData')}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`tp-map-card h-100 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h6 className="mb-2">{t('pages.trackingMap.title')}</h6>
      {locationUnavailable ? (
        <div className="alert alert-warning py-2 px-3 small mb-2 mb-md-3" role="status">
          {t('pages.trackingMap.unavailable')}
        </div>
      ) : null}
      {geoError && liveDriver ? (
        <div className="alert alert-secondary py-2 px-3 small mb-2 mb-md-3" role="status">
          {t('pages.trackingMap.geoDenied')}
        </div>
      ) : null}
      <Map
        pickup={pickup}
        delivery={delivery}
        route={coords}
        driver={driver}
        liveDriver={false}
        loading={orsLoading && !hasLiveRoute}
        errorMessage={orsFallback && !hasLiveRoute && !orsLoading ? t('map.routeFallback') : ''}
        pickupLabel={t('pages.trackingMap.pickup')}
        deliveryLabel={t('pages.trackingMap.delivery')}
        forceInvalidate={trackingActive}
        invalidateKey={mapInvalidateKey}
      />
    </Card>
  );
};

export default TrackingMap;
