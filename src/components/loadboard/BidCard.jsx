import React, { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ConfirmActionModal from '../ui/ConfirmActionModal.jsx';
import UserRatingBadge from '../reviews/UserRatingBadge.jsx';
import ProfileLink from '../profile/ProfileLink.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { translateBidStatus } from '../../utils/i18nLabels.js';
import { isAwaitingShipper, isCounterOffered, isActiveBidStatus, normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';
import { formatDistanceKm } from '../../utils/formatDistance.js';

function formatHHMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Card representing a bid placed by a carrier.
const BidCard = ({
  bid,
  onAccept,
  onReject,
  onSuggest,
  onAcceptSuggestion,
  onRejectSuggestion,
  isShipper,
  isCarrier,
  actionsDisabled,
  /** UUID of counterpart for trust badge (carrier when shipper; shipper when carrier) */
  ratingTargetUserId = null,
  /** Explicit profile link target (defaults to ratingTargetUserId or bid.carrierId) */
  profileUserId = null,
  /** Optional label when carrierName is empty (carrier view) */
  counterpartyLabel = null
}) => {
  const { t } = useLanguage();

  const createdAtMs = useMemo(() => {
    const v = bid?.createdAt;
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : Date.now();
  }, [bid?.createdAt]);

  const expiresAtMs = useMemo(() => {
    const v = bid?.expiresAt;
    const d = v ? new Date(v) : null;
    if (d && !Number.isNaN(d.getTime())) return d.getTime();
    return createdAtMs + 2 * 60 * 60 * 1000;
  }, [bid?.expiresAt, createdAtMs]);

  const totalWindow = Math.max(1, Math.floor((expiresAtMs - createdAtMs) / 1000));
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
  const isExpired = remainingSeconds <= 0 || bid.status === 'expired';
  const canonStatus = normalizeBidStatus(bid.status);
  const statusBadgeLabel = isExpired
    ? t('bidCard.expired')
    : translateBidStatus(t, canonStatus);
  const progressPct = Math.max(0, Math.min(100, Math.round((remainingSeconds / totalWindow) * 100)));
  const amount = Number(bid?.amount ?? bid?.price ?? 0);
  const suggestedAmount = bid?.suggestedAmount != null ? Number(bid.suggestedAmount) : null;
  const currency = bid?.currency || 'PKR';
  const isSuggested = isCounterOffered(bid.status);
  const suggestedByShipper = isSuggested && bid?.suggestedBy === 'shipper';
  const suggestedByCarrier = isSuggested && bid?.suggestedBy === 'carrier';
  const displayAmount = suggestedAmount != null ? suggestedAmount : amount;

  const profileId = profileUserId || ratingTargetUserId || (isShipper ? bid.carrierId : bid.shipperId);
  const primaryName =
    (isShipper ? bid.carrierName : counterpartyLabel || bid.carrierName) || (isShipper ? t('auth.carrier') : t('auth.shipper'));
  const profileRole = isShipper ? t('auth.carrier') : t('auth.shipper');

  const [suggestInput, setSuggestInput] = useState('');
  const [showSuggestInput, setShowSuggestInput] = useState(false);

  const [confirmState, setConfirmState] = useState(null); // { kind: 'accept'|'reject', handler: fn }

  const showActions = isActiveBidStatus(bid.status) && !isExpired;

  const canAccept = isShipper
    ? showActions && (isAwaitingShipper(bid.status) || suggestedByCarrier) && typeof onAccept === 'function'
    : isCarrier
    ? showActions && suggestedByShipper && typeof onAcceptSuggestion === 'function'
    : false;

  const canReject = isShipper
    ? showActions &&
      (isAwaitingShipper(bid.status) || suggestedByCarrier) &&
      typeof onReject === 'function'
    : isCarrier
    ? showActions && suggestedByShipper && typeof onRejectSuggestion === 'function'
    : false;

  const canSuggest = isShipper
    ? showActions &&
      (isAwaitingShipper(bid.status) || suggestedByCarrier) &&
      typeof onSuggest === 'function'
    : isCarrier
    ? showActions &&
      (isAwaitingShipper(bid.status) || suggestedByShipper) &&
      typeof onSuggest === 'function'
    : false;

  const distRaw = bid?.distanceKm ?? bid?.distance ?? bid?.loadDistanceKm;
  const routeDistance = formatDistanceKm(distRaw, t);

  const acceptHandler = canAccept
    ? () => (isShipper ? onAccept?.(bid) : onAcceptSuggestion?.(bid))
    : null;

  const rejectHandler = canReject
    ? () => (isShipper ? onReject?.(bid) : onRejectSuggestion?.(bid))
    : null;

  useEffect(() => {
    if (actionsDisabled || !canSuggest) setShowSuggestInput(false);
    if (actionsDisabled) setConfirmState(null);
  }, [actionsDisabled, canSuggest]);

  const handleSuggestSubmit = () => {
    const val = Number(suggestInput);
    if (!Number.isNaN(val) && val >= 0 && onSuggest) {
      onSuggest(bid, val);
      setSuggestInput('');
      setShowSuggestInput(false);
    }
  };

  return (
    <Card className={`tp-bid-card ${isExpired ? 'opacity-50' : ''}`}>
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
        <div className="min-w-0 flex-grow-1 tp-min-w-12">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {profileId ? (
              <h6 className="mb-0">
                <ProfileLink userId={profileId} name={primaryName} showBadge role={profileRole} />
              </h6>
            ) : (
              <h6 className="mb-0 text-break">{primaryName}</h6>
            )}
            {profileId ? <UserRatingBadge userId={profileId} /> : null}
          </div>
          <small className="text-muted d-block text-break">
            {bid.vehicleType} · {bid.transitTime} {t('bidCard.daysSuffix')}
            {routeDistance.available ? ` · ${routeDistance.display}` : ''}
          </small>
          {!routeDistance.available && distRaw != null ? (
            <small className="text-muted d-block">{routeDistance.display}</small>
          ) : null}
        </div>
        <Badge
          variant={
            canonStatus === BID_STATUS.ACCEPTED
              ? 'success'
              : isCounterOffered(bid.status)
                ? 'info'
                : isExpired
                  ? 'secondary'
                  : 'warning'
          }
        >
          {statusBadgeLabel}
        </Badge>
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
          {bid.createdAt ? new Date(bid.createdAt).toLocaleString() : ''}
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

              {showSuggestInput ? (
                <div className="d-flex gap-2 align-items-center flex-fill">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder={t('bidCard.amountPlaceholder')}
                    value={suggestInput}
                    onChange={(e) => setSuggestInput(e.target.value)}
                    min="0"
                    step="1000"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSuggestSubmit}
                    disabled={actionsDisabled || !canSuggest}
                  >
                    {t('ui.button.submit')}
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={() => setShowSuggestInput(false)}>
                    {t('ui.button.cancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="flex-fill"
                  disabled={actionsDisabled || !canSuggest}
                  onClick={() => canSuggest && setShowSuggestInput(true)}
                >
                  {t('ui.button.suggest')}
                </Button>
              )}
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
    </Card>
  );
};

export default React.memo(BidCard);

