import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveShipmentPanel from './ActiveShipmentPanel.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { advanceStatusLabelKey } from '../../utils/shipmentAdvance.js';
import { withShipmentUILabels } from '../../utils/shipmentUIState.js';
import { isValidShipmentTrackRef } from '../../utils/shipmentStatus.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { triggerStatusActivationSync } from '../../utils/contractActivation.js';
import { ingestFlowNotification } from '../../utils/notificationPipeline.js';
import { NOTIFICATION_KIND } from '../../utils/notificationEngine.js';
import FlowSessionBanner from '../flow/FlowSessionBanner.jsx';
import { FLOW_STATUS, FLOW_TYPE } from '../../utils/flowSession.js';

/**
 * Unified active shipment card — only rendered from GET /shipments/active rows.
 */
const ActiveShipmentCard = ({
  trackRef,
  label,
  assignedCarrierId = null,
  shipmentStatus = 'booked',
  flowType = FLOW_TYPE.BID,
  trackingEnabled: trackingEnabledProp = false,
  shareLive = false,
  carrierMode = false,
  defaultExpanded = false
}) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const { user } = useAuth();
  const stableRoleRef = useRef(null);
  if (stableRoleRef.current == null) {
    stableRoleRef.current = carrierMode
      ? 'carrier'
      : user?.activeRole === 'shipper'
        ? 'shipper'
        : user?.activeRole === 'carrier'
          ? 'carrier'
          : null;
  }
  const workspaceRole = stableRoleRef.current;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const trackingEnabled = Boolean(trackRef) && Boolean(trackingEnabledProp);

  const { trackingData, uiState, loading, livePos, geoError } = useShipmentTracking({
    trackRef,
    assignedCarrierId,
    shipmentStatus,
    trackingEnabled: trackingEnabledProp,
    shareLive: shareLive && Boolean(assignedCarrierId),
    enabled: Boolean(trackRef),
    role: workspaceRole,
    flowType
  });

  const ui = useMemo(() => withShipmentUILabels(uiState, t), [uiState, t]);
  const liveTrackingActive = Boolean(ui.unifiedContract?.trackingEnabled ?? trackingEnabled);
  const canRenderAdvanceButton =
    carrierMode && isValidShipmentTrackRef(trackRef) && ui.canUpdateStatus;
  const canEnableAdvance = canRenderAdvanceButton && ui.upcomingStatus != null;

  useEffect(() => {
    if (liveTrackingActive && (defaultExpanded || carrierMode)) setExpanded(true);
  }, [liveTrackingActive, defaultExpanded, carrierMode]);

  const href =
    liveTrackingActive && isValidShipmentTrackRef(trackRef)
      ? `/shipments/tracking/${encodeURIComponent(trackRef)}`
      : null;

  const handleAdvanceStatus = async (next) => {
    if (!next || !trackRef || !canEnableAdvance) return;
    setAdvancingStatus(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(trackRef)}/status`,
        data: { status: next }
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.tracking.statusUpdated'));
      ingestFlowNotification({
        kind: NOTIFICATION_KIND.STATUS_UPDATE,
        dispatchType: 'STATUS_UPDATED',
        title: t('pages.tracking.statusUpdated'),
        message: `${trackRef}: ${next}`,
        shipmentRef: trackRef,
        roleType: carrierMode ? 'carrier' : 'shipper',
        soundType: 'status',
        priority: 'medium',
      });
      await triggerStatusActivationSync(trackRef);
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
    <div className="tp-active-shipment-card border rounded-3 mb-3 overflow-hidden tp-animate-fade-in">
      <div className="px-3 pt-3">
        <FlowSessionBanner
          flowType={flowType}
          status={
            flowType === FLOW_TYPE.CAPACITY
              ? FLOW_STATUS.ACTIVE_CAPACITY_MATCH
              : FLOW_STATUS.ACTIVE
          }
          trackRef={trackRef}
          carrierMode={carrierMode}
        />
      </div>
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
            liveDriver={liveTrackingActive && shareLive && expanded}
            liveLocation={livePos}
            geoError={geoError}
            trackHref={href}
            trackingEnabled={liveTrackingActive}
            uiState={ui}
            carrierAdvance={
              carrierMode && isValidShipmentTrackRef(trackRef)
                ? {
                    title: t('pages.tracking.updateStatus'),
                    upcoming: canEnableAdvance ? ui.upcomingStatus : null,
                    loadingStatus: advancingStatus,
                    buttonLabel: ui.upcomingStatus
                      ? t(advanceStatusLabelKey(ui.upcomingStatus))
                      : t('pages.tracking.updateStatus'),
                    statusLine: t('pages.tracking.advanceStatus'),
                    onAdvance: handleAdvanceStatus
                  }
                : null
            }
            emptyState={
              loading ? null : (
                <div className="text-muted small py-3 text-center">{t('pages.tracking.waitingForData')}</div>
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export default ActiveShipmentCard;
