import React from 'react';
import { Link } from 'react-router-dom';
import TrackingMap from '../shipment/TrackingMap.jsx';
import ShipmentProgressBox from '../shipment/ShipmentProgressBox.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import LifecycleBadge from '../shipment/LifecycleBadge.jsx';
import StatusTimeline from '../shipment/StatusTimeline.jsx';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isLocationFresh } from '../../utils/logisticsLifecycle.js';

/**
 * Single tracking UI for shipper + carrier dashboards (backend tracking only, progress above map).
 */
const ActiveShipmentPanel = ({
  trackingData,
  loadingTracking,
  emptyState,
  carrierAdvance = null,
  liveDriver = false,
  liveLocation = null,
  geoError = null,
  trackHref = null
}) => {
  const { t } = useLanguage();

  if (loadingTracking) {
    return (
      <div className="tp-tracking-skeleton rounded-3 border p-3">
        <div className="placeholder-glow mb-2">
          <span className="placeholder col-4 rounded" />
        </div>
        <div className="placeholder-glow mb-3" style={{ minHeight: 180 }}>
          <span className="placeholder col-12 rounded h-100 d-block" style={{ minHeight: 180 }} />
        </div>
        <div className="text-center py-2">
          <Loader />
        </div>
      </div>
    );
  }

  if (!trackingData) {
    return emptyState;
  }

  const st = trackingData.tracking?.status;
  const lifecycle = trackingData.lifecycleStage;
  const ref = trackingData.refKey;
  const href = trackHref || (ref ? `/shipments/tracking/${encodeURIComponent(ref)}` : null);
  const reportedLoc = trackingData?.tracking?.currentLocation;
  const showDriver =
    liveDriver ||
    (Array.isArray(reportedLoc) &&
      isLocationFresh(
        trackingData?.tracking?.locationUpdatedAt,
        trackingData?.ts ?? trackingData?.tracking?.ts
      ));
  const mapLocation = showDriver ? liveLocation || reportedLoc : null;

  return (
    <div className="tp-active-shipment-panel">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <LifecycleBadge stage={lifecycle || st} />
          <StatusBadge status={st || 'unknown'} />
        </div>
        {href ? (
          <Link to={href} className="btn btn-sm btn-outline-primary">
            {t('pages.dashboard.viewLiveTracking')}
          </Link>
        ) : null}
      </div>
      <ShipmentProgressBox status={st} eta={trackingData.tracking?.eta} />
      <div className="mt-3 tp-dashboard-map-preview">
        <TrackingMap
          trackingData={trackingData}
          originName={trackingData?.origin}
          destinationName={trackingData?.destination}
          currentLocation={mapLocation}
          liveDriver={liveDriver}
          geoError={geoError}
        />
      </div>
      {carrierAdvance && (
        <div className="mt-3 pt-2 border-top">
          <h6 className="mb-2">{carrierAdvance.title}</h6>
          <div className="d-grid gap-2" style={{ maxWidth: 320 }}>
            <Button
              variant="primary"
              className="py-2"
              onClick={() => carrierAdvance.upcoming && carrierAdvance.onAdvance(carrierAdvance.upcoming)}
              disabled={!carrierAdvance.upcoming || carrierAdvance.loadingStatus}
            >
              {carrierAdvance.buttonLabel}
            </Button>
          </div>
          <small className="text-muted mt-2 d-block">
            {carrierAdvance.statusLine}
          </small>
        </div>
      )}
      <div className="mt-3">
        {trackingData.history?.length > 0 ? (
          <StatusTimeline
            currentStatus={st}
            events={trackingData.history.map((h) => ({
              label: h.event,
              time: h.time,
              note: h.location,
              done: true
            }))}
          />
        ) : (
          <div className="text-muted small text-center py-3">{t('pages.trackingMap.noHistory')}</div>
        )}
      </div>
    </div>
  );
};

export default ActiveShipmentPanel;
