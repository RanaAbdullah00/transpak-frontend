import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Link } from 'react-router-dom';

// Shipper workflow helper: carrier approval is done by accepting a bid on a specific load.
const ApproveCarrier = () => {
  const [ack, setAck] = useState(false);

  return (
    <div className="container py-3">
      <h5 className="mb-3">Approve carrier</h5>
      <Card>
        <div className="text-muted small">
          Carrier approval is completed when you <span className="fw-semibold">accept a bid</span> on a specific load.
          This creates the booking and starts shipment tracking.
        </div>
        <div className="mt-3 d-flex gap-2 flex-wrap">
          <Link className="btn btn-primary btn-sm rounded-lg" to="/bids">
            Review bids
          </Link>
          <Link className="btn btn-outline-secondary btn-sm rounded-lg" to="/loads/manage">
            Manage loads
          </Link>
          <Button
            variant={ack ? 'success' : 'outline-success'}
            className="btn-sm rounded-lg"
            onClick={() => setAck(true)}
          >
            {ack ? 'Got it' : 'OK'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ApproveCarrier;

