import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';
import { isDebugErrorsEnabled } from '../../utils/mapError.js';
import { sanitizeProductText } from '../../utils/userErrors.js';

function ErrorBoundaryFallback({ error, onReset }) {
  const { t } = useLanguage();
  const showDetail = isDebugErrorsEnabled();
  const friendly =
    sanitizeProductText(error?.message) ||
    t('common.errorBoundaryBody');

  return (
    <div className="container py-4">
      <div className="card border-0 shadow-sm rounded-xl tp-error-boundary">
        <div className="card-body">
          <h5 className="mb-2">{t('common.errorBoundaryTitle')}</h5>
          <p className="small text-muted mb-2">{friendly}</p>
          {showDetail ? (
            <pre className="small mb-0 tp-error-boundary__detail">
              {String(error?.message || error || 'Unknown render error')}
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
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ui] render crash', error, info);
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
