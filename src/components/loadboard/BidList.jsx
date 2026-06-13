import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaGavel } from 'react-icons/fa';
import BidCard from './BidCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isActiveBidStatus, normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';
import {
  assertIsSnapshotConsumer,
  collectSnapshotBids,
  getUnifiedShipmentSnapshot
} from '../../utils/shipmentUIState.js';
import { mergeOptimisticBid } from '../../utils/contractActivationLayer.js';

// List of bids. mode: 'shipper' | 'carrier' controls which actions are shown.
const BidList = memo(({
  bids = [],
  onAccept,
  onReject,
  onSuggest,
  onAcceptSuggestion,
  onRejectSuggestion,
  mode = 'shipper',
  emptyMessage,
  actionsDisabled = false,
  /** loadId -> shipper UUID (carrier view) */
  shipperIdByLoadId = null,
  /** loadId -> display label for shipper row (carrier view) */
  counterpartyLabelByLoadId = null
}) => {
  const { t } = useLanguage();
  const defaultEmpty =
    mode === 'carrier' ? t('pages.bids.emptyCarrier') : t('pages.bids.emptyShipper');
  const resolvedEmpty = emptyMessage ?? defaultEmpty;
  const [bidUiTick, bumpBidUi] = useState(0);
  const lastEventKeyRef = useRef('');

  useEffect(() => {
    let pending = false;
    const onBidUpdated = (e) => {
      const bidId = String(e?.detail?.bidId || e?.detail?.spaceRequestId || '').trim();
      const status = String(e?.detail?.status || e?.type || '').trim();
      const eventKey = `${bidId}:${status}`;
      if (bidId && lastEventKeyRef.current === eventKey) return;
      if (bidId) lastEventKeyRef.current = eventKey;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        bumpBidUi((n) => n + 1);
      });
    };
    window.addEventListener('tp:bid-updated', onBidUpdated);
    window.addEventListener('tp:contract-activated', onBidUpdated);
    window.addEventListener('tp:bids-refresh', onBidUpdated);
    return () => {
      window.removeEventListener('tp:bid-updated', onBidUpdated);
      window.removeEventListener('tp:contract-activated', onBidUpdated);
      window.removeEventListener('tp:bids-refresh', onBidUpdated);
    };
  }, []);

  const bidSnapshot = useMemo(
    () =>
      assertIsSnapshotConsumer(
        getUnifiedShipmentSnapshot({
          bids: (Array.isArray(bids) ? bids : []).map((b) => mergeOptimisticBid(b || {}))
        }),
        'BidList'
      ),
    [bids, bidUiTick]
  );

  const normalizedBids = useMemo(() => {
    const seen = new Set();
    return collectSnapshotBids(bidSnapshot).filter((b) => {
      const bidId = String(b?.id || '').trim();
      if (!bidId || seen.has(bidId)) return false;
      seen.add(bidId);
      return true;
    });
  }, [bidSnapshot]);

  const { standardBids, suggestedBids, acceptedBids, rejectedBids, closedBids } = useMemo(() => {
    const standard = [];
    const suggested = [];
    const accepted = [];
    const rejected = [];
    const closed = [];
    for (const bid of normalizedBids) {
      if (!bid || typeof bid !== 'object') continue;
      const status = normalizeBidStatus(bid.status);
      if (status === BID_STATUS.ACCEPTED) {
        accepted.push(bid);
      } else if (status === BID_STATUS.REJECTED || status === BID_STATUS.CANCELLED) {
        rejected.push(bid);
      } else if (status === 'expired') {
        closed.push(bid);
      } else if (!bid.status || isActiveBidStatus(bid.status)) {
        if (isCounterOffered(bid.status)) {
          suggested.push(bid);
        } else {
          standard.push(bid);
        }
      } else {
        closed.push(bid);
      }
    }
    return {
      standardBids: standard,
      suggestedBids: suggested,
      acceptedBids: accepted,
      rejectedBids: rejected,
      closedBids: closed
    };
  }, [normalizedBids]);

  const safeStandardBids = standardBids || [];
  const safeSuggestedBids = suggestedBids || [];
  const safeAcceptedBids = acceptedBids || [];
  const safeRejectedBids = rejectedBids || [];
  const safeClosedBids = closedBids || [];
  const isShipper = mode === 'shipper';
  const isCarrier = mode === 'carrier';

  const ratingTargetFor = (bid) => {
    if (isShipper) return bid.carrierId || null;
    if (!bid.loadId || !shipperIdByLoadId) return null;
    return shipperIdByLoadId[String(bid.loadId)] || null;
  };

  return (
    <div className="mt-2">
      {safeStandardBids.length === 0 && safeSuggestedBids.length === 0 && normalizedBids.length === 0 ? (
        <EmptyState icon={FaGavel} title={resolvedEmpty} body={t('empty.bidsBody')} />
      ) : (
        <>
          {safeStandardBids.length > 0 ? (
            <>
              <h6 className="text-muted small text-uppercase mb-2">{t('pages.bids.standardBidsHeading')}</h6>
              {safeStandardBids.map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onAccept={onAccept}
                  onReject={onReject}
                  onSuggest={onSuggest}
                  onAcceptSuggestion={onAcceptSuggestion}
                  onRejectSuggestion={onRejectSuggestion}
                  isShipper={isShipper}
                  isCarrier={isCarrier}
                  actionsDisabled={actionsDisabled}
                  ratingTargetUserId={ratingTargetFor(bid)}
                  counterpartyLabel={isCarrier && bid.loadId ? counterpartyLabelByLoadId?.[String(bid.loadId)] : undefined}
                />
              ))}
            </>
          ) : null}
          {safeSuggestedBids.length > 0 ? (
            <>
              <hr className="my-3" />
              <h6 className="text-info small text-uppercase mb-2">{t('pages.bids.counterOffersHeading')}</h6>
              {safeSuggestedBids.map((bid) => (
                <BidCard
                  key={`suggested-${bid.id}`}
                  bid={bid}
                  onAccept={onAccept}
                  onReject={onReject}
                  onSuggest={onSuggest}
                  onAcceptSuggestion={onAcceptSuggestion}
                  onRejectSuggestion={onRejectSuggestion}
                  isShipper={isShipper}
                  isCarrier={isCarrier}
                  actionsDisabled={actionsDisabled}
                  ratingTargetUserId={ratingTargetFor(bid)}
                  counterpartyLabel={isCarrier && bid.loadId ? counterpartyLabelByLoadId?.[String(bid.loadId)] : undefined}
                />
              ))}
            </>
          ) : null}
          {safeRejectedBids.length > 0 && (
            <>
              <hr className="my-4" />
              <h6 className="text-danger mb-3">{t('pages.bids.rejectedBidsHeading')}</h6>
              {safeRejectedBids.map((bid) => (
                <BidCard
                  key={`rejected-${bid.id}`}
                  bid={bid}
                  isShipper={isShipper}
                  isCarrier={isCarrier}
                  ratingTargetUserId={ratingTargetFor(bid)}
                  counterpartyLabel={isCarrier && bid.loadId ? counterpartyLabelByLoadId?.[String(bid.loadId)] : undefined}
                />
              ))}
            </>
          )}
          {safeAcceptedBids.length > 0 && (
            <>
              <hr className="my-4" />
              <h6 className="text-success mb-3">{t('pages.bids.acceptedBidsHeading')}</h6>
              {safeAcceptedBids.map((bid) => (
                <BidCard
                  key={`accepted-${bid.id}`}
                  bid={bid}
                  isShipper={isShipper}
                  isCarrier={isCarrier}
                  ratingTargetUserId={ratingTargetFor(bid)}
                  counterpartyLabel={isCarrier && bid.loadId ? counterpartyLabelByLoadId?.[String(bid.loadId)] : undefined}
                />
              ))}
            </>
          )}
          {safeClosedBids.length > 0 && (
            <>
              <hr className="my-4" />
              <h6 className="text-muted mb-3">{t('pages.bids.closedBidsHeading')}</h6>
              {safeClosedBids.map((bid) => (
                <BidCard
                  key={`closed-${bid.id}`}
                  bid={bid}
                  isShipper={isShipper}
                  isCarrier={isCarrier}
                  ratingTargetUserId={ratingTargetFor(bid)}
                  counterpartyLabel={isCarrier && bid.loadId ? counterpartyLabelByLoadId?.[String(bid.loadId)] : undefined}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
});

BidList.displayName = 'BidList';

export default BidList;

