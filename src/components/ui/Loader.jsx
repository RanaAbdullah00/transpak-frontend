import React from 'react';

// Simple spinner used across the app.
const Loader = ({ light = false, size = 'sm' }) => (
  <div
    className={`spinner-border spinner-border-${size} ${
      light ? 'text-white' : 'text-primary'
    }`}
    role="status"
  >
    <span className="visually-hidden">Loading...</span>
  </div>
);

export default Loader;

