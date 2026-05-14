import React from 'react';
import BidCard from './BidCard.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

// List of bids. mode: 'shipper' | 'carrier' controls which actions are shown.
const BidList = ({
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

  const activeBids = bids.filter((bid) => !bid.status || bid.status === 'pending' || bid.status === 'suggested');
  const acceptedBids = bids.filter((bid) => bid.status === 'accepted');
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
        <p className="text-center text-muted small mt-3 py-4">{resolvedEmpty}</p>
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
        </>
      )}
    </div>
  );
};

export default BidList;

