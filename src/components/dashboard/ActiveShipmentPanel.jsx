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
 * Single tracking UI for shipper + carrier dashboards.
 * Visibility is controlled only by trackingEnabled (trackingActive).
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
  originName = '',
  destinationName = '',
  /** trackingActive — sole visibility gate */
  trackingEnabled = null
}) => {
  const { t } = useLanguage();
  const trackingActive = Boolean(trackingEnabled);

  if (!trackingActive) {
    return (
      emptyState ?? (
        <div className="text-muted small py-3 text-center">{t('pages.tracking.trackingNotActiveYet')}</div>
      )
    );
  }

  const data = trackingData || {
    refKey: '',
    origin: originName,
    destination: destinationName,
    tracking: {
      status: uiState?.status || 'booked',
      locationUnavailable: true
    },
    history: [],
    liveTrackingMap: { coordinates: [] }
  };

  const ui = uiState;
  const lifecycle = data.lifecycleStage;
  const href = trackHref || null;
  const reportedLoc = data?.tracking?.currentLocation ?? data?.tracking?.location;
  const showDriver =
    liveDriver ||
    (Array.isArray(reportedLoc) &&
      reportedLoc.length >= 2 &&
      Number.isFinite(Number(reportedLoc[0])) &&
      Number.isFinite(Number(reportedLoc[1])));
  const mapLocation = showDriver ? liveLocation || reportedLoc : null;
  const mapOrigin = data?.origin || originName;
  const mapDestination = data?.destination || destinationName;

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
      <ShipmentProgressBox uiState={ui} eta={data.tracking?.eta} />
      <div className="mt-3 tp-dashboard-map-preview position-relative">
        {loadingTracking ? (
          <div className="position-absolute top-0 start-0 end-0 z-1 text-center py-1">
            <Loader />
          </div>
        ) : null}
        <TrackingMap
          trackingData={{
            ...data,
            origin: mapOrigin,
            destination: mapDestination,
            tracking: {
              ...data.tracking,
              currentLocation: mapLocation,
              locationUnavailable: !mapLocation
            }
          }}
          originName={mapOrigin}
          destinationName={mapDestination}
          currentLocation={mapLocation}
          liveDriver={liveDriver}
          geoError={geoError}
          trackingActive={trackingActive}
        />
      </div>
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
        {data.history?.length > 0 ? (
          <StatusTimeline
            uiState={ui}
            events={data.history.map((h) => ({
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
