import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

function TrackingErrorFallback({ error, onReset, compact = false }) {
  const { t } = useLanguage();
  const message = error?.message ? String(error.message) : t('pages.tracking.loadFailed');

  if (compact) {
    return (
      <div className="tp-section-error rounded-3 border p-3 mb-2" role="alert">
        <p className="small fw-semibold mb-1">{t('common.errorBoundaryTitle')}</p>
        <p className="small text-muted mb-2">{message}</p>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={onReset}>
          {t('common.errorBoundaryRetry')}
        </button>
      </div>
    );
  }

  return (
    <div className="container py-4 tp-tracking-page">
      <div className="card border-0 shadow-sm rounded-xl">
        <div className="card-body">
          <h5 className="mb-2">{t('pages.tracking.title')}</h5>
          <p className="small text-muted mb-3">{message}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onReset}>
            {t('common.errorBoundaryRetry')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Production tracking crash isolation — retry UI only, no simulated data.
 */
class TrackingSafeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[tracking] render crash', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <TrackingErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          compact={Boolean(this.props.compact)}
        />
      );
    }
    return this.props.children;
  }
}

export default TrackingSafeBoundary;
