import React, { useEffect, useRef, useState } from 'react';
import AdminActivityCard from './AdminActivityCard.jsx';
import { groupActivityByTime, formatWhen } from '../../hooks/useAdminLiveFeed.js';

function LiveBadge({ connectionState, t }) {
  const cls =
    connectionState === 'live'
      ? 'tp-admin-live-badge--live'
      : connectionState === 'retrying' || connectionState === 'degraded'
        ? 'tp-admin-live-badge--retrying'
        : 'tp-admin-live-badge--offline';
  const label =
    connectionState === 'live'
      ? t('pages.admin.liveBadge')
      : connectionState === 'retrying'
        ? t('pages.admin.liveFeedReconnecting')
        : connectionState === 'degraded'
          ? t('pages.admin.partialStatsWarning')
          : t('pages.admin.liveFeedOffline');
  return (
    <span className={`tp-admin-live-badge ${cls}`}>
      <span className="tp-admin-live-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Scrollable grouped activity timeline with LIVE indicator.
 */
const AdminLiveFeedPanel = ({
  title,
  items = [],
  locale,
  t,
  connectionState = 'live',
  loading = false,
  error = null,
  onRetry,
  markLivePulse,
  emptyMessage
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef(null);
  const groups = groupActivityByTime(items, locale);

  useEffect(() => {
    if (!autoScroll || !listRef.current) return;
    listRef.current.scrollTop = 0;
  }, [items, autoScroll]);

  const renderGroup = (key, label, groupItems) => {
    if (!groupItems.length) return null;
    return (
      <div key={key} className="tp-admin-feed-group">
        <div className="tp-admin-feed-group__label small text-muted text-uppercase fw-semibold mb-2">
          {label}
        </div>
        <ul className="list-unstyled tp-admin-activity-list mb-0">
          {groupItems.map((item) => (
            <AdminActivityCard
              key={item.id}
              label={item.label}
              detail={item.detail}
              meta={item.meta}
              timestamp={formatWhen(item.ts, locale)}
              variant={item.variant}
              pulse={markLivePulse ? markLivePulse(item) : false}
            />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="tp-admin-live-feed">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h6 className="fw-semibold mb-0">{title}</h6>
        <div className="d-flex align-items-center gap-2">
          <LiveBadge connectionState={connectionState} t={t} />
          <label className="small text-muted mb-0 d-flex align-items-center gap-1">
            <input
              type="checkbox"
              className="form-check-input m-0"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            {t('pages.admin.autoScroll')}
          </label>
        </div>
      </div>

      {error ? (
        <div className="alert border rounded-3 mb-2 tp-bg-surface-soft" role="status">
          <p className="small text-muted mb-2">{error}</p>
          {onRetry ? (
            <button type="button" className="btn btn-outline-primary btn-sm rounded-lg" onClick={onRetry}>
              {t('pages.admin.tryAgain')}
            </button>
          ) : null}
        </div>
      ) : null}

      {loading && !items.length ? (
        <div className="placeholder-glow" aria-busy="true">
          <span className="placeholder col-12 rounded mb-2" style={{ height: '3.5rem' }} />
          <span className="placeholder col-10 rounded mb-2" style={{ height: '3.5rem' }} />
          <span className="placeholder col-8 rounded" style={{ height: '3.5rem' }} />
        </div>
      ) : null}

      {!loading && !items.length && !error ? (
        <p className="small text-muted mb-0">{emptyMessage}</p>
      ) : null}

      <div ref={listRef} className="tp-admin-live-feed__scroll">
        {renderGroup('today', t('pages.admin.feedToday'), groups.today)}
        {renderGroup('yesterday', t('pages.admin.feedYesterday'), groups.yesterday)}
        {renderGroup('earlier', t('pages.admin.feedEarlier'), groups.earlier)}
      </div>
    </div>
  );
};

export default AdminLiveFeedPanel;
