import React from 'react';
import { FaMapMarkerAlt, FaCube, FaWeightHanging } from 'react-icons/fa';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import UserRatingBadge from '../reviews/UserRatingBadge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import CarrierLoadActions from './CarrierLoadActions.jsx';
import { formatLoadDisplayId } from '../../utils/displayId.js';
import { formatDistanceKm } from '../../utils/formatDistance.js';

// Card representing a single load in the marketplace.
const LoadCard = ({
  load,
  onBid,
  carrierMode = false,
  onCarrierAccept,
  onCarrierCounter,
  onCarrierReject,
  carrierBusy = false
}) => {
  const { t } = useLanguage();
  const expectedPrice = Number(load?.expectedPrice ?? 0);
  const distance = formatDistanceKm(load?.distance ?? load?.distanceKm, t).display;
  const shipperId = load?.shipperId || null;
  const deadlineMs = load?.deadline ? new Date(load.deadline).getTime() : null;
  const isDeadlinePast = deadlineMs != null && !Number.isNaN(deadlineMs) && Date.now() > deadlineMs;
  const statusRaw = String(load?.status || '').toLowerCase();
  const bidCount = Number(load?.bidCount ?? load?.bid_count ?? 0);
  const statusLabel =
    statusRaw === 'open'
      ? bidCount > 0
        ? t('pages.loads.statusBidding')
        : t('pages.loads.statusPosted')
      : statusRaw === 'booked'
      ? t('pages.pipeline.booked')
      : statusRaw === 'closed'
      ? t('pages.pipeline.closed')
      : statusRaw === 'delivered'
      ? t('pages.pipeline.delivered')
      : load?.status || '—';

  return (
    <Card className="tp-load-card" hover>
      <div className="d-flex justify-content-between align-items-start mb-2 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h6 className="mb-1 text-break">
              <TranslatedText text={load.cargo} />
            </h6>
            {shipperId ? <UserRatingBadge userId={shipperId} /> : null}
          </div>
          <small className="text-muted d-block text-break">
            {t('pages.loads.loadCardRef', { code: formatLoadDisplayId(load) })}
          </small>
        </div>
        <Badge variant={load.status === 'open' ? 'success' : 'secondary'}>{statusLabel}</Badge>
      </div>
      <div className="d-flex flex-column small mb-2">
        <span className="d-flex align-items-center mb-1 text-break">
          <FaMapMarkerAlt className="text-primary me-2 flex-shrink-0" />
          <TranslatedText text={load.origin} /> → <TranslatedText text={load.destination} />
        </span>
        <span className="d-flex align-items-center mb-1 text-break">
          <FaWeightHanging className="text-secondary me-2 flex-shrink-0" />
          {load.weight} {t('pages.loads.loadCardTons')} · <TranslatedText text={load.vehicleType} />
        </span>
        <span className="d-flex align-items-center text-break">
          <FaCube className="text-secondary me-2 flex-shrink-0" />
          {t('pages.loads.loadCardDistancePrice', {
            distance,
            price: expectedPrice.toLocaleString()
          })}
        </span>
      </div>
      <div className="d-flex justify-content-between align-items-start mb-2 gap-2 flex-wrap">
        <small className="text-muted">
          {t('pages.loads.loadCardPickup')}: {load.pickupDate}
        </small>
        {load.deadline && (
          <Badge variant={isDeadlinePast ? 'secondary' : 'warning'}>
            {isDeadlinePast ? t('pages.loads.loadCardExpired') : t('pages.loads.loadCardBiddingOpen')}
          </Badge>
        )}
      </div>
      {carrierMode ? (
        <CarrierLoadActions
          load={load}
          onAccept={onCarrierAccept}
          onCounter={onCarrierCounter}
          onReject={onCarrierReject}
          busy={carrierBusy}
          disabled={Boolean(load.deadline && isDeadlinePast) || load.status !== 'open'}
        />
      ) : null}
      {!carrierMode && onBid ? (
        <div className="mt-auto">
          <Button
            variant="primary"
            className="w-100 btn-sm rounded-lg tp-btn-glow"
            onClick={() => onBid(load)}
            disabled={Boolean(load.deadline && isDeadlinePast)}
          >
            {load.deadline && isDeadlinePast
              ? t('pages.loads.loadCardBiddingClosed')
              : t('pages.loads.loadCardPlaceBid')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
};

export default React.memo(LoadCard);
