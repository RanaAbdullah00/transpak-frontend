import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

function ErrorBoundaryFallback({ error, onReset }) {
  const { t } = useLanguage();
  const showDetail = import.meta.env.DEV;

  return (
    <div className="container py-4">
      <div className="card border-0 shadow-sm rounded-xl tp-error-boundary">
        <div className="card-body">
          <h5 className="mb-2">{t('common.errorBoundaryTitle')}</h5>
          <p className="small text-muted mb-2">
            {showDetail ? t('common.errorBoundaryDevBody') : t('common.errorBoundaryBody')}
          </p>
          {showDetail ? (
            <pre className="small mb-0 tp-error-boundary__detail">
              {String(error?.message || error || 'Unknown error')}
            </pre>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm mt-3 rounded-lg" onClick={onReset}>
            {t('common.errorBoundaryRetry')}
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('TransPak UI crashed:', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
