import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveShipmentPanel from './ActiveShipmentPanel.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { advanceStatusLabelKey } from '../../utils/shipmentAdvance.js';
import {
  assertIsSnapshotConsumer,
  getUnifiedShipmentSnapshot,
  isSnapshotConsumer,
  withShipmentUILabels
} from '../../utils/shipmentUIState.js';
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

  const snapshot = useMemo(() => {
    if (snapshotProp && isSnapshotConsumer(snapshotProp)) {
      return assertIsSnapshotConsumer(snapshotProp, 'ActiveShipmentCard');
    }
    return assertIsSnapshotConsumer(
      getUnifiedShipmentSnapshot({
        ref: trackRef,
        restRow: {
          trackRef,
          assignedCarrierId,
          shipmentStatus,
          flowType,
          trackingEnabled: trackingEnabledProp
        },
        assignedCarrierId,
        shipmentStatus,
        flowType,
        role: workspaceRole
      }),
      'ActiveShipmentCard'
    );
  }, [
    snapshotProp,
    trackRef,
    assignedCarrierId,
    shipmentStatus,
    flowType,
    trackingEnabledProp,
    workspaceRole
  ]);

  const resolvedTrackRef = snapshot.ref || trackRef;
  const resolvedStatus = snapshot.shipmentStatus ?? shipmentStatus;
  const resolvedCarrierId =
    snapshot.activeRow?.assignedCarrierId ??
    snapshot.contractFields?.assignedCarrierId ??
    assignedCarrierId;
  const resolvedFlowType = snapshot.activeRow?.flowType ?? snapshot.contractFields?.flowType ?? flowType;
  const trackingEnabled = Boolean(snapshot.tracking?.enabled);

  const { trackingData, uiState, loading, livePos, geoError } = useShipmentTracking({
    trackRef: resolvedTrackRef,
    assignedCarrierId: resolvedCarrierId,
    shipmentStatus: resolvedStatus,
    trackingEnabled,
    shareLive: shareLive && Boolean(resolvedCarrierId),
    enabled: Boolean(resolvedTrackRef),
    role: workspaceRole,
    flowType: resolvedFlowType
  });

  const ui = useMemo(
    () => withShipmentUILabels(snapshot.uiState ?? uiState, t),
    [snapshot.uiState, uiState, t]
  );
  const liveTrackingActive = Boolean(snapshot.tracking?.gate ?? ui.canTrack);
  const canRenderAdvanceButton =
    carrierMode &&
    isValidShipmentTrackRef(resolvedTrackRef) &&
    Boolean(snapshot.permissions?.canUpdateStatus ?? ui.canUpdateStatus);
  const canEnableAdvance = canRenderAdvanceButton && ui.upcomingStatus != null;

  useEffect(() => {
    if (liveTrackingActive && (defaultExpanded || carrierMode)) setExpanded(true);
  }, [liveTrackingActive, defaultExpanded, carrierMode]);

  const href =
    liveTrackingActive && isValidShipmentTrackRef(resolvedTrackRef)
      ? `/shipments/tracking/${encodeURIComponent(resolvedTrackRef)}`
      : null;

  const handleAdvanceStatus = async (next) => {
    if (!next || !resolvedTrackRef || !canEnableAdvance) return;
    setAdvancingStatus(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(resolvedTrackRef)}/status`,
        data: { status: next }
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.tracking.statusUpdated'));
      ingestFlowNotification({
        kind: NOTIFICATION_KIND.STATUS_UPDATE,
        dispatchType: 'STATUS_UPDATED',
        title: t('pages.tracking.statusUpdated'),
        message: `${resolvedTrackRef}: ${next}`,
        shipmentRef: resolvedTrackRef,
        roleType: carrierMode ? 'carrier' : 'shipper',
        soundType: 'status',
        priority: 'medium',
      });
      await triggerStatusActivationSync(resolvedTrackRef);
    } catch (err) {
      notifyApiError(err);
    } finally {
      setAdvancingStatus(false);
    }
  };

  const summary = label || trackingData?.origin
    ? `${trackingData?.origin || ''} → ${trackingData?.destination || ''}`.trim()
    : resolvedTrackRef;

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
          trackRef={resolvedTrackRef}
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
          <div className="fw-semibold text-truncate">{summary || resolvedTrackRef}</div>
          <div className="small text-muted">{resolvedTrackRef}</div>
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
              carrierMode && isValidShipmentTrackRef(resolvedTrackRef)
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
