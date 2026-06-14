import React, { useMemo } from 'react';
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
import {
  mergeShipmentTimelineEvents,
  resolveEffectiveShipmentStatus
} from '../../utils/shipmentStatusOptimistic.js';
import { normalizeCoordList, safeStringField } from '../../utils/mapCoords.js';

/**
 * Single tracking UI for shipper + carrier dashboards.
 * variant="summary" — dashboard card expand (no map/timeline/advance).
 * variant="full" — tracking page layout.
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
  trackingEnabled = null,
  variant = 'full'
}) => {
  const { t } = useLanguage();
  const trackingActive = Boolean(trackingEnabled);
  const summaryMode = variant === 'summary';

  const raw = trackingData && typeof trackingData === 'object' ? trackingData : null;
  const data = {
    refKey: safeStringField(raw?.refKey),
    origin: safeStringField(raw?.origin ?? originName),
    destination: safeStringField(raw?.destination ?? destinationName),
    lifecycleStage: raw?.lifecycleStage ?? null,
    tracking: {
      status: raw?.tracking?.status ?? uiState?.status ?? 'booked',
      currentLocation: raw?.tracking?.currentLocation ?? raw?.tracking?.location ?? null,
      locationUnavailable: raw?.tracking?.locationUnavailable ?? true,
      eta: raw?.tracking?.eta ?? null
    },
    history: Array.isArray(raw?.history) ? raw.history : [],
    liveTrackingMap: {
      coordinates: normalizeCoordList(raw?.liveTrackingMap?.coordinates)
    }
  };

  const ui = uiState;
  const effectiveStatus = resolveEffectiveShipmentStatus(
    data.refKey || trackHref || '',
    ui?.status || data?.tracking?.status || 'booked'
  );
  const uiForDisplay = ui ? { ...ui, status: effectiveStatus } : { status: effectiveStatus };
  const timelineEvents = useMemo(() => {
    if (summaryMode) return [];
    try {
      const { events } = mergeShipmentTimelineEvents(data.refKey || trackHref || '', data.history, {
        apiStatus: ui?.status || data?.tracking?.status,
        fallbackLabel: t('pages.tracking.timelineUpdate'),
        updatedAt: raw?.tracking?.locationUpdatedAt || data.history?.[data.history.length - 1]?.time
      });
      return events;
    } catch {
      return [];
    }
  }, [summaryMode, data.refKey, data.history, data.tracking?.status, trackHref, ui?.status, raw?.tracking?.locationUpdatedAt, t]);

  if (!trackingActive) {
    return (
      emptyState ?? (
        <div className="text-muted small py-3 text-center">{t('pages.tracking.trackingNotActiveYet')}</div>
      )
    );
  }

  if (summaryMode) {
    return (
      <div className="tp-active-shipment-panel tp-active-shipment-panel--summary">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <LifecycleBadge stage={data.lifecycleStage || ui?.status} />
          {ui ? <StatusBadge uiState={uiForDisplay} /> : null}
        </div>
        {ui?.showShipperAcceptedBanner && ui.label ? (
          <p className="small text-primary mb-2 fw-semibold">
            <TranslatedText text={ui.label} as="span" />
          </p>
        ) : null}
        <ShipmentProgressBox uiState={uiForDisplay} eta={data.tracking?.eta} />
        <p className="small text-muted mb-0 mt-2">{t('pages.dashboard.trackingSummaryHint')}</p>
      </div>
    );
  }

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
          {ui ? <StatusBadge uiState={uiForDisplay} /> : null}
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
              ...(data.tracking || {}),
              currentLocation: mapLocation ?? null,
              locationUnavailable: !mapLocation
            },
            liveTrackingMap: data.liveTrackingMap ?? { coordinates: [] }
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
        <StatusTimeline
          uiState={uiForDisplay}
          currentStatus={effectiveStatus}
          events={timelineEvents}
        />
      </div>
    </div>
  );
};

export default ActiveShipmentPanel;
