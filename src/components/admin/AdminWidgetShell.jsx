import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Per-widget graceful degradation — never blocks the admin page shell.
 */
const AdminWidgetShell = ({
  title,
  loading = false,
  error = null,
  onRetry,
  children,
  className = ''
}) => {
  const { t } = useLanguage();

  return (
    <div className={className}>
      {title ? <h6 className="fw-semibold mb-3">{title}</h6> : null}
      {loading && !children ? (
        <div className="placeholder-glow" aria-busy="true">
          <span className="placeholder col-12 rounded mb-2" style={{ height: '2.5rem' }} />
          <span className="placeholder col-10 rounded mb-2" style={{ height: '2.5rem' }} />
          <span className="placeholder col-8 rounded" style={{ height: '2.5rem' }} />
        </div>
      ) : null}
      {error && !children ? (
        <div className="alert alert-light border rounded-3 mb-0" role="status">
          <p className="small text-muted mb-2">{t('pages.admin.widgetUnavailable')}</p>
          {onRetry ? (
            <button type="button" className="btn btn-outline-primary btn-sm rounded-lg" onClick={onRetry}>
              {t('pages.admin.tryAgain')}
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

export default AdminWidgetShell;
