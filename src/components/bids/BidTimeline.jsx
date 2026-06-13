import React, { useMemo } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isAwaitingShipper, isCounterOffered, normalizeBidStatus } from '../../utils/bidStatus.js';
import { normalizeShipmentStatus } from '../../utils/shipmentStatus.js';

const STEP_DEFS = [
  { id: 'posted', labelKey: 'bidTimeline.posted' },
  { id: 'active_bidding', labelKey: 'bidTimeline.activeBidding' },
  { id: 'counter', labelKey: 'bidTimeline.counter', optional: true },
  { id: 'accepted', labelKey: 'bidTimeline.accepted' },
  { id: 'in_transit', labelKey: 'bidTimeline.inTransit' },
  { id: 'delivered', labelKey: 'bidTimeline.delivered' },
  { id: 'closed', labelKey: 'bidTimeline.closed' }
];

function formatTs(iso, locale) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-PK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function resolveStepStates({ load, bids }) {
  const loadStatus = String(load?.status || 'open').toLowerCase();
  const shipmentStatus = normalizeShipmentStatus(
    load?.shipmentStatus ?? load?.tracking?.status ?? null
  );
  const list = Array.isArray(bids) ? bids : [];
  const primary =
    list.find((b) => normalizeBidStatus(b.status) === 'accepted') ||
    list.find((b) => isAwaitingShipper(b.status)) ||
    list.find((b) => isCounterOffered(b.status)) ||
    list[0];

  const hasBid = list.length > 0;
  const counterActive = list.some((b) => isCounterOffered(b.status));
  const booked = loadStatus === 'booked' || loadStatus === 'closed';
  const delivered = loadStatus === 'closed' || shipmentStatus === 'delivered';
  const closed = loadStatus === 'closed' || shipmentStatus === 'closed';
  const inTransit =
    ['pickedup', 'intransit', 'delivered', 'closed'].includes(shipmentStatus) ||
    (booked && ['pickedup', 'intransit'].includes(shipmentStatus));

  const states = {
    posted: load ? 'success' : 'pending',
    active_bidding: 'pending',
    counter: 'pending',
    accepted: 'pending',
    in_transit: 'pending',
    delivered: 'pending',
    closed: 'pending'
  };

  if (load) {
    if (hasBid) {
      states.active_bidding = booked ? 'success' : 'success';
    } else if (loadStatus === 'open') {
      states.active_bidding = 'active';
    }
  }

  if (counterActive) {
    states.active_bidding = 'success';
    states.counter = 'active';
  } else if (hasBid && list.some((b) => b.suggestedAt || b.suggestedAmount)) {
    states.counter = 'success';
  }

  if (isAwaitingShipper(primary?.status) && !counterActive) {
    states.active_bidding = 'success';
  }

  if (booked || normalizeBidStatus(primary?.status) === 'accepted') {
    states.active_bidding = 'success';
    states.counter = counterActive ? states.counter : counterActive ? 'active' : states.counter;
    if (!counterActive && states.counter === 'pending' && list.some((b) => isCounterOffered(b.status) || b.suggestedAmount)) {
      states.counter = 'success';
    }
    states.accepted = 'success';
  }

  if (inTransit || delivered || closed) {
    states.in_transit = 'success';
  } else if (booked) {
    states.in_transit = 'active';
  }

  if (delivered || closed) {
    states.delivered = 'success';
  }

  if (closed) {
    states.closed = 'success';
  } else if (delivered) {
    states.closed = 'active';
  }

  const timestamps = {
    posted: load?.createdAt,
    active_bidding: primary?.createdAt,
    counter: primary?.suggestedAt || primary?.updatedAt || primary?.createdAt,
    accepted: booked ? primary?.updatedAt || primary?.createdAt : null,
    in_transit: load?.updatedAt,
    delivered: load?.updatedAt,
    closed: load?.updatedAt
  };

  return {
    states,
    timestamps,
    showCounter: counterActive || list.some((b) => b.suggestedAmount || isCounterOffered(b.status))
  };
}

/**
 * Bid + shipment lifecycle: Posted → Active Bidding → Counter (opt) → Accepted → In Transit → Delivered → Closed
 */
const BidTimeline = ({ load, bids = [], className = '', highlightStepId = null }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ur' ? 'ur' : 'en';

  const { states, timestamps, showCounter } = useMemo(
    () => resolveStepStates({ load, bids }),
    [load, bids]
  );

  const steps = useMemo(
    () => STEP_DEFS.filter((s) => s.id !== 'counter' || showCounter),
    [showCounter]
  );

  return (
    <div className={`tp-bid-timeline ${className}`.trim()} role="list" aria-label={t('bidTimeline.aria')}>
      <div className="small text-muted mb-2">{t('bidTimeline.title')}</div>
      {steps.map((step, index) => {
        const tone = highlightStepId === step.id ? 'active' : states[step.id] || 'pending';
        const ts = formatTs(timestamps[step.id], locale);
        return (
          <div
            key={step.id}
            className={`tp-bid-timeline__step tp-bid-timeline__step--${tone} ${
              index < steps.length - 1 ? 'tp-bid-timeline__step--has-connector' : ''
            }`}
            role="listitem"
          >
            {index < steps.length - 1 ? <span className="tp-bid-timeline__connector" aria-hidden /> : null}
            <span className="tp-bid-timeline__node" aria-hidden />
            <div className="tp-bid-timeline__content">
              <span className="tp-bid-timeline__label">{t(step.labelKey)}</span>
              {ts ? <span className="tp-bid-timeline__time text-muted small">{ts}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(BidTimeline);
