import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveShipmentPanel from './ActiveShipmentPanel.jsx';
import StatusBadge from '../shipment/StatusBadge.jsx';
import { useShipmentTracking } from '../../hooks/useShipmentTracking.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getNextAllowedActions } from '../../utils/stateNormalizationEngine.js';
import {
  assertIsSnapshotConsumer,
  getUnifiedShipmentSnapshot,
  isSnapshotConsumer,
  withShipmentUILabels
} from '../../utils/shipmentUIState.js';
import {
  getOptimisticActivation,
  subscribeOptimisticActivation
} from '../../utils/contractActivationLayer.js';
import { useTrackingActive } from '../../hooks/useTrackingActive.js';
import { isValidShipmentTrackRef } from '../../utils/shipmentStatus.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { notifyApiError, notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { triggerStatusActivationSync } from '../../utils/contractActivation.js';
import {
  commitOptimisticStatusAdvance,
  resolveEffectiveShipmentStatus,
  subscribeOptimisticShipmentStatus
} from '../../utils/shipmentStatusOptimistic.js';
import { ingestFlowNotification } from '../../utils/notificationPipeline.js';
import { NOTIFICATION_KIND } from '../../utils/notificationEngine.js';
import FlowSessionBanner from '../flow/FlowSessionBanner.jsx';
import { FLOW_STATUS, FLOW_TYPE } from '../../utils/flowSession.js';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';

/**
 * Unified active shipment card — only rendered from GET /shipments/active rows.
 */
const ActiveShipmentCard = ({
  snapshot: snapshotProp = null,
  trackRef,
  label,
  assignedCarrierId = null,
  shipperId = null,
  shipperName = null,
  carrierName = null,
  shipperAvatar = null,
  carrierAvatar = null,
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
  const [, bumpOptimistic] = useState(0);

  useEffect(() => subscribeOptimisticActivation(() => bumpOptimistic((n) => n + 1)), []);
  useEffect(() => subscribeOptimisticShipmentStatus(() => bumpOptimistic((n) => n + 1)), []);

  const optimisticTs = trackRef ? getOptimisticActivation(trackRef)?.ts : 0;

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
    workspaceRole,
    optimisticTs
  ]);

  const resolvedTrackRef = snapshot.ref || trackRef;
  const resolvedStatus = snapshot.shipmentStatus ?? shipmentStatus;
  const resolvedCarrierId =
    snapshot.activeRow?.assignedCarrierId ??
    snapshot.contractFields?.assignedCarrierId ??
    assignedCarrierId;
  const resolvedFlowType = snapshot.activeRow?.flowType ?? snapshot.contractFields?.flowType ?? flowType;
  const contractActivated = Boolean(snapshot.contractActivated);
  const { trackingActive, storeRow, shipmentRow } = useTrackingActive({
    trackRef: resolvedTrackRef,
    restRow: snapshot.activeRow,
    role: workspaceRole,
    userId: user?.id ?? null
  });
  const { trackingData, uiState, loading, livePos, geoError } = useShipmentTracking({
    trackRef: resolvedTrackRef,
    assignedCarrierId: resolvedCarrierId,
    shipmentStatus: resolvedStatus,
    trackingEnabled: trackingActive,
    shareLive: shareLive && (Boolean(resolvedCarrierId) || trackingActive),
    enabled: Boolean(resolvedTrackRef) && trackingActive,
    role: workspaceRole,
    flowType: resolvedFlowType
  });

  const baseStatus = resolvedStatus ?? snapshot.shipmentStatus ?? 'booked';
  const effectiveStatus = resolveEffectiveShipmentStatus(resolvedTrackRef, baseStatus);
  const ui = useMemo(
    () => withShipmentUILabels({ ...(snapshot.uiState ?? uiState), status: effectiveStatus }, t),
    [snapshot.uiState, uiState, effectiveStatus, t]
  );
  const advanceActions = useMemo(
    () => (carrierMode ? getNextAllowedActions(effectiveStatus, { role: 'carrier' }) : []),
    [carrierMode, effectiveStatus]
  );
  const primaryAction = advanceActions[0] ?? null;
  const canRenderAdvanceButton =
    carrierMode &&
    isValidShipmentTrackRef(resolvedTrackRef) &&
    (trackingActive || Boolean(snapshot.activeRow || shipmentRow));
  const canEnableAdvance = canRenderAdvanceButton && primaryAction != null;

  useEffect(() => {
    if (trackingActive && (defaultExpanded || carrierMode || contractActivated)) {
      setExpanded(true);
    }
  }, [trackingActive, contractActivated, defaultExpanded, carrierMode]);

  const href =
    trackingActive && isValidShipmentTrackRef(resolvedTrackRef)
      ? `/shipments/tracking/${encodeURIComponent(resolvedTrackRef)}`
      : null;

  const handleAdvanceStatus = async () => {
    const step = primaryAction?.nextBackendStatus;
    if (!step || !resolvedTrackRef || !canEnableAdvance) return;
    commitOptimisticStatusAdvance(resolvedTrackRef, step, {
      label: t(primaryAction.labelKey)
    });
    setAdvancingStatus(true);
    try {
      await request({
        method: 'PUT',
        url: `/shipments/${encodeURIComponent(resolvedTrackRef)}/status`,
        data: { status: step }
      });
      notifySystem(SystemNotifyType.SUCCESS, t('pages.tracking.statusUpdated'));
      ingestFlowNotification({
        kind: NOTIFICATION_KIND.STATUS_UPDATE,
        dispatchType: 'STATUS_UPDATED',
        title: t('pages.tracking.statusUpdated'),
        message: `${resolvedTrackRef}: ${step}`,
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
          flowType={resolvedFlowType}
          status={
            resolvedFlowType === FLOW_TYPE.CAPACITY
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
          <div className="small text-muted d-flex flex-wrap align-items-center gap-1">
            <span>{resolvedTrackRef}</span>
            {carrierMode && shipperId ? (
              <ProfileAccessLayer
                userId={shipperId}
                name={shipperName}
                avatarSrc={shipperAvatar}
                className="small"
              />
            ) : null}
            {!carrierMode && assignedCarrierId ? (
              <ProfileAccessLayer
                userId={assignedCarrierId}
                name={carrierName}
                avatarSrc={carrierAvatar}
                className="small"
              />
            ) : null}
          </div>
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
            liveDriver={trackingActive && shareLive && expanded}
            liveLocation={livePos}
            geoError={geoError}
            trackHref={href}
            trackingEnabled={trackingActive}
            originName={
              trackingData?.origin || shipmentRow?.origin || storeRow?.origin || ''
            }
            destinationName={
              trackingData?.destination || shipmentRow?.destination || storeRow?.destination || ''
            }
            uiState={ui}
            carrierAdvance={
              carrierMode && trackingActive && isValidShipmentTrackRef(resolvedTrackRef)
                ? {
                    title: t('pages.tracking.updateStatus'),
                    upcoming: canEnableAdvance ? primaryAction?.nextBackendStatus : null,
                    loadingStatus: advancingStatus,
                    buttonLabel: primaryAction
                      ? t(primaryAction.labelKey)
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
