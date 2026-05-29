import React from 'react';

export default class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[admin] render error', error, info);
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="alert alert-danger rounded-3 m-3" role="alert">
          <div className="fw-semibold mb-1">Admin panel error</div>
          <p className="small mb-2">{error.message || 'Something went wrong rendering this view.'}</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
