import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import TrackingMap from '../../components/shipment/TrackingMap.jsx';
import RouteInfo from '../../components/shipment/RouteInfo.jsx';
import ShipmentCard from '../../components/shipment/ShipmentCard.jsx';
import StatusTimeline from '../../components/shipment/StatusTimeline.jsx';
import ShipmentProgressBox from '../../components/shipment/ShipmentProgressBox.jsx';
import LifecycleBadge from '../../components/shipment/LifecycleBadge.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { isLocationFresh } from '../../utils/logisticsLifecycle.js';
import Loader from '../../components/ui/Loader.jsx';

const ShipmentTracking = () => {
  const { trackId } = useParams();
  const id = trackId?.trim() || '';
  const { user } = useAuth();
  const { t } = useLanguage();
  const isCarrier =
    user?.activeRole === 'carrier' || (user?.roles || []).includes('carrier');
  const shareLive = isCarrier && Boolean(id);

  const { trackingData: payload, loading, error, livePos, geoError } = useShipmentTracking({
    trackRef: id,
    shareLive,
    enabled: Boolean(id)
  });

  const tracking = payload?.tracking;
  const originName = payload?.origin || '';
  const destinationName = payload?.destination || '';

  const coords = useMemo(() => {
    const raw = payload?.liveTrackingMap?.coordinates || [];
    return raw
      .filter(
        (c) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(Number(c[0])) &&
          Number.isFinite(Number(c[1]))
      )
      .map((c) => [Number(c[0]), Number(c[1])]);
  }, [payload?.liveTrackingMap?.coordinates]);

  const currentLocation = useMemo(() => {
    const direct = tracking?.currentLocation ?? tracking?.location;
    if (shareLive && livePos) return livePos;
    if (
      Array.isArray(direct) &&
      direct.length >= 2 &&
      isLocationFresh(tracking?.locationUpdatedAt, payload?.ts ?? tracking?.ts)
    ) {
      return [Number(direct[0]), Number(direct[1])];
    }
    return null;
  }, [
    tracking?.currentLocation,
    tracking?.location,
    tracking?.locationUpdatedAt,
    tracking?.ts,
    shareLive,
    livePos,
    payload?.ts
  ]);

  const shipment = useMemo(
    () => ({
      code: payload?.refKey ? `#${payload.refKey}` : `#${id}`,
      origin: originName || t('common.emDash'),
      destination: destinationName || t('common.emDash'),
      status: tracking?.status || 'posted',
      driverName: t('common.emDash'),
      vehicleReg: t('common.emDash'),
      eta: tracking?.eta || t('common.emDash'),
      lastUpdate: tracking?.locationUpdatedAt || payload?.history?.[0]?.time || t('common.emDash')
    }),
    [id, payload?.refKey, tracking, payload?.history, originName, destinationName, t]
  );

  const timelineEvents = useMemo(() => {
    const h = payload?.history || [];
    return h.map((ev) => ({
      label: ev.event || ev.label || t('pages.tracking.timelineUpdate'),
      time: ev.time || '',
      done: true,
      note: ev.location
    }));
  }, [payload?.history, t]);

  const checkpoints = useMemo(() => {
    if (coords.length >= 2)
      return coords.map((_, i) => t('pages.tracking.mapPoint', { n: String(i + 1) }));
    if (coords.length === 1) return [t('pages.tracking.lastReportedPosition')];
    return [];
  }, [coords, t]);

  const trackingDataForMap = useMemo(
    () => ({
      ...payload,
      origin: originName,
      destination: destinationName,
      tracking: {
        ...tracking,
        status: tracking?.status,
        eta: tracking?.eta,
        currentLocation,
        locationUnavailable: !currentLocation && !shareLive
      },
      liveTrackingMap: payload?.liveTrackingMap || { coordinates: coords }
    }),
    [tracking, currentLocation, payload, coords, originName, destinationName, shareLive]
  );

  if (!id) {
    return (
      <div className="container py-4 tp-tracking-page">
        <h5 className="mb-3 text-body">{t('pages.tracking.title')}</h5>
        <div className="tp-empty-state rounded-3 border border-dashed p-4 text-center">
          <p className="small tp-support-muted mb-3">{t('pages.tracking.noIdHint')}</p>
          <Link to="/loads" className="btn btn-primary btn-sm">
            {t('pages.tracking.trackByCodeCta')}
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !payload) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <div className="tp-tracking-skeleton rounded-3 border p-3 mb-3">
          <div className="placeholder-glow mb-2">
            <span className="placeholder col-5 rounded" />
          </div>
          <div className="placeholder-glow" style={{ minHeight: 320 }}>
            <span className="placeholder col-12 rounded d-block h-100" style={{ minHeight: 320 }} />
          </div>
        </div>
        <Loader />
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="container py-3 tp-tracking-page">
        <h5 className="mb-3">{t('pages.tracking.title')}</h5>
        <p className="text-danger small">{error}</p>
        <Link to="/loads" className="btn btn-outline-primary btn-sm">
          {t('pages.tracking.trackByCodeCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-md-3 py-3 tp-tracking-page tp-tracking-page--live">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0">{t('pages.tracking.title')}</h5>
        <LifecycleBadge stage={payload?.lifecycleStage || shipment.status} size="lg" />
      </div>
      {error ? <p className="text-warning small mb-2">{error}</p> : null}
      <ShipmentCard shipment={shipment} />
      <div className="tp-tracking-progress mb-3">
        <ShipmentProgressBox status={shipment.status} eta={shipment.eta} />
      </div>
      <div className="tp-tracking-map tp-tracking-map--fullscreen mb-3 overflow-hidden rounded-3 border">
        <TrackingMap
          trackingData={trackingDataForMap}
          currentLocation={currentLocation}
          originName={originName}
          destinationName={destinationName}
          liveDriver={shareLive}
          geoError={geoError}
        />
      </div>
      <StatusTimeline currentStatus={shipment.status} events={timelineEvents} />
      <RouteInfo distance={null} duration={null} checkpoints={checkpoints} />
    </div>
  );
};

export default ShipmentTracking;
