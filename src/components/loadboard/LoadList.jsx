import React from 'react';
import LoadCard from './LoadCard.jsx';

// Vertical list of load cards with mobile spacing.
const LoadList = ({ loads, onBid }) => {
  const safeLoads = Array.isArray(loads) ? loads : [];
  if (!safeLoads.length) {
    return (
      <div className="text-center py-5 px-3 rounded-xl" style={{ background: 'var(--pak-light-green-bg)' }}>
        <p className="text-muted mb-0 fw-medium">No loads available</p>
        <p className="small text-muted mt-1 mb-0">Try adjusting filters or check back later.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {safeLoads.map((load) => (
        <LoadCard key={load.id} load={load} onBid={onBid} />
      ))}
    </div>
  );
};

export default LoadList;

