import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import FlowTimeline, { SPACE_STEPS, SPACE_STEPS_REJECTED } from '../ui/FlowTimeline.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import { spaceStepId, proposedSpacePrice } from '../../utils/spaceFlow.js';
import { translateSpaceRequestStatus } from '../../utils/i18nLabels.js';
import { formatVisibilitySummary } from '../../utils/capacityVisibility.js';
import { resolveBadgeVariantForStatus } from '../../utils/statusColorTokens.js';
import { isValidShipmentTrackRef } from '../../utils/shipmentStatus.js';
import { getTrackingRef, hasOptimisticActivation } from '../../utils/contractActivationLayer.js';
import { formatTons } from '../../utils/weightUnits.js';

const SpaceRequestLifecycle = ({
  row = {},
  onAccept,
  onReject,
  onInTransit,
  onComplete,
  showCarrierActions,
  priority = false
}) => {
  const { t } = useLanguage();
  const [eventAccepted, setEventAccepted] = useState(false);

  const rawStatus = String(row?.status || '').toLowerCase();
  const trackingRef = useMemo(
    () => getTrackingRef(row) || null,
    [
      row?.loadCode,
      row?.bridgeRef,
      row?.bridge_ref,
      row?.shipmentRef,
      row?.code,
      row?.ref,
      row?.trackRef,
      row?.booking_reference,
      row?.bookingReference
    ]
  );
  const optimisticActive = trackingRef ? hasOptimisticActivation(trackingRef) : false;

  useEffect(() => {
    const onActivated = (e) => {
      const ref = String(e?.detail?.ref || '').trim();
      const spaceRequestId = String(e?.detail?.spaceRequestId || '').trim();
      if (spaceRequestId && String(row?.id) === spaceRequestId) setEventAccepted(true);
      if (ref && trackingRef && ref === trackingRef) setEventAccepted(true);
    };
    window.addEventListener('tp:contract-activated', onActivated);
    window.addEventListener('tp:bid-updated', onActivated);
    return () => {
      window.removeEventListener('tp:contract-activated', onActivated);
      window.removeEventListener('tp:bid-updated', onActivated);
    };
  }, [row?.id, trackingRef]);

  const status = useMemo(() => {
    if (rawStatus === 'rejected') return 'rejected';
    if (eventAccepted || optimisticActive) {
      if (rawStatus === 'in_transit' || rawStatus === 'intransit') return 'in_transit';
      if (rawStatus === 'completed') return 'completed';
      return 'accepted';
    }
    return rawStatus;
  }, [rawStatus, eventAccepted, optimisticActive]);

  const stepId = spaceStepId(status);
  const usesShipmentEngine = Boolean(trackingRef) || optimisticActive || eventAccepted;
  const proposed = proposedSpacePrice(row);
  const steps = status === 'rejected' ? SPACE_STEPS_REJECTED : SPACE_STEPS;
  const badgeVariant = resolveBadgeVariantForStatus(status);

  return (
    <div className={`border rounded-3 p-3 tp-space-request-row ${priority ? 'tp-space-request-row--priority border-warning' : ''}`}>
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-1">
        <div className="fw-semibold">
          {showCarrierActions ? (
            <ProfileAccessLayer
              userId={row?.shipperId}
              name={row?.shipperName}
              avatarSrc={row?.shipperAvatar}
              showBadge
              role={t('auth.shipper')}
            />
          ) : (
            <ProfileAccessLayer
              userId={row?.carrierId}
              name={row?.carrierName}
              avatarSrc={row?.carrierAvatar}
              showBadge
              role={t('auth.carrier')}
            />
          )}{' '}
          · {formatTons(row?.requestedKg)} t
        </div>
        <Badge variant={badgeVariant}>{translateSpaceRequestStatus(t, status)}</Badge>
      </div>
      <div className="small text-muted mb-2">
        {row.origin} → {row.destination}
        {row.availableFrom ? (
          <span className="ms-2">
            · {t('loadsHub.availableFrom')}: {String(row.availableFrom).slice(0, 10)}
          </span>
        ) : null}
        {formatVisibilitySummary(row.availabilitySlots, t) ? (
          <span className="ms-2">· {formatVisibilitySummary(row.availabilitySlots, t)}</span>
        ) : null}
      </div>
      {proposed != null ? (
        <div className="small mb-2">
          <span className="text-muted">{t('loadsHub.proposedPrice')}:</span>{' '}
          <span className="fw-semibold">PKR {proposed.toLocaleString()}</span>
        </div>
      ) : null}
      {row?.message ? (
        <p className="small text-body-secondary mb-2 text-break">
          <span className="text-muted">{t('loadsHub.requestMessage')}:</span>{' '}
          <TranslatedText text={row.message} as="span" />
        </p>
      ) : null}
      {status === 'rejected' ? (
        <p className="small text-danger mb-2">{t('loadsHub.requestRejectedHint')}</p>
      ) : null}
      <FlowTimeline steps={steps} currentId={stepId} className="my-2" />
      {status === 'request_sent' && showCarrierActions ? (
        <div className="d-flex gap-2 flex-wrap">
          <Button size="sm" variant="primary" onClick={() => onAccept?.(row?.id)}>
            {t('loadsHub.acceptRequest')}
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => onReject?.(row.id)}>
            {t('loadsHub.rejectRequest')}
          </Button>
        </div>
      ) : null}
      {usesShipmentEngine &&
      isValidShipmentTrackRef(trackingRef) &&
      (status === 'accepted' || status === 'active' || status === 'in_transit') ? (
        <Link
          to={`/shipments/tracking/${encodeURIComponent(trackingRef)}`}
          className="btn btn-sm btn-primary"
        >
          {t('pages.dashboard.viewLiveTracking')}
        </Link>
      ) : null}
      {!usesShipmentEngine && (status === 'active' || status === 'accepted') ? (
        <Button size="sm" variant="primary" onClick={() => onInTransit?.(row?.id)}>
          {t('loadsHub.markInTransit')}
        </Button>
      ) : null}
      {!usesShipmentEngine && status === 'in_transit' ? (
        <Button size="sm" variant="success" onClick={() => onComplete?.(row?.id)}>
          {t('loadsHub.markComplete')}
        </Button>
      ) : null}
      {status === 'completed' ? (
        <p className="small text-muted mb-0 mt-2">{t('loadsHub.spaceCompletedHint')}</p>
      ) : null}
    </div>
  );
};

export default SpaceRequestLifecycle;
