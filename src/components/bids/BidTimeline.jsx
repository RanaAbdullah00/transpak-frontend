import React, { useMemo } from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isAwaitingShipper, isCounterOffered, normalizeBidStatus } from '../../utils/bidStatus.js';

const STEP_DEFS = [
  { id: 'posted', labelKey: 'bidTimeline.posted' },
  { id: 'carrier_accept', labelKey: 'bidTimeline.carrierAccept' },
  { id: 'pending_confirmation', labelKey: 'bidTimeline.pendingConfirmation' },
  { id: 'counter', labelKey: 'bidTimeline.counter', optional: true },
  { id: 'accepted', labelKey: 'bidTimeline.accepted' },
  { id: 'delivered', labelKey: 'bidTimeline.delivered' }
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
  const primary =
    bids.find((b) => normalizeBidStatus(b.status) === 'accepted') ||
    bids.find((b) => isAwaitingShipper(b.status)) ||
    bids.find((b) => isCounterOffered(b.status)) ||
    bids[0];

  const hasBid = bids.length > 0;
  const counter = bids.some((b) => isCounterOffered(b.status));
  const rejectedOnly = bids.every((b) => normalizeBidStatus(b.status) === 'rejected');
  const booked = loadStatus === 'booked' || loadStatus === 'closed';
  const delivered = loadStatus === 'closed';

  const states = {
    posted: 'success',
    carrier_accept: hasBid ? 'success' : load ? 'active' : 'pending',
    pending_confirmation: 'pending',
    counter: 'pending',
    accepted: 'pending',
    delivered: 'pending'
  };

  if (hasBid && !rejectedOnly) {
    states.carrier_accept = 'success';
    if (isCounterOffered(primary?.status)) {
      states.pending_confirmation = 'success';
      states.counter = 'active';
    } else if (isAwaitingShipper(primary?.status)) {
      states.pending_confirmation = 'active';
      states.counter = counter ? 'success' : 'pending';
    } else if (normalizeBidStatus(primary?.status) === 'accepted') {
      states.pending_confirmation = 'success';
      states.counter = counter ? 'success' : 'pending';
    }
  }

  if (booked) {
    states.pending_confirmation = 'success';
    states.counter = counter ? 'success' : 'pending';
    states.accepted = 'success';
  }
  if (delivered) {
    states.delivered = 'success';
  }
  if (rejectedOnly && !booked) {
    states.pending_confirmation = 'rejected';
  }

  const timestamps = {
    posted: load?.createdAt,
    carrier_accept: primary?.createdAt,
    pending_confirmation: primary?.createdAt,
    counter: primary?.suggestedAt || primary?.updatedAt || primary?.createdAt,
    accepted: booked ? primary?.updatedAt || primary?.createdAt : null,
    delivered: load?.updatedAt
  };

  return { states, timestamps, showCounter: counter || isCounterOffered(primary?.status) };
}

/**
 * Visual bid lifecycle for FYP demo and load detail screens.
 */
const BidTimeline = ({ load, bids = [], className = '', highlightStepId = null }) => {
  const { t, language } = useLanguage();
  const locale = language === 'ur' ? 'ur' : 'en';

  const { states, timestamps, showCounter } = useMemo(
    () => resolveStepStates({ load, bids: Array.isArray(bids) ? bids : [] }),
    [load, bids]
  );

  const steps = useMemo(
    () => STEP_DEFS.filter((s) => s.id !== 'counter' || showCounter),
    [showCounter]
  );

  return (
    <div className={`tp-bid-timeline ${className}`.trim()} role="list" aria-label={t('bidTimeline.aria')}>
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
