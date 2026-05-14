import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('TransPak UI crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-4">
          <div className="card border-0 shadow-sm rounded-xl">
            <div className="card-body">
              <h5 className="mb-2">Something went wrong</h5>
              <p className="small text-muted mb-2">The UI crashed while rendering.</p>
              <pre
                className="small mb-0"
                style={{
                  whiteSpace: 'pre-wrap',
                  background: 'rgba(15, 23, 42, 0.04)',
                  padding: '10px',
                  borderRadius: '8px'
                }}
              >
                {String(this.state.error?.message || this.state.error || 'Unknown error')}
              </pre>
              <button className="btn btn-primary btn-sm mt-3 rounded-lg" onClick={this.handleReset}>
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

