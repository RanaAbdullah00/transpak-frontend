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
import TranslatedText from '../ui/TranslatedText.jsx';

/**
 * Single tracking UI for shipper + carrier dashboards (backend tracking only, progress above map).
 */
const ActiveShipmentPanel = ({
  trackingData,
  uiState = null,
  loadingTracking,
  emptyState,
  carrierAdvance = null,
  liveDriver = false,
  liveLocation = null,
  geoError = null,
  trackHref = null,
  /** From GET /shipments/active — overrides ui.canTrack for map gating */
  trackingEnabled = null
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

  const ui = uiState;
  const lifecycle = trackingData.lifecycleStage;
  const showTracking = Boolean(trackingEnabled);
  const href = showTracking && trackHref ? trackHref : null;
  const reportedLoc = trackingData?.tracking?.currentLocation ?? trackingData?.tracking?.location;
  const showDriver =
    showTracking &&
    (liveDriver ||
      (Array.isArray(reportedLoc) &&
        reportedLoc.length >= 2 &&
        Number.isFinite(Number(reportedLoc[0])) &&
        Number.isFinite(Number(reportedLoc[1]))));
  const mapLocation = showDriver ? liveLocation || reportedLoc : null;

  return (
    <div className="tp-active-shipment-panel">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <LifecycleBadge stage={lifecycle || ui?.status} />
          {ui ? <StatusBadge uiState={ui} /> : null}
        </div>
        {href ? (
          <Link to={href} className="btn btn-sm btn-outline-primary">
            {t('pages.dashboard.viewLiveTracking')}
          </Link>
        ) : null}
      </div>
      {ui?.showShipperAcceptedBanner && ui.label ? (
        <p className="small text-primary mb-2 fw-semibold">
          <TranslatedText text={ui.label} as="span" />
        </p>
      ) : null}
      {!showTracking ? (
        <p className="small text-muted mb-2">{t('pages.tracking.trackingNotActiveYet')}</p>
      ) : null}
      <ShipmentProgressBox uiState={ui} eta={trackingData.tracking?.eta} />
      {showTracking ? (
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
      ) : null}
      {carrierAdvance ? (
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
      ) : null}
      <div className="mt-3">
        {trackingData.history?.length > 0 ? (
          <StatusTimeline
            uiState={ui}
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
