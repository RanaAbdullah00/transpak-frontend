import React from 'react';
import { Link } from 'react-router-dom';
import AdminActivityCard from './AdminActivityCard.jsx';
import { groupActivityByTime, formatWhen } from '../../hooks/useAdminLiveFeed.js';

/**
 * Static grouped activity list (no auto-scroll, no live indicator).
 */
const AdminLiveFeedPanel = ({
  title,
  headerAction = null,
  items = [],
  locale,
  t,
  loading = false,
  error = null,
  onRetry,
  emptyMessage
}) => {
  const groups = groupActivityByTime(items, locale);

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
        {headerAction ? <div className="d-flex align-items-center gap-2">{headerAction}</div> : null}
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

      <div className="tp-admin-dashboard-feed__body">
        {renderGroup('today', t('pages.admin.feedToday'), groups.today)}
        {renderGroup('yesterday', t('pages.admin.feedYesterday'), groups.yesterday)}
        {renderGroup('earlier', t('pages.admin.feedEarlier'), groups.earlier)}
      </div>
    </div>
  );
};

export default AdminLiveFeedPanel;
