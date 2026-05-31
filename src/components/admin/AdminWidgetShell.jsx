import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

/**
 * Per-widget graceful degradation — never blocks the admin page shell.
 */
const AdminWidgetShell = ({
  title,
  loading = false,
  error = null,
  errorMessage = null,
  onRetry,
  children,
  className = ''
}) => {
  const { t } = useLanguage();
  const displayError = errorMessage || error;
  const showEmpty = loading && !children;
  const showErrorOnly = displayError && !children;

  return (
    <div className={className}>
      {title ? <h6 className="fw-semibold mb-3">{title}</h6> : null}
      {displayError ? (
        <div className="alert border rounded-3 mb-2 tp-bg-surface-soft" role="status">
          <p className="small text-muted mb-2">{displayError}</p>
          {onRetry ? (
            <button type="button" className="btn btn-outline-primary btn-sm rounded-lg" onClick={onRetry}>
              {t('pages.admin.tryAgain')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showEmpty ? (
        <div className="placeholder-glow" aria-busy="true">
          <span className="placeholder col-12 rounded mb-2" style={{ height: '2.5rem' }} />
          <span className="placeholder col-10 rounded mb-2" style={{ height: '2.5rem' }} />
          <span className="placeholder col-8 rounded" style={{ height: '2.5rem' }} />
        </div>
      ) : null}
      {showErrorOnly ? null : children}
    </div>
  );
};

export default AdminWidgetShell;
