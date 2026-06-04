import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveShipmentPanel from './ActiveShipmentPanel.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { advanceStatusLabelKey } from '../../utils/shipmentAdvance.js';
import { withShipmentUILabels } from '../../utils/shipmentUIState.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

/**
 * One active shipment card — isolated tracking session per ref.
 */
const ActiveShipmentCard = ({
  trackRef,
  label,
  assignedCarrierId = null,
  shareLive = false,
  carrierMode = false,
  defaultExpanded = false
}) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const { user } = useAuth();
  const workspaceRole = carrierMode ? 'carrier' : user?.activeRole === 'shipper' ? 'shipper' : null;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const { trackingData, uiState, loading, livePos, geoError } = useShipmentTracking({
    trackRef,
    assignedCarrierId,
    shareLive: shareLive && Boolean(assignedCarrierId),
    enabled: Boolean(trackRef),
    role: workspaceRole
  });

  const ui = useMemo(() => withShipmentUILabels(uiState, t), [uiState, t]);

  useEffect(() => {
    if (ui?.canTrack && (defaultExpanded || carrierMode)) setExpanded(true);
  }, [ui?.canTrack, defaultExpanded, carrierMode]);

  const href = ui.canTrack && trackRef ? `/shipments/tracking/${encodeURIComponent(trackRef)}` : null;

  const handleAdvanceStatus = async (next) => {
    if (!next || !trackRef || !ui.canUpdateStatus) return;
    setAdvancingStatus(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(trackRef)}/status`,
        data: { status: next }
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.tracking.statusUpdated'));
      emitRealtimeRefresh('shipments');
      emitRealtimeRefresh('all');
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
          {ui.label ? <StatusBadge uiState={ui} /> : null}
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
            liveDriver={ui.canTrack && shareLive && expanded}
            liveLocation={livePos}
            geoError={geoError}
            trackHref={href}
            uiState={ui}
            carrierAdvance={
              ui.canUpdateStatus
                ? {
                    title: t('pages.tracking.updateStatus'),
                    upcoming: ui.upcomingStatus,
                    loadingStatus: advancingStatus,
                    buttonLabel: t(advanceStatusLabelKey(ui.upcomingStatus)),
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
