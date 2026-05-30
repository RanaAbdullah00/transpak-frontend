import React, { memo, useMemo } from 'react';
import { FaGavel } from 'react-icons/fa';
import BidCard from './BidCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isActiveBidStatus, normalizeBidStatus, BID_STATUS } from '../../utils/bidStatus.js';

// List of bids. mode: 'shipper' | 'carrier' controls which actions are shown.
const BidList = memo(({
  bids,
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

  const { activeBids, acceptedBids, closedBids } = useMemo(() => {
    const active = [];
    const accepted = [];
    const closed = [];
    for (const bid of Array.isArray(bids) ? bids : []) {
      const status = normalizeBidStatus(bid.status);
      if (status === BID_STATUS.ACCEPTED) {
        accepted.push(bid);
      } else if (!bid.status || isActiveBidStatus(bid.status)) {
        active.push(bid);
      } else {
        closed.push(bid);
      }
    }
    return { activeBids: active, acceptedBids: accepted, closedBids: closed };
  }, [bids]);
  const isShipper = mode === 'shipper';
  const isCarrier = mode === 'carrier';

  const ratingTargetFor = (bid) => {
    if (isShipper) return bid.carrierId || null;
    if (!bid.loadId || !shipperIdByLoadId) return null;
    return shipperIdByLoadId[String(bid.loadId)] || null;
  };

  return (
    <div className="mt-2">
      {activeBids.length === 0 && bids.length === 0 ? (
        <EmptyState icon={FaGavel} title={resolvedEmpty} body={t('empty.bidsBody')} />
      ) : (
        <>
          {activeBids.map((bid) => (
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
          {acceptedBids.length > 0 && (
            <>
              <hr className="my-4" />
              <h6 className="text-success mb-3">{t('pages.bids.acceptedBidsHeading')}</h6>
              {acceptedBids.map((bid) => (
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
          {closedBids.length > 0 && (
            <>
              <hr className="my-4" />
              <h6 className="text-muted mb-3">{t('pages.bids.closedBidsHeading')}</h6>
              {closedBids.map((bid) => (
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

