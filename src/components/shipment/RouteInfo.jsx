import React from 'react';
import Card from '../ui/Card.jsx';

// Shows key route metrics for a shipment.
const RouteInfo = ({ distance, duration, checkpoints }) => (
  <Card>
    <h6 className="mb-2">Route overview</h6>
    <div className="d-flex justify-content-between small mb-2">
      <span>Distance: {distance != null && distance !== '' ? `${distance} km` : '—'}</span>
      <span>Duration: {duration != null && duration !== '' ? `${duration} hrs` : '—'}</span>
    </div>
    <ol className="small ps-3 mb-0">
      {checkpoints.map((cp) => (
        <li key={cp}>{cp}</li>
      ))}
    </ol>
  </Card>
);

export default RouteInfo;

