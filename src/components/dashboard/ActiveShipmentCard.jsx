import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveShipmentPanel from './ActiveShipmentPanel.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { nextShipmentStatus, normalizeShipmentStatus } from '../../utils/shipmentStatus.js';
import { advanceStatusLabelKey } from '../../utils/shipmentAdvance.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

/**
 * One active shipment card — isolated tracking session per ref.
 */
const ActiveShipmentCard = ({
  trackRef,
  label,
  shareLive = false,
  carrierMode = false,
  defaultExpanded = false
}) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const { trackingData, loading, livePos, geoError } = useShipmentTracking({
    trackRef,
    shareLive: shareLive && expanded,
    enabled: Boolean(trackRef)
  });

  const canonStatus = normalizeShipmentStatus(trackingData?.tracking?.status || 'posted');
  const upcomingStatus = nextShipmentStatus(canonStatus);
  const href = trackRef ? `/shipments/tracking/${encodeURIComponent(trackRef)}` : null;

  const handleAdvanceStatus = async (next) => {
    if (!next || !trackRef) return;
    setAdvancingStatus(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(trackRef)}/status`,
        data: { status: next }
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.tracking.statusUpdated'));
      emitRealtimeRefresh('shipments');
    } catch (err) {
      notifyApiError(err);
    } finally {
      setAdvancingStatus(false);
    }
  };

  const summary = label || trackingData?.origin
    ? `${trackingData?.origin || ''} → ${trackingData?.destination || ''}`.trim()
    : trackRef;

  return (
    <div className="tp-active-shipment-card border rounded-3 mb-3 overflow-hidden">
      <button
        type="button"
        className="w-100 d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-0 bg-transparent text-start"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">{summary || trackRef}</div>
          <div className="small text-muted">{trackRef}</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {trackingData?.tracking?.status ? (
            <StatusBadge status={trackingData.tracking.status} />
          ) : null}
          {href ? (
            <Link
              to={href}
              className="btn btn-sm btn-outline-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {t('pages.dashboard.viewLiveTracking')}
            </Link>
          ) : null}
          <span className="small text-muted">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded ? (
        <div className="px-3 pb-3 border-top">
          <ActiveShipmentPanel
            trackingData={trackingData}
            loadingTracking={loading}
            liveDriver={shareLive && expanded}
            liveLocation={livePos}
            geoError={geoError}
            trackHref={href}
            carrierAdvance={
              carrierMode && upcomingStatus && canonStatus !== 'closed'
                ? {
                    title: t('pages.tracking.updateStatus'),
                    upcoming: upcomingStatus,
                    loadingStatus: advancingStatus,
                    buttonLabel: t(advanceStatusLabelKey(upcomingStatus)),
                    statusLine: t('pages.tracking.advanceStatus'),
                    onAdvance: handleAdvanceStatus
                  }
                : null
            }
            emptyState={
              loading ? null : (
                <div className="text-muted small py-3 text-center">{t('pages.tracking.loadFailed')}</div>
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export default ActiveShipmentCard;
