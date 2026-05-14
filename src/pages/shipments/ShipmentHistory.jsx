import React from 'react';

// Historical list of completed shipments.
const ShipmentHistory = () => {
  return (
    <div className="container py-3">
      <h5 className="mb-3">Shipment history</h5>
      <div className="text-center py-5 px-3 rounded-xl" style={{ background: 'var(--pak-light-green-bg)' }}>
        <p className="text-muted mb-0 fw-medium">No shipment history yet</p>
        <p className="small text-muted mt-1 mb-0">
          Completed shipments will appear here after deliveries are marked as <span className="fw-semibold">Closed</span>.
        </p>
      </div>
    </div>
  );
};

export default ShipmentHistory;

