import React from 'react';
import { sanitizeProductText } from '../../utils/userErrors.js';
import { isDebugErrorsEnabled } from '../../utils/mapError.js';

function adminBoundaryMessage(error) {
  const raw = sanitizeProductText(error?.message) || '';
  if (raw) return raw;
  if (isDebugErrorsEnabled() && error?.message) {
    return String(error.message).slice(0, 200);
  }
  return 'This admin section failed to load. Please try again.';
}

export default class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[admin] render crash', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="alert alert-danger rounded-3 m-3" role="alert">
          <div className="fw-semibold mb-1">Admin section unavailable</div>
          <p className="small mb-2">{adminBoundaryMessage(error)}</p>
          {isDebugErrorsEnabled() && error?.message ? (
            <pre className="small mb-2">{String(error.message).slice(0, 400)}</pre>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
