import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useReceivedRatingSummary } from '../../hooks/useReceivedRatingSummary.js';

/**
 * Compact star + average for bid cards / lists (counterparty trust signal).
 */
const UserRatingBadge = ({ userId, className = '' }) => {
  const { t } = useLanguage();
  const { avg, count, loading } = useReceivedRatingSummary(userId);

  if (!userId) return null;

  if (loading) {
    return (
      <span className={`tp-rating-badge tp-rating-badge--loading ${className}`.trim()} aria-hidden>
        ★ …
      </span>
    );
  }

  if (!count || avg == null) {
    return (
      <span
        className={`tp-rating-badge tp-rating-badge--muted ${className}`.trim()}
        title={t('reviews.noReviewsYetShort')}
      >
        ★ <span className="tp-rating-badge__dash">—</span>
      </span>
    );
  }

  const label = t('reviews.avgShort', { avg: avg.toFixed(1), count });
  return (
    <span className={`tp-rating-badge ${className}`.trim()} title={label}>
      ★ <span className="tp-rating-badge__num">{avg.toFixed(1)}</span>
      <span className="tp-rating-badge__count">({count})</span>
    </span>
  );
};

export default UserRatingBadge;
