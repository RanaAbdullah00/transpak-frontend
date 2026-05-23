import React, { useMemo } from 'react';
import Card from '../ui/Card.jsx';
import Map from '../Map.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { normalizeCoordList, routeFromCityNames, toLatLngPair } from '../../utils/mapCoords.js';
import { isLocationFresh } from '../../utils/logisticsLifecycle.js';

const TrackingMap = ({
  route = [],
  currentLocation,
  trackingData,
  originName,
  destinationName,
  liveDriver = false,
  geoError = null
}) => {
  const { t, isUrdu } = useLanguage();

  const coords = useMemo(() => {
    const fromData = normalizeCoordList(trackingData?.liveTrackingMap?.coordinates);
    if (fromData.length > 0) return fromData;
    const fromRoute = normalizeCoordList(route);
    if (fromRoute.length > 0) return fromRoute;
    return routeFromCityNames(originName, destinationName);
  }, [trackingData?.liveTrackingMap?.coordinates, route, originName, destinationName]);

  const pickup = coords.length >= 1 ? coords[0] : null;
  const delivery = coords.length >= 2 ? coords[coords.length - 1] : null;
  const rawCurrent = trackingData?.tracking?.currentLocation ?? currentLocation;
  const fresh =
    liveDriver ||
    isLocationFresh(
      trackingData?.tracking?.locationUpdatedAt,
      trackingData?.ts ?? trackingData?.tracking?.ts
    );
  const driver = fresh ? toLatLngPair(rawCurrent) : null;
  const locationUnavailable =
    (Boolean(trackingData?.tracking?.locationUnavailable) && !driver) ||
    (!fresh && !liveDriver);

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
        pickupLabel={t('pages.trackingMap.pickup')}
        deliveryLabel={t('pages.trackingMap.delivery')}
        driverLabel={t('pages.trackingMap.driver')}
      />
    </Card>
  );
};

export default TrackingMap;
