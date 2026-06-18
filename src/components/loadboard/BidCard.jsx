import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ConfirmActionModal from '../ui/ConfirmActionModal.jsx';
import UserRatingBadge from '../reviews/UserRatingBadge.jsx';
import ProfileAccessLayer from '../profile/ProfileAccessLayer.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { translateBidStatus } from '../../utils/i18nLabels.js';
import { isAwaitingShipper, isCounterOffered, isActiveBidStatus, normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';
import { deriveBidType } from '../../utils/flowSession.js';
import { formatDistanceKm } from '../../utils/formatDistance.js';
import { getTrackingRef, mergeOptimisticBid } from '../../utils/contractActivationLayer.js';
import {
  assertIsSnapshotConsumer,
  getUnifiedShipmentSnapshot,
  resolveBidFromSnapshot
} from '../../utils/shipmentUIState.js';

function formatHHMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Card representing a bid placed by a carrier.
const BidCard = ({
  bid = {},
  onAccept,
  onReject,
  isShipper,
  isCarrier,
  actionsDisabled,
  /** UUID of counterpart for trust badge (carrier when shipper; shipper when carrier) */
  ratingTargetUserId = null,
  ratingMap = null,
  ratingsLoading = false,
  /** Explicit profile link target (defaults to ratingTargetUserId or bid.carrierId) */
  profileUserId = null,
  /** Optional label when carrierName is empty (carrier view) */
  counterpartyLabel = null
}) => {
  const { t } = useLanguage();
  const [bidUiTick, bumpBidUi] = useState(0);

  useEffect(() => {
    const refresh = (e) => {
      const bidId = String(e?.detail?.bidId || '').trim();
      const loadCode = String(e?.detail?.loadCode || e?.detail?.ref || '').trim();
      if (bidId && String(bid.id) !== bidId) return;
      if (
        !bidId &&
        loadCode &&
        String(bid.loadCode || bid.load_code || '') !== loadCode
      ) {
        return;
      }
      bumpBidUi((n) => n + 1);
    };
    window.addEventListener('tp:bid-updated', refresh);
    window.addEventListener('tp:contract-activated', refresh);
    return () => {
      window.removeEventListener('tp:bid-updated', refresh);
      window.removeEventListener('tp:contract-activated', refresh);
    };
  }, [bid.id, bid.loadCode, bid.load_code]);

  const resolvedBid = useMemo(() => {
    const mergedBid = mergeOptimisticBid(bid && typeof bid === 'object' ? bid : {});
    const snapshot = assertIsSnapshotConsumer(
      getUnifiedShipmentSnapshot({ bid: mergedBid }),
      'BidCard'
    );
    return resolveBidFromSnapshot(snapshot, bid?.id, 'BidCard');
  }, [bid, bidUiTick]);

  const createdAtMs = useMemo(() => {
    const v = resolvedBid?.createdAt;
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : Date.now();
  }, [resolvedBid?.createdAt]);

  const expiresAtMs = useMemo(() => {
    const v = resolvedBid?.expiresAt;
    const d = v ? new Date(v) : null;
    if (d && !Number.isNaN(d.getTime())) return d.getTime();
    return createdAtMs + 2 * 60 * 60 * 1000;
  }, [resolvedBid?.expiresAt, createdAtMs]);

  const totalWindow = Math.max(1, Math.floor((expiresAtMs - createdAtMs) / 1000));
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
  const isExpired = remainingSeconds <= 0 || resolvedBid?.status === 'expired';
  const canonStatus = normalizeBidStatus(resolvedBid?.status);
  const statusBadgeLabel = isExpired
    ? t('bidCard.expired')
    : translateBidStatus(t, canonStatus);
  const progressPct = Math.max(0, Math.min(100, Math.round((remainingSeconds / totalWindow) * 100)));
  const amount = Number(resolvedBid?.amount ?? resolvedBid?.price ?? 0);
  const suggestedAmount =
    resolvedBid?.suggestedAmount != null ? Number(resolvedBid.suggestedAmount) : null;
  const currency = resolvedBid?.currency || 'PKR';
  const bidType = deriveBidType(resolvedBid);
  const isSuggested = bidType === 'suggested' || isCounterOffered(resolvedBid.status);
  const suggestedByShipper = isSuggested && resolvedBid?.suggestedBy === 'shipper';
  const suggestedByCarrier = isSuggested && resolvedBid?.suggestedBy === 'carrier';
  const displayAmount = suggestedAmount != null ? suggestedAmount : amount;

  const profileId =
    profileUserId || ratingTargetUserId || (isShipper ? resolvedBid.carrierId : resolvedBid.shipperId);
  const profileAvatar = isShipper
    ? resolvedBid.carrierAvatar || resolvedBid.carrierProfileImage
    : resolvedBid.shipperAvatar || resolvedBid.shipperProfileImage;
  const primaryName =
    (isShipper ? resolvedBid.carrierName : counterpartyLabel || resolvedBid.carrierName) ||
    (isShipper ? t('auth.carrier') : t('auth.shipper'));
  const profileRole = isShipper ? t('auth.carrier') : t('auth.shipper');

  const [confirmState, setConfirmState] = useState(null); // { kind: 'accept'|'reject', handler: fn }

  const showActions = isActiveBidStatus(resolvedBid.status) && !isExpired;

  const canAccept =
    isShipper &&
    showActions &&
    (isAwaitingShipper(resolvedBid.status) || suggestedByCarrier) &&
    typeof onAccept === 'function';

  const canReject =
    isShipper &&
    showActions &&
    (isAwaitingShipper(resolvedBid.status) || suggestedByCarrier) &&
    typeof onReject === 'function';

  const distRaw = bid?.distanceKm ?? bid?.distance ?? bid?.loadDistanceKm;
  const routeDistance = formatDistanceKm(distRaw, t);

  const acceptHandler = canAccept ? () => onAccept?.(resolvedBid) : null;

  const rejectHandler = canReject ? () => onReject?.(resolvedBid) : null;

  useEffect(() => {
    if (actionsDisabled) setConfirmState(null);
  }, [actionsDisabled]);

  const isAccepted = canonStatus === BID_STATUS.ACCEPTED;
  const trackingRef = getTrackingRef(resolvedBid) || null;

  return (
    <Card className={`tp-bid-card ${isSuggested ? 'tp-bid-card--suggested border-info' : ''} ${isExpired ? 'opacity-50' : ''}`}>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
        <div className="min-w-0 flex-grow-1 tp-min-w-12">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {profileId ? (
              <h6 className="mb-0">
                <ProfileAccessLayer
                  userId={profileId}
                  name={primaryName}
                  avatarSrc={profileAvatar}
                  showBadge
                  role={profileRole}
                />
              </h6>
            ) : (
              <h6 className="mb-0 text-break">{primaryName}</h6>
            )}
            {profileId ? (
              <UserRatingBadge
                userId={profileId}
                ratingMap={ratingMap}
                loading={ratingsLoading}
              />
            ) : null}
          </div>
          <small className="text-muted d-block text-break">
            {resolvedBid.vehicleType} · {resolvedBid.transitTime} {t('bidCard.daysSuffix')}
            {routeDistance.available ? ` · ${routeDistance.display}` : ''}
          </small>
          <small className="d-flex align-items-center text-break mt-1">
            <span>{resolvedBid.origin || '—'}</span>
            <span className="mx-1" aria-hidden="true">↓</span>
            <span>{resolvedBid.destination || '—'}</span>
          </small>
          {!routeDistance.available && distRaw != null ? (
            <small className="text-muted d-block">{routeDistance.display}</small>
          ) : null}
        </div>
        <div className="d-flex flex-column align-items-end gap-1">
          {isSuggested && !isAccepted ? (
            <Badge variant="info">{t('bidCard.suggestedBidType')}</Badge>
          ) : null}
          <Badge
            variant={
              canonStatus === BID_STATUS.ACCEPTED
                ? 'success'
                : isSuggested
                  ? 'info'
                  : isExpired
                    ? 'secondary'
                    : 'warning'
            }
          >
            {statusBadgeLabel}
          </Badge>
        </div>
      </div>
      <div className="d-flex justify-content-between align-items-end mb-2">
        <div>
          <span className="h5 fw-bold text-success">
            {displayAmount.toLocaleString()} {currency}
          </span>
          {suggestedAmount != null && (
            <small className="d-block text-muted">
              {suggestedByShipper
                ? t('bidCard.youSuggested')
                : suggestedByCarrier
                ? t('bidCard.carrierSuggested')
                : t('bidCard.suggestedLabel')}
              : {suggestedAmount.toLocaleString()} {currency}
              {amount !== suggestedAmount &&
                ` (${t('bidCard.original')}: ${amount.toLocaleString()})`}
            </small>
          )}
        </div>
        <small className="text-muted">
          {resolvedBid.createdAt ? new Date(resolvedBid.createdAt).toLocaleString() : ''}
        </small>
      </div>
      <div className="mb-2">
        <div className="d-flex justify-content-between small text-muted">
          <span>{t('bidCard.expiresIn')}</span>
          <span className={isExpired ? 'text-muted' : 'fw-semibold'}>{formatHHMMSS(remainingSeconds)}</span>
        </div>
        <div className="progress tp-progress-thin">
          <div
            className={`progress-bar tp-progress-bar ${isExpired ? 'bg-secondary' : 'bg-success'}`}
            role="progressbar"
            style={{ '--tp-progress': `${progressPct}%` }}
            aria-valuenow={progressPct}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      </div>
      {showActions && (
        <>
          <div className="d-grid gap-2">
            <div className="d-grid gap-2 d-md-flex">
              <Button
                variant="success"
                size="sm"
                className="flex-fill"
                disabled={actionsDisabled || !canAccept}
                onClick={() => canAccept && setConfirmState({ kind: 'accept', handler: acceptHandler })}
              >
                {t('ui.button.accept')}
              </Button>

              <Button
                variant="outline-secondary"
                size="sm"
                className="flex-fill"
                disabled={actionsDisabled || !canReject}
                onClick={() => canReject && setConfirmState({ kind: 'reject', handler: rejectHandler })}
              >
                {t('ui.button.reject')}
              </Button>
            </div>
          </div>

          <ConfirmActionModal
            show={!!confirmState}
            title={confirmState?.kind === 'accept' ? t('ui.confirm.acceptBidTitle') : t('ui.confirm.rejectBidTitle')}
            message={confirmState?.kind === 'accept' ? t('ui.confirm.acceptBidMessage') : t('ui.confirm.rejectBidMessage')}
            confirmText={confirmState?.kind === 'accept' ? t('ui.button.accept') : t('ui.button.reject')}
            cancelText={t('ui.button.cancel')}
            onClose={() => setConfirmState(null)}
            onConfirm={confirmState?.handler}
          />
        </>
      )}
      {isExpired && (
        <small className="text-muted text-center d-block mt-2">
          {t('bidCard.bidExpiredHint')}
        </small>
      )}
      {isAccepted && trackingRef ? (
        <div className="mt-2 text-end">
          <Link
            to={`/shipments/tracking/${encodeURIComponent(trackingRef)}`}
            className="btn btn-sm btn-primary"
          >
            {t('pages.dashboard.viewLiveTracking')}
          </Link>
        </div>
      ) : null}
    </Card>
  );
};

export default React.memo(BidCard);

